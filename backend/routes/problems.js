// backend/routes/problems.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware, ownerOrCreatorMiddleware } = require('../middleware/auth');
const { problemUploadMiddleware } = require('../config/multer'); // Import specific middleware
const { toCamelCase } = require('../utils/helpers');

const router = express.Router();

// --- Helper function for Create/Update Problem Logic ---
const handleProblemSave = async (req, res, isUpdate = false) => {
  const { problemData } = req.body; // JSON string containing problem details
  const problemId = isUpdate ? req.params.id : null; // Get ID from params if updating
  const authorId = req.userId; // Get author ID from authMiddleware
  const userRole = req.userRole; // Get role from authMiddleware

  if (!problemData) {
    return res.status(400).json({ message: 'Missing problem data.' });
  }

  let parsedData;
  try {
    parsedData = JSON.parse(problemData);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid problem data format (must be JSON string).' });
  }

  // Destructure and validate required fields
  // Added existingDatasets to destructuring
  const { name, difficulty, content, problemType, tagIds = [], metricIds = [], existingDatasets = [] } = parsedData;


  if (!name || !difficulty || !content || !problemType || !Array.isArray(tagIds) || !Array.isArray(metricIds)) {
      return res.status(400).json({ message: 'Missing required problem fields (name, difficulty, content, problemType) or invalid tags/metrics format.' });
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ message: 'Invalid difficulty value.' });
  }
   if (!['classification', 'regression'].includes(problemType)) {
       return res.status(400).json({ message: 'Invalid problemType value.' });
   }

   // --- Dataset Handling ---
   let datasets = [];
   // Use existingDatasets passed from the frontend if updating
   if (isUpdate && Array.isArray(existingDatasets)) {
       datasets = existingDatasets.filter(d => d && typeof d === 'object' && d.split && d.filename && d.content); // Basic validation
   }


  // Process uploaded files, replacing existing ones if present
  const processFile = (fileKey, splitType) => {
      if (req.files && req.files[fileKey] && req.files[fileKey][0]) {
          const file = req.files[fileKey][0];
          // Remove existing dataset for this split before adding the new one
          datasets = datasets.filter((d) => d.split !== splitType);
          // Add new dataset
          datasets.push({
              split: splitType,
              filename: file.originalname,
              content: file.buffer.toString('utf-8'), // Assuming UTF-8 encoding
              // Optionally add size or other metadata if needed
              // size: file.size,
              // uploadedAt: new Date().toISOString(),
          });
          console.log(`Processed ${splitType} file: ${file.originalname}`); // Add log
      } else {
          console.log(`No new file provided for ${splitType}.`); // Add log
      }
  };

  processFile('trainCsv', 'train');
  processFile('testCsv', 'public_test'); // Assuming testCsv corresponds to public_test

  // --- Database Transaction ---
  const client = await pool.connect();
  let savedProblemId = problemId; // Use existing ID for update, or get new ID after insert

  try {
    await client.query('BEGIN');

    // Check ownership for updates (owner bypasses this)
    if (isUpdate && userRole !== 'owner') {
        const ownerCheck = await client.query('SELECT author_id FROM problems WHERE id = $1', [problemId]);
        if (ownerCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ message: 'Problem not found.' });
        }
        if (ownerCheck.rows[0].author_id !== authorId) {
             await client.query('ROLLBACK');
             client.release();
             return res.status(403).json({ message: 'You are not authorized to update this problem.' });
        }
    }


    // Insert or Update Problem Core Data
    if (isUpdate) {
      console.log(`Updating problem ${problemId} with datasets:`, JSON.stringify(datasets)); // Log datasets being saved
      const updateQuery = `
        UPDATE problems
        SET name = $1, difficulty = $2, content = $3, problem_type = $4, datasets = $5
        WHERE id = $6
        RETURNING id`; // Return id to confirm update occurred
      const updateResult = await client.query(updateQuery, [
        name,
        difficulty,
        content,
        problemType,
        JSON.stringify(datasets), // Store datasets as JSONB string
        problemId,
      ]);
       if (updateResult.rowCount === 0) {
           throw new Error('Problem update failed, possibly due to incorrect ID.');
       }
       savedProblemId = updateResult.rows[0].id; // Ensure savedProblemId is correct for updates too
    } else {
       console.log(`Creating new problem with datasets:`, JSON.stringify(datasets)); // Log datasets being saved
      // Insert new problem
      const insertQuery = `
        INSERT INTO problems (name, difficulty, content, problem_type, author_id, datasets)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`;
      const insertResult = await client.query(insertQuery, [
        name,
        difficulty,
        content,
        problemType,
        authorId,
        JSON.stringify(datasets),
      ]);
      savedProblemId = insertResult.rows[0].id; // Get the newly generated ID
    }

     console.log(`Problem ${isUpdate ? 'updated' : 'created'} with ID: ${savedProblemId}`); // Log successful insert/update


    // --- Handle Tags and Metrics Associations ---
    // Clear existing associations for the saved problem ID
     console.log(`Clearing tags/metrics for problem ID: ${savedProblemId}`); // Log clearing step
    await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [savedProblemId]);
    await client.query('DELETE FROM problem_metrics WHERE problem_id = $1', [savedProblemId]);

    // Insert new associations (ignore errors for non-existent tag/metric IDs for simplicity, or add validation)
    console.log(`Inserting tags: ${tagIds.join(', ')} for problem ID: ${savedProblemId}`); // Log insertion step
    const insertTagPromises = tagIds.map(tagId =>
        // Using ON CONFLICT DO NOTHING is safe and efficient
        client.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT (problem_id, tag_id) DO NOTHING', [savedProblemId, tagId])
    );
     console.log(`Inserting metrics: ${metricIds.join(', ')} for problem ID: ${savedProblemId}`); // Log insertion step
    const insertMetricPromises = metricIds.map(metricId =>
        // Using ON CONFLICT DO NOTHING is safe and efficient
        client.query('INSERT INTO problem_metrics (problem_id, metric_id) VALUES ($1, $2) ON CONFLICT (problem_id, metric_id) DO NOTHING', [savedProblemId, metricId])
    );

    await Promise.all([...insertTagPromises, ...insertMetricPromises]);
     console.log(`Finished inserting tags/metrics for problem ID: ${savedProblemId}`); // Log completion


    // Commit transaction
    await client.query('COMMIT');
     console.log(`Transaction committed for problem ID: ${savedProblemId}`); // Log commit


    // Fetch the final problem data including the author username and aggregated tags/metrics
     const finalProblemRes = await pool.query(
         `SELECT p.*, u.username as author_username,
                 COALESCE(tags.tag_ids, '{}'::int[]) as tags,
                 COALESCE(metrics.metric_ids, '{}'::int[]) as metrics
          FROM problems p
          JOIN users u ON p.author_id = u.id
          LEFT JOIN (SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids FROM problem_tags WHERE problem_id = $1 GROUP BY problem_id) tags ON p.id = tags.problem_id
          LEFT JOIN (SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids FROM problem_metrics WHERE problem_id = $1 GROUP BY problem_id) metrics ON p.id = metrics.problem_id
          WHERE p.id = $1`,
         [savedProblemId]
     );

      if (finalProblemRes.rows.length === 0) {
           // This case means the fetch after commit failed, which is unusual but possible
           console.error(`Failed to fetch problem ${savedProblemId} after saving.`);
           throw new Error('Could not retrieve problem data after saving.');
       }

      console.log(`Successfully saved and fetched problem ${savedProblemId}`); // Log success


    res
      .status(isUpdate ? 200 : 201)
      .json({
          message: `Problem ${isUpdate ? 'updated' : 'created'} successfully.`,
          problem: toCamelCase(finalProblemRes.rows[0]) // Return the saved problem data
       });

  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on any error
    console.error(`Error ${isUpdate ? 'updating' : 'creating'} problem:`, error); // Log the actual error
    // Send a more informative error message if possible
    res.status(500).json({ message: `Failed to ${isUpdate ? 'update' : 'create'} problem. ${error instanceof Error ? error.message : 'Unknown error'}` });
  } finally {
    client.release(); // Release client back to pool
  }
};


// --- Create Problem Route ---
router.post(
  '/', // Base path for problems
  authMiddleware,
  ownerOrCreatorMiddleware,
  problemUploadMiddleware, // Use multer middleware for file fields
  (req, res) => handleProblemSave(req, res, false) // isUpdate = false
);

// --- Update Problem Route ---
router.put(
  '/:id', // Problem ID in URL
  authMiddleware,
  ownerOrCreatorMiddleware,
  problemUploadMiddleware, // Use multer middleware for file fields
  (req, res) => handleProblemSave(req, res, true) // isUpdate = true
);

// --- Delete Problem Route ---
// Explicitly delete related data before deleting the problem
router.delete('/:id', authMiddleware, ownerOrCreatorMiddleware, async (req, res) => {
  const { id } = req.params;
  const problemId = Number(id);
  const userId = req.userId;
  const userRole = req.userRole;

  if (isNaN(problemId)) {
      return res.status(400).json({ message: 'Invalid problem ID.' });
  }
    console.log(`Attempting to delete problem ID: ${problemId} by user ID: ${userId} with role: ${userRole}`); // Log deletion attempt


  const client = await pool.connect();
  try {
     await client.query('BEGIN');

     // 1. Check ownership (owner bypasses)
     if (userRole !== 'owner') {
         const ownerCheck = await client.query('SELECT author_id FROM problems WHERE id = $1', [problemId]);
         if (ownerCheck.rows.length === 0) {
              await client.query('ROLLBACK');
              client.release();
              console.log(`Deletion failed: Problem ${problemId} not found.`); // Log failure reason
              return res.status(404).json({ message: 'Problem not found.' });
         }
         if (ownerCheck.rows[0].author_id !== userId) {
             await client.query('ROLLBACK');
             client.release();
              console.log(`Deletion failed: User ${userId} is not authorized to delete problem ${problemId}.`); // Log failure reason
             return res.status(403).json({ message: 'You are not authorized to delete this problem.' });
         }
     }

      // 2. Explicitly delete related data (even with CASCADE for extra safety)
      // Order matters due to potential dependencies (e.g., votes depend on comments/posts)
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


     // 3. Perform the final problem deletion
      console.log(`Deleting problem ${problemId} itself...`); // Log final step
     const deleteResult = await client.query('DELETE FROM problems WHERE id = $1 RETURNING id', [problemId]);

     if (deleteResult.rowCount === 0) {
         // This might happen if the ID didn't exist or was already deleted between checks
         await client.query('ROLLBACK');
         client.release();
          console.log(`Deletion rollback: Problem ${problemId} not found during final delete step.`); // Log failure reason
         return res.status(404).json({ message: 'Problem not found or already deleted.' });
     }

     await client.query('COMMIT');
     console.log(`Successfully deleted problem ${problemId} and related data. Transaction committed.`); // Log success
     res.status(204).send(); // No content on successful deletion

  } catch (error) {
    await client.query('ROLLBACK');
     console.error(`Error deleting problem ${problemId}:`, error); // Log the actual error
    res.status(500).json({ message: `Lỗi server khi xóa bài toán. ${error instanceof Error ? error.message : 'Unknown error'}` });
  } finally {
      client.release();
  }
});

module.exports = router;
