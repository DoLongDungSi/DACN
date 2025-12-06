// backend/routes/users.js
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const { OWNER_ID } = require('../config/constants');

const router = express.Router();

// --- Update User Profile (Self) ---
router.put('/me', authMiddleware, async (req, res) => {
  const { username, email, profile } = req.body;
  const userId = req.userId; // Get userId from authMiddleware

  // Basic validation
  if (!username || !email || !profile) {
    return res.status(400).json({ message: 'Missing required fields: username, email, or profile data.' });
  }

  // Add server-side validation for profile structure if needed

  try {
    const query = `
      UPDATE users
      SET username = $1, email = $2, profile = $3
      WHERE id = $4
      RETURNING id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium
    `;
    const result = await pool.query(query, [username, email, JSON.stringify(profile), userId]); // Ensure profile is stringified

    if (result.rows.length === 0) {
      // Should not happen if authMiddleware worked, but check anyway
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user: toCamelCase(result.rows[0]) });

  } catch (error) {
    if (error.code === '23505') { // Handle unique constraint violation (username or email)
      if (error.constraint === 'users_username_key') {
           return res.status(409).json({ message: 'Tên người dùng đã tồn tại.' });
      } else if (error.constraint === 'users_email_key') {
           return res.status(409).json({ message: 'Email đã tồn tại.' });
      } else {
           return res.status(409).json({ message: 'Tên người dùng hoặc email đã tồn tại.' });
      }
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật hồ sơ.' });
  }
});

// --- Delete User Account (Self) ---
router.delete('/me', authMiddleware, async (req, res) => {
  const userId = req.userId;

  // Prevent owner account deletion
  if (userId === OWNER_ID) {
    return res.status(403).json({ message: 'Không thể xóa tài khoản Owner.' });
  }

  // Consider adding a password confirmation step here for security

  try {
    // Use a transaction for safety, although deleting related data might be complex
    // Simple deletion for now:
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rowCount === 0) {
        return res.status(404).json({ message: 'User not found.' });
    }

    // Clear the auth cookie upon successful deletion
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.status(204).send(); // No content on successful deletion

  } catch (error) {
    console.error('Error deleting account:', error);
    // Handle potential foreign key constraint errors if needed
    res.status(500).json({ message: 'Lỗi server khi xóa tài khoản.' });
  }
});

// --- Update User Avatar (Self) ---
router.put('/me/avatar', authMiddleware, async (req, res) => {
  const { avatarDataUrl } = req.body;
  const userId = req.userId;

  // Basic validation for Data URL (simple check)
  if (!avatarDataUrl || typeof avatarDataUrl !== 'string' || !avatarDataUrl.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Invalid or missing avatar data URL.' });
  }

  // Optional: Add size validation for the Data URL string length if needed

  try {
    const query = `
      UPDATE users
      SET avatar_url = $1
      WHERE id = $2
      RETURNING id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium
    `;
    const result = await pool.query(query, [avatarDataUrl, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user: toCamelCase(result.rows[0]) });

  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật ảnh đại diện.' });
  }
});


module.exports = router;
