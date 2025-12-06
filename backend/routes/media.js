const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { DATA_ROOT, ensureDir } = require('../utils/storage');

const router = express.Router();

// Create uploads directory
const UPLOADS_DIR = path.join(DATA_ROOT, 'public_uploads');
ensureDir(UPLOADS_DIR);

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ được upload file ảnh!'));
        }
    }
});

router.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Không có file nào được gửi lên.' });
    }
    
    // Return relative path that can be served by static middleware
    const imageUrl = `/api/media/files/${req.file.filename}`;
    res.json({ url: imageUrl });
});

// Serve files
router.get('/files/:filename', (req, res) => {
    const filepath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).send('File not found');
    }
});

module.exports = router;