const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*, c.name AS customer_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await pool.query(`
      SELECT o.*, c.name AS customer_name
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!order.rows[0]) return res.status(404).json({ error: 'Not found' });
    const items = await pool.query(`
      SELECT oi.*,
        COALESCE(ci.name, oi.custom_item_name) AS item_name,
        ci.catalog_number, ci.category
      FROM order_items oi
      LEFT JOIN catalog_items ci ON ci.id = oi.item_id
      WHERE oi.order_id = $1
    `, [req.params.id]);
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { customer_id, notes, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = (items || []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const { rows } = await client.query(
      'INSERT INTO orders (customer_id, notes, total_amount) VALUES ($1,$2,$3) RETURNING *',
      [customer_id, notes, total]
    );
    const order = rows[0];
    for (const item of (items || [])) {
      await client.query(
        'INSERT INTO order_items (order_id, item_id, custom_item_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [order.id, item.item_id || null, item.item_id ? null : (item.item_name || null), item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { customer_id, notes, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = (items || []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const { rows } = await client.query(
      'UPDATE orders SET customer_id=$1, notes=$2, total_amount=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [customer_id || null, notes, total, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id]);
    for (const item of (items || [])) {
      await client.query(
        'INSERT INTO order_items (order_id, item_id, custom_item_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, item.item_id || null, item.item_id ? null : (item.item_name || null), item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
