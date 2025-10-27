// backend/config/constants.js
const OWNER_ID = 1;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // Use environment variable if available
const PORT = process.env.PORT || 5001;

module.exports = {
  OWNER_ID,
  SALT_ROUNDS,
  JWT_SECRET,
  PORT,
};
