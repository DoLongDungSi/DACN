const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
// [QUAN TRỌNG] Sử dụng middleware uploadProblemFiles từ storage để lưu file xuống ổ cứng
// Nếu dùng multer mặc định thì file chỉ nằm trên RAM -> Lỗi khi tạo bài toán
const { uploadProblemFiles, resolveFilePath, UPLOADS_ROOT } = require('../utils/storage');
const fs = require('fs');
const path = require('path');

// --- Helper: Xóa file vật lý khi xóa bài toán ---
const deleteProblemFiles = (datasets, coverImage) => {
    // Xóa các file dataset (train, test, ground_truth)
    if (Array.isArray(datasets)) {
        datasets.forEach(ds => {
            try {
                const p = path.join(UPLOADS_ROOT, ds.path);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch (e) { 
                console.error("Error deleting file:", e.message); 
            }
        });
    }
    // Xóa ảnh bìa
    if (coverImage && coverImage.startsWith('/uploads/')) {
        try {
            const p = path.join(UPLOADS_ROOT, path.basename(coverImage));
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) { 
            console.error("Error deleting cover:", e.message); 
        }
    }
};

// --- Helper: Đồng bộ Tags & Metrics vào cột JSON (Denormalization) ---
// Giúp việc tìm kiếm và hiển thị nhanh hơn mà không cần join bảng liên tục
const syncDenormalizedData = async (client, problemId, tagIds, metricIds) => {
    let tagNames = [];
    let metricKeys = [];

    if (tagIds && tagIds.length > 0) {
        const res = await client.query('SELECT name FROM tags WHERE id = ANY($1)', [tagIds]);
        tagNames = res.rows.map(r => r.name);
    }

    if (metricIds && metricIds.length > 0) {
        const res = await client.query('SELECT key FROM metrics WHERE id = ANY($1)', [metricIds]);
        metricKeys = res.rows.map(r => r.key);
    }

    await client.query(
        'UPDATE problems SET tags = $1::jsonb, metrics = $2::jsonb WHERE id = $3',
        [JSON.stringify(tagNames), JSON.stringify(metricKeys), problemId]
    );
};

// ============================================================================
// ROUTES
// ============================================================================

// 1. GET / - Lấy danh sách bài toán
router.get('/', optionalAuth, async (req, res) => {
    try {
        // Lấy danh sách problem, kèm theo mảng ID của tags và metrics
        // Sử dụng subquery json_agg để gom nhóm ID ngay trong SQL
        const result = await pool.query(`
            SELECT p.*, u.username as author_name,
            (SELECT COALESCE(json_agg(tag_id), '[]') FROM problem_tags WHERE problem_id = p.id) as tag_ids,
            (SELECT COALESCE(json_agg(metric_id), '[]') FROM problem_metrics WHERE problem_id = p.id) as metric_ids
            FROM problems p 
            LEFT JOIN users u ON p.author_id = u.id 
            ORDER BY p.created_at DESC
        `);
        
        // Map dữ liệu để frontend dễ sử dụng
        const problems = result.rows.map(row => ({
            ...row,
            tags: row.tag_ids || [],       // Frontend cần mảng ID để filter
            metrics: row.metric_ids || [], // Frontend cần mảng ID để filter
            // Giữ lại tên tag (từ cột JSON tags) để hiển thị nhanh nếu cần
            tagsJson: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags
        }));

        res.json({ problems: toCamelCase(problems) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// 2. GET /:id - Lấy chi tiết bài toán
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT p.*, u.username as author_name, u.avatar_url as author_avatar,
            (SELECT COALESCE(json_agg(tag_id), '[]') FROM problem_tags WHERE problem_id = p.id) as tag_ids,
            (SELECT COALESCE(json_agg(metric_id), '[]') FROM problem_metrics WHERE problem_id = p.id) as metric_ids
            FROM problems p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Problem not found' });
        }

        const problem = result.rows[0];
        
        // Parse datasets từ JSONB
        const datasets = typeof problem.datasets === 'string' ? JSON.parse(problem.datasets) : (problem.datasets || []);
        
        const parsedProblem = {
            ...problem,
            // [FIX QUAN TRỌNG] Gán tag_ids vào tags để Form Editor hiển thị đúng các tag đã chọn
            tags: problem.tag_ids || [], 
            metrics: problem.metric_ids || [],
            datasets: datasets
        };

        // Lọc dataset: Ẩn ground_truth nếu không phải Owner/Admin
        let filteredDatasets = parsedProblem.datasets;
        const isOwner = req.userId && req.userId === problem.author_id;
        const isAdmin = req.userRole === 'admin';

        if (!isOwner && !isAdmin) {
            filteredDatasets = filteredDatasets.filter(d => d.split !== 'ground_truth');
        }

        res.json({
            problem: {
                ...toCamelCase(parsedProblem),
                datasets: filteredDatasets.map(d => toCamelCase(d)),
                evaluationScript: parsedProblem.evaluation_script
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// 3. GET /:id/download/:fileName - Tải file dataset
router.get('/:id/download/:fileName', optionalAuth, async (req, res) => {
    try {
        const { id, fileName } = req.params;
        const probRes = await pool.query('SELECT * FROM problems WHERE id = $1', [id]);
        if (probRes.rows.length === 0) return res.status(404).json({ message: 'Problem not found' });
        
        const problem = probRes.rows[0];
        const datasets = problem.datasets || [];
        
        // Tìm file trong danh sách datasets
        const targetFile = datasets.find(d => d.file_name === fileName || d.path.endsWith(fileName) || path.basename(d.path) === fileName);

        if (!targetFile) return res.status(404).json({ message: 'File not associated with this problem' });

        // Kiểm tra quyền tải file ground_truth (Đáp án)
        if (targetFile.split === 'ground_truth') {
            const isOwner = req.userId && req.userId === problem.author_id;
            const isAdmin = req.userRole === 'admin';
            if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Unauthorized' });
        }

        const absolutePath = resolveFilePath(targetFile.path);
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: 'File content missing on server' });

        res.download(absolutePath, targetFile.file_name || fileName);
    } catch (err) {
        console.error("Download Error:", err);
        res.status(500).json({ message: 'Download failed' });
    }
});

// 4. POST /:id/hint - Tạo gợi ý AI (TÍNH NĂNG CAO CẤP)
router.post('/:id/hint', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Kiểm tra User có gói Premium không
        const userRes = await pool.query('SELECT is_premium FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        
        // Lấy thông tin bài toán để làm ngữ cảnh cho AI
        const probRes = await pool.query('SELECT name, content, summary, problem_type, data_description FROM problems WHERE id = $1', [id]);
        if (probRes.rows.length === 0) return res.status(404).json({ message: 'Problem not found' });
        const problem = probRes.rows[0];

        // Lấy API Key từ biến môi trường
        const apiKey = process.env.OPENROUTER_API_KEY;
        const BOT_URL = process.env.BOT_URL;
        if (!apiKey) return res.status(503).json({ message: 'AI Service unavailable (Missing Key)' });

        const systemPrompt = process.env.HINT_SYSTEM_PROMPT || "You are a helpful AI assistant for Data Science competitions.";
        
        // Tạo Prompt ngữ cảnh
        const problemContext = `
            Problem Name: ${problem.name}
            Type: ${problem.problem_type}
            Summary: ${problem.summary || ''}
            Description (Excerpt): ${problem.content ? problem.content.substring(0, 1000) : 'No description'}
            Data Description: ${problem.data_description ? problem.data_description.substring(0, 500) : ''}
        `;

        // Gọi OpenRouter API
        const response = await fetch(BOT_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000", 
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Please provide a helpful hint for this problem, focusing on approach rather than giving the solution:\n${problemContext}` }
                ],
                temperature: 0.7,
                max_tokens: 400
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("OpenRouter Error:", errText);
            throw new Error(`AI Provider Error: ${response.status}`);
        }

        const data = await response.json();
        const hint = data.choices?.[0]?.message?.content || "Không thể tạo gợi ý lúc này.";

        res.json({ hint });

    } catch (err) {
        console.error("Hint Gen Error:", err);
        res.status(500).json({ message: err.message || 'Server Error generating hint' });
    }
});

// 5. PUT /:id/freeze - Khóa/Mở khóa bài toán
router.put('/:id/freeze', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT author_id, is_frozen FROM problems WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Problem not found' });
        
        // Chỉ Admin hoặc Owner mới được quyền khóa
        if (req.userRole !== 'admin' && check.rows[0].author_id !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const newState = !check.rows[0].is_frozen;
        await pool.query('UPDATE problems SET is_frozen = $1 WHERE id = $2', [newState, id]);

        res.json({ success: true, isFrozen: newState, message: `Status updated to ${newState ? 'Frozen' : 'Active'}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// 6. DELETE /:id - Xóa bài toán
router.delete('/:id', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        const check = await client.query('SELECT author_id, datasets, cover_image_url FROM problems WHERE id = $1', [id]);
        if (check.rows.length === 0) throw new Error('Problem not found');

        if (req.userRole !== 'admin' && check.rows[0].author_id !== req.userId) {
            throw new Error('Unauthorized');
        }

        const { datasets, cover_image_url } = check.rows[0];

        // Xóa DB trước
        await client.query('DELETE FROM problems WHERE id = $1', [id]);
        await client.query('COMMIT');

        // Xóa file sau khi DB thành công
        deleteProblemFiles(datasets, cover_image_url);

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete Error:', err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// 7. POST / - Tạo bài toán mới
// Sử dụng uploadProblemFiles để lưu file vào thư mục uploads
router.post('/', authMiddleware, uploadProblemFiles, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        if (!req.body.problemData) throw new Error('Missing problemData');

        const problemData = JSON.parse(req.body.problemData);
        const {
            name, summary, content, difficulty, problemType,
            dataDescription, evaluationScriptContent,
            tagIds = [], metricIds = []
        } = problemData;

        if (!name || !difficulty) throw new Error('Name and Difficulty are required');

        // Helper tạo object dataset để lưu vào DB
        const createDatasetEntry = (file, split) => {
            if (!file) return null;
            return {
                split,
                path: path.relative(UPLOADS_ROOT, file.path), // Lưu đường dẫn tương đối
                file_name: file.filename,
                original_name: file.originalname,
                size: file.size
            };
        };

        const datasets = [];
        if (req.files['trainCsv']) datasets.push(createDatasetEntry(req.files['trainCsv'][0], 'train'));
        if (req.files['testCsv']) datasets.push(createDatasetEntry(req.files['testCsv'][0], 'public_test'));
        if (req.files['groundTruthCsv']) datasets.push(createDatasetEntry(req.files['groundTruthCsv'][0], 'ground_truth'));

        const coverImageUrl = req.files['coverImage'] ? `/uploads/${req.files['coverImage'][0].filename}` : problemData.coverImageUrl;

        const insertQuery = `
            INSERT INTO problems (
                name, summary, content, difficulty, problem_type,
                author_id, is_frozen, datasets,
                data_description, evaluation_script, cover_image_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `;

        const probRes = await client.query(insertQuery, [
            name, summary, content, difficulty, problemType || 'Classification',
            req.userId, false, JSON.stringify(datasets),
            dataDescription, evaluationScriptContent, coverImageUrl
        ]);
        
        const problemId = probRes.rows[0].id;

        // Lưu Tags vào bảng trung gian
        if (tagIds.length > 0) {
            const cleanTagIds = tagIds.map(Number).filter(n => !isNaN(n));
            if (cleanTagIds.length > 0) {
                const values = cleanTagIds.flatMap(tid => [problemId, tid]);
                await client.query(
                    `INSERT INTO problem_tags (problem_id, tag_id) VALUES ${cleanTagIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                    values
                );
            }
        }
        // Lưu Metrics vào bảng trung gian
        if (metricIds.length > 0) {
            const cleanMetricIds = metricIds.map(Number).filter(n => !isNaN(n));
            if (cleanMetricIds.length > 0) {
                const values = cleanMetricIds.flatMap(mid => [problemId, mid]);
                await client.query(
                    `INSERT INTO problem_metrics (problem_id, metric_id) VALUES ${cleanMetricIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                    values
                );
            }
        }

        // Đồng bộ dữ liệu Denormalized
        await syncDenormalizedData(client, problemId, tagIds, metricIds);

        await client.query('COMMIT');
        res.status(201).json({ success: true, problemId, message: 'Created successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create Error:', err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// 8. PUT /:id - Cập nhật bài toán
router.put('/:id', authMiddleware, uploadProblemFiles, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        if (!req.body.problemData) throw new Error('Missing problemData');

        // Kiểm tra quyền sở hữu
        const checkRes = await client.query('SELECT author_id, datasets FROM problems WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) throw new Error('Not found');
        if (req.userRole !== 'admin' && checkRes.rows[0].author_id !== req.userId) throw new Error('Unauthorized');

        const currentDatasets = checkRes.rows[0].datasets || [];
        const problemData = JSON.parse(req.body.problemData);
        
        const {
            name, summary, content, difficulty, problemType,
            dataDescription, evaluationScriptContent,
            tagIds = [], metricIds = []
        } = problemData;

        if (!name) throw new Error('Name required');

        // Logic xử lý file cập nhật (Thay thế file cũ)
        const createDatasetEntry = (file, split) => ({
            split,
            path: path.relative(UPLOADS_ROOT, file.path),
            file_name: file.filename,
            original_name: file.originalname,
            size: file.size
        });

        let newDatasets = [...currentDatasets];
        const filesToDelete = [];

        const updateSplit = (split, file) => {
            if (!file) return;
            const oldFile = newDatasets.find(d => d.split === split);
            if (oldFile) filesToDelete.push(path.join(UPLOADS_ROOT, oldFile.path));
            newDatasets = newDatasets.filter(d => d.split !== split);
            newDatasets.push(createDatasetEntry(file, split));
        };

        if (req.files['trainCsv']) updateSplit('train', req.files['trainCsv'][0]);
        if (req.files['testCsv']) updateSplit('public_test', req.files['testCsv'][0]);
        if (req.files['groundTruthCsv']) updateSplit('ground_truth', req.files['groundTruthCsv'][0]);

        const coverImageUrl = req.files['coverImage'] ? `/uploads/${req.files['coverImage'][0].filename}` : problemData.coverImageUrl;

        const updateQuery = `
            UPDATE problems SET
                name = $1, summary = $2, content = $3, difficulty = $4,
                problem_type = $5, data_description = $6, evaluation_script = $7,
                datasets = $8, cover_image_url = $9, updated_at = NOW()
            WHERE id = $10
        `;

        await client.query(updateQuery, [
            name, summary, content, difficulty, problemType,
            dataDescription, evaluationScriptContent,
            JSON.stringify(newDatasets), coverImageUrl, id
        ]);

        // Cập nhật Tags
        await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [id]);
        if (tagIds.length > 0) {
            const cleanTagIds = tagIds.map(Number).filter(n => !isNaN(n));
            if (cleanTagIds.length > 0) {
                const values = cleanTagIds.flatMap(tid => [id, tid]);
                await client.query(
                    `INSERT INTO problem_tags (problem_id, tag_id) VALUES ${cleanTagIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                    values
                );
            }
        }

        // Cập nhật Metrics
        await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [id]);
        if (metricIds.length > 0) {
            const cleanMetricIds = metricIds.map(Number).filter(n => !isNaN(n));
            if (cleanMetricIds.length > 0) {
                const values = cleanMetricIds.flatMap(mid => [id, mid]);
                await client.query(
                    `INSERT INTO problem_metrics (problem_id, metric_id) VALUES ${cleanMetricIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                    values
                );
            }
        }

        // Đồng bộ lại
        await syncDenormalizedData(client, id, tagIds, metricIds);

        // Xóa file rác
        filesToDelete.forEach(filePath => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Updated successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update Error:', err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;