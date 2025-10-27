// backend/routes/submissions.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { singleUploadMiddleware } = require('../config/multer'); // Use single file upload
const { toCamelCase } = require('../utils/helpers');

const router = express.Router();

// --- Create Submission Route ---
router.post(
    '/',
    authMiddleware,
    singleUploadMiddleware('submissionFile'), // Expecting a single file named 'submissionFile'
    async (req, res) => {
        const { problemId } = req.body;
        const userId = req.userId;
        const submissionFile = req.file; // File data from multer

        // --- Validation ---
        if (!problemId) {
            return res.status(400).json({ message: 'Problem ID is required.' });
        }
         // Check if file exists (multer puts it in req.file)
         if (!submissionFile) {
             return res.status(400).json({ message: 'Submission file is required.' });
         }
         // Optional: Add more file validation (e.g., check extension, size again although multer handles limits)
         // console.log("Received submission file:", submissionFile.originalname, submissionFile.mimetype, submissionFile.size);


        // --- Simulation/Placeholder Logic ---
        // TODO: Replace this with actual model evaluation logic
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000)); // Simulate processing time

        let simulatedScore;
        let evaluationStatus = 'succeeded'; // Assume success for now
        let runtime = 1500 + Math.random() * 2000; // Simulate runtime

        try {
            // Check if problem exists and get its type for scoring simulation
            const problemRes = await pool.query('SELECT problem_type FROM problems WHERE id = $1', [problemId]);
            if (problemRes.rows.length === 0) {
                return res.status(404).json({ message: 'Problem not found.' });
            }

            // Simulate score based on problem type
            const problemType = problemRes.rows[0].problem_type;
            if (problemType === 'classification') {
                simulatedScore = Math.random() * (0.95 - 0.6) + 0.6; // Simulate accuracy score
            } else if (problemType === 'regression') {
                simulatedScore = Math.random() * (30000 - 10000) + 10000; // Simulate RMSE score
            } else {
                 // Handle unknown problem type if necessary
                 console.warn(`Unknown problem type "${problemType}" for problem ID ${problemId}. Using default score.`);
                 simulatedScore = Math.random(); // Default random score
            }

            // --- Database Insertion ---
            const insertQuery = `
              INSERT INTO submissions (problem_id, user_id, status, public_score, runtime_ms)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *`; // Return the newly inserted row

            const result = await pool.query(insertQuery, [
                problemId,
                userId,
                evaluationStatus,
                simulatedScore,
                runtime,
            ]);

            const finalSub = result.rows[0];

            // Convert numeric strings back to numbers for the response
            finalSub.public_score = finalSub.public_score ? parseFloat(finalSub.public_score) : null;
            finalSub.runtime_ms = finalSub.runtime_ms ? parseFloat(finalSub.runtime_ms) : null;

            // Fetch username to include in the response (optional but useful for frontend)
            const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            if (userRes.rows.length > 0) {
                finalSub.username = userRes.rows[0].username;
            } else {
                finalSub.username = 'Unknown User'; // Fallback
            }


            res.status(201).json({ submission: toCamelCase(finalSub) });

        } catch (error) {
            console.error('Error creating submission:', error);
            // Handle specific DB errors if needed
            res.status(500).json({ message: 'Lỗi server khi xử lý bài nộp.' });
        }
    }
);

// --- Get Submissions (e.g., for "My Submissions" page) ---
// Optional: Add filtering by problemId or userId if needed
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.userId; // Get user ID from token

    try {
        const query = `
            SELECT s.*, p.name as problem_name, u.username
            FROM submissions s
            JOIN problems p ON s.problem_id = p.id
            JOIN users u ON s.user_id = u.id
            WHERE s.user_id = $1
            ORDER BY s.submitted_at DESC`; // Order by most recent

        const result = await pool.query(query, [userId]);

        const processedSubmissions = result.rows.map(sub => ({
             ...sub,
             public_score: sub.public_score ? parseFloat(sub.public_score) : null,
             runtime_ms: sub.runtime_ms ? parseFloat(sub.runtime_ms) : null,
        }));

        res.json({ submissions: toCamelCase(processedSubmissions) });

    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài nộp.' });
    }
});


module.exports = router;
