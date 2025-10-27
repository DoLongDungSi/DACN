// backend/routes/initialData.js
const express = require('express');
const pool = require('../config/db');
const { toCamelCase } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Parallel database queries
    const [
      usersRes,
      problemsRes,
      tagsRes,
      metricsRes,
      submissionsRes,
      postsRes,
      commentsRes,
      allVotesRes,
    ] = await Promise.all([
      pool.query(
        'SELECT id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned FROM users'
      ),
      // Query to fetch problems along with their tags and metrics as arrays
      pool.query(
        `SELECT p.*, u.username as author_username,
                COALESCE(tags.tag_ids, '{}'::int[]) as tags, -- Ensure empty array if no tags
                COALESCE(metrics.metric_ids, '{}'::int[]) as metrics -- Ensure empty array if no metrics
         FROM problems p
         JOIN users u ON p.author_id = u.id
         LEFT JOIN (
           SELECT problem_id, array_agg(tag_id ORDER BY tag_id) as tag_ids -- Added ORDER BY for consistency
           FROM problem_tags
           GROUP BY problem_id
         ) tags ON p.id = tags.problem_id
         LEFT JOIN (
           SELECT problem_id, array_agg(metric_id ORDER BY metric_id) as metric_ids -- Added ORDER BY for consistency
           FROM problem_metrics
           GROUP BY problem_id
         ) metrics ON p.id = metrics.problem_id
         ORDER BY p.id` // Added ORDER BY for consistency
      ),
      pool.query('SELECT * FROM tags ORDER BY name'),
      pool.query('SELECT * FROM metrics ORDER BY key'),
      pool.query('SELECT s.*, u.username FROM submissions s JOIN users u ON s.user_id = u.id ORDER BY s.submitted_at DESC'), // Order submissions
      pool.query(
        'SELECT p.*, u.username, u.avatar_color, u.avatar_url FROM discussion_posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC' // Order posts
      ),
      pool.query(
        'SELECT c.*, u.username, u.avatar_color, u.avatar_url FROM discussion_comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at ASC' // Order comments chronologically
      ),
      pool.query('SELECT * from votes'), // Fetch all votes once
    ]);

    // Process votes efficiently using a Map
    const voteMap = new Map(); // Key: 'post-1' or 'comment-5', Value: { upvotedBy: [], downvotedBy: [] }
    allVotesRes.rows.forEach(vote => {
        const targetType = vote.post_id ? 'post' : 'comment';
        const targetId = vote.post_id || vote.comment_id;
        const key = `${targetType}-${targetId}`;

        if (!voteMap.has(key)) {
            voteMap.set(key, { upvotedBy: [], downvotedBy: [] });
        }
        const votes = voteMap.get(key);
        if (vote.vote_type === 1) {
            votes.upvotedBy.push(vote.user_id);
        } else if (vote.vote_type === -1) {
            votes.downvotedBy.push(vote.user_id);
        }
    });

    // Helper to add votes to posts or comments
    const addVotes = (item, type) => {
        const key = `${type}-${item.id}`;
        const votes = voteMap.get(key) || { upvotedBy: [], downvotedBy: [] };
        return {
            ...item,
            upvotedBy: votes.upvotedBy,
            downvotedBy: votes.downvotedBy,
        };
    };


    // Process submissions to convert numeric strings to numbers
    const processedSubmissions = submissionsRes.rows.map((sub) => ({
      ...sub,
      // Ensure score and runtime are numbers, handle potential nulls
      public_score: sub.public_score ? parseFloat(sub.public_score) : null,
      runtime_ms: sub.runtime_ms ? parseFloat(sub.runtime_ms) : null,
    }));

    // Respond with camelCased data
    res.json(
      toCamelCase({
        users: usersRes.rows,
        problems: problemsRes.rows,
        tags: tagsRes.rows,
        metrics: metricsRes.rows,
        submissions: processedSubmissions,
        posts: postsRes.rows.map(post => addVotes(post, 'post')),
        comments: commentsRes.rows.map(comment => addVotes(comment, 'comment')),
      })
    );
  } catch (error) {
    console.error('Error fetching initial data:', error);
    res.status(500).json({ message: 'Failed to load initial data from server.' });
  }
});

module.exports = router;
