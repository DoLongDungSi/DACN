// backend/config/constants.js
const path = require('path');
const OWNER_ID = 1;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // Use environment variable if available
const PORT = process.env.PORT || 5001;
const DATA_ROOT = process.env.DATA_ROOT || path.join(process.cwd(), 'db', 'data');
const DIRS = {
  UPLOADS: path.join(DATA_ROOT, 'uploads'),
  DATA: DATA_ROOT
};

module.exports = {
  OWNER_ID,
  SALT_ROUNDS,
  JWT_SECRET,
  PORT,
  DIRS,
  DATA_ROOT
};
