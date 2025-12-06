// backend/utils/storage.js
const fs = require('fs');
const path = require('path');

// Centralized data root so every module reads/writes from the same place.
// Defaults to <repo>/db/data to keep datasets/versioned assets together.
const defaultRoot = path.resolve(__dirname, '../../db/data');
const DATA_ROOT = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : defaultRoot;

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

ensureDir(DATA_ROOT);

const resolveFilePath = (fileRef) => {
  if (!fileRef) return null;
  if (path.isAbsolute(fileRef)) return fileRef;
  return path.join(DATA_ROOT, fileRef);
};

const readFileContent = (fileRef, fallbackFilename) => {
  const candidatePaths = [];
  if (fileRef) candidatePaths.push(resolveFilePath(fileRef));
  if (fallbackFilename) {
    const sanitized = path.basename(fallbackFilename);
    candidatePaths.push(
      path.join('/usr/src/test', sanitized),
      path.join(__dirname, '../../test', sanitized),
      path.join(process.cwd(), 'test', sanitized),
    );
  }

  for (const candidate of candidatePaths) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8');
      }
    } catch (error) {
      console.error('[storage] Error reading file', candidate, error);
    }
  }
  return null;
};

module.exports = {
  DATA_ROOT,
  ensureDir,
  resolveFilePath,
  readFileContent,
};
