// backend/routes/submissions.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { singleUploadMiddleware } = require('../config/multer');
const { toCamelCase } = require('../utils/helpers');
const { readFileContent } = require('../utils/storage');
const axios = require('axios');
const router = express.Router();


// --- Create Submission Route ---
router.post(
    '/',
    authMiddleware,
    singleUploadMiddleware('submissionFile'),
    async (req, res) => {
        const { problemId } = req.body;
        const userId = req.userId;
        const submissionFile = req.file;

        // --- Validation ---
        if (!problemId) return res.status(400).json({ message: 'Problem ID is required.' });
        if (!submissionFile) return res.status(400).json({ message: 'Submission file is required.' });
        if (!submissionFile.originalname.toLowerCase().endsWith('.csv')) {
             return res.status(400).json({ message: 'Submission file must be a .csv file.' });
        }
        console.log(`Received submission for problem ${problemId} from user ${userId}: ${submissionFile.originalname}`);

        let client;
        try {
            client = await pool.connect();

            // Fetch problem details: script plus paths for ground truth and public test
            const problemRes = await client.query(
                `SELECT evaluation_script, ground_truth_path, public_test_path FROM problems WHERE id = $1`,
                 [problemId]
            );

            if (problemRes.rows.length === 0) {
                return res.status(404).json({ message: 'Problem not found.' });
            }

            const evaluationScript = problemRes.rows[0].evaluation_script;
            const groundTruthContent = readFileContent(problemRes.rows[0].ground_truth_path);
            const publicTestContent = readFileContent(problemRes.rows[0].public_test_path);

            // Check if all necessary data is present
            if (!evaluationScript) {
                return res.status(500).json({ message: 'Evaluation script for this problem is missing.' });
            }
            if (!groundTruthContent) {
                 return res.status(500).json({ message: 'Ground truth file for this problem is missing on disk.' });
            }
            if (!publicTestContent) {
                return res.status(500).json({ message: 'Public test file for this problem is missing on disk.' });
            }



            // --- Call Evaluation Microservice ---
            const microserviceUrl = process.env.EVALUATION_SERVICE_URL || 'http://microservice:5002/evaluate';
            console.log(`Calling evaluation microservice at ${microserviceUrl}`);

            let evaluationResult;
            try {
                // Send submission, script, ground truth, AND public test content
                const response = await axios.post(microserviceUrl, {
                    submission_file_content: submissionFile.buffer.toString('utf-8'),
                    ground_truth_content: groundTruthContent,
                    public_test_content: publicTestContent, // Send the fetched content
                    evaluation_script_content: evaluationScript,
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000 // 60 seconds timeout
                });
                evaluationResult = response.data;
                console.log('Evaluation microservice response:', evaluationResult);

                 // MODIFIED: Validate based on microservice's structured response
                 // Microservice now handles validation of score >= 0 on success
                 if (evaluationResult.status === 'succeeded' && (typeof evaluationResult.score !== 'number' || evaluationResult.score < 0)) {
                     console.error("Microservice reported success but score is invalid:", evaluationResult.score);
                     evaluationResult.status = 'failed';
                     evaluationResult.error = evaluationResult.error || "Invalid score value received from evaluator.";
                     evaluationResult.score = null; // Ensure score is null on failure
                 }

            } catch (microserviceError) {
                 const responseData = microserviceError?.response?.data;
                 let errorDetails = "Unknown evaluation service error.";
                 let statusFromError = 'failed';
                 let scoreFromError = null; // Keep score null on error unless explicitly set below

                 if (responseData) {
                     errorDetails = responseData.error || errorDetails;
                     // Microservice might return a score even on failure (-1 or 0)
                     if (typeof responseData.score === 'number') {
                          scoreFromError = responseData.score; // Keep the score reported by microservice
                     }
                     // Use the status from microservice if available
                     statusFromError = responseData.status || statusFromError;
                 } else if (microserviceError instanceof Error) {
                    errorDetails = microserviceError.message;
                 } else {
                     errorDetails = String(microserviceError);
                 }

                console.error('Error calling evaluation microservice:', errorDetails);
                // Ensure runtime is null if the call itself failed badly
                const runtimeOnError = (responseData && typeof responseData.runtime_ms === 'number') ? responseData.runtime_ms : null;
                evaluationResult = {
                    status: statusFromError, // Use status from response if possible
                    error: `Evaluation service error: ${errorDetails}`,
                    score: scoreFromError, // Keep score (-1 or 0) if microservice provided it
                    runtime_ms: runtimeOnError
                };
            }

            // --- Database Insertion ---
            // MODIFIED: Determine final status based on microservice response and reported score
            let finalStatus = 'failed'; // Default to failed
            let finalScore = null; // Default to null score
            let finalDetails = evaluationResult.error ? { error: evaluationResult.error } : null;

            if (evaluationResult.status === 'succeeded' && typeof evaluationResult.score === 'number' && evaluationResult.score >= 0) {
                 finalStatus = 'succeeded';
                 finalScore = evaluationResult.score;
            } else {
                // If failed, check the score reported by microservice to set a more specific status
                if (typeof evaluationResult.score === 'number') {
                    if (evaluationResult.score === -1.0) {
                        finalStatus = 'format_error'; // Specific status for format error
                        if (finalDetails) finalDetails.type = 'FORMAT_ERROR';
                         else finalDetails = { type: 'FORMAT_ERROR', error: 'Submission format check failed.'};
                    } else if (evaluationResult.score === 0.0) {
                         // Check if error message indicates runtime error rather than just score 0
                         if (evaluationResult.error && evaluationResult.error.toLowerCase().includes('script exited') || evaluationResult.error.toLowerCase().includes('traceback')) {
                            finalStatus = 'runtime_error'; // Specific status for script error after format check
                            if (finalDetails) finalDetails.type = 'RUNTIME_ERROR';
                            else finalDetails = { type: 'RUNTIME_ERROR', error: 'Evaluation script runtime error.' };
                         } else {
                             // It might be a valid score of 0, but status is failed (e.g., timeout before score write)
                             finalStatus = 'failed'; // Keep generic failed for ambiguity or timeout
                             if (finalDetails) finalDetails.type = 'FAILED_EXECUTION';
                             else finalDetails = { type: 'FAILED_EXECUTION', error: evaluationResult.error || 'Evaluation failed.' };
                         }
                    } else {
                         // Some other negative score or unexpected score on failure? Keep generic failed.
                         finalStatus = 'failed';
                         if (finalDetails) finalDetails.type = 'UNKNOWN_FAILURE';
                         else finalDetails = { type: 'UNKNOWN_FAILURE', error: evaluationResult.error || 'Unknown evaluation failure.' };
                    }
                } else {
                     // Status is 'failed' and score is null (e.g., timeout, setup error)
                     finalStatus = 'failed'; // Keep generic failed
                     if (finalDetails) finalDetails.type = 'SYSTEM_ERROR'; // Or more specific like TIMEOUT
                     else finalDetails = { type: 'SYSTEM_ERROR', error: evaluationResult.error || 'Evaluation system error.' };
                }
                finalScore = null; // Ensure score is null for all failure types in DB
            }

            console.log(`Final Status: ${finalStatus}, Final Score for DB: ${finalScore}`);


            const insertQuery = `
              INSERT INTO submissions (problem_id, user_id, status, public_score, runtime_ms, evaluation_details)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING *`;

            const result = await client.query(insertQuery, [
                problemId,
                userId,
                finalStatus, // Use the determined final status
                finalScore, // Save actual score (>=0) or null
                evaluationResult.runtime_ms || null,
                finalDetails ? JSON.stringify(finalDetails) : null // Store structured details
            ]);

            const finalSub = result.rows[0];

            // Prepare response data
            finalSub.public_score = finalSub.public_score ? parseFloat(finalSub.public_score) : null;
            finalSub.runtime_ms = finalSub.runtime_ms ? parseFloat(finalSub.runtime_ms) : null;
            try {
                if (finalSub.evaluation_details && typeof finalSub.evaluation_details === 'string') {
                    finalSub.evaluation_details = JSON.parse(finalSub.evaluation_details);
                }
            } catch (parseError) {
                console.warn("Failed to parse evaluation_details from DB:", parseError);
                finalSub.evaluation_details = { error: "Failed to parse details" };
             }

            const userRes = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
            finalSub.username = userRes.rows.length > 0 ? userRes.rows[0].username : 'Unknown User';

            res.status(201).json({ submission: toCamelCase(finalSub) });

        } catch (error) {
            console.error('Error creating submission in backend:', error);
            if (error && typeof error === 'object' && 'code' in error && error.code === '23503' && 'constraint' in error && error.constraint === 'submissions_problem_id_fkey') {
                return res.status(404).json({ message: 'Problem not found.' });
            }
            res.status(500).json({ message: 'Lỗi server khi xử lý bài nộp.' });
        } finally {
            if (client) { client.release(); }
        }
    }
);

// --- Get Submissions ---
// (No changes needed based on eval report)
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const { problemId } = req.query; // Allow filtering by problem

    try {
        let query = `
            SELECT s.*, p.name as problem_name, u.username
            FROM submissions s
            JOIN problems p ON s.problem_id = p.id
            JOIN users u ON s.user_id = u.id
            WHERE s.user_id = $1`;
        const queryParams = [userId];

        if (problemId) {
            query += ` AND s.problem_id = $2`;
            queryParams.push(Number(problemId));
        }
        query += ` ORDER BY s.submitted_at DESC`;

        const result = await pool.query(query, queryParams);

        const processedSubmissions = result.rows.map(sub => {
            let evaluationDetails = null;
            try {
                // Ensure evaluation_details is parsed if it's a string
                if (sub.evaluation_details && typeof sub.evaluation_details === 'string') {
                    evaluationDetails = JSON.parse(sub.evaluation_details);
                } else if (sub.evaluation_details && typeof sub.evaluation_details === 'object') {
                    // Already an object (or null)
                    evaluationDetails = sub.evaluation_details;
                }
            } catch (parseError) {
                console.warn("Failed to parse evaluation_details from DB for display:", parseError);
                evaluationDetails = { error: "Failed to parse details" }; // Provide a fallback object
            }
            return {
                ...sub,
                public_score: sub.public_score ? parseFloat(sub.public_score) : null,
                runtime_ms: sub.runtime_ms ? parseFloat(sub.runtime_ms) : null,
                evaluation_details: evaluationDetails, // Assign potentially parsed object
            };
        });
        res.json({ submissions: toCamelCase(processedSubmissions) });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài nộp.' });
    }
});

module.exports = router;
