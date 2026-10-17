const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM tender_suppliers ts WHERE ts.tender_id = t.id) AS supplier_count,
        (SELECT COUNT(*) FROM tender_items ti WHERE ti.tender_id = t.id) AS item_count
      FROM tenders t
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenders WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Tender not found.' });
    const { rows: suppliers } = await pool.query(`
      SELECT ts.id, ts.supplier_id, ts.material_notes, s.name AS supplier_name
      FROM tender_suppliers ts
      JOIN suppliers s ON s.id = ts.supplier_id
      WHERE ts.tender_id = $1
    `, [req.params.id]);
    const { rows: items } = await pool.query(`
      SELECT ti.id, ti.item_id, ti.quantity_needed, ti.notes,
             c.name AS item_name, c.catalog_number, c.unit,
             COALESCE(inv.quantity, 0) AS stock_qty
      FROM tender_items ti
      JOIN catalog_items c ON c.id = ti.item_id
      LEFT JOIN inventory inv ON inv.catalog_item_id = ti.item_id
      WHERE ti.tender_id = $1
    `, [req.params.id]);
    res.json({ ...rows[0], suppliers, items });
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

const VALID_TENDER_TYPES = ['public', 'private', 'government'];
const VALID_TENDER_STATUSES = ['open', 'bidding', 'awarded', 'in_progress', 'completed', 'cancelled'];

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { title, description, tender_type, issued_by, deadline, budget } = req.body;
  if (!title) return res.status(400).json({ error: 'Tender title is required.' });
  if (tender_type && !VALID_TENDER_TYPES.includes(tender_type)) {
    return res.status(400).json({ error: `tender_type must be one of: ${VALID_TENDER_TYPES.join(', ')}.` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tenders (title, description, tender_type, issued_by, deadline, budget)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, description, tender_type || 'private', issued_by || null, deadline || null, budget || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { title, description, tender_type, issued_by, awarded_to, status, deadline, budget, suppliers, items } = req.body;
  if (!title) return res.status(400).json({ error: 'Tender title is required.' });
  if (tender_type && !VALID_TENDER_TYPES.includes(tender_type)) {
    return res.status(400).json({ error: `tender_type must be one of: ${VALID_TENDER_TYPES.join(', ')}.` });
  }
  if (status && !VALID_TENDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_TENDER_STATUSES.join(', ')}.` });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE tenders SET title=$1, description=$2, tender_type=$3, issued_by=$4, awarded_to=$5,
       status=$6, deadline=$7, budget=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [title, description, tender_type, issued_by || null, awarded_to || null,
       status, deadline || null, budget || null, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Tender not found.' }); }

    if (Array.isArray(suppliers)) {
      await client.query('DELETE FROM tender_suppliers WHERE tender_id = $1', [req.params.id]);
      for (const s of suppliers) {
        if (s.supplier_id) {
          await client.query(
            'INSERT INTO tender_suppliers (tender_id, supplier_id, material_notes) VALUES ($1,$2,$3)',
            [req.params.id, s.supplier_id, s.material_notes || null]
          );
        }
      }
    }
    if (Array.isArray(items)) {
      await client.query('DELETE FROM tender_items WHERE tender_id = $1', [req.params.id]);
      for (const item of items) {
        if (item.item_id) {
          // L-6: reject negative quantity_needed
          const qty = parseFloat(item.quantity_needed) || 0;
          if (qty < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'quantity_needed cannot be negative.' }); }
          await client.query(
            'INSERT INTO tender_items (tender_id, item_id, quantity_needed, notes) VALUES ($1,$2,$3,$4)',
            [req.params.id, item.item_id, qty, item.notes || null]
          );
        }
      }
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

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tenders WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Tender not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
