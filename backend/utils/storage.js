const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { DATA_ROOT } = require('../config/constants');

// Định nghĩa đường dẫn tuyệt đối an toàn
const DATA_DIR = DATA_ROOT;
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads'); // Lưu tất cả vào db/data/uploads

const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Khởi tạo thư mục ngay lập tức
ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Đảm bảo thư mục tồn tại trước khi lưu
        ensureDir(UPLOADS_DIR);
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Tên file: timestamp-uuid-tên-gốc (đã làm sạch)
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${Date.now()}-${uuidv4()}-${name}${ext}`);
    }
});

const uploadProblemFiles = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
}).fields([
    { name: 'trainCsv', maxCount: 1 },
    { name: 'testCsv', maxCount: 1 },
    { name: 'groundTruthCsv', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]);

const resolveFilePath = (relativePath) => {
    if (!relativePath) return null;
    if (path.isAbsolute(relativePath)) return fs.existsSync(relativePath) ? relativePath : null;

    // Ưu tiên tìm trong UPLOADS_DIR
    const inUploads = path.join(UPLOADS_DIR, relativePath);
    if (fs.existsSync(inUploads)) return inUploads;

    // Tìm trong DATA_DIR
    const inData = path.join(DATA_DIR, relativePath);
    if (fs.existsSync(inData)) return inData;

    return null;
};

module.exports = { 
    uploadProblemFiles, 
    resolveFilePath, 
    DATA_ROOT: DATA_DIR, 
    UPLOADS_ROOT: UPLOADS_DIR,
    ensureDir 
};