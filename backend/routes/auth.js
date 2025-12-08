// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs'); // FIX: Đổi từ 'bcrypt' sang 'bcryptjs' để khớp với package.json
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { SALT_ROUNDS, JWT_SECRET, OWNER_ID } = require('../config/constants');
const { toCamelCase, getAvatarColor } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth'); // Import authMiddleware

const router = express.Router();

// --- Signup Route ---
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  // Basic validation
  if (!username || !email || !password || password.length < 6) {
    return res.status(400).json({ message: 'Invalid input. Ensure username, email are provided and password is at least 6 characters long.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const avatarColor = getAvatarColor(username);

    // Default user profile structure
    const defaultProfile = {
      skills: [],
      education: [],
      workExperience: [],
      allowJobContact: true,
      showOnLeaderboard: true,
      showSubmissionHistory: true,
      notifications: { // Default notification settings
        award: { site: true, email: true },
        promotions: { site: false, email: false },
        newComments: { site: true, email: false },
        announcements: { site: true, email: true },
        contestUpdates: { site: true, email: true },
        featureAnnouncements: { site: true, email: true },
      },
      // Initialize other potential profile fields
      realName: null,
      gender: null,
      country: null,
      birthday: null,
      summary: null,
      website: null,
      github: null,
      twitter: null,
      linkedin: null,
    };

    const newUserQuery = `
      INSERT INTO users (username, email, password_hash, avatar_color, profile)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium
    `;

    const result = await pool.query(newUserQuery, [
      username,
      email,
      passwordHash,
      avatarColor,
      JSON.stringify(defaultProfile), // Ensure profile is stored as JSONB
    ]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' } // Token expires in 1 day
    );

    // Set token in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true, // Prevents client-side script access
      secure: process.env.NODE_ENV === 'production', // Send only over HTTPS in production
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
      sameSite: 'lax', // Basic CSRF protection
    });

    // Send back user data (excluding password hash)
    res.status(201).json({ user: toCamelCase(user) });

  } catch (error) {
    if (error.code === '23505') { // PostgreSQL unique violation error code
      // Determine which field caused the violation
      if (error.constraint === 'users_username_key') {
           return res.status(409).json({ message: 'Tên người dùng đã tồn tại.' });
      } else if (error.constraint === 'users_email_key') {
           return res.status(409).json({ message: 'Email đã tồn tại.' });
      } else {
           return res.status(409).json({ message: 'Tên người dùng hoặc email đã tồn tại.' }); // Generic message if constraint name is unknown
      }
    }
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Lỗi server khi đăng ký.' });
  }
});

// --- Login Route ---
router.post('/login', async (req, res) => {
  const { credential, password } = req.body; // Credential can be username or email

  if (!credential || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tên người dùng/email và mật khẩu.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium, password_hash
       FROM users
       WHERE username = $1 OR email = $1`,
      [credential]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ.' }); // Generic message for security
    }

    const user = result.rows[0];

    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ.' }); // Generic message
    }

    // Check if the user account is banned
    if (user.is_banned) {
      return res.status(403).json({ message: 'Tài khoản này đã bị khóa.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set token in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    // Remove password hash before sending user data
    delete user.password_hash;
    res.json({ user: toCamelCase(user) });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Lỗi server khi đăng nhập.' });
  }
});

// --- Logout Route ---
router.post('/logout', (req, res) => {
  // Clear the token cookie
  res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
  });
  res.status(204).send(); // No content response
});

// --- Check Session Route ---
router.get('/check-session', authMiddleware, async (req, res) => {
  // authMiddleware already verified the token and attached req.userId
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, joined_at, avatar_color, avatar_url, profile, is_banned, is_premium
       FROM users
       WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      // This case might happen if the user was deleted after token issuance
      res.clearCookie('token');
      return res.status(404).json({ message: 'User associated with token not found.' });
    }

    const user = result.rows[0];
    // Check if banned *after* fetching, in case status changed
     if (user.is_banned) {
       res.clearCookie('token'); // Log out banned user
       return res.status(403).json({ message: 'Tài khoản này đã bị khóa.' });
     }


    res.json({ user: toCamelCase(user) });

  } catch (error) {
    console.error('Check Session Error:', error);
    res.status(500).json({ message: 'Lỗi server khi kiểm tra phiên đăng nhập.' });
  }
});

// --- Change Password Route ---
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới (ít nhất 6 ký tự).' });
  }

  try {
    // Fetch the current password hash
    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows.length === 0) {
      // Should not happen if authMiddleware passed, but good practice to check
      return res.status(404).json({ message: 'User not found.' });
    }

    const currentHash = userRes.rows[0].password_hash;

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng.' });
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the password in the database
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newPasswordHash,
      req.userId,
    ]);

    res.status(200).json({ message: 'Đổi mật khẩu thành công!' });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu.' });
  }
});

module.exports = router;