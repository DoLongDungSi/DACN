const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');

// Middleware xác thực & admin
router.use(authMiddleware);
router.use(adminMiddleware);

// 1. Stats (Thống kê)
router.get('/stats', async (req, res) => {
    try {
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const problemCount = await pool.query('SELECT COUNT(*) FROM problems');
        const subCount = await pool.query('SELECT COUNT(*) FROM submissions');
        
        const dailySubs = await pool.query(`
            SELECT TO_CHAR(submitted_at, 'YYYY-MM-DD') as date, COUNT(*) as count 
            FROM submissions WHERE submitted_at > NOW() - INTERVAL '7 days' 
            GROUP BY TO_CHAR(submitted_at, 'YYYY-MM-DD') ORDER BY date ASC
        `);

        const statusStats = await pool.query(`SELECT status, COUNT(*) as count FROM submissions GROUP BY status`);

        res.json({
            stats: {
                totalUsers: parseInt(userCount.rows[0].count),
                totalProblems: parseInt(problemCount.rows[0].count),
                totalSubmissions: parseInt(subCount.rows[0].count),
                dailySubmissions: dailySubs.rows,
                submissionStatus: statusStats.rows
            }
        });
    } catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ message: 'Lỗi thống kê' });
    }
});

// 2. Get All Users
router.get('/users', async (req, res) => {
    try {
        // [FIX] Sửa is_locked -> is_banned để khớp với init.sql
        const result = await pool.query(`
            SELECT id, username, email, role, created_at, is_banned, avatar_url,
            (SELECT COUNT(*) FROM submissions WHERE user_id = users.id) as submission_count
            FROM users ORDER BY created_at DESC
        `);
        res.json({ users: toCamelCase(result.rows) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi lấy danh sách user' });
    }
});

// 3. Get Single User
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // [FIX] Sửa is_locked -> is_banned
        const result = await pool.query(`SELECT id, username, email, role, created_at, is_banned, avatar_url FROM users WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ user: toCamelCase(result.rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi lấy chi tiết user' });
    }
});

// 4. Ban/Unban User (Sửa lại Logic & Route)
// Frontend gọi /ban, logic là toggle (khóa <-> mở)
router.put('/users/:id/ban', async (req, res) => {
    const { id } = req.params;
    
    // Không cho phép ban chính mình
    if (parseInt(id) === req.userId) return res.status(400).json({ message: 'Không thể tự khóa tài khoản của mình.' });

    try {
        // [FIX] Dùng logic NOT is_banned để toggle trạng thái
        // [FIX] Thêm RETURNING * để trả về user mới nhất cho Frontend (tránh trắng trang)
        const result = await pool.query(`
            UPDATE users 
            SET is_banned = NOT is_banned 
            WHERE id = $1 
            RETURNING id, username, email, role, is_banned, avatar_url
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updatedUser = result.rows[0];
        res.json({ 
            success: true, 
            message: `Đã ${updatedUser.is_banned ? 'khóa' : 'mở khóa'} user.`,
            user: toCamelCase(updatedUser) // Trả về user để Frontend cập nhật state
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi khi khóa/mở khóa user' });
    }
});

// 5. Change Role
router.put('/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['admin', 'user', 'creator', 'owner'];
    
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Role không hợp lệ.' });
    if (parseInt(id) === req.userId) return res.status(400).json({ message: 'Không thể tự đổi role của mình.' });

    try {
        // [FIX] Thêm RETURNING * để trả về user (SỬA LỖI TRẮNG TRANG)
        const result = await pool.query(`
            UPDATE users 
            SET role = $1 
            WHERE id = $2 
            RETURNING id, username, email, role, is_banned, avatar_url
        `, [role, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            success: true, 
            message: 'Đổi role thành công.',
            user: toCamelCase(result.rows[0]) // Trả về user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi đổi role' });
    }
});

// 6. Reset Password
router.put('/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Mật khẩu quá ngắn.' });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, id]);
        res.json({ success: true, message: 'Reset mật khẩu thành công.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi reset password' });
    }
});

// 7. Delete User
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.userId) return res.status(400).json({ message: 'Không thể tự xóa mình.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM submissions WHERE user_id = $1', [id]);
        await client.query('DELETE FROM problems WHERE author_id = $1', [id]);
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'Xóa user thành công.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Lỗi xóa user: ' + err.message });
    } finally {
        client.release();
    }
});

// --- ROUTES CHO TAGS & METRICS (Bổ sung để Admin Page không bị lỗi 404 khi gọi API) ---

// Get Tags
router.get('/tags', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tags ORDER BY id ASC');
        res.json({ tags: toCamelCase(result.rows) });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Add Tag
router.post('/tags', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING *', [name]);
        res.json({ tag: toCamelCase(result.rows[0]) });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Delete Tag
router.delete('/tags/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Get Metrics
router.get('/metrics', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM metrics ORDER BY id ASC');
        res.json({ metrics: toCamelCase(result.rows) });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Add Metric
router.post('/metrics', async (req, res) => {
    const { key, direction } = req.body; // direction: 'maximize' or 'minimize'
    try {
        const result = await pool.query('INSERT INTO metrics (key, direction) VALUES ($1, $2) RETURNING *', [key, direction]);
        res.json({ metric: toCamelCase(result.rows[0]) });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Delete Metric
router.delete('/metrics/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM metrics WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});


module.exports = router;