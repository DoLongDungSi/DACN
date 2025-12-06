const express = require('express');
const pool = require('../config/db');
const { authMiddleware, ownerOrCreatorMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const { DATA_ROOT, ensureDir, resolveFilePath, readFileContent } = require('../utils/storage');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Storage root for datasets
ensureDir(DATA_ROOT);

// Cấu hình AI Hint từ biến môi trường
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SYSTEM_PROMPT = process.env.HINT_SYSTEM_PROMPT || "You are a helpful AI assistant for data science competitions. Provide a concise hint without giving away the code.";

const router = express.Router();

// --- HELPER FUNCTIONS (Viết đầy đủ, không viết tắt) ---

const parseDatasets = (datasets) => {
    if (!datasets) return [];
    if (Array.isArray(datasets)) return datasets;
    try {
        return JSON.parse(datasets);
    } catch (e) {
        return [];
    }
};

const loadDatasetFromDisk = (entry) => {
    if (!entry) return null;
    const content = readFileContent(entry.path, entry.filename);
    return content;
};

const ensureProblemDir = (problemId) => {
    const dir = path.join(DATA_ROOT, `problem_${problemId}`);
    ensureDir(dir);
    return dir;
};

const saveUploadedFile = (problemId, file, split) => {
    const dir = ensureProblemDir(problemId);
    const base = path.basename(file.originalname);
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const finalName = `${split}-${unique}-${base}`;
    const fullPath = path.join(dir, finalName);
    fs.writeFileSync(fullPath, file.buffer);
    
    return {
        filename: base,
        path: path.relative(DATA_ROOT, fullPath),
        sizeBytes: file.size || file.buffer?.length || null
    };
};

const deleteFileIfExists = (fileRef) => {
    const full = resolveFilePath(fileRef);
    if (!full) return;
    try {
        if (fs.existsSync(full)) {
            fs.unlinkSync(full);
        }
    } catch (e) {
        console.error('Error deleting file:', full, e);
    }
};

const buildDatasetList = (problemRow) => {
    const rawDatasets = parseDatasets(problemRow.datasets);
    if (!Array.isArray(rawDatasets)) return [];
    
    return rawDatasets
        .filter(entry => entry && entry.split)
        .map(entry => {
            const split = entry.split;
            let sizeBytes = entry.sizeBytes || null;
            
            const resolvedPath = entry.path ? resolveFilePath(entry.path) : null;
            if (resolvedPath) {
                try {
                    const stat = fs.statSync(resolvedPath);
                    sizeBytes = stat.size;
                } catch (err) {
                    // File might be missing physically
                }
            }

            return {
                split,
                filename: entry.filename || `${split}.csv`,
                path: entry.path,
                sizeBytes,
                download_url: `/api/problems/${problemRow.id}/datasets/${split}`,
            };
        })
        .filter(entry => entry.split !== 'ground_truth'); // Hide ground truth from public list
};

// --- MULTER CONFIGURATION ---

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        const allowedCsvFields = ['trainCsv', 'testCsv', 'groundTruthCsv'];
        if (allowedCsvFields.includes(file.fieldname)) {
            if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
                 cb(null, true);
            } else {
                cb(new Error(`Only .csv files are allowed for ${file.fieldname}!`));
            }
        } else {
             cb(null, true);
        }
    }
}).fields([
    { name: 'trainCsv', maxCount: 1 },
    { name: 'testCsv', maxCount: 1 },
    { name: 'groundTruthCsv', maxCount: 1 }
]);

// --- MAIN LOGIC ---

const handleProblemSave = async (req, res, isUpdate = false) => {
  const { problemData } = req.body;
  const problemId = isUpdate ? req.params.id : null;
  const authorId = req.userId;
  const userRole = req.userRole;

  if (!problemData) {
      return res.status(400).json({ message: 'Missing problem data.' });
  }

  let parsedData;
  try {
      parsedData = JSON.parse(problemData);
  } catch (e) {
      return res.status(400).json({ message: 'Invalid problem data format.' });
  }

  // Destructure all fields including new dataDescription
  const { 
      name, 
      difficulty, 
      content, 
      summary = '', 
      dataDescription = '', // Trường mới
      coverImageUrl = null, 
      problemType, 
      tagIds = [], 
      metricIds = [], 
      existingDatasets = [], 
      evaluationScriptContent 
  } = parsedData;

  if (!name || !difficulty || !content || !problemType || !evaluationScriptContent) {
      return res.status(400).json({ message: 'Missing required fields.' });
  }

   let datasets = [];
   let groundTruthPath = null;
   let publicTestPath = null;
   const files = req.files || {};

   const uploadedTrain = files.trainCsv?.[0];
   const uploadedTest = files.testCsv?.[0];
   const uploadedGT = files.groundTruthCsv?.[0];

   let client;
   let savedProblemId = problemId;

   try {
      client = await pool.connect();
      await client.query('BEGIN');

      if (isUpdate) {
          // Check ownership
          const existingRes = await client.query('SELECT author_id, datasets, ground_truth_path, public_test_path FROM problems WHERE id = $1', [problemId]);
          
          if (existingRes.rows.length === 0) {
              await client.query('ROLLBACK');
              throw new Error('Problem not found.');
          }
          
          if (userRole !== 'owner' && existingRes.rows[0].author_id !== authorId) {
              await client.query('ROLLBACK');
              throw new Error('Not authorized.');
          }
          
          const row = existingRes.rows[0];
          // Preserve existing paths if not replaced
          datasets = parseDatasets(row.datasets); 
          groundTruthPath = row.ground_truth_path;
          publicTestPath = row.public_test_path;
      } else {
          // New problem ID
          const idRes = await client.query("SELECT nextval('problems_id_seq') as id");
          savedProblemId = idRes.rows[0].id;
          datasets = [];
      }

      // Helper to update dataset array
      const updateDatasetMeta = (split, fileObj) => {
           datasets = datasets.filter(d => d.split !== split);
           datasets.push({ 
               split, 
               filename: fileObj.filename, 
               path: fileObj.path, 
               sizeBytes: fileObj.sizeBytes 
           });
      }

      // Process Uploads
      if (uploadedTrain) {
          const saved = saveUploadedFile(savedProblemId, uploadedTrain, 'train');
          updateDatasetMeta('train', saved);
      }
      if (uploadedTest) {
          const saved = saveUploadedFile(savedProblemId, uploadedTest, 'public_test');
          updateDatasetMeta('public_test', saved);
          publicTestPath = saved.path;
      }
      if (uploadedGT) {
          const saved = saveUploadedFile(savedProblemId, uploadedGT, 'ground_truth');
          groundTruthPath = saved.path;
          updateDatasetMeta('ground_truth', saved);
      }

      // Validation
      const hasTrain = datasets.some(d => d.split === 'train');
      const hasTest = datasets.some(d => d.split === 'public_test');
      
      // Strict check: must have these files
      if (!hasTrain || !hasTest || !groundTruthPath) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Missing required dataset files (Train, Public Test, or Ground Truth).' });
      }

      const datasetsJson = JSON.stringify(datasets);
      
      // SQL Insert/Update
      if (isUpdate) {
         const updateQuery = `
            UPDATE problems 
            SET name=$1, difficulty=$2, content=$3, summary=$4, cover_image_url=$5, 
                problem_type=$6, datasets=$7, evaluation_script=$8, ground_truth_path=$9, 
                public_test_path=$10, data_description=$11 
            WHERE id = $12 RETURNING id`;
         
         await client.query(updateQuery, [
             name, difficulty, content, summary, coverImageUrl, 
             problemType, datasetsJson, evaluationScriptContent, 
             groundTruthPath, publicTestPath, dataDescription, problemId
         ]);
      } else {
         const insertQuery = `
            INSERT INTO problems (id, name, difficulty, content, summary, cover_image_url, problem_type, author_id, datasets, evaluation_script, ground_truth_path, public_test_path, data_description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`;
         
         await client.query(insertQuery, [
             savedProblemId, name, difficulty, content, summary, coverImageUrl, 
             problemType, authorId, datasetsJson, evaluationScriptContent, 
             groundTruthPath, publicTestPath, dataDescription
         ]);
      }

      // Tags & Metrics
      await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [savedProblemId]);
      await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [savedProblemId]);
      
      if (tagIds.length) {
          const tagValues = tagIds.map((tid, i) => `($1, $${i + 2})`).join(',');
          await client.query(`INSERT INTO problem_tags (problem_id, tag_id) VALUES ${tagValues} ON CONFLICT DO NOTHING`, [savedProblemId, ...tagIds]);
      }
      if (metricIds.length) {
          const metricQueries = metricIds.map((mid, i) => 
              client.query('INSERT INTO problem_metrics (problem_id, metric_id, is_primary) VALUES ($1, $2, $3)', [savedProblemId, mid, i === 0])
          );
          await Promise.all(metricQueries);
      }

      await client.query('COMMIT');

      // Return full problem data
      const finalRes = await pool.query(`SELECT * FROM problems WHERE id = $1`, [savedProblemId]);
      const finalProblem = finalRes.rows[0];
      finalProblem.datasets = buildDatasetList(finalProblem);
      
      res.status(isUpdate ? 200 : 201).json({ problem: toCamelCase(finalProblem) });

   } catch (error) {
     if (client) { 
         try { await client.query('ROLLBACK'); } catch (e) {} 
     }
     console.error('Save problem error:', error);
     res.status(500).json({ message: error.message });
   } finally {
     if (client) client.release();
   }
};

// --- ROUTES ---

router.post('/', authMiddleware, ownerOrCreatorMiddleware, upload, (req, res) => handleProblemSave(req, res, false));
router.put('/:id', authMiddleware, ownerOrCreatorMiddleware, upload, (req, res) => handleProblemSave(req, res, true));

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const problemId = Number(id);
    if (isNaN(problemId)) { 
        return res.status(400).json({ message: 'Invalid ID.' }); 
    }

    try {
       const result = await pool.query(
           `SELECT
               p.id, p.name, p.difficulty, p.content, p.summary, p.data_description, p.problem_type, p.author_id, p.created_at,
               p.evaluation_script,
               u.username as author_username,
               p.datasets, p.cover_image_url,
               (CASE WHEN p.evaluation_script IS NOT NULL AND p.evaluation_script != '' THEN true ELSE false END) as has_evaluation_script,
               (CASE WHEN p.ground_truth_path IS NOT NULL AND p.ground_truth_path != '' THEN true ELSE false END) as has_ground_truth,
               (CASE WHEN p.public_test_path IS NOT NULL AND p.public_test_path != '' THEN true ELSE false END) as has_public_test,
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

router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
         `SELECT
              p.id, p.name, p.difficulty, p.problem_type, p.author_id, p.created_at, p.summary, p.cover_image_url,
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

router.delete('/:id', authMiddleware, ownerOrCreatorMiddleware, async (req, res) => {
    const { id } = req.params;
    const problemId = Number(id);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM problems WHERE id = $1', [problemId]);
        await client.query('COMMIT');
        res.status(204).send();
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Delete problem error:', e);
        res.status(500).json({message: 'Delete failed'});
    } finally { 
        client.release(); 
    }
});

router.get('/:id/datasets/:split', async (req, res) => {
    const { id, split } = req.params;
    
    try {
        const result = await pool.query('SELECT datasets FROM problems WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Problem not found.' });
        }
        
        const datasets = parseDatasets(result.rows[0].datasets);
        const dataset = datasets.find(d => d.split === split);
        
        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found.' });
        }

        const fullPath = resolveFilePath(dataset.path);
        if (!fullPath || !fs.existsSync(fullPath)) {
            return res.status(404).json({ message: 'File not found on server.' });
        }

        res.download(fullPath, dataset.filename);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error downloading file' });
    }
});

// --- NEW ROUTE: Hint with Premium Check & Prompt Config ---
router.post('/:id/hint', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Kiểm tra User có Premium không
        const userRes = await pool.query('SELECT is_premium FROM users WHERE id = $1', [req.userId]);
        
        if (!userRes.rows.length || !userRes.rows[0].is_premium) {
            return res.status(403).json({ 
                message: 'Tính năng này chỉ dành cho tài khoản Premium.',
                requiresPremium: true 
            });
        }

        const result = await pool.query('SELECT content, summary FROM problems WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Bài toán không tồn tại.' });
        }
        const problemContent = result.rows[0].content;

        // Gọi API AI để lấy gợi ý
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-2.0-flash-exp:free', // Hoặc model bạn muốn
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: `Problem Description:\n${problemContent}\n\nGive me a hint to solve this data science problem.` }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
                    'X-Title': 'ML Judge'
                }
            }
        );

        const hint = response.data.choices[0]?.message?.content || "Không thể tạo gợi ý lúc này.";
        res.json({ hint });

    } catch (error) {
        console.error('Hint error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Lỗi khi tạo gợi ý AI.' });
    }
});

module.exports = router;