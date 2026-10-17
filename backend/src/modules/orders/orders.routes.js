const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

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
    res.status(500).json({ error: dbError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await pool.query(`
      SELECT o.*, c.name AS customer_name
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!order.rows[0]) return res.status(404).json({ error: 'Order not found.' });
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
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { customer_id, notes, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required.' });
  for (const item of items) {
    if ((item.quantity || 0) <= 0) return res.status(400).json({ error: 'Item quantity must be greater than 0.' });
    if ((item.unit_price || 0) < 0) return res.status(400).json({ error: 'Item price cannot be negative.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
    const { rows } = await client.query(
      'INSERT INTO orders (customer_id, notes, total_amount) VALUES ($1,$2,$3) RETURNING *',
      [customer_id || null, notes, total]
    );
    const order = rows[0];
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, item_id, custom_item_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [order.id, item.item_id || null, item.item_id ? null : (item.item_name || null), item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: dbError(err) });
  } finally {
    client.release();
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { customer_id, notes, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required.' });
  for (const item of items) {
    if ((item.quantity || 0) <= 0) return res.status(400).json({ error: 'Item quantity must be greater than 0.' });
    if ((item.unit_price || 0) < 0) return res.status(400).json({ error: 'Item price cannot be negative.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
    const { rows } = await client.query(
      'UPDATE orders SET customer_id=$1, notes=$2, total_amount=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [customer_id || null, notes, total, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found.' }); }
    await client.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id]);
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, item_id, custom_item_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, item.item_id || null, item.item_id ? null : (item.item_name || null), item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: dbError(err) });
  } finally {
    client.release();
  }
});

router.patch('/:id/payment', requireRole('admin', 'manager'), async (req, res) => {
  let { payment_status, amount_paid } = req.body;
  const valid = ['unpaid', 'paid', 'partial'];
  if (!valid.includes(payment_status)) return res.status(400).json({ error: `Invalid payment status. Must be one of: ${valid.join(', ')}.` });
  // M-1: validate amount_paid is a finite number
  if (amount_paid !== undefined) {
    const parsed = parseFloat(amount_paid);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return res.status(400).json({ error: 'amount_paid must be a finite number.' });
    }
  }
  // M-8: wrap SELECT + UPDATE in a transaction to prevent TOCTOU race
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (amount_paid !== undefined) {
      const order = await client.query('SELECT total_amount FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (order.rows[0]) {
        const total = parseFloat(order.rows[0].total_amount);
        const paid  = parseFloat(amount_paid);
        if (paid <= 0)          payment_status = 'unpaid';
        else if (paid >= total) { payment_status = 'paid'; amount_paid = total; }
        else                    payment_status = 'partial';
      }
    }
    const amtPaid = amount_paid !== undefined ? parseFloat(amount_paid) : null;
    const { rows } = await client.query(
      `UPDATE orders SET payment_status=$1, ${amtPaid !== null ? 'amount_paid=$2,' : ''} updated_at=NOW() WHERE id=$${amtPaid !== null ? 3 : 2} RETURNING *`,
      amtPaid !== null ? [payment_status, amtPaid, req.params.id] : [payment_status, req.params.id]
    );
    await client.query('COMMIT');
    if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: dbError(err) });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', requireRole('admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}.` });
  try {
    const { rows } = await pool.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    // M-5: block deletion of completed/delivered orders to preserve audit trail
    const check = await pool.query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Order not found.' });
    if (check.rows[0].status === 'delivered') {
      return res.status(400).json({ error: 'Delivered orders cannot be deleted. They are part of the financial audit trail.' });
    }
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
