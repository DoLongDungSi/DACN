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
        // Allow only CSV files for these specific fields
        if (['trainCsv', 'testCsv', 'groundTruthCsv'].includes(file.fieldname)) {
            if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
                 cb(null, true);
            } else {
                // Log the rejected file
                console.error(`Rejected file: ${file.originalname} (fieldname: ${file.fieldname}, mimetype: ${file.mimetype}). Reason: Not a CSV.`);
                cb(new Error(`Only .csv files are allowed for ${file.fieldname}!`));
            }
        } else {
             // If other fields are expected, allow them, otherwise you might restrict further.
             // For now, allowing others.
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
  // *** NEW LOGGING: Log req.files and req.body immediately ***
  console.log("--- Inside handleProblemSave ---");
  console.log("req.body:", JSON.stringify(req.body)); // Log parsed body (problemData should be here)
  console.log("req.files:", req.files ? JSON.stringify(Object.keys(req.files)) : 'req.files is undefined/null'); // Log ONLY the keys of req.files to see what Multer parsed
  // *** END NEW LOGGING ***

  const { problemData } = req.body; // JSON string with problem details + script content
  const problemId = isUpdate ? req.params.id : null;
  const authorId = req.userId;
  const userRole = req.userRole;

  // Check if req.files exists before proceeding
  // Note: req.files might be an empty object {} if no files were uploaded, which is okay for updates.
  // We only fail if it's strictly undefined/null, indicating a middleware issue.
  if (req.files === undefined || req.files === null) {
      console.error("Critical Error: req.files is missing after Multer middleware ran.");
      return res.status(500).json({ message: 'Server error: Failed to process uploaded files.' });
  }


  if (!problemData) return res.status(400).json({ message: 'Missing problem data.' });

  let parsedData;
  try { parsedData = JSON.parse(problemData); }
  catch (e) { return res.status(400).json({ message: 'Invalid problem data format (must be JSON string).' }); }

  // Destructure including evaluationScriptContent
  const { name, difficulty, content, problemType, tagIds = [], metricIds = [], existingDatasets = [], evaluationScriptContent } = parsedData;

  // Basic Validations
  if (!name || !difficulty || !content || !problemType || !evaluationScriptContent || !evaluationScriptContent.trim() || !Array.isArray(tagIds) || !Array.isArray(metricIds)) {
      return res.status(400).json({ message: 'Missing required fields (name, difficulty, content, type, script) or invalid tags/metrics format.' });
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ message: 'Invalid difficulty value.' });
  }
   if (!['classification', 'regression'].includes(problemType)) {
       return res.status(400).json({ message: 'Invalid problemType value.' });
   }


  // --- Dataset, Ground Truth & Public Test Handling ---
   let datasets = (isUpdate && Array.isArray(existingDatasets))
       ? existingDatasets.filter(d => d && typeof d === 'object' && d.split && d.filename) // Keep existing metadata
       : [];
   let groundTruthContent = null; // Initialize ground truth content
   let publicTestContent = null; // Initialize public test content

   const files = req.files; // Access uploaded files

   // Process Train CSV
   if (files && files.trainCsv && files.trainCsv[0]) {
       const file = files.trainCsv[0];
       datasets = datasets.filter(d => d.split !== 'train'); // Remove old train metadata
       datasets.push({ split: 'train', filename: file.originalname }); // Store only metadata
       console.log(`Processed dataset file (train): ${file.originalname}`);
   }

   // Process Test Public CSV (Save content)
   if (files && files.testCsv && files.testCsv[0]) {
       const file = files.testCsv[0];
       datasets = datasets.filter(d => d.split !== 'public_test'); // Remove old public test metadata
       datasets.push({ split: 'public_test', filename: file.originalname }); // Store only metadata
       publicTestContent = file.buffer.toString('utf-8'); // Store content
       console.log(`Processed public test file: ${file.originalname}, Content length: ${publicTestContent?.length ?? 'N/A'}`);
   }

   // Process Ground Truth CSV (Save content)
   // Check specifically for the groundTruthCsv key provided by Multer config
   if (files && files.groundTruthCsv && files.groundTruthCsv[0]) {
       const file = files.groundTruthCsv[0];
       groundTruthContent = file.buffer.toString('utf-8');
       console.log(`Processed ground truth file: ${file.originalname}, Content length: ${groundTruthContent?.length ?? 'N/A'}`);
       console.log(`GRND TRUTH CHECK: Is groundTruthContent null? ${groundTruthContent === null}`);
       console.log(`GRND TRUTH CHECK: Is groundTruthContent undefined? ${groundTruthContent === undefined}`);
       console.log(`GRND TRUTH CHECK: Is groundTruthContent empty string? ${groundTruthContent === ""}`);
       datasets = datasets.filter(d => d.split !== 'ground_truth');
       datasets.push({ split: 'ground_truth', filename: file.originalname });
   } else {
        // This log now confirms Multer didn't add it to req.files OR no file was sent
        console.log("No 'groundTruthCsv' field/file found in req.files.");
   }


   // --- Validation after processing files ---
    const hasTrainMeta = datasets.some(d => d.split === 'train');
    const hasPublicTestMeta = datasets.some(d => d.split === 'public_test');

    // For CREATE: train and public test metadata MUST exist (implying files were uploaded or handled)
    if (!isUpdate && !hasTrainMeta) {
        return res.status(400).json({ message: `Missing required dataset file: train.` });
    }
    if (!isUpdate && !hasPublicTestMeta) {
        return res.status(400).json({ message: `Missing required dataset file: public test.` });
    }
    // For UPDATE: Log if missing but allow update to proceed
    if (isUpdate && !hasTrainMeta) {
        console.log("Train dataset metadata missing, but allowing update.");
    }
    if (isUpdate && !hasPublicTestMeta) {
        console.log("Public test dataset metadata missing, but allowing update.");
    }


   // --- Database Transaction ---
   let client;
   let savedProblemId = problemId;

   try {
      client = await pool.connect();

      // Determine content to save: use new upload OR existing if not updating GT
      if (!groundTruthContent && isUpdate && problemId) {
          const existingRes = await client.query('SELECT ground_truth_content FROM problems WHERE id = $1', [problemId]);
          if (existingRes.rows.length > 0 && existingRes.rows[0].ground_truth_content) {
              groundTruthContent = existingRes.rows[0].ground_truth_content;
              console.log("Update: No new ground truth file, keeping existing one.");
          } else {
               console.error(`Update Error: Existing ground truth content not found for problem ${problemId}, and no new file provided.`);
               throw new Error('Ground truth content is missing for update and not provided.');
          }
      } else if (!groundTruthContent && !isUpdate) {
            console.error(`Create Error: groundTruthContent is still falsy just before DB check. isUpdate=${isUpdate}. This should not happen if file upload was mandatory.`);
            // This error likely means the file wasn't processed correctly by Multer earlier, or frontend didn't send it.
            throw new Error('Ground truth file/content missing when creating a new problem.');
      }

       // Determine content to save: use new upload OR existing if not updating Public Test
       if (!publicTestContent && isUpdate && problemId) {
           const existingRes = await client.query('SELECT public_test_content FROM problems WHERE id = $1', [problemId]);
           if (existingRes.rows.length > 0 && existingRes.rows[0].public_test_content) {
               publicTestContent = existingRes.rows[0].public_test_content;
               console.log("Update: No new public test file, keeping existing one.");
           } else {
               console.error(`Update Error: Existing public test content not found for problem ${problemId}, and no new file provided.`);
               throw new Error('Public test content is missing for update and not provided.');
           }
       } else if (!publicTestContent && !isUpdate) {
           console.error(`Create Error: publicTestContent is falsy. isUpdate=${isUpdate}. This should not happen if file upload was mandatory.`);
           throw new Error('Public test file/content missing when creating a new problem.');
       }

        // START TRANSACTION
        await client.query('BEGIN');

        // Ownership check for updates
        if (isUpdate && userRole !== 'owner') {
            const ownerCheck = await client.query('SELECT author_id FROM problems WHERE id = $1', [problemId]);
            if (ownerCheck.rows.length === 0) {
                 await client.query('ROLLBACK'); // Rollback before throwing
                 throw new Error('Problem not found.');
            }
            if (ownerCheck.rows[0].author_id !== authorId) {
                 await client.query('ROLLBACK'); // Rollback before throwing
                 throw new Error('Not authorized to update this problem.');
            }
        }

        // Insert/Update Problem - include both ground_truth_content and public_test_content
        const datasetsJson = JSON.stringify(datasets); // Store only metadata (filename, split) in datasets JSON

        if (isUpdate) {
           console.log(`Updating problem ${problemId}`);
           const updateQuery = `
             UPDATE problems SET
                 name=$1, difficulty=$2, content=$3, problem_type=$4, datasets=$5,
                 evaluation_script=$6, ground_truth_content=$7, public_test_content=$8
             WHERE id = $9 RETURNING id`;
           const updateResult = await client.query(updateQuery, [
               name, difficulty, content, problemType, datasetsJson,
               evaluationScriptContent, groundTruthContent, publicTestContent,
               problemId
           ]);
            if (updateResult.rowCount === 0) {
                 await client.query('ROLLBACK'); // Rollback before throwing
                 throw new Error('Update failed. Problem not found or no changes made.');
            }
            savedProblemId = updateResult.rows[0].id;
        } else {
           console.log(`Creating new problem`);
           const insertQuery = `
             INSERT INTO problems (
                 name, difficulty, content, problem_type, author_id, datasets,
                 evaluation_script, ground_truth_content, public_test_content
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
           const insertResult = await client.query(insertQuery, [
               name, difficulty, content, problemType, authorId, datasetsJson,
               evaluationScriptContent, groundTruthContent, publicTestContent
           ]);
           savedProblemId = insertResult.rows[0].id;
        }
        console.log(`Problem ${isUpdate ? 'updated' : 'created'} ID: ${savedProblemId}`);

        // Tags & Metrics - Clear existing and insert new ones
        await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [savedProblemId]);
        await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [savedProblemId]);
        // Ensure tagIds and metricIds are arrays of numbers
        const validTagIds = tagIds.filter(id => typeof id === 'number' && !isNaN(id));
        const validMetricIds = metricIds.filter(id => typeof id === 'number' && !isNaN(id));

        // Use Promise.all for inserting tags and metrics concurrently
        const tagPromises = validTagIds.map(tagId =>
            client.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [savedProblemId, tagId])
        );
        // Mark the first selected metric as primary
        const metricPromises = validMetricIds.map((metricId, index) =>
            client.query('INSERT INTO problem_metrics (problem_id, metric_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [savedProblemId, metricId, index === 0])
        );
        await Promise.all([...tagPromises, ...metricPromises]);
        console.log(`Tags/Metrics updated for problem ID: ${savedProblemId}`);

        // Commit Transaction
        await client.query('COMMIT');
        console.log(`Transaction committed for problem ID: ${savedProblemId}`);

        // Fetch final data for response (excluding sensitive content like full scripts/datasets)
         const finalProblemRes = await pool.query( // Using pool here is fine as transaction is committed
             `SELECT p.id, p.name, p.difficulty, p.content, p.problem_type, p.author_id, p.created_at,
                     u.username as author_username, p.datasets, -- Contains only metadata now
                     (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script,
                     (CASE WHEN p.ground_truth_content IS NOT NULL AND p.ground_truth_content != '' THEN true ELSE false END) as has_ground_truth,
                     (CASE WHEN p.public_test_content IS NOT NULL AND p.public_test_content != '' THEN true ELSE false END) as has_public_test, -- Indicate existence
                     COALESCE(tags.tag_ids, '{}'::int[]) as tags,
                     COALESCE(metrics.metric_ids, '{}'::int[]) as metrics,
                    (SELECT json_agg(json_build_object('metricId', pm.metric_id, 'isPrimary', pm.is_primary)) FROM problem_metrics pm WHERE pm.problem_id = p.id) as metrics_links
              FROM problems p
              LEFT JOIN users u ON p.author_id = u.id /* Changed to LEFT JOIN in case author is deleted */
              LEFT JOIN (SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids FROM problem_tags WHERE problem_id = $1 GROUP BY problem_id) tags ON p.id = tags.problem_id
              LEFT JOIN (SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids FROM problem_metrics WHERE problem_id = $1 GROUP BY problem_id) metrics ON p.id = metrics.problem_id
              WHERE p.id = $1`,
             [savedProblemId]
         );

          if (finalProblemRes.rows.length === 0) {
              // This should ideally not happen after a successful insert/update and commit
              console.error(`Consistency Error: Could not retrieve problem data (ID: ${savedProblemId}) immediately after saving.`);
              throw new Error('Could not retrieve problem data after saving.');
          }
          console.log(`Successfully saved/fetched problem ${savedProblemId} for response.`);

        // Send successful response
        res.status(isUpdate ? 200 : 201).json({ problem: toCamelCase(finalProblemRes.rows[0]) });

   } catch (error) {
     // Rollback transaction if it was started and an error occurred
     if (client) {
         try { await client.query('ROLLBACK'); console.log("Transaction rolled back due to error."); }
         catch (rollbackError) { console.error("Error rolling back transaction:", rollbackError); }
     }
     console.error(`Error saving problem (isUpdate: ${isUpdate}):`, error);
     // Send error response
     res.status(500).json({ message: `Failed to save problem. Error: ${(error instanceof Error ? error.message : String(error))}` });
   } finally {
     // Release the client back to the pool
     if (client) client.release();
   }
};

// --- Create Problem Route ---
router.post(
  '/',
  authMiddleware,
  ownerOrCreatorMiddleware,
  (req, res, next) => {
      console.log("POST /problems - Running Multer middleware..."); // Log before Multer
      upload(req, res, (err) => {
          if (err instanceof multer.MulterError) {
              console.error("Multer error on POST:", err);
              return res.status(400).json({ message: `File upload error: ${err.code} - ${err.message}` }); // Include code
          } else if (err) {
              console.error("Unknown file upload error on POST:", err);
              return res.status(400).json({ message: `File upload error: ${err.message}` });
          }
           console.log("POST /problems - Multer finished successfully.");
           // Log files received by Multer
           console.log("Files received by Multer (POST):", req.files ? JSON.stringify(Object.keys(req.files)) : 'None');
           next();
      });
  },
  (req, res) => handleProblemSave(req, res, false) // isUpdate = false
);

// --- Update Problem Route ---
router.put(
  '/:id',
  authMiddleware,
  ownerOrCreatorMiddleware,
   (req, res, next) => {
       console.log(`PUT /problems/${req.params.id} - Running Multer middleware...`); // Log before Multer
      upload(req, res, (err) => {
           if (err instanceof multer.MulterError) {
              console.error(`Multer error on PUT /problems/${req.params.id}:`, err);
              return res.status(400).json({ message: `File upload error: ${err.code} - ${err.message}` }); // Include code
          } else if (err) {
              console.error(`Unknown file upload error on PUT /problems/${req.params.id}:`, err);
              return res.status(400).json({ message: `File upload error: ${err.message}` });
          }
           console.log(`PUT /problems/${req.params.id} - Multer finished successfully.`);
           // Log files received by Multer
           console.log("Files received by Multer (PUT):", req.files ? JSON.stringify(Object.keys(req.files)) : 'None');
           next();
      });
  },
  (req, res) => handleProblemSave(req, res, true) // isUpdate = true
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

      // Explicitly delete related data before deleting the problem to handle potential CASCADE issues or for logging
      console.log(`Deleting votes related to problem ${problemId}...`);
      await client.query(`DELETE FROM votes WHERE comment_id IN (SELECT id FROM discussion_comments WHERE post_id IN (SELECT id FROM discussion_posts WHERE problem_id = $1))`, [problemId]);
      await client.query(`DELETE FROM votes WHERE post_id IN (SELECT id FROM discussion_posts WHERE problem_id = $1)`, [problemId]);

      console.log(`Deleting comments related to problem ${problemId}...`);
      await client.query(`DELETE FROM discussion_comments WHERE post_id IN (SELECT id FROM discussion_posts WHERE problem_id = $1)`, [problemId]);

      console.log(`Deleting posts related to problem ${problemId}...`);
      await client.query('DELETE FROM discussion_posts WHERE problem_id = $1', [problemId]);

      console.log(`Deleting submissions related to problem ${problemId}...`);
      await client.query('DELETE FROM submissions WHERE problem_id = $1', [problemId]);

      console.log(`Deleting problem_tags relations for problem ${problemId}...`);
      await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [problemId]);

      console.log(`Deleting problem_metrics relations for problem ${problemId}...`);
      await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [problemId]);

     // Perform the final problem deletion
     console.log(`Deleting problem ${problemId} itself...`);
     const deleteResult = await client.query('DELETE FROM problems WHERE id = $1 RETURNING id', [problemId]);

     if (deleteResult.rowCount === 0) {
        // This might happen if the problem was deleted between the check and now
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Problem not found during final delete step.' });
     }

     await client.query('COMMIT');
     console.log(`Successfully deleted problem ${problemId}.`);
     res.status(204).send(); // No content on successful deletion

  } catch (error) {
    // Ensure rollback on any error
    try { await client.query('ROLLBACK'); console.log("Transaction rolled back due to deletion error."); }
    catch (rollbackError) { console.error("Error rolling back transaction during delete:", rollbackError); }

     console.error(`Error deleting problem ${problemId}:`, error);
     const msg = (error instanceof Error ? error.message : String(error));
     // Avoid sending detailed messages in production generally, but keep specific ones for now
     if (msg.includes('Not found')) res.status(404).json({ message: msg });
     else if (msg.includes('authorized')) res.status(403).json({ message: msg });
     else res.status(500).json({ message: `Server error while deleting problem. ${msg}` });
  } finally {
    client.release();
  }
});

// --- Get All Problems Route --- (Fetches minimal info for listing)
router.get('/', async (req, res) => {
    try {
      // Optimized query to get necessary list data
      const result = await pool.query(
         `SELECT
              p.id, p.name, p.difficulty, p.problem_type, p.author_id, p.created_at,
              u.username as author_username,
              COALESCE(tags.tag_ids, '{}'::int[]) as tags,
              -- Optionally fetch primary metric key for display if needed
              m.key as primary_metric_key
          FROM problems p
          LEFT JOIN users u ON p.author_id = u.id
          LEFT JOIN (
              SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids
              FROM problem_tags GROUP BY problem_id
          ) tags ON p.id = tags.problem_id
          LEFT JOIN problem_metrics pm ON p.id = pm.problem_id AND pm.is_primary = TRUE
          LEFT JOIN metrics m ON pm.metric_id = m.id
          ORDER BY p.id` // Or order by created_at DESC, name, etc.
      );
      res.json({ problems: toCamelCase(result.rows) });
    } catch (error) {
      console.error('Error fetching problems list:', error);
      res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài toán.' });
    }
});

// --- Get Single Problem Route --- (Fetches detailed info for display, excluding sensitive content)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const problemId = Number(id);
    if (isNaN(problemId)) { return res.status(400).json({ message: 'Invalid ID.' }); }

    try {
       // Query to get problem details, author, tags, metrics, and dataset metadata
       const result = await pool.query(
           `SELECT
               p.id, p.name, p.difficulty, p.content, p.problem_type, p.author_id, p.created_at,
               u.username as author_username,
               p.datasets, -- Contains only metadata like {split: 'train', filename: '...'}
               (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script, -- Indicate if script exists
               (CASE WHEN p.ground_truth_content IS NOT NULL AND p.ground_truth_content != '' THEN true ELSE false END) as has_ground_truth, -- Indicate if GT exists
               (CASE WHEN p.public_test_content IS NOT NULL AND p.public_test_content != '' THEN true ELSE false END) as has_public_test, -- Indicate if Public Test exists
               COALESCE(tags.tag_ids, '{}'::int[]) as tags, -- Array of tag IDs
               COALESCE(metrics_agg.metric_ids, '{}'::int[]) as metrics, -- Array of all metric IDs
               -- Aggregate metric details (id, key, direction, is_primary) into a JSON array
               COALESCE(metrics_details.details, '[]'::jsonb) as metrics_details
            FROM problems p
            LEFT JOIN users u ON p.author_id = u.id
            -- Aggregate tag IDs
            LEFT JOIN (
                SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids
                FROM problem_tags GROUP BY problem_id
            ) tags ON p.id = tags.problem_id
            -- Aggregate all metric IDs
            LEFT JOIN (
                SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids
                FROM problem_metrics GROUP BY problem_id
            ) metrics_agg ON p.id = metrics_agg.problem_id
            -- Aggregate detailed metric info including is_primary flag
            LEFT JOIN (
                 SELECT
                     pm.problem_id,
                     jsonb_agg(jsonb_build_object(
                         'id', m.id,
                         'key', m.key,
                         'direction', m.direction,
                         'isPrimary', pm.is_primary
                     ) ORDER BY m.key) as details
                 FROM problem_metrics pm
                 JOIN metrics m ON pm.metric_id = m.id
                 GROUP BY pm.problem_id
             ) metrics_details ON p.id = metrics_details.problem_id
            WHERE p.id = $1`,
           [problemId]
       );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Problem not found.' });
      }
      // metrics_details might be null if no metrics linked, default to empty array
      const problemData = result.rows[0];
      problemData.metrics_details = problemData.metrics_details || [];

      res.json({ problem: toCamelCase(problemData) });
    } catch (error) {
      console.error(`Error fetching problem ${problemId}:`, error);
      res.status(500).json({ message: 'Lỗi server khi lấy chi tiết bài toán.' });
    }
});


module.exports = router;

