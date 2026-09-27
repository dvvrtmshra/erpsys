const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM catalog_items ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM catalog_items WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { sku, name, description, unit_price, unit } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'SKU and name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO catalog_items (sku, name, description, unit_price, unit) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [sku, name, description, unit_price || 0, unit || 'unit']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { sku, name, description, unit_price, unit } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE catalog_items SET sku=$1, name=$2, description=$3, unit_price=$4, unit=$5 WHERE id=$6 RETURNING *',
      [sku, name, description, unit_price, unit, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM catalog_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
