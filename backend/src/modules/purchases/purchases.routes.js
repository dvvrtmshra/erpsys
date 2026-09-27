const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, s.name AS supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const purchase = await pool.query(`
      SELECT p.*, s.name AS supplier_name
      FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!purchase.rows[0]) return res.status(404).json({ error: 'Not found' });
    const items = await pool.query(`
      SELECT pi.*, ci.name AS item_name, ci.sku
      FROM purchase_items pi JOIN catalog_items ci ON ci.id = pi.item_id
      WHERE pi.purchase_id = $1
    `, [req.params.id]);
    res.json({ ...purchase.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { supplier_id, notes, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = (items || []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const { rows } = await client.query(
      'INSERT INTO purchases (supplier_id, notes, total_amount) VALUES ($1,$2,$3) RETURNING *',
      [supplier_id, notes, total]
    );
    const purchase = rows[0];
    for (const item of (items || [])) {
      await client.query(
        'INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
        [purchase.id, item.item_id, item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(purchase);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE purchases SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
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
    await pool.query('DELETE FROM purchases WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
