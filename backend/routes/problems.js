// backend/routes/problems.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware, ownerOrCreatorMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Storage root for datasets (train/test/gt) per problem
const DATA_ROOT = process.env.DATA_ROOT || path.join(__dirname, '../../storage');
if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
}
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/auto';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'ML Judge';

const router = express.Router();

const parseDatasets = (datasets) => {
    if (!datasets) return [];
    if (Array.isArray(datasets)) return datasets;
    try { return JSON.parse(datasets); }
    catch (e) { return []; }
};

const resolveFilePath = (fileRef) => {
    if (!fileRef) return null;
    if (path.isAbsolute(fileRef)) return fileRef;
    return path.join(DATA_ROOT, fileRef);
};

const loadDatasetFromDisk = (entry) => {
    if (!entry) return null;
    const candidatePaths = [];
    if (entry.path) candidatePaths.push(resolveFilePath(entry.path));
    if (entry.filename) {
        const sanitizedFilename = path.basename(entry.filename);
        candidatePaths.push(
            path.join('/usr/src/test', sanitizedFilename),
            path.join(__dirname, '../../test', sanitizedFilename),
            path.join(process.cwd(), 'test', sanitizedFilename),
        );
    }
    for (const candidate of candidatePaths) {
        if (!candidate) continue;
        try {
            if (fs.existsSync(candidate)) {
                console.log(`Reading dataset file from disk: ${candidate}`);
                return fs.readFileSync(candidate, 'utf8');
            }
        } catch (e) {
            console.error('Error reading dataset file', candidate, e);
        }
    }
    console.warn(`Dataset fallback not found for entry: ${JSON.stringify(entry)}`);
    return null;
};

const ensureProblemDir = (problemId) => {
    const dir = path.join(DATA_ROOT, `problem_${problemId}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const saveUploadedFile = (problemId, file, split) => {
    const dir = ensureProblemDir(problemId);
    const base = path.basename(file.originalname);
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const finalName = `${split}-${unique}-${base}`;
    const fullPath = path.join(dir, finalName);
    fs.writeFileSync(fullPath, file.buffer);
    return { filename: base, path: path.relative(DATA_ROOT, fullPath) };
};

const deleteFileIfExists = (fileRef) => {
    const full = resolveFilePath(fileRef);
    if (!full) return;
    try {
        if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (e) {
        console.warn('Unable to delete old file', full, e.message || e);
    }
};

const buildDatasetList = (problemRow) => {
    const rawDatasets = parseDatasets(problemRow.datasets);
    if (!Array.isArray(rawDatasets)) return [];
    return rawDatasets
        .filter(entry => entry && entry.split)
        .map(entry => {
            const split = entry.split;
            const sanitized = {
                split,
                filename: entry.filename || `${split}.csv`,
                path: entry.path,
                download_url: `/api/problems/${problemRow.id}/datasets/${split}`,
            };
            console.log('Dataset entry for problem', problemRow.id, JSON.stringify(sanitized));
            return sanitized;
        })
        .filter(entry => entry.split !== 'ground_truth');
};

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
   const sanitizeDatasetEntry = (entry) => {
       if (!entry || typeof entry !== 'object') return null;
       if (!entry.split || !entry.filename) return null;
       const normalized = {
           split: entry.split,
           filename: entry.filename,
           path: entry.path,
       };
       return normalized;
   };

   // Seed datasets from DB (safer than trusting client) when updating
   let existingDbDatasets = [];
   let existingGroundTruthPath = null;
   let existingPublicTestPath = null;

   // --- File buffers (will be written to disk after we have problemId) ---
   let datasets = [];
   let groundTruthPath = null;
   let publicTestPath = null;
   const files = req.files;

   // Process Train CSV (buffer will be written after we know problemId)
   const uploadedTrain = files && files.trainCsv && files.trainCsv[0] ? files.trainCsv[0] : null;
   const uploadedTest = files && files.testCsv && files.testCsv[0] ? files.testCsv[0] : null;
   const uploadedGT = files && files.groundTruthCsv && files.groundTruthCsv[0] ? files.groundTruthCsv[0] : null;


   // --- Validation after processing files ---
    // Validation of presence will happen after loading existing metadata


   // --- Database Transaction ---
   let client;
   let savedProblemId = problemId;

   try {
      client = await pool.connect();
      await client.query('BEGIN');

      if (isUpdate) {
          const existingRes = await client.query('SELECT author_id, datasets, ground_truth_content, public_test_content FROM problems WHERE id = $1', [problemId]);
          if (existingRes.rows.length === 0) { await client.query('ROLLBACK'); throw new Error('Problem not found.'); }
          if (userRole !== 'owner' && existingRes.rows[0].author_id !== authorId) { await client.query('ROLLBACK'); throw new Error('Not authorized to update this problem.'); }
          existingDbDatasets = parseDatasets(existingRes.rows[0].datasets) || [];
          datasets = existingDbDatasets.map(sanitizeDatasetEntry).filter(Boolean);
          groundTruthPath = existingRes.rows[0].ground_truth_content || null;
          publicTestPath = existingRes.rows[0].public_test_content || null;
      } else {
          // Pre-reserve an ID so we can place files on disk with stable folder names
          const idRes = await client.query("SELECT nextval('problems_id_seq') as id");
          savedProblemId = idRes.rows[0].id;
          datasets = [];
      }

      // Helpers for dataset replacement
      const replaceDatasetEntry = (split, savedInfo) => {
          if (!savedInfo) return;
          const existing = datasets.find(d => d.split === split);
          if (existing?.path) deleteFileIfExists(existing.path);
          datasets = datasets.filter(d => d && d.split !== split);
          datasets.push({ split, filename: savedInfo.filename, path: savedInfo.path });
      };

      // Write uploaded files to disk now that we know problemId
      if (uploadedTrain) {
          const saved = saveUploadedFile(savedProblemId, uploadedTrain, 'train');
          replaceDatasetEntry('train', saved);
          console.log(`Saved train dataset to ${saved.path}`);
      }
      if (uploadedTest) {
          const saved = saveUploadedFile(savedProblemId, uploadedTest, 'public_test');
          replaceDatasetEntry('public_test', saved);
          publicTestPath = saved.path;
          console.log(`Saved public test dataset to ${saved.path}`);
      }
      if (uploadedGT) {
          if (groundTruthPath) deleteFileIfExists(groundTruthPath);
          const saved = saveUploadedFile(savedProblemId, uploadedGT, 'ground_truth');
          groundTruthPath = saved.path;
          // We still keep metadata entry for GT just to track filename/path internally (not exposed)
          replaceDatasetEntry('ground_truth', saved);
          console.log(`Saved ground truth dataset to ${saved.path}`);
      }

      // Validate presence of required datasets
      const hasTrainMeta = datasets.some(d => d.split === 'train' && d.path);
      const hasPublicTestMeta = datasets.some(d => d.split === 'public_test' && d.path);
      if (!hasTrainMeta) { throw new Error('Missing required dataset file: train.'); }
      if (!hasPublicTestMeta) { throw new Error('Missing required dataset file: public test.'); }
      if (!groundTruthPath) { throw new Error('Ground truth file missing.'); }

      // Insert/Update Problem
      const datasetsJson = JSON.stringify(datasets);
      if (isUpdate) {
         console.log(`Updating problem ${problemId}`);
         const updateQuery = `UPDATE problems SET name=$1, difficulty=$2, content=$3, problem_type=$4, datasets=$5, evaluation_script=$6, ground_truth_content=$7, public_test_content=$8 WHERE id = $9 RETURNING id`;
         const updateResult = await client.query(updateQuery, [name, difficulty, content, problemType, datasetsJson, evaluationScriptContent, groundTruthPath, publicTestPath, problemId]);
          if (updateResult.rowCount === 0) { await client.query('ROLLBACK'); throw new Error('Update failed. Problem not found or no changes.'); }
          savedProblemId = updateResult.rows[0].id;
      } else {
         console.log(`Creating new problem ${savedProblemId}`);
const insertQuery = `INSERT INTO problems (id, name, difficulty, content, problem_type, author_id, datasets, evaluation_script, ground_truth_content, public_test_content) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`;
const insertResult = await client.query(insertQuery, [savedProblemId, name, difficulty, content, problemType, authorId, datasetsJson, evaluationScriptContent, groundTruthContent, publicTestContent]);

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
                   p.evaluation_script,
                   u.username as author_username, p.datasets,
                   (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script,
                   (CASE WHEN p.ground_truth_content IS NOT NULL AND p.ground_truth_content != '' THEN true ELSE false END) as has_ground_truth,
                   (CASE WHEN p.public_test_content IS NOT NULL AND p.public_test_content != '' THEN true ELSE false END) as has_public_test,
                   COALESCE(tags.tag_ids, '{}'::int[]) as tags,
                   COALESCE(metrics_agg.metric_ids, '{}'::int[]) as metrics,
                   COALESCE(metrics_details.details, '[]'::jsonb) as metrics_details,
                   COALESCE(metrics_links.links, '[]'::jsonb) as metrics_links
            FROM problems p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN (SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids FROM problem_tags WHERE problem_id = $1 GROUP BY problem_id) tags ON p.id = tags.problem_id
            LEFT JOIN (SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids FROM problem_metrics WHERE problem_id = $1 GROUP BY problem_id) metrics_agg ON p.id = metrics_agg.problem_id
            LEFT JOIN (SELECT pm.problem_id, jsonb_agg(jsonb_build_object('id', m.id, 'key', m.key, 'direction', m.direction, 'isPrimary', pm.is_primary) ORDER BY m.key) as details FROM problem_metrics pm JOIN metrics m ON pm.metric_id = m.id WHERE pm.problem_id = $1 GROUP BY pm.problem_id) metrics_details ON p.id = metrics_details.problem_id
            LEFT JOIN (SELECT pm.problem_id, jsonb_agg(jsonb_build_object('metricId', pm.metric_id, 'isPrimary', pm.is_primary) ORDER BY CASE WHEN pm.is_primary THEN 0 ELSE 1 END, pm.metric_id) as links FROM problem_metrics pm WHERE pm.problem_id = $1 GROUP BY pm.problem_id) metrics_links ON p.id = metrics_links.problem_id
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
               p.evaluation_script,
               u.username as author_username,
               p.datasets,
               (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script,
               (CASE WHEN p.ground_truth_content IS NOT NULL AND p.ground_truth_content != '' THEN true ELSE false END) as has_ground_truth,
               (CASE WHEN p.public_test_content IS NOT NULL AND p.public_test_content != '' THEN true ELSE false END) as has_public_test,
               COALESCE(tags.tag_ids, '{}'::int[]) as tags,
               COALESCE(metrics_agg.metric_ids, '{}'::int[]) as metrics,
               COALESCE(metrics_details.details, '[]'::jsonb) as metrics_details,
               COALESCE(metrics_links.links, '[]'::jsonb) as metrics_links
            FROM problems p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN (SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids FROM problem_tags WHERE problem_id = $1 GROUP BY problem_id) tags ON p.id = tags.problem_id
            LEFT JOIN (SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids FROM problem_metrics WHERE problem_id = $1 GROUP BY problem_id) metrics_agg ON p.id = metrics_agg.problem_id
            LEFT JOIN (SELECT pm.problem_id, jsonb_agg(jsonb_build_object('id', m.id, 'key', m.key, 'direction', m.direction, 'isPrimary', pm.is_primary) ORDER BY m.key) as details FROM problem_metrics pm JOIN metrics m ON pm.metric_id = m.id WHERE pm.problem_id = $1 GROUP BY pm.problem_id) metrics_details ON p.id = metrics_details.problem_id
            LEFT JOIN (SELECT pm.problem_id, jsonb_agg(jsonb_build_object('metricId', pm.metric_id, 'isPrimary', pm.is_primary) ORDER BY CASE WHEN pm.is_primary THEN 0 ELSE 1 END, pm.metric_id) as links FROM problem_metrics pm WHERE pm.problem_id = $1 GROUP BY pm.problem_id) metrics_links ON p.id = metrics_links.problem_id
            WHERE p.id = $1`,
           [problemId]
       );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Problem not found.' });
      }
      const problemData = result.rows[0];
      problemData.metrics_details = problemData.metrics_details || [];
      problemData.datasets = buildDatasetList(problemData);

      res.json({ problem: toCamelCase(problemData) });
    } catch (error) {
      console.error(`Error fetching problem ${problemId}:`, error);
      res.status(500).json({ message: 'Lỗi server khi lấy chi tiết bài toán.' });
    }
});

// --- Generate AI Hint ---
router.post('/:id/hint', async (req, res) => {
    const { id } = req.params;
    const problemId = Number(id);
    if (isNaN(problemId)) {
        return res.status(400).json({ message: 'Invalid ID.' });
    }

    // Even when no API key is configured, return a graceful fallback instead of erroring
    const noKeyFallback = () => res.status(200).json({
        hint: 'Hãy bắt đầu bằng một baseline đơn giản, kiểm tra kỹ format dữ liệu và thử nhiều đặc trưng/thuật toán nhanh trước khi tối ưu.',
        warning: 'AI hint service is not configured – đang dùng gợi ý mặc định.',
    });

    try {
        const problemRes = await pool.query('SELECT name, content FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rows.length === 0) {
            return res.status(404).json({ message: 'Problem not found.' });
        }
        const problem = problemRes.rows[0];

        if (!OPENROUTER_API_KEY) {
            return noKeyFallback();
        }

        const summary = (problem.content || '').replace(/<[^>]*>/g, '').slice(0, 600);
        const prompt = `Provide a concise (max 3 sentences) strategic hint for this machine learning challenge:
Title: ${problem.name}
Summary: ${summary}
Focus on approach guidance, not code, and keep the tone encouraging.`;

        const response = await axios.post(
            OPENROUTER_BASE_URL,
            {
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: 'You are an assistant helping competitors on a machine-learning contest platform with short strategic hints.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 200,
                temperature: 0.3,
            },
            {
                timeout: 20000,
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': OPENROUTER_SITE_URL,
                    'X-Title': OPENROUTER_APP_NAME,
                },
            }
        );

        const hintText = response.data?.choices?.[0]?.message?.content;
        const hintText2 = response.data?.choices?.[1]?.message?.content;
        const finalHint = hintText || hintText2;
        if (!finalHint) {
            return res.status(502).json({ message: 'AI service did not return a hint.' });
        }
        res.json({ hint: finalHint.trim() });
    } catch (error) {
        const apiError = error.response?.data?.error || error.response?.data || error.message;
        console.error('Error generating hint:', apiError);

        // Fall back to a local/static hint so UI still works even if OpenRouter key fails
        const fallbackHint = 'Hãy bắt đầu bằng một baseline đơn giản, kiểm tra kỹ format dữ liệu và thử so sánh nhiều mô hình/feature nhanh trước khi tối ưu.';

        const message = (typeof apiError === 'string')
            ? apiError
            : (apiError?.message || 'Không tạo được gợi ý cho bài toán này.');

        // Return both the warning message and a usable fallback hint
        return res.status(200).json({
            hint: fallbackHint,
            warning: message,
        });
    }
});

// --- Download Dataset ---
router.get('/:id/datasets/:split', async (req, res) => {
    const problemId = Number(req.params.id);
    const split = req.params.split;
    if (isNaN(problemId)) {
        return res.status(400).json({ message: 'Invalid ID.' });
    }

    if (split === 'ground_truth') {
        return res.status(403).json({ message: 'Không thể tải ground truth.' });
    }

    try {
        const problemRes = await pool.query(
            'SELECT datasets, public_test_content FROM problems WHERE id = $1',
            [problemId]
        );
        if (problemRes.rows.length === 0) {
            return res.status(404).json({ message: 'Problem not found.' });
        }

        const problem = problemRes.rows[0];
        const datasets = parseDatasets(problem.datasets);
        const entry = datasets.find(d => d && d.split === split);
        let content = null;
        let filename = entry?.filename || `${split}.csv`;

        content = loadDatasetFromDisk(entry || { filename });
        if (!content && split === 'public_test' && problem.public_test_content) {
            content = loadDatasetFromDisk({ path: problem.public_test_content, filename });
        }

        if (!content) {
            return res.status(404).json({ message: 'Dataset chưa sẵn sàng để tải.' });
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(content);
    } catch (error) {
        console.error('Error downloading dataset:', error);
        return res.status(500).json({ message: 'Không thể tải dataset.' });
    }
});

module.exports = router;
