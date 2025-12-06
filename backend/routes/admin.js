// backend/routes/admin.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware, ownerMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const { OWNER_ID } = require('../config/constants');

const router = express.Router();

// Apply auth and owner checks to all routes in this file
router.use(authMiddleware);
router.use(ownerMiddleware);

// --- Update User Role ---
router.put('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validate role input
  if (!['user', 'creator', 'owner'].includes(role)) {
     return res.status(400).json({ message: 'Invalid role specified.' });
  }

  const targetUserId = Number(id);

  // Prevent changing owner's role
  if (targetUserId === OWNER_ID) {
    return res.status(403).json({ message: 'Không thể thay đổi vai trò của Owner.' });
  }

  // Prevent assigning 'owner' role via API (should be done manually or via specific secure process)
  if (role === 'owner') {
      return res.status(403).json({ message: 'Cannot assign owner role via API.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2 AND id != $3 -- Ensure owner cannot be targeted
       RETURNING id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium`, // Exclude password_hash
      [role, targetUserId, OWNER_ID]
    );

    if (result.rows.length === 0) {
      // User not found or was the owner
      return res.status(404).json({ message: 'User not found or cannot be modified.' });
    }

    res.json({ user: toCamelCase(result.rows[0]) });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật vai trò người dùng.' });
  }
});

// --- Toggle User Ban Status ---
router.put('/users/:id/ban', async (req, res) => {
  const { id } = req.params;
  const targetUserId = Number(id);

  // Prevent banning/unbanning owner
  if (targetUserId === OWNER_ID) {
    return res.status(403).json({ message: 'Không thể khóa hoặc mở khóa Owner.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET is_banned = NOT is_banned
       WHERE id = $1 AND id != $2 -- Ensure owner cannot be targeted
       RETURNING id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium`, // Exclude password_hash
      [targetUserId, OWNER_ID]
    );

     if (result.rows.length === 0) {
       // User not found or was the owner
       return res.status(404).json({ message: 'User not found or cannot be modified.' });
     }

    res.json({ user: toCamelCase(result.rows[0]) });

  } catch (error) {
    console.error('Error toggling user ban status:', error);
    res.status(500).json({ message: 'Lỗi server khi thay đổi trạng thái khóa người dùng.' });
  }
});

// --- Delete User ---
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const targetUserId = Number(id);

  // Prevent deleting owner
  if (targetUserId === OWNER_ID) {
    return res.status(403).json({ message: 'Không thể xóa tài khoản Owner.' });
  }

  try {
    // Consider using a transaction if related data needs deletion
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [targetUserId]);

    if (result.rowCount === 0) {
        return res.status(404).json({ message: 'User not found.' });
    }

    res.status(204).send(); // No content on successful deletion

  } catch (error) {
    console.error('Error deleting user:', error);
    // Handle potential foreign key constraint issues if needed
    res.status(500).json({ message: 'Lỗi server khi xóa người dùng.' });
  }
});

// --- Add Tag ---
router.post('/tags', async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: 'Tag name cannot be empty.' });
  }

  try {
    const result = await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING *', [name.trim()]);
    res.status(201).json({ tag: toCamelCase(result.rows[0]) });
  } catch (error) {
     if (error.code === '23505' && error.constraint === 'tags_name_key') {
         return res.status(409).json({ message: 'Tag name already exists.' });
     }
    console.error('Error adding tag:', error);
    res.status(500).json({ message: 'Lỗi server khi thêm tag.' });
  }
});

// --- Delete Tag ---
router.delete('/tags/:id', async (req, res) => {
  const { id } = req.params;
  const tagId = Number(id);

  try {
    // Deleting a tag might cascade or require handling relations in problem_tags
    const result = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING id', [tagId]);

     if (result.rowCount === 0) {
       return res.status(404).json({ message: 'Tag not found.' });
     }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting tag:', error);
    // Handle potential foreign key errors (e.g., if tag is still in use)
    if (error.code === '23503') { // foreign_key_violation
        return res.status(409).json({ message: 'Cannot delete tag: It is currently associated with one or more problems.' });
    }
    res.status(500).json({ message: 'Lỗi server khi xóa tag.' });
  }
});

// --- Add Metric ---
router.post('/metrics', async (req, res) => {
  const { key, direction } = req.body;

  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return res.status(400).json({ message: 'Metric key cannot be empty.' });
  }
  if (!['maximize', 'minimize'].includes(direction)) {
      return res.status(400).json({ message: 'Invalid direction. Must be "maximize" or "minimize".' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO metrics (key, direction) VALUES ($1, $2) RETURNING *',
      [key.trim(), direction]
    );
    res.status(201).json({ metric: toCamelCase(result.rows[0]) });
  } catch (error) {
     if (error.code === '23505' && error.constraint === 'metrics_key_key') {
       return res.status(409).json({ message: 'Metric key already exists.' });
     }
    console.error('Error adding metric:', error);
    res.status(500).json({ message: 'Lỗi server khi thêm metric.' });
  }
});

// --- Delete Metric ---
router.delete('/metrics/:id', async (req, res) => {
  const { id } = req.params;
  const metricId = Number(id);

  try {
    // Deleting a metric might cascade or require handling relations in problem_metrics
    const result = await pool.query('DELETE FROM metrics WHERE id = $1 RETURNING id', [metricId]);

     if (result.rowCount === 0) {
       return res.status(404).json({ message: 'Metric not found.' });
     }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting metric:', error);
     // Handle potential foreign key errors (e.g., if metric is still in use)
     if (error.code === '23503') { // foreign_key_violation
       return res.status(409).json({ message: 'Cannot delete metric: It is currently associated with one or more problems.' });
     }
    res.status(500).json({ message: 'Lỗi server khi xóa metric.' });
  }
});

module.exports = router;
