const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
             c.catalog_number, c.category, c.unit_price
      FROM inventory i
      LEFT JOIN catalog_items c ON c.id = i.catalog_item_id
      ORDER BY i.type, i.item_name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.get('/available-catalog', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.catalog_number, c.name, c.category, c.unit, c.unit_price
      FROM catalog_items c
      WHERE c.id NOT IN (
        SELECT catalog_item_id FROM inventory
        WHERE type = 'finished_good' AND catalog_item_id IS NOT NULL
      )
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { type, catalog_item_id, item_name, description, unit, quantity, location } = req.body;
  if (!item_name) return res.status(400).json({ error: 'Item name is required.' });
  if (quantity !== undefined && isNaN(parseInt(quantity))) return res.status(400).json({ error: 'Quantity must be a whole number.' });
  const validType = type === 'finished_good' ? 'finished_good' : 'raw_material';
  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory (type, catalog_item_id, item_name, description, unit, quantity, location, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [validType, catalog_item_id || null, item_name, description || null, unit || 'unit', quantity || 0, location || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { item_name, description, unit, quantity, location } = req.body;
  if (!item_name) return res.status(400).json({ error: 'Item name is required.' });
  if (quantity !== undefined && isNaN(parseInt(quantity))) return res.status(400).json({ error: 'Quantity must be a whole number.' });
  try {
    const { rows } = await pool.query(
      `UPDATE inventory SET item_name=$1, description=$2, unit=$3, quantity=$4, location=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [item_name, description || null, unit || 'unit', quantity || 0, location || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Inventory item not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.patch('/:id/adjust', requireRole('admin', 'manager'), async (req, res) => {
  const { delta } = req.body;
  if (delta === undefined || isNaN(parseInt(delta))) return res.status(400).json({ error: 'A numeric delta value is required.' });
  try {
    const { rows } = await pool.query(
      `UPDATE inventory SET quantity = GREATEST(0, quantity + $1), updated_at = NOW()
       WHERE id=$2 RETURNING *`,
      [parseInt(delta), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Inventory item not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Inventory item not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
