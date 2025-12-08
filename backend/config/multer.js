const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Import constants để lấy đường dẫn chuẩn, tránh hardcode
const { DIRS } = require('./constants');

// Đảm bảo thư mục upload tồn tại
// DIRS.UPLOADS được định nghĩa là path.join(APP_ROOT, 'db', 'data', 'uploads')
if (DIRS && DIRS.UPLOADS) {
    if (!fs.existsSync(DIRS.UPLOADS)) {
        fs.mkdirSync(DIRS.UPLOADS, { recursive: true });
    }
} else {
    // Fallback nếu constants chưa load kịp (dù ít khi xảy ra)
    const fallbackPath = path.join(process.cwd(), 'db', 'data', 'uploads');
    if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Sử dụng đường dẫn từ constants hoặc fallback
        const uploadPath = (DIRS && DIRS.UPLOADS) ? DIRS.UPLOADS : path.join(process.cwd(), 'db', 'data', 'uploads');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Tạo tên file unique để tránh trùng lặp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Khởi tạo multer instance
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Giới hạn 100MB cho dataset lớn
});

// QUAN TRỌNG: Export trực tiếp instance để dùng được .fields(), .single()
module.exports = upload;