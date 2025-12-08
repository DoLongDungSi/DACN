const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');

// Middleware chung cho toàn bộ file
router.use(authMiddleware);
router.use(adminMiddleware);

// 1. Stats (Thống kê)
router.get('/stats', async (req, res) => {
    try {
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const problemCount = await pool.query('SELECT COUNT(*) FROM problems'); // Giữ nguyên query gốc
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
        // Giữ nguyên is_locked như file gốc
        const result = await pool.query(`
            SELECT id, username, email, role, created_at, is_locked, avatar_url,
            (SELECT COUNT(*) FROM submissions WHERE user_id = users.id) as submission_count
            FROM users ORDER BY created_at DESC
        `);
        res.json({ users: toCamelCase(result.rows) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi lấy user' });
    }
});

// 3. Get Single User (Chi tiết)
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT id, username, email, role, created_at, is_locked, avatar_url FROM users WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ user: toCamelCase(result.rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi lấy chi tiết user' });
    }
});

// 4. Lock User (Giữ nguyên logic isLocked)
router.put('/users/:id/lock', async (req, res) => {
    const { id } = req.params;
    const { isLocked } = req.body; 
    if (parseInt(id) === req.userId) return res.status(400).json({ message: 'Không thể tự khóa mình.' });

    try {
        await pool.query('UPDATE users SET is_locked = $1 WHERE id = $2', [isLocked, id]);
        res.json({ success: true, message: `Đã ${isLocked ? 'khóa' : 'mở'} user.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi lock user' });
    }
});

// 5. Change Role
router.put('/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['admin', 'user', 'creator', 'owner'];
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Role sai.' });
    if (parseInt(id) === req.userId) return res.status(400).json({ message: 'Không thể tự đổi role mình.' });

    try {
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
        res.json({ success: true, message: 'Đổi role thành công.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi đổi role' });
    }
});

// 6. Reset Password (Đã khôi phục lại hàm này)
router.put('/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password quá ngắn.' });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, id]);
        res.json({ success: true, message: 'Reset password thành công.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi reset password' });
    }
});

// 7. Delete User (Giữ nguyên author_id)
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.userId) return res.status(400).json({ message: 'Không thể tự xóa mình.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM submissions WHERE user_id = $1', [id]);
        // SỬ DỤNG author_id như file gốc của bạn
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

module.exports = router;