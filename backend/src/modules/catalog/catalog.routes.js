const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

const uploadsDir = process.env.UPLOADS_DIR ||
  (process.pkg ? path.join(path.dirname(process.execPath), 'uploads') : path.join(__dirname, '../../../..', 'uploads'));
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM catalog_items ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM catalog_items WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Catalog item not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', requireRole('admin', 'manager'), upload.single('image'), async (req, res) => {
  const { catalog_number, name, category, description, unit_price, unit } = req.body;
  if (!catalog_number) return res.status(400).json({ error: 'Catalog number is required.' });
  if (!name) return res.status(400).json({ error: 'Item name is required.' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { rows } = await pool.query(
      'INSERT INTO catalog_items (catalog_number, name, category, description, unit_price, unit, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [catalog_number, name, category || null, description, unit_price || 0, unit || 'unit', image_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.put('/:id', requireRole('admin', 'manager'), upload.single('image'), async (req, res) => {
  const { catalog_number, name, category, description, unit_price, unit } = req.body;
  if (!catalog_number) return res.status(400).json({ error: 'Catalog number is required.' });
  if (!name) return res.status(400).json({ error: 'Item name is required.' });
  try {
    let image_url_clause = '';
    const params = [catalog_number, name, category || null, description, unit_price, unit, req.params.id];
    if (req.file) {
      // Insert image_url at index 6 (becomes $7); id shifts to index 7 (becomes $8)
      params.splice(6, 0, `/uploads/${req.file.filename}`);
      image_url_clause = ', image_url=$7';
    }
    const { rows } = await pool.query(
      `UPDATE catalog_items SET catalog_number=$1, name=$2, category=$3, description=$4, unit_price=$5, unit=$6${image_url_clause} WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Catalog item not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM catalog_items WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Catalog item not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
