const multer = require('multer');
const path = require('path');

const uploadsDir = process.env.UPLOADS_DIR ||
  (process.pkg ? path.join(path.dirname(process.execPath), 'uploads') : path.join(__dirname, '../../..', 'uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;
