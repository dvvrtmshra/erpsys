const multer = require('multer');
const path = require('path');

const uploadsDir = process.env.UPLOADS_DIR ||
  (process.pkg ? path.join(path.dirname(process.execPath), 'uploads') : path.join(__dirname, '../../..', 'uploads'));

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed.'));
    }
  },
});

module.exports = upload;
