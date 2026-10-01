const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id AS item_id, c.name AS item_name, c.sku, c.unit,
             COALESCE(i.id, NULL) AS id,
             COALESCE(i.quantity, 0) AS quantity,
             i.location,
             i.updated_at
      FROM catalog_items c
      LEFT JOIN inventory i ON i.item_id = c.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:itemId', requireRole('admin', 'manager'), async (req, res) => {
  const { quantity, location } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO inventory (item_id, quantity, location, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (item_id) DO UPDATE
        SET quantity = $2, location = $3, updated_at = NOW()
      RETURNING *
    `, [req.params.itemId, quantity, location]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:itemId/adjust', requireRole('admin', 'manager'), async (req, res) => {
  const { delta } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO inventory (item_id, quantity, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (item_id) DO UPDATE
        SET quantity = GREATEST(0, inventory.quantity + $2), updated_at = NOW()
      RETURNING *
    `, [req.params.itemId, delta]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
