const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

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
    res.status(500).json({ error: dbError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const purchase = await pool.query(`
      SELECT p.*, s.name AS supplier_name, s.contact_person AS supplier_contact,
             s.phone AS supplier_phone, s.email AS supplier_email
      FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!purchase.rows[0]) return res.status(404).json({ error: 'Purchase order not found.' });
    const items = await pool.query(`
      SELECT pi.*,
        COALESCE(ci.name, pi.custom_item_name) AS item_name,
        ci.catalog_number, ci.category,
        COALESCE(ci.unit, 'unit') AS unit
      FROM purchase_items pi
      LEFT JOIN catalog_items ci ON ci.id = pi.item_id
      WHERE pi.purchase_id = $1
    `, [req.params.id]);
    res.json({ ...purchase.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { supplier_id, notes, items } = req.body;
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
      'INSERT INTO purchases (supplier_id, notes, total_amount) VALUES ($1,$2,$3) RETURNING *',
      [supplier_id || null, notes, total]
    );
    const purchase = rows[0];
    for (const item of items) {
      await client.query(
        'INSERT INTO purchase_items (purchase_id, item_id, custom_item_name, item_type, quantity, unit_price) VALUES ($1,$2,$3,$4,$5,$6)',
        [purchase.id, item.item_id || null, item.item_id ? null : (item.item_name || null), item.item_type || 'catalog', item.quantity, item.unit_price]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(purchase);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: dbError(err) });
  } finally {
    client.release();
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { supplier_id, notes, items } = req.body;
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
      'UPDATE purchases SET supplier_id=$1, notes=$2, total_amount=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [supplier_id || null, notes, total, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Purchase order not found.' }); }
    await client.query('DELETE FROM purchase_items WHERE purchase_id=$1', [req.params.id]);
    for (const item of items) {
      await client.query(
        'INSERT INTO purchase_items (purchase_id, item_id, custom_item_name, item_type, quantity, unit_price) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.params.id, item.item_id || null, item.item_id ? null : (item.item_name || null), item.item_type || 'catalog', item.quantity, item.unit_price]
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
  try {
    if (amount_paid !== undefined) {
      const po = await pool.query('SELECT total_amount FROM purchases WHERE id=$1', [req.params.id]);
      if (po.rows[0]) {
        const total = parseFloat(po.rows[0].total_amount);
        const paid  = parseFloat(amount_paid);
        if (paid <= 0)         payment_status = 'unpaid';
        else if (paid >= total) { payment_status = 'paid'; amount_paid = total; }
        else                   payment_status = 'partial';
      }
    }
    const amtPaid = amount_paid !== undefined ? parseFloat(amount_paid) : null;
    const { rows } = await pool.query(
      `UPDATE purchases SET payment_status=$1, ${amtPaid !== null ? 'amount_paid=$2,' : ''} updated_at=NOW() WHERE id=$${amtPaid !== null ? 3 : 2} RETURNING *`,
      amtPaid !== null ? [payment_status, amtPaid, req.params.id] : [payment_status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.patch('/:id/status', requireRole('admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'ordered', 'received', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}.` });
  try {
    const { rows } = await pool.query(
      'UPDATE purchases SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM purchases WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
