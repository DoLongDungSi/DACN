const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { optionalAuth } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Đường dẫn file initial.json
const INITIAL_DATA_PATH = path.join(__dirname, '../../initial.json');

// Hàm Seed (Giữ nguyên logic seed)
const seedDatabase = async () => {
    if (!fs.existsSync(INITIAL_DATA_PATH)) {
        console.warn('File initial.json not found');
        return;
    }
    const data = JSON.parse(fs.readFileSync(INITIAL_DATA_PATH, 'utf8'));
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Seed Tags
        if (data.tags) {
            for (const tag of data.tags) {
                const check = await client.query('SELECT id FROM tags WHERE name = $1', [tag.name]);
                if (check.rows.length === 0) {
                    await client.query('INSERT INTO tags (name, description, color) VALUES ($1, $2, $3)', [tag.name, tag.description || '', tag.color || '#6366f1']);
                }
            }
        }

        // Seed Metrics
        if (data.metrics) {
            for (const metric of data.metrics) {
                const check = await client.query('SELECT id FROM metrics WHERE key = $1', [metric.key]);
                if (check.rows.length === 0) {
                    await client.query('INSERT INTO metrics (key, name, description, direction) VALUES ($1, $2, $3, $4)', [metric.key, metric.name, metric.description || '', metric.direction || 'max']);
                }
            }
        }

        // Seed Users
        if (data.users) {
            for (const user of data.users) {
                const check = await client.query('SELECT id FROM users WHERE username = $1', [user.username]);
                if (check.rows.length === 0) {
                    const hashedPassword = await bcrypt.hash(user.password || '123456', 10);
                    await client.query('INSERT INTO users (username, email, password_hash, role, avatar_color) VALUES ($1, $2, $3, $4, $5)', [user.username, user.email, hashedPassword, user.role || 'user', user.avatar_color || '#ef4444']);
                }
            }
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Seeding Error:", e);
    } finally {
        client.release();
    }
};

router.get('/', optionalAuth, async (req, res) => {
    try {
        // Auto-seed nếu DB trống
        const countRes = await pool.query('SELECT COUNT(*) FROM tags');
        if (parseInt(countRes.rows[0].count) === 0) {
            console.log("Database empty, auto-seeding...");
            await seedDatabase();
        }

        const tagsRes = await pool.query('SELECT * FROM tags ORDER BY name ASC');
        const metricsRes = await pool.query('SELECT * FROM metrics ORDER BY key ASC');

        // Lấy danh sách problems
        const problemsRes = await pool.query(`
            SELECT p.id, p.name, p.difficulty, p.problem_type, p.cover_image_url,
                   p.created_at, p.summary, p.is_frozen,
                   (SELECT COUNT(*) FROM submissions s WHERE s.problem_id = p.id) as submission_count
            FROM problems p
            ORDER BY p.created_at DESC
        `);

        // Lấy bài thảo luận
        const postsRes = await pool.query(`
            SELECT p.*, u.username, u.avatar_color, u.avatar_url,
            (SELECT COUNT(*) FROM votes WHERE post_id = p.id AND vote_type = 1) as upvotes,
            (SELECT COUNT(*) FROM votes WHERE post_id = p.id AND vote_type = -1) as downvotes
            FROM discussion_posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC LIMIT 50
        `);

        // Lấy bình luận
        const commentsRes = await pool.query(`
            SELECT c.*, u.username, u.avatar_color, u.avatar_url,
            (SELECT COUNT(*) FROM votes WHERE comment_id = c.id AND vote_type = 1) as upvotes,
            (SELECT COUNT(*) FROM votes WHERE comment_id = c.id AND vote_type = -1) as downvotes
            FROM discussion_comments c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at ASC
        `);

        // [QUAN TRỌNG] Lấy danh sách Users (Thông tin public) để hiển thị Profile/Avatar
        const usersRes = await pool.query(`
            SELECT id, username, role, avatar_url, avatar_color, joined_at, profile
            FROM users
        `);

        let currentUser = null;
        let userSubmissions = [];

        if (req.userId) {
            const userRes = await pool.query('SELECT id, username, email, role, avatar_url, avatar_color, is_premium FROM users WHERE id = $1', [req.userId]);
            if (userRes.rows.length > 0) currentUser = toCamelCase(userRes.rows[0]);

            const subRes = await pool.query(`
                SELECT s.*, p.name as problem_name 
                FROM submissions s
                JOIN problems p ON s.problem_id = p.id
                WHERE s.user_id = $1
                ORDER BY s.submitted_at DESC
            `, [req.userId]);
            userSubmissions = toCamelCase(subRes.rows);
        }

        res.json({
            tags: toCamelCase(tagsRes.rows),
            metrics: toCamelCase(metricsRes.rows),
            problems: toCamelCase(problemsRes.rows),
            posts: toCamelCase(postsRes.rows),
            comments: toCamelCase(commentsRes.rows),
            users: toCamelCase(usersRes.rows), // <--- Cần thiết để fix lỗi Profile
            submissions: userSubmissions,
            user: currentUser,
            config: { allowSignups: true, maintenanceMode: false }
        });
    } catch (err) {
        console.error("Initial Data Error:", err);
        res.json({ tags: [], metrics: [], problems: [], submissions: [], posts: [], comments: [], users: [], user: null, error: 'Failed' });
    }
});

router.post('/seed', async (req, res) => {
    try {
        await seedDatabase();
        res.json({ success: true, message: 'Seeding complete' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;