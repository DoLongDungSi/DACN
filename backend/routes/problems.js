// backend/routes/problems.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware, ownerOrCreatorMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const multer = require('multer');

const router = express.Router();

// Configure multer for dataset, ground truth, and public test uploads (CSV files, stored in memory)
const storage = multer.memoryStorage();
// Increased file size limit slightly for potentially larger datasets/scripts
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit per file
    fileFilter: (req, file, cb) => {
        // *** ADDED DETAILED LOGGING INSIDE fileFilter ***
        console.log(`[fileFilter] Processing file - Fieldname: ${file.fieldname}, Originalname: ${file.originalname}, Mimetype: ${file.mimetype}`);

        const allowedCsvFields = ['trainCsv', 'testCsv', 'groundTruthCsv'];

        if (allowedCsvFields.includes(file.fieldname)) {
            const isCsvMime = file.mimetype === 'text/csv';
            const isCsvExtension = file.originalname.toLowerCase().endsWith('.csv');

            if (isCsvMime || isCsvExtension) {
                 console.log(`[fileFilter] Accepting CSV file for field '${file.fieldname}'. Mime: ${isCsvMime}, Extension: ${isCsvExtension}`);
                 cb(null, true); // Accept file
            } else {
                console.error(`[fileFilter] REJECTING file for field '${file.fieldname}'. Originalname: ${file.originalname}, Mimetype: ${file.mimetype}. Reason: Not a CSV.`);
                cb(new Error(`Only .csv files are allowed for ${file.fieldname}!`)); // Reject file
            }
        } else {
             // If the fieldname is not one of the CSV fields, accept it (e.g., if other file types were added later)
             console.log(`[fileFilter] Accepting non-CSV field '${file.fieldname}'.`);
             cb(null, true);
        }
    }
}).fields([
    { name: 'trainCsv', maxCount: 1 },
    { name: 'testCsv', maxCount: 1 }, // Public test
    { name: 'groundTruthCsv', maxCount: 1 } // Ground truth file for scoring
]);


// --- Helper function for Create/Update Problem Logic ---
const handleProblemSave = async (req, res, isUpdate = false) => {
  // Log req.files and req.body immediately
  console.log("--- Inside handleProblemSave ---");
  console.log("req.body:", JSON.stringify(req.body));
  console.log("req.files (keys):", req.files ? JSON.stringify(Object.keys(req.files)) : 'req.files is undefined/null');

  const { problemData } = req.body;
  const problemId = isUpdate ? req.params.id : null;
  const authorId = req.userId;
  const userRole = req.userRole;

  if (req.files === undefined || req.files === null) {
      console.error("Critical Error: req.files is missing after Multer middleware ran.");
      return res.status(500).json({ message: 'Server error: Failed to process uploaded files.' });
  }
  if (!problemData) return res.status(400).json({ message: 'Missing problem data.' });

  let parsedData;
  try { parsedData = JSON.parse(problemData); }
  catch (e) { return res.status(400).json({ message: 'Invalid problem data format (must be JSON string).' }); }

  const { name, difficulty, content, problemType, tagIds = [], metricIds = [], existingDatasets = [], evaluationScriptContent } = parsedData;

  // Basic Validations
  if (!name || !difficulty || !content || !problemType || !evaluationScriptContent || !evaluationScriptContent.trim() || !Array.isArray(tagIds) || !Array.isArray(metricIds)) {
      return res.status(400).json({ message: 'Missing required fields (name, difficulty, content, type, script) or invalid tags/metrics format.' });
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) { return res.status(400).json({ message: 'Invalid difficulty value.' }); }
  if (!['classification', 'regression'].includes(problemType)) { return res.status(400).json({ message: 'Invalid problemType value.' }); }


  // --- Dataset, Ground Truth & Public Test Handling ---
   let datasets = (isUpdate && Array.isArray(existingDatasets)) ? existingDatasets.filter(d => d && typeof d === 'object' && d.split && d.filename) : [];
   let groundTruthContent = null;
   let publicTestContent = null;
   const files = req.files;

   // Process Train CSV
   if (files && files.trainCsv && files.trainCsv[0]) {
       const file = files.trainCsv[0];
       datasets = datasets.filter(d => d.split !== 'train');
       datasets.push({ split: 'train', filename: file.originalname });
       console.log(`Processed dataset file (train): ${file.originalname}`);
   }

   // Process Test Public CSV (Save content)
   if (files && files.testCsv && files.testCsv[0]) {
       const file = files.testCsv[0];
       datasets = datasets.filter(d => d.split !== 'public_test');
       datasets.push({ split: 'public_test', filename: file.originalname });
       publicTestContent = file.buffer.toString('utf-8');
       console.log(`Processed public test file: ${file.originalname}, Content length: ${publicTestContent?.length ?? 'N/A'}`);
   }

   // Process Ground Truth CSV (Save content)
   if (files && files.groundTruthCsv && files.groundTruthCsv[0]) {
       const file = files.groundTruthCsv[0];
       groundTruthContent = file.buffer.toString('utf-8');
       console.log(`Processed ground truth file: ${file.originalname}, Content length: ${groundTruthContent?.length ?? 'N/A'}`);
       console.log(`GRND TRUTH CHECK: Is null? ${groundTruthContent === null}, Is undefined? ${groundTruthContent === undefined}, Is empty? ${groundTruthContent === ""}`);
       datasets = datasets.filter(d => d.split !== 'ground_truth');
       datasets.push({ split: 'ground_truth', filename: file.originalname });
   } else {
        console.log("No 'groundTruthCsv' field/file found in req.files AFTER processing."); // Log again after trying to access
   }


   // --- Validation after processing files ---
    const hasTrainMeta = datasets.some(d => d.split === 'train');
    const hasPublicTestMeta = datasets.some(d => d.split === 'public_test');

    if (!isUpdate && !hasTrainMeta) { return res.status(400).json({ message: `Missing required dataset file: train.` }); }
    if (!isUpdate && !hasPublicTestMeta) { return res.status(400).json({ message: `Missing required dataset file: public test.` }); }
    if (isUpdate && !hasTrainMeta) { console.log("Train dataset metadata missing, allowing update."); }
    if (isUpdate && !hasPublicTestMeta) { console.log("Public test dataset metadata missing, allowing update."); }


   // --- Database Transaction ---
   let client;
   let savedProblemId = problemId;

   try {
      client = await pool.connect();

      // Determine groundTruthContent to save
      if (!groundTruthContent && isUpdate && problemId) {
          const existingRes = await client.query('SELECT ground_truth_content FROM problems WHERE id = $1', [problemId]);
          if (existingRes.rows.length > 0 && existingRes.rows[0].ground_truth_content) {
              groundTruthContent = existingRes.rows[0].ground_truth_content;
              console.log("Update: No new GT file, keeping existing.");
          } else {
               console.error(`Update Error: Existing GT content not found for problem ${problemId}, and no new file provided.`);
               throw new Error('Ground truth content is missing for update and not provided.');
          }
      } else if (!groundTruthContent && !isUpdate) {
            console.error(`Create Error: groundTruthContent is falsy before DB check. isUpdate=${isUpdate}.`);
            throw new Error('Ground truth file/content missing when creating a new problem.');
      }

       // Determine publicTestContent to save
       if (!publicTestContent && isUpdate && problemId) {
           const existingRes = await client.query('SELECT public_test_content FROM problems WHERE id = $1', [problemId]);
           if (existingRes.rows.length > 0 && existingRes.rows[0].public_test_content) {
               publicTestContent = existingRes.rows[0].public_test_content;
               console.log("Update: No new public test file, keeping existing.");
           } else {
               console.error(`Update Error: Existing public test content not found for problem ${problemId}, and no new file provided.`);
               throw new Error('Public test content is missing for update and not provided.');
           }
       } else if (!publicTestContent && !isUpdate) {
           console.error(`Create Error: publicTestContent is falsy. isUpdate=${isUpdate}.`);
           throw new Error('Public test file/content missing when creating a new problem.');
       }

        // START TRANSACTION
        await client.query('BEGIN');

        // Ownership check for updates
        if (isUpdate && userRole !== 'owner') {
            const ownerCheck = await client.query('SELECT author_id FROM problems WHERE id = $1', [problemId]);
            if (ownerCheck.rows.length === 0) { await client.query('ROLLBACK'); throw new Error('Problem not found.'); }
            if (ownerCheck.rows[0].author_id !== authorId) { await client.query('ROLLBACK'); throw new Error('Not authorized to update this problem.'); }
        }

        // Insert/Update Problem
        const datasetsJson = JSON.stringify(datasets);
        if (isUpdate) {
           console.log(`Updating problem ${problemId}`);
           const updateQuery = `UPDATE problems SET name=$1, difficulty=$2, content=$3, problem_type=$4, datasets=$5, evaluation_script=$6, ground_truth_content=$7, public_test_content=$8 WHERE id = $9 RETURNING id`;
           const updateResult = await client.query(updateQuery, [name, difficulty, content, problemType, datasetsJson, evaluationScriptContent, groundTruthContent, publicTestContent, problemId]);
            if (updateResult.rowCount === 0) { await client.query('ROLLBACK'); throw new Error('Update failed. Problem not found or no changes.'); }
            savedProblemId = updateResult.rows[0].id;
        } else {
           console.log(`Creating new problem`);
           const insertQuery = `INSERT INTO problems (name, difficulty, content, problem_type, author_id, datasets, evaluation_script, ground_truth_content, public_test_content) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
           const insertResult = await client.query(insertQuery, [name, difficulty, content, problemType, authorId, datasetsJson, evaluationScriptContent, groundTruthContent, publicTestContent]);
           savedProblemId = insertResult.rows[0].id;
        }
        console.log(`Problem ${isUpdate ? 'updated' : 'created'} ID: ${savedProblemId}`);

        // Tags & Metrics
        await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [savedProblemId]);
        await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [savedProblemId]);
        const validTagIds = tagIds.filter(id => typeof id === 'number' && !isNaN(id));
        const validMetricIds = metricIds.filter(id => typeof id === 'number' && !isNaN(id));
        const tagPromises = validTagIds.map(tagId => client.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [savedProblemId, tagId]));
        const metricPromises = validMetricIds.map((metricId, index) => client.query('INSERT INTO problem_metrics (problem_id, metric_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [savedProblemId, metricId, index === 0]));
        await Promise.all([...tagPromises, ...metricPromises]);
        console.log(`Tags/Metrics updated for problem ID: ${savedProblemId}`);

        // Commit Transaction
        await client.query('COMMIT');
        console.log(`Transaction committed for problem ID: ${savedProblemId}`);

        // Fetch final data for response
         const finalProblemRes = await pool.query(
             `SELECT p.id, p.name, p.difficulty, p.content, p.problem_type, p.author_id, p.created_at,
                     u.username as author_username, p.datasets,
                     (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script,
                     (CASE WHEN p.ground_truth_content IS NOT NULL AND p.ground_truth_content != '' THEN true ELSE false END) as has_ground_truth,
                     (CASE WHEN p.public_test_content IS NOT NULL AND p.public_test_content != '' THEN true ELSE false END) as has_public_test,
                     COALESCE(tags.tag_ids, '{}'::int[]) as tags,
                     COALESCE(metrics_agg.metric_ids, '{}'::int[]) as metrics,
                     COALESCE(metrics_details.details, '[]'::jsonb) as metrics_details
              FROM problems p
              LEFT JOIN users u ON p.author_id = u.id
              LEFT JOIN (SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids FROM problem_tags WHERE problem_id = $1 GROUP BY problem_id) tags ON p.id = tags.problem_id
              LEFT JOIN (SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids FROM problem_metrics WHERE problem_id = $1 GROUP BY problem_id) metrics_agg ON p.id = metrics_agg.problem_id
              LEFT JOIN (SELECT pm.problem_id, jsonb_agg(jsonb_build_object('id', m.id, 'key', m.key, 'direction', m.direction, 'isPrimary', pm.is_primary) ORDER BY m.key) as details FROM problem_metrics pm JOIN metrics m ON pm.metric_id = m.id WHERE pm.problem_id = $1 GROUP BY pm.problem_id) metrics_details ON p.id = metrics_details.problem_id
              WHERE p.id = $1`,
             [savedProblemId]
         );

          if (finalProblemRes.rows.length === 0) {
              console.error(`Consistency Error: Could not retrieve problem data (ID: ${savedProblemId}) immediately after saving.`);
              throw new Error('Could not retrieve problem data after saving.');
          }
          console.log(`Successfully saved/fetched problem ${savedProblemId} for response.`);
          const responseProblem = finalProblemRes.rows[0];
          responseProblem.metrics_details = responseProblem.metrics_details || []; // Ensure it's an array

        // Send successful response
        res.status(isUpdate ? 200 : 201).json({ problem: toCamelCase(responseProblem) });

   } catch (error) {
     if (client) { try { await client.query('ROLLBACK'); console.log("Transaction rolled back."); } catch (rbErr) { console.error("Rollback failed:", rbErr); } }
     console.error(`Error saving problem (isUpdate: ${isUpdate}):`, error);
     res.status(500).json({ message: `Failed to save problem. Error: ${(error instanceof Error ? error.message : String(error))}` });
   } finally {
     if (client) client.release();
   }
};

// --- Create Problem Route ---
router.post(
  '/',
  authMiddleware,
  ownerOrCreatorMiddleware,
  (req, res, next) => {
      console.log("POST /problems - Running Multer middleware...");
      upload(req, res, (err) => {
          if (err instanceof multer.MulterError) {
              console.error("Multer error on POST:", err);
              return res.status(400).json({ message: `File upload error: ${err.code} - ${err.message}` });
          } else if (err) {
              console.error("Unknown file upload error on POST:", err);
              // Check if it's the specific fileFilter error
              if (err.message && err.message.startsWith('Only .csv files are allowed')) {
                  return res.status(400).json({ message: err.message });
              }
              return res.status(500).json({ message: `File processing error: ${err.message}` }); // More generic for other errors
          }
           console.log("POST /problems - Multer finished successfully.");
           console.log("Files received by Multer (POST):", req.files ? JSON.stringify(Object.keys(req.files)) : 'None');
           next();
      });
  },
  (req, res) => handleProblemSave(req, res, false)
);

// --- Update Problem Route ---
router.put(
  '/:id',
  authMiddleware,
  ownerOrCreatorMiddleware,
   (req, res, next) => {
       console.log(`PUT /problems/${req.params.id} - Running Multer middleware...`);
      upload(req, res, (err) => {
           if (err instanceof multer.MulterError) {
              console.error(`Multer error on PUT /problems/${req.params.id}:`, err);
              return res.status(400).json({ message: `File upload error: ${err.code} - ${err.message}` });
          } else if (err) {
              console.error(`Unknown file upload error on PUT /problems/${req.params.id}:`, err);
               if (err.message && err.message.startsWith('Only .csv files are allowed')) {
                  return res.status(400).json({ message: err.message });
              }
              return res.status(500).json({ message: `File processing error: ${err.message}` });
          }
           console.log(`PUT /problems/${req.params.id} - Multer finished successfully.`);
           console.log("Files received by Multer (PUT):", req.files ? JSON.stringify(Object.keys(req.files)) : 'None');
           next();
      });
  },
  (req, res) => handleProblemSave(req, res, true)
);

// --- Delete Problem Route ---
router.delete('/:id', authMiddleware, ownerOrCreatorMiddleware, async (req, res) => {
  const { id } = req.params;
  const problemId = Number(id);
  const userId = req.userId;
  const userRole = req.userRole;

  if (isNaN(problemId)) {
    return res.status(400).json({ message: 'Invalid ID.' });
  }

  const client = await pool.connect();
  try {
     await client.query('BEGIN');

     // Check ownership or if user is owner
     if (userRole !== 'owner') {
         const ownerCheck = await client.query('SELECT author_id FROM problems WHERE id = $1', [problemId]);
         if (ownerCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Problem not found.' });
         }
         if (ownerCheck.rows[0].author_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Not authorized to delete this problem.' });
         }
     }

      // Explicitly delete related data before deleting the problem
      console.log(`Deleting relationships for problem ${problemId}...`);
      await client.query(`DELETE FROM votes WHERE comment_id IN (SELECT id FROM discussion_comments WHERE post_id IN (SELECT id FROM discussion_posts WHERE problem_id = $1))`, [problemId]);
      await client.query(`DELETE FROM votes WHERE post_id IN (SELECT id FROM discussion_posts WHERE problem_id = $1)`, [problemId]);
      await client.query(`DELETE FROM discussion_comments WHERE post_id IN (SELECT id FROM discussion_posts WHERE problem_id = $1)`, [problemId]);
      await client.query('DELETE FROM discussion_posts WHERE problem_id = $1', [problemId]);
      await client.query('DELETE FROM submissions WHERE problem_id = $1', [problemId]);
      await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [problemId]);
      await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [problemId]);

     // Perform the final problem deletion
     console.log(`Deleting problem ${problemId} itself...`);
     const deleteResult = await client.query('DELETE FROM problems WHERE id = $1 RETURNING id', [problemId]);

     if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Problem not found during final delete step.' });
     }

     await client.query('COMMIT');
     console.log(`Successfully deleted problem ${problemId}.`);
     res.status(204).send();

  } catch (error) {
    try { await client.query('ROLLBACK'); console.log("Transaction rolled back due to deletion error."); }
    catch (rollbackError) { console.error("Error rolling back transaction during delete:", rollbackError); }
     console.error(`Error deleting problem ${problemId}:`, error);
     const msg = (error instanceof Error ? error.message : String(error));
     res.status(500).json({ message: `Server error while deleting problem. ${msg}` });
  } finally {
    client.release();
  }
});

// --- Get All Problems Route ---
router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
         `SELECT
              p.id, p.name, p.difficulty, p.problem_type, p.author_id, p.created_at,
              u.username as author_username,
              COALESCE(tags.tag_ids, '{}'::int[]) as tags,
              m.key as primary_metric_key
          FROM problems p
          LEFT JOIN users u ON p.author_id = u.id
          LEFT JOIN (
              SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids
              FROM problem_tags GROUP BY problem_id
          ) tags ON p.id = tags.problem_id
          LEFT JOIN problem_metrics pm ON p.id = pm.problem_id AND pm.is_primary = TRUE
          LEFT JOIN metrics m ON pm.metric_id = m.id
          ORDER BY p.id`
      );
      res.json({ problems: toCamelCase(result.rows) });
    } catch (error) {
      console.error('Error fetching problems list:', error);
      res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài toán.' });
    }
});

// --- Get Single Problem Route ---
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const problemId = Number(id);
    if (isNaN(problemId)) { return res.status(400).json({ message: 'Invalid ID.' }); }

    try {
       const result = await pool.query(
           `SELECT
               p.id, p.name, p.difficulty, p.content, p.problem_type, p.author_id, p.created_at,
               u.username as author_username,
               p.datasets,
               (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script,
               (CASE WHEN p.ground_truth_content IS NOT NULL AND p.ground_truth_content != '' THEN true ELSE false END) as has_ground_truth,
               (CASE WHEN p.public_test_content IS NOT NULL AND p.public_test_content != '' THEN true ELSE false END) as has_public_test,
               COALESCE(tags.tag_ids, '{}'::int[]) as tags,
               COALESCE(metrics_agg.metric_ids, '{}'::int[]) as metrics,
               COALESCE(metrics_details.details, '[]'::jsonb) as metrics_details
            FROM problems p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN (SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids FROM problem_tags WHERE problem_id = $1 GROUP BY problem_id) tags ON p.id = tags.problem_id
            LEFT JOIN (SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids FROM problem_metrics WHERE problem_id = $1 GROUP BY problem_id) metrics_agg ON p.id = metrics_agg.problem_id
            LEFT JOIN (SELECT pm.problem_id, jsonb_agg(jsonb_build_object('id', m.id, 'key', m.key, 'direction', m.direction, 'isPrimary', pm.is_primary) ORDER BY m.key) as details FROM problem_metrics pm JOIN metrics m ON pm.metric_id = m.id WHERE pm.problem_id = $1 GROUP BY pm.problem_id) metrics_details ON p.id = metrics_details.problem_id
            WHERE p.id = $1`,
           [problemId]
       );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Problem not found.' });
      }
      const problemData = result.rows[0];
      problemData.metrics_details = problemData.metrics_details || [];

      res.json({ problem: toCamelCase(problemData) });
    } catch (error) {
      console.error(`Error fetching problem ${problemId}:`, error);
      res.status(500).json({ message: 'Lỗi server khi lấy chi tiết bài toán.' });
    }
});

module.exports = router;

