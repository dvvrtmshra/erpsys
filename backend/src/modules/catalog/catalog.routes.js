const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const router = express.Router();
router.use(requireAuth);

// Resolve uploads dir relative to exe when packaged, or project root in dev
const uploadsDir = process.env.UPLOADS_DIR ||
  (process.pkg ? path.join(path.dirname(process.execPath), 'uploads') : path.join(__dirname, '../../../..', 'uploads'));
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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

router.post('/', requireRole('admin', 'manager'), upload.single('image'), async (req, res) => {
  const { sku, name, description, unit_price, unit } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'SKU and name required' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { rows } = await pool.query(
      'INSERT INTO catalog_items (sku, name, description, unit_price, unit, image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [sku, name, description, unit_price || 0, unit || 'unit', image_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireRole('admin', 'manager'), upload.single('image'), async (req, res) => {
  const { sku, name, description, unit_price, unit } = req.body;
  try {
    let image_url_clause = '';
    const params = [sku, name, description, unit_price, unit, req.params.id];
    if (req.file) {
      image_url_clause = ', image_url=$7';
      params.splice(5, 0, `/uploads/${req.file.filename}`);
      params[params.length - 1] = req.params.id;
    }
    const { rows } = await pool.query(
      `UPDATE catalog_items SET sku=$1, name=$2, description=$3, unit_price=$4, unit=$5${image_url_clause} WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM catalog_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
