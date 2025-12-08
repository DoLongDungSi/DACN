const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db'); // Import kết nối DB
const routes = require('./routes'); // Import tổng hợp routes

// Load biến môi trường
require('dotenv').config();

// Khởi tạo ứng dụng Express
const app = express();
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ==================================================================
// 1. KIỂM TRA KẾT NỐI DATABASE (STARTUP CHECK)
// ==================================================================
// Việc này giúp đảm bảo DB đã sẵn sàng trước khi Server nhận request
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ [Database] Connection Failed:', err.message);
        console.error('   Please check your connection string in .env or docker-compose.');
    } else {
        console.log('✅ [Database] Connection Successful.');
        console.log(`   Time from DB: ${res.rows[0].now}`);
    }
});

// ==================================================================
// 2. CẤU HÌNH MIDDLEWARE (CORE)
// ==================================================================

// Cấu hình CORS: Cho phép Frontend truy cập tài nguyên
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true, // Cho phép gửi Cookie/Token
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Tăng giới hạn Body Parser để upload ảnh lớn (Base64)
// Mặc định là 100kb, không đủ cho ảnh Avatar chất lượng cao
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Parser Cookie từ request header
app.use(cookieParser());

// Logger đơn giản cho request (Optional: giúp debug dễ hơn)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ==================================================================
// 3. CẤU HÌNH THƯ MỤC UPLOADS (STATIC FILES)
// ==================================================================

// Xác định đường dẫn thực tế tới thư mục lưu trữ
// Trong Docker, DATA_ROOT thường là /db/data
const dataRoot = process.env.DATA_ROOT || path.join(__dirname, '../db/data');
const uploadsDir = path.join(dataRoot, 'uploads');

// Kiểm tra và tạo thư mục nếu chưa tồn tại (Tránh lỗi crash server)
if (!fs.existsSync(uploadsDir)) {
    console.log(`⚠️ [Storage] Uploads directory not found. Creating: ${uploadsDir}`);
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('✅ [Storage] Created uploads directory successfully.');
    } catch (err) {
        console.error('❌ [Storage] Failed to create uploads directory:', err.message);
    }
}

console.log(`📂 [Storage] Serving static files from: ${uploadsDir}`);

// Cấu hình Serve Static Files với Header CORS đặc biệt
// Đây là CHÌA KHÓA để sửa lỗi "Tainted Canvas" (ảnh đen)
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath, stat) => {
        // Cho phép mọi nguồn (hoặc chỉ định cụ thể) truy cập ảnh
        // Dấu * giúp xử lý các trường hợp IP động hoặc truy cập qua mạng LAN
        res.set('Access-Control-Allow-Origin', '*');
        
        // Header quan trọng cho Canvas
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        
        // Cache Control: Giúp tải ảnh nhanh hơn ở lần sau
        // public: có thể cache bởi proxy/CDN, max-age: thời gian cache (giây)
        res.set('Cache-Control', 'public, max-age=31536000'); 
        
        // Security Headers bổ sung cho file tĩnh
        res.set('X-Content-Type-Options', 'nosniff');
    }
}));

// ==================================================================
// 4. ĐỊNH TUYẾN (ROUTING)
// ==================================================================

// Gắn các route API vào prefix /api
app.use('/api', routes);

// Route Health Check (để Docker hoặc Load Balancer kiểm tra)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date() 
    });
});

// Route trang chủ backend (thông tin cơ bản)
app.get('/', (req, res) => {
    res.send(`ML Judge Backend API is running on port ${PORT}`);
});

// ==================================================================
// 5. XỬ LÝ LỖI TẬP TRUNG (ERROR HANDLING)
// ==================================================================

// Middleware xử lý lỗi 404 (Không tìm thấy route)
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

// Middleware xử lý lỗi Server (500)
app.use((err, req, res, next) => {
    console.error('🔥 [Server Error]', err.stack);

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        // Chỉ hiển thị stack trace ở môi trường development để bảo mật
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    });
});

// ==================================================================
// 6. KHỞI ĐỘNG SERVER
// ==================================================================

app.listen(PORT, () => {
    console.log(`
    ################################################
    🚀  Server listening on port: ${PORT}
    🌍  Environment: ${process.env.NODE_ENV || 'development'}
    🔗  Frontend URL: ${FRONTEND_URL}
    ################################################
    `);
});