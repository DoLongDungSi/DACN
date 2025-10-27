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
      RETURNING *`; // Return all fields of the new post
    const insertResult = await pool.query(insertQuery, [title, content, problemId, userId]);

    if (insertResult.rows.length === 0) {
        throw new Error("Failed to insert post, no data returned.");
    }

    const newPostRaw = insertResult.rows[0];

    // Fetch user details for the response (avoid sending sensitive info)
    const userRes = await pool.query('SELECT username, avatar_color, avatar_url FROM users WHERE id = $1', [userId]);
    const userDetails = userRes.rows[0] || { username: 'Unknown', avatar_color: 'bg-slate-500', avatar_url: null };

    // Construct the final post object for the response
    const finalPost = {
        ...newPostRaw, // Spread all fields from the inserted row
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

// --- Update Discussion Post ---
router.put('/posts/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.userId;
    const userRole = req.userRole; // Get role from auth middleware

    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check ownership or if user is owner
        const postCheck = await client.query('SELECT user_id FROM discussion_posts WHERE id = $1', [id]);
        if (postCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found.' });
        }
        if (postCheck.rows[0].user_id !== userId && userRole !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: You do not own this post.' });
        }

        // Perform update
        const updateQuery = `
            UPDATE discussion_posts
            SET title = $1, content = $2
            WHERE id = $3
            RETURNING *`; // Return updated post
        const updateResult = await client.query(updateQuery, [title, content, id]);

        if (updateResult.rows.length === 0) {
             // Should not happen if the check above passed, but good practice
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Post not found during update.' });
        }

        await client.query('COMMIT');

        // Fetch user details and votes to return the complete object
        const updatedPostRaw = updateResult.rows[0];
        const userRes = await pool.query('SELECT username, avatar_color, avatar_url FROM users WHERE id = $1', [updatedPostRaw.user_id]);
        const userDetails = userRes.rows[0] || { username: 'Unknown', avatar_color: 'bg-slate-500', avatar_url: null };

        const votesRes = await pool.query('SELECT user_id, vote_type FROM votes WHERE post_id = $1', [id]);
        const upvotedBy = votesRes.rows.filter(v => v.vote_type === 1).map(v => v.user_id);
        const downvotedBy = votesRes.rows.filter(v => v.vote_type === -1).map(v => v.user_id);

        const finalPost = {
            ...updatedPostRaw,
            username: userDetails.username,
            avatarColor: userDetails.avatar_color,
            avatarUrl: userDetails.avatar_url,
            upvotedBy,
            downvotedBy,
        };

        res.json({ post: toCamelCase(finalPost) });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating post:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật bài viết.' });
    } finally {
        client.release();
    }
});

// --- Delete Discussion Post ---
router.delete('/posts/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check ownership or if user is owner
        const postCheck = await client.query('SELECT user_id FROM discussion_posts WHERE id = $1', [id]);
        if (postCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found.' });
        }
        if (postCheck.rows[0].user_id !== userId && userRole !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: You do not own this post.' });
        }

        // Perform deletion (CASCADE should handle comments and votes)
        const deleteResult = await client.query('DELETE FROM discussion_posts WHERE id = $1 RETURNING id', [id]);

        if (deleteResult.rowCount === 0) {
            // Should not happen if the check above passed
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found during deletion.' });
        }

        await client.query('COMMIT');
        res.status(204).send(); // No content on successful deletion

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting post:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa bài viết.' });
    } finally {
        client.release();
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
      RETURNING *`; // Return all fields
    const insertResult = await pool.query(insertQuery, [content, postId, parentId, userId]);

    if (insertResult.rows.length === 0) {
       throw new Error("Failed to insert comment, no data returned.");
    }

    const newCommentRaw = insertResult.rows[0];

     // Fetch user details for the response
     const userRes = await pool.query('SELECT username, avatar_color, avatar_url FROM users WHERE id = $1', [userId]);
     const userDetails = userRes.rows[0] || { username: 'Unknown', avatar_color: 'bg-slate-500', avatar_url: null };


    // Construct the final comment object
    const finalComment = {
        ...newCommentRaw,
        postId: Number(postId), // Ensure type consistency
        parentId: parentId ? Number(parentId) : null, // Ensure parentId is number or null
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

// --- Update Discussion Comment ---
router.put('/comments/:id', async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;

    if (!content) {
        return res.status(400).json({ message: 'Content is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check ownership or if user is owner
        const commentCheck = await client.query('SELECT user_id FROM discussion_comments WHERE id = $1', [id]);
        if (commentCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found.' });
        }
        if (commentCheck.rows[0].user_id !== userId && userRole !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: You do not own this comment.' });
        }

        // Perform update
        const updateQuery = `
            UPDATE discussion_comments
            SET content = $1
            WHERE id = $2
            RETURNING *`; // Return updated comment
        const updateResult = await client.query(updateQuery, [content, id]);

         if (updateResult.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Comment not found during update.' });
         }

        await client.query('COMMIT');

        // Fetch user details and votes to return the complete object
        const updatedCommentRaw = updateResult.rows[0];
        const userRes = await pool.query('SELECT username, avatar_color, avatar_url FROM users WHERE id = $1', [updatedCommentRaw.user_id]);
        const userDetails = userRes.rows[0] || { username: 'Unknown', avatar_color: 'bg-slate-500', avatar_url: null };

        const votesRes = await pool.query('SELECT user_id, vote_type FROM votes WHERE comment_id = $1', [id]);
        const upvotedBy = votesRes.rows.filter(v => v.vote_type === 1).map(v => v.user_id);
        const downvotedBy = votesRes.rows.filter(v => v.vote_type === -1).map(v => v.user_id);

        const finalComment = {
            ...updatedCommentRaw,
            username: userDetails.username,
            avatarColor: userDetails.avatar_color,
            avatarUrl: userDetails.avatar_url,
            upvotedBy,
            downvotedBy,
        };

        res.json({ comment: toCamelCase(finalComment) });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating comment:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật bình luận.' });
    } finally {
        client.release();
    }
});

// --- Delete Discussion Comment ---
router.delete('/comments/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check ownership or if user is owner
        const commentCheck = await client.query('SELECT user_id FROM discussion_comments WHERE id = $1', [id]);
        if (commentCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found.' });
        }
        if (commentCheck.rows[0].user_id !== userId && userRole !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: You do not own this comment.' });
        }

         // Explicitly delete replies first if CASCADE isn't fully trusted or for logging
         // await client.query('DELETE FROM discussion_comments WHERE parent_id = $1', [id]);
         // Explicitly delete votes associated with this comment
         // await client.query('DELETE FROM votes WHERE comment_id = $1', [id]);


        // Perform deletion (CASCADE on parent_id should handle replies, CASCADE on votes table handles votes)
        const deleteResult = await client.query('DELETE FROM discussion_comments WHERE id = $1 RETURNING id', [id]);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found during deletion.' });
        }

        await client.query('COMMIT');
        res.status(204).send(); // No content on successful deletion

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa bình luận.' });
    } finally {
        client.release();
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
        // Ensure ON CONFLICT targets the correct unique constraint columns
        await client.query(
            `INSERT INTO votes (user_id, post_id, comment_id, vote_type)
             VALUES ($1, ${targetType === 'posts' ? '$2' : 'NULL'}, ${targetType === 'comments' ? '$2' : 'NULL'}, $3)
             ON CONFLICT (user_id, post_id, comment_id)
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
      // No need to release client here, finally block handles it
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
