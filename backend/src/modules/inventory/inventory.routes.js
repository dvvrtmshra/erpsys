const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET all — join catalog for finished goods
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
    console.error('[inventory GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET catalog items not yet in finished-goods inventory (for the add dropdown)
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { type, catalog_item_id, item_name, description, unit, quantity, location } = req.body;
  if (!item_name) return res.status(400).json({ error: 'Item name required' });
  const validType = type === 'finished_good' ? 'finished_good' : 'raw_material';
  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory (type, catalog_item_id, item_name, description, unit, quantity, location, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [validType, catalog_item_id || null, item_name, description || null, unit || 'unit', quantity || 0, location || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[inventory POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { item_name, description, unit, quantity, location } = req.body;
  if (!item_name) return res.status(400).json({ error: 'Item name required' });
  try {
    const { rows } = await pool.query(
      `UPDATE inventory SET item_name=$1, description=$2, unit=$3, quantity=$4, location=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [item_name, description || null, unit || 'unit', quantity || 0, location || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/adjust', requireRole('admin', 'manager'), async (req, res) => {
  const { delta } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE inventory SET quantity = GREATEST(0, quantity + $1), updated_at = NOW()
       WHERE id=$2 RETURNING *`,
      [delta, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
