const multer = require('multer');
const path = require('path');

const appRoot = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '../../..');
const uploadsDir = path.join(appRoot, 'uploads');

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
