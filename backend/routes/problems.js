const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
// [QUAN TRỌNG] Khôi phục lại middleware uploadProblemFiles từ storage
const { uploadProblemFiles, resolveFilePath, UPLOADS_ROOT } = require('../utils/storage');
const fs = require('fs');
const path = require('path');

// --- Helper: Xóa file vật lý ---
const deleteProblemFiles = (datasets, coverImage) => {
    if (Array.isArray(datasets)) {
        datasets.forEach(ds => {
            try {
                const p = path.join(UPLOADS_ROOT, ds.path);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch (e) { console.error("Error deleting file:", e.message); }
        });
    }
    if (coverImage && coverImage.startsWith('/uploads/')) {
        try {
            const p = path.join(UPLOADS_ROOT, path.basename(coverImage));
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) { console.error("Error deleting cover:", e.message); }
    }
};

// --- Helper: Đồng bộ Tags & Metrics vào cột JSON ---
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

// GET: Lấy danh sách bài toán
router.get('/', optionalAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username as author_name 
            FROM problems p 
            LEFT JOIN users u ON p.author_id = u.id 
            ORDER BY p.created_at DESC
        `);
        
        const problems = result.rows.map(row => ({
            ...row,
            tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
            metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics || [])
        }));

        res.json({ problems: toCamelCase(problems) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// GET: Lấy chi tiết bài toán
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT p.*, u.username as author_name, u.avatar_url as author_avatar
            FROM problems p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Problem not found' });

        const problem = result.rows[0];
        const parsedProblem = {
            ...problem,
            tags: typeof problem.tags === 'string' ? JSON.parse(problem.tags) : (problem.tags || []),
            metrics: typeof problem.metrics === 'string' ? JSON.parse(problem.metrics) : (problem.metrics || []),
            datasets: typeof problem.datasets === 'string' ? JSON.parse(problem.datasets) : (problem.datasets || [])
        };

        let datasets = parsedProblem.datasets;
        const isOwner = req.userId && req.userId === problem.author_id;
        const isAdmin = req.userRole === 'admin';

        if (!isOwner && !isAdmin) {
            datasets = datasets.filter(d => d.split !== 'ground_truth');
        }

        res.json({
            problem: {
                ...toCamelCase(parsedProblem),
                datasets: datasets.map(d => toCamelCase(d)),
                evaluationScript: parsedProblem.evaluation_script
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// GET: Download File Dataset
router.get('/:id/download/:fileName', optionalAuth, async (req, res) => {
    try {
        const { id, fileName } = req.params;
        const probRes = await pool.query('SELECT * FROM problems WHERE id = $1', [id]);
        if (probRes.rows.length === 0) return res.status(404).json({ message: 'Problem not found' });
        
        const problem = probRes.rows[0];
        const datasets = problem.datasets || [];
        const targetFile = datasets.find(d => d.file_name === fileName || d.path.endsWith(fileName) || path.basename(d.path) === fileName);

        if (!targetFile) return res.status(404).json({ message: 'File not associated' });

        if (targetFile.split === 'ground_truth') {
            const isOwner = req.userId && req.userId === problem.author_id;
            const isAdmin = req.userRole === 'admin';
            if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Unauthorized' });
        }

        const absolutePath = resolveFilePath(targetFile.path);
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: 'File content missing' });

        res.download(absolutePath, targetFile.file_name || fileName);
    } catch (err) {
        console.error("Download Error:", err);
        res.status(500).json({ message: 'Download failed' });
    }
});

// PUT: Freeze/Unfreeze Problem
router.put('/:id/freeze', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT author_id, is_frozen FROM problems WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Problem not found' });
        
        if (req.userRole !== 'admin' && check.rows[0].author_id !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const newState = !check.rows[0].is_frozen;
        await pool.query('UPDATE problems SET is_frozen = $1 WHERE id = $2', [newState, id]);

        res.json({ success: true, isFrozen: newState, message: `Bài toán đã được ${newState ? 'khóa' : 'mở khóa'}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// DELETE: Xóa bài toán
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

        await client.query('DELETE FROM problems WHERE id = $1', [id]);
        await client.query('COMMIT');

        deleteProblemFiles(datasets, cover_image_url);

        res.json({ success: true, message: 'Đã xóa bài toán thành công.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete Error:', err);
        res.status(500).json({ message: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// POST: Tạo bài toán mới (Sử dụng uploadProblemFiles chuẩn)
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

        if (!name || !difficulty) throw new Error('Tên và độ khó là bắt buộc');

        const createDatasetEntry = (file, split) => {
            if (!file) return null;
            return {
                split,
                path: path.relative(UPLOADS_ROOT, file.path),
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

        // Insert Tags & Metrics vào bảng trung gian
        if (tagIds.length > 0) {
            const values = tagIds.flatMap(tid => [problemId, tid]);
            await client.query(
                `INSERT INTO problem_tags (problem_id, tag_id) VALUES ${tagIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                values
            );
        }
        if (metricIds.length > 0) {
            const values = metricIds.flatMap(mid => [problemId, mid]);
            await client.query(
                `INSERT INTO problem_metrics (problem_id, metric_id) VALUES ${metricIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                values
            );
        }

        // [QUAN TRỌNG] Đồng bộ tên tag/metric vào bảng problems
        await syncDenormalizedData(client, problemId, tagIds, metricIds);

        await client.query('COMMIT');
        res.status(201).json({ success: true, problemId, message: 'Tạo bài toán thành công' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create Error:', err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// PUT: Cập nhật bài toán
router.put('/:id', authMiddleware, uploadProblemFiles, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        if (!req.body.problemData) throw new Error('Missing problemData');

        const checkRes = await client.query('SELECT author_id, datasets FROM problems WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) throw new Error('Problem not found');
        if (req.userRole !== 'admin' && checkRes.rows[0].author_id !== req.userId) throw new Error('Unauthorized');

        const currentDatasets = checkRes.rows[0].datasets || [];
        const problemData = JSON.parse(req.body.problemData);
        
        const {
            name, summary, content, difficulty, problemType,
            dataDescription, evaluationScriptContent,
            tagIds = [], metricIds = []
        } = problemData;

        if (!name) throw new Error('Tên bài toán là bắt buộc');

        // Xử lý file
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

        // Cập nhật Tags & Metrics
        await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [id]);
        if (tagIds.length > 0) {
            const values = tagIds.flatMap(tid => [id, tid]);
            await client.query(
                `INSERT INTO problem_tags (problem_id, tag_id) VALUES ${tagIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                values
            );
        }

        await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [id]);
        if (metricIds.length > 0) {
            const values = metricIds.flatMap(mid => [id, mid]);
            await client.query(
                `INSERT INTO problem_metrics (problem_id, metric_id) VALUES ${metricIds.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',')}`,
                values
            );
        }

        // [QUAN TRỌNG] Đồng bộ lại dữ liệu
        await syncDenormalizedData(client, id, tagIds, metricIds);

        // Cleanup
        filesToDelete.forEach(filePath => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Cập nhật thành công' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update Error:', err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;