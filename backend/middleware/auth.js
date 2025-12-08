const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const pool = require('../config/db');

// Middleware xác thực người dùng qua Cookie
const authMiddleware = (req, res, next) => {
  // Lấy token từ cookie
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
  }

  try {
    // Giải mã token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    console.error('Auth Error:', err.message);
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
};

// Middleware kiểm tra quyền (Role)
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }
    next();
  };
};

// [THÊM MỚI] Middleware dành riêng cho Admin/Owner để sửa lỗi crash
const adminMiddleware = (req, res, next) => {
    // Các role được phép truy cập admin
    const allowedRoles = ['owner', 'admin'];

    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
        return res.status(403).json({ message: 'Yêu cầu quyền quản trị viên.' });
    }
    next();
};

// Middleware xác thực tùy chọn (optional auth)
const optionalAuth = (req, res, next) => {
    const token = req.cookies.token;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
            req.userRole = decoded.role;
        } catch (err) {
            // Nếu token không hợp lệ, bỏ qua và tiếp tục
            console.error('Optional Auth Error:', err.message);
        }
    }
    next();
};

module.exports = { authMiddleware, checkRole, adminMiddleware, optionalAuth };