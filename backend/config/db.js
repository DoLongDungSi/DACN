// backend/config/db.js
const { Pool } = require('pg');

// Use environment variable for connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1); // Exit if database URL is missing
}

const pool = new Pool({ connectionString });

/**
 * Lightweight, idempotent migrations to align existing databases with current code.
 * - Adds users.is_premium
 * - Adds problems.summary, cover_image_url, ground_truth_path, public_test_path (renames old *_content if present)
 */
const runMigrations = async () => {
  const sql = `
  DO $$
  BEGIN
    -- users.is_premium
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='is_premium'
    ) THEN
      ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- problems.summary
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='problems' AND column_name='summary'
    ) THEN
      ALTER TABLE problems ADD COLUMN summary TEXT;
    END IF;

    -- problems.cover_image_url
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='problems' AND column_name='cover_image_url'
    ) THEN
      ALTER TABLE problems ADD COLUMN cover_image_url TEXT;
    END IF;

    -- problems.ground_truth_path (rename from ground_truth_content if needed)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='problems' AND column_name='ground_truth_path'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='problems' AND column_name='ground_truth_content'
      ) THEN
        ALTER TABLE problems RENAME COLUMN ground_truth_content TO ground_truth_path;
      ELSE
        ALTER TABLE problems ADD COLUMN ground_truth_path TEXT;
      END IF;
    END IF;

    -- problems.public_test_path (rename from public_test_content if needed)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='problems' AND column_name='public_test_path'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='problems' AND column_name='public_test_content'
      ) THEN
        ALTER TABLE problems RENAME COLUMN public_test_content TO public_test_path;
      ELSE
        ALTER TABLE problems ADD COLUMN public_test_path TEXT;
      END IF;
    END IF;
  END $$;
  `;

  try {
    await pool.query(sql);
    console.log('[db] Migration check completed.');
  } catch (err) {
    console.error('[db] Migration error:', err);
    // Do not exit hard; allow the app to log the error and fail loudly elsewhere.
  }
};

// Test connection and run migrations
pool.connect(async (err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
  } else {
    console.log('Connected to database');
    try {
      await runMigrations();
    } catch (e) {
      console.error('[db] Migration run failed:', e);
    }
    release();
  }
});

module.exports = pool;
