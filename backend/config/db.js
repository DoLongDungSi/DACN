// backend/config/db.js
const { Pool } = require('pg');

// Use environment variable for connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1); // Exit if database URL is missing
}

const pool = new Pool({ connectionString });

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
    // Consider exiting or implementing retry logic depending on requirements
  } else {
    console.log('Connected to database');
    release(); // Release client immediately after connection test
  }
});


module.exports = pool;
