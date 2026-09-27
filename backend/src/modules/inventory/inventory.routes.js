const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, c.name AS item_name, c.sku, c.unit
      FROM inventory i
      JOIN catalog_items c ON c.id = i.item_id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:itemId', async (req, res) => {
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

router.patch('/:itemId/adjust', async (req, res) => {
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
