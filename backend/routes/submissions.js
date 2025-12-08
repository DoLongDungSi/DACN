const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const { resolveFilePath } = require('../utils/storage');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: safely parse datasets field which may be array, json string, or null
function parseDatasetsField(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            // not JSON, ignore
            return [];
        }
    }
    // unknown type
    return [];
}

// ==========================================
// 1) SUBMIT SOLUTION: upload + call judge
// ==========================================
router.post('/', authMiddleware, upload.single('submissionFile'), async (req, res) => {
    const { problemId } = req.body;
    const userId = req.userId;

    if (!req.file || !problemId) {
        return res.status(400).json({ message: 'Thiếu file nộp hoặc ID cuộc thi.' });
    }

    let submissionId = null;

    try {
        // 1. Fetch problem (include datasets if available)
        const probRes = await pool.query(
            'SELECT is_frozen, evaluation_script, ground_truth_path, datasets FROM problems WHERE id = $1',
            [problemId]
        );

        if (probRes.rows.length === 0) return res.status(404).json({ message: 'Cuộc thi không tồn tại.' });

        const problem = probRes.rows[0];
        const isOfficial = !problem.is_frozen;

        // 2. Resolve ground truth path robustly
        let groundTruthPath = null;
        try {
            const datasets = parseDatasetsField(problem.datasets);
            if (datasets && datasets.length) {
                // try several possible key names that might indicate ground truth
                const gtItem = datasets.find(item => {
                    if (!item) return false;
                    if (typeof item === 'string') return item.includes('ground') || item.includes('ground_truth');
                    // item might be object
                    return ['split', 'type', 'role', 'name'].some(k => item[k] === 'ground_truth' || item[k] === 'ground' || (typeof item[k] === 'string' && item[k].toLowerCase().includes('ground')));
                });
                if (gtItem) {
                    if (typeof gtItem === 'string') groundTruthPath = gtItem;
                    else if (gtItem.path) groundTruthPath = gtItem.path;
                }
            }
        } catch (ignore) {
            // continue to fallback
        }

        // fallback to legacy column
        if (!groundTruthPath && problem.ground_truth_path) groundTruthPath = problem.ground_truth_path;

        if (!groundTruthPath) {
            console.error('No ground truth path found for problem', problemId);
            return res.status(500).json({ message: 'Lỗi hệ thống: Không tìm thấy file đáp án gốc.' });
        }

        const fullGtPath = resolveFilePath(groundTruthPath);
        if (!fullGtPath || !fs.existsSync(fullGtPath)) {
            console.error(`CRITICAL: Ground truth missing for problem ${problemId}. Resolved: ${fullGtPath}`);
            return res.status(500).json({ message: 'Lỗi hệ thống: Không tìm thấy file đáp án gốc trên server.' });
        }

        // 3. Insert submission record (running)
        const insertRes = await pool.query(
            'INSERT INTO submissions (problem_id, user_id, status, is_official) VALUES ($1, $2, $3, $4) RETURNING id',
            [problemId, userId, 'running', isOfficial]
        );
        submissionId = insertRes.rows[0].id;

        // 4. Prepare FormData and call microservice
        const MICROSERVICE_URL = process.env.EVALUATION_SERVICE_URL || 'http://microservice:5002/evaluate';
        const form = new FormData();
        form.append('submission_file', req.file.buffer, req.file.originalname);
        form.append('ground_truth_file', fs.createReadStream(fullGtPath));
        form.append('evaluation_script', problem.evaluation_script || '');

        let score = 0.0;
        let status = 'succeeded';
        let error = null;

        try {
            const msRes = await axios.post(MICROSERVICE_URL, form, {
                headers: { ...form.getHeaders() },
                timeout: 300000
            });

            const result = msRes.data || {};
            if (result.error) {
                status = 'failed';
                error = result.error;
            } else {
                const maybeScore = parseFloat(result.score);
                if (!Number.isFinite(maybeScore)) {
                    status = 'failed';
                    error = 'Invalid score format returned from judge.';
                    score = 0.0;
                } else {
                    score = maybeScore;
                }
            }
        } catch (msError) {
            console.error(`Judge Error (submission ${submissionId}):`, msError?.message || msError);
            status = 'failed';
            error = `Lỗi kết nối bộ chấm: ${msError?.message || 'unknown'}`;
        }

        // 5. Update DB with result
        if (status === 'failed') {
            await pool.query(
                "UPDATE submissions SET status = $1, public_score = 0.0, evaluation_details = $2 WHERE id = $3",
                ['failed', JSON.stringify({ error }), submissionId]
            );
        } else {
            await pool.query(
                "UPDATE submissions SET status = $1, public_score = $2 WHERE id = $3",
                ['succeeded', score, submissionId]
            );
        }

        // 6. Fetch full submission to return to client
        const fullSubmissionRes = await pool.query(
            `SELECT s.*, u.username, u.avatar_color, u.avatar_url 
             FROM submissions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1`,
            [submissionId]
        );

        if (fullSubmissionRes.rows.length === 0) throw new Error('Không thể lấy lại thông tin bài nộp sau khi chấm.');

        const rawSub = fullSubmissionRes.rows[0];
        const completeSubmission = {
            ...toCamelCase(rawSub),
            publicScore: rawSub.public_score != null ? parseFloat(rawSub.public_score) : 0.0,
            runtimeMs: rawSub.runtime_ms != null ? parseFloat(rawSub.runtime_ms) : 0.0,
            submittedAt: rawSub.submitted_at || null
        };

        return res.json({
            success: true,
            message: status === 'succeeded' ? 'Chấm điểm hoàn tất.' : 'Chấm điểm thất bại.',
            submission: completeSubmission
        });

    } catch (e) {
        console.error('Submission processing error:', e);
        if (submissionId) {
            try {
                await pool.query("UPDATE submissions SET status = 'failed' WHERE id = $1", [submissionId]);
            } catch (updErr) {
                console.error('Failed to mark submission failed:', updErr);
            }
        }
        return res.status(500).json({ message: 'Lỗi nội bộ server: ' + (e?.message || String(e)) });
    }
});

// ==========================================
// 2) GET MY SUBMISSIONS
// ==========================================
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.*, p.name as problem_name 
             FROM submissions s 
             JOIN problems p ON s.problem_id = p.id 
             WHERE s.user_id = $1 
             ORDER BY s.submitted_at DESC`,
            [req.userId]
        );

        const formattedRows = result.rows.map(row => ({
            ...row,
            public_score: row.public_score != null ? parseFloat(row.public_score) : null,
            runtime_ms: row.runtime_ms != null ? parseFloat(row.runtime_ms) : null
        }));

        return res.json({ submissions: toCamelCase(formattedRows) });
    } catch (e) {
        console.error('Error fetching my submissions:', e);
        return res.status(500).json({ message: 'Lỗi lấy danh sách bài nộp.' });
    }
});

// ==========================================
// 3) GET LEADERBOARD
// ==========================================
router.get('/leaderboard/:problemId', async (req, res) => {
    const { problemId } = req.params;
    try {
        const query = `
            SELECT DISTINCT ON (u.username)
                u.username, u.avatar_color, u.avatar_url,
                s.public_score as score, s.submitted_at as time, s.id as sub_id
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.problem_id = $1 AND s.status = 'succeeded'
              AND s.public_score IS NOT NULL AND s.is_official = TRUE
            ORDER BY u.username, s.public_score DESC, s.submitted_at ASC
        `;
        const result = await pool.query(query, [problemId]);

        const formattedRows = result.rows.map(row => ({
            ...row,
            score: Number.isFinite(parseFloat(row.score)) ? parseFloat(row.score) : 0
        }));

        // Sort by score desc to ensure final ordering
        formattedRows.sort((a, b) => b.score - a.score);

        return res.json({ leaderboard: toCamelCase(formattedRows) });
    } catch (e) {
        console.error('Error fetching leaderboard:', e);
        return res.status(500).json({ message: 'Lỗi lấy bảng xếp hạng.' });
    }
});

module.exports = router;
