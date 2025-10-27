// backend/config/multer.js
const multer = require('multer');

// Configure multer for memory storage (for file uploads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Middleware specifically for problem uploads (train/test CSV)
const problemUploadMiddleware = upload.fields([
  { name: 'trainCsv', maxCount: 1 },
  { name: 'testCsv', maxCount: 1 },
]);

// Middleware for single file uploads (e.g., submission file)
const singleUploadMiddleware = (fieldName) => upload.single(fieldName);

module.exports = {
  upload, // General multer instance if needed elsewhere
  problemUploadMiddleware,
  singleUploadMiddleware,
};
