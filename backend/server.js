// backend/server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes'); // Import aggregated routes
const { PORT } = require('./config/constants'); // Import PORT from constants

// --- INITIALIZATION ---
const app = express();

// --- CORS Configuration ---
// Make sure this is specific and secure for production
const corsOptions = {
  // Allow requests from your frontend origin
  origin: process.env.FRONTEND_URL || true, // Use env var or allow all in dev (true) - BE CAREFUL with 'true' in prod
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// --- CORE MIDDLEWARE ---
app.use(cors(corsOptions)); // Apply CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// --- MOUNT API ROUTES ---
// All API routes will be prefixed with /api
app.use('/api', apiRoutes);

// --- Basic Error Handling Middleware (Optional but Recommended) ---
// Catch-all for 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found.' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err); // Log the error stack
  // Avoid sending detailed error messages in production for security
  const statusCode = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : err.message || 'Server error';
  res.status(statusCode).json({ message });
});


// --- SERVER STARTUP ---
// Database connection is implicitly tested in db.js when imported
// No need to call startServer function here if db.js handles connection/logging

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  // Optional: Log environment (development/production)
  console.log(`Running in ${process.env.NODE_ENV || 'development'} mode`);
   if(process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL) {
      console.warn('Warning: DATABASE_URL environment variable is not set. Using default or potentially failing.');
   }
   if(process.env.NODE_ENV !== 'production' && !process.env.JWT_SECRET) {
       console.warn('Warning: JWT_SECRET environment variable is not set. Using insecure default.');
   }
   if(process.env.NODE_ENV === 'production' && (!process.env.DATABASE_URL || !process.env.JWT_SECRET || !process.env.FRONTEND_URL)) {
        console.error('FATAL ERROR: Required environment variables (DATABASE_URL, JWT_SECRET, FRONTEND_URL) are missing for production.');
        process.exit(1);
   }
});

// Handle graceful shutdown (optional)
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    // Add cleanup logic here if needed (e.g., close DB pool)
    // pool.end(() => { console.log('Database pool closed.'); process.exit(0); });
    process.exit(0); // Exit gracefully
});
