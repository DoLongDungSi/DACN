// backend/routes/discussion.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');

const router = express.Router();

// Middleware applied to all discussion routes requiring authentication
router.use(authMiddleware);

// --- Create Discussion Post ---
router.post('/posts', async (req, res) => {
  const { title, content, problemId } = req.body;
  const userId = req.userId;

  // Validation
  if (!title || !content || !problemId) {
    return res.status(400).json({ message: 'Missing required fields: title, content, or problemId.' });
  }

  try {
    const insertQuery = `
      INSERT INTO discussion_posts (title, content, problem_id, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at`; // Return ID and timestamp
    const insertResult = await pool.query(insertQuery, [title, content, problemId, userId]);

    if (insertResult.rows.length === 0) {
        throw new Error("Failed to insert post, no ID returned.");
    }

    const newPostId = insertResult.rows[0].id;
    const createdAt = insertResult.rows[0].created_at;

    // Fetch user details for the response (avoid sending sensitive info)
    const userRes = await pool.query('SELECT username, avatar_color, avatar_url FROM users WHERE id = $1', [userId]);
    const userDetails = userRes.rows[0] || { username: 'Unknown', avatar_color: 'bg-slate-500', avatar_url: null };

    // Construct the final post object for the response
    const finalPost = {
        id: newPostId,
        problemId: Number(problemId), // Ensure type consistency
        userId: userId,
        title: title,
        content: content,
        createdAt: createdAt,
        username: userDetails.username,
        avatarColor: userDetails.avatar_color,
        avatarUrl: userDetails.avatar_url,
        // Initialize vote arrays for immediate use in frontend
        upvotedBy: [],
        downvotedBy: [],
    };

    res.status(201).json({ post: toCamelCase(finalPost) });

  } catch (error) {
    console.error('Error creating post:', error);
    // Check for foreign key violation if problemId is invalid
    if (error.code === '23503' && error.constraint === 'discussion_posts_problem_id_fkey') {
         return res.status(400).json({ message: `Invalid problemId: ${problemId}` });
    }
    res.status(500).json({ message: 'Lỗi server khi tạo bài viết.' });
  }
});

// --- Create Discussion Comment ---
router.post('/comments', async (req, res) => {
  const { content, postId, parentId = null } = req.body; // Default parentId to null if not provided
  const userId = req.userId;

  if (!content || !postId) {
    return res.status(400).json({ message: 'Missing required fields: content or postId.' });
  }

  try {
    const insertQuery = `
      INSERT INTO discussion_comments (content, post_id, parent_id, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at`; // Return ID and timestamp
    const insertResult = await pool.query(insertQuery, [content, postId, parentId, userId]);

    if (insertResult.rows.length === 0) {
       throw new Error("Failed to insert comment, no ID returned.");
    }

    const newCommentId = insertResult.rows[0].id;
    const createdAt = insertResult.rows[0].created_at;

     // Fetch user details for the response
     const userRes = await pool.query('SELECT username, avatar_color, avatar_url FROM users WHERE id = $1', [userId]);
     const userDetails = userRes.rows[0] || { username: 'Unknown', avatar_color: 'bg-slate-500', avatar_url: null };


    // Construct the final comment object
    const finalComment = {
        id: newCommentId,
        postId: Number(postId),
        parentId: parentId ? Number(parentId) : null, // Ensure parentId is number or null
        userId: userId,
        content: content,
        createdAt: createdAt,
        username: userDetails.username,
        avatarColor: userDetails.avatar_color,
        avatarUrl: userDetails.avatar_url,
        // Initialize vote arrays
        upvotedBy: [],
        downvotedBy: [],
    };

    res.status(201).json({ comment: toCamelCase(finalComment) });

  } catch (error) {
    console.error('Error creating comment:', error);
     // Check for foreign key violations
     if (error.code === '23503') {
         if (error.constraint === 'discussion_comments_post_id_fkey') {
             return res.status(400).json({ message: `Invalid postId: ${postId}` });
         } else if (error.constraint === 'discussion_comments_parent_id_fkey') {
              return res.status(400).json({ message: `Invalid parentId: ${parentId}` });
         }
     }
    res.status(500).json({ message: 'Lỗi server khi tạo bình luận.' });
  }
});

// --- Vote on Post or Comment ---
// Uses route parameters to distinguish between posts and comments
router.post('/:targetType(posts|comments)/:targetId/vote', async (req, res) => {
  const { targetType, targetId } = req.params; // 'posts' or 'comments'
  const { voteType } = req.body; // 'up' or 'down'
  const userId = req.userId;
  const numericTargetId = Number(targetId);

  // Validation
  if (isNaN(numericTargetId)) {
      return res.status(400).json({ message: 'Invalid target ID.' });
  }
  if (!['up', 'down'].includes(voteType)) {
    return res.status(400).json({ message: 'Invalid vote type. Must be "up" or "down".' });
  }

  const voteValue = voteType === 'up' ? 1 : -1;
  const targetColumn = targetType === 'posts' ? 'post_id' : 'comment_id';
  const otherTargetColumn = targetType === 'posts' ? 'comment_id' : 'post_id'; // To ensure null in the other column

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check current vote status for this user and target
    const { rows: existingVotes } = await client.query(
      `SELECT vote_type FROM votes WHERE user_id = $1 AND ${targetColumn} = $2`,
      [userId, numericTargetId]
    );

    const currentVoteType = existingVotes.length > 0 ? existingVotes[0].vote_type : null;

    // If the user is trying to cast the same vote again, remove the vote (toggle off)
    if (currentVoteType === voteValue) {
        await client.query(
            `DELETE FROM votes WHERE user_id = $1 AND ${targetColumn} = $2`,
            [userId, numericTargetId]
        );
    } else {
        // If changing vote or casting new vote, use INSERT ... ON CONFLICT UPDATE
        await client.query(
            `INSERT INTO votes (user_id, ${targetColumn}, ${otherTargetColumn}, vote_type)
             VALUES ($1, $2, NULL, $3)
             ON CONFLICT (user_id, post_id, comment_id) -- Use the unique constraint columns
             DO UPDATE SET vote_type = EXCLUDED.vote_type`, // Update vote_type if conflict occurs
            [userId, numericTargetId, voteValue]
        );
    }


    await client.query('COMMIT');

    // --- Fetch Updated Item with Votes ---
    // Determine table name based on targetType
    const tableName = targetType === 'posts' ? 'discussion_posts' : 'discussion_comments';

    // Query to get the item and associated user details
    const updatedItemQuery = `
        SELECT i.*, u.username, u.avatar_color, u.avatar_url
        FROM ${tableName} i
        JOIN users u ON i.user_id = u.id
        WHERE i.id = $1`;
    const itemRes = await client.query(updatedItemQuery, [numericTargetId]);

    if (itemRes.rows.length === 0) {
      // This might happen if the post/comment was deleted concurrently
      client.release(); // Release client before returning error
      return res.status(404).json({ message: `${targetType.slice(0, -1)} not found.` });
    }
    const item = itemRes.rows[0];

    // Query to get all votes for this specific item
    const allVotesQuery = `SELECT user_id, vote_type FROM votes WHERE ${targetColumn} = $1`;
    const allVotesRes = await client.query(allVotesQuery, [numericTargetId]);

    // Aggregate votes
    item.upvotedBy = allVotesRes.rows.filter((v) => v.vote_type === 1).map((v) => v.user_id);
    item.downvotedBy = allVotesRes.rows.filter((v) => v.vote_type === -1).map((v) => v.user_id);

    // --- Prepare and Send Response ---
    const responsePayload = {};
    const singularTarget = targetType.slice(0, -1); // 'post' or 'comment'
    responsePayload[singularTarget] = toCamelCase(item);

    res.json(responsePayload);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Vote processing error:', error);
     // Check for foreign key violations if targetId is invalid
     if (error.code === '23503') {
         return res.status(404).json({ message: `${targetType.slice(0, -1)} with ID ${targetId} not found.` });
     }
    res.status(500).json({ message: 'Lỗi server khi xử lý vote.' });
  } finally {
    client.release();
  }
});

module.exports = router;
