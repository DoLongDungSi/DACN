const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const runMigrations = async () => {
  const sql = `
  DO $$
  BEGIN
    -- users.is_premium
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_premium') THEN
      ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- problems.summary
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='summary') THEN
      ALTER TABLE problems ADD COLUMN summary TEXT;
    END IF;

    -- problems.cover_image_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='cover_image_url') THEN
      ALTER TABLE problems ADD COLUMN cover_image_url TEXT;
    END IF;

    -- problems.prizes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='prizes') THEN
      ALTER TABLE problems ADD COLUMN prizes TEXT;
    END IF;

    -- problems.data_description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='data_description') THEN
      ALTER TABLE problems ADD COLUMN data_description TEXT;
    END IF;

    -- problems.is_frozen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='is_frozen') THEN
      ALTER TABLE problems ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- submissions.is_official (NEW: Đánh dấu bài nộp được tính vào BXH)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='is_official') THEN
      ALTER TABLE submissions ADD COLUMN is_official BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- Rename old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='ground_truth_content') THEN
      ALTER TABLE problems RENAME COLUMN ground_truth_content TO ground_truth_path;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='ground_truth_path') THEN
          ALTER TABLE problems ADD COLUMN ground_truth_path TEXT;
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='public_test_content') THEN
      ALTER TABLE problems RENAME COLUMN public_test_content TO public_test_path;
    ELSE
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='problems' AND column_name='public_test_path') THEN
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
  }
};

pool.connect(async (err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
  } else {
    console.log('Connected to database');
    try { await runMigrations(); } catch (e) { console.error('[db] Migration run failed:', e); }
    release();
  }
});

module.exports = pool;