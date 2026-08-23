const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { authenticateToken } = require('./middleware/auth');
const studentController = require('./controllers/student.controller');

// Import Routes
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const alumniRoutes = require('./routes/alumni.routes');
const aiRoutes = require('./routes/ai.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const adviceRoutes = require('./routes/advice.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Production reverse-proxy header trust (Nginx / Cloud Load Balancer / AWS)
app.set('trust proxy', 1);

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// User session state local variables
app.use((req, res, next) => {
  res.locals.user = null;
  res.locals.path = req.path;
  next();
});

// Health check endpoint for Docker, AWS ALB & Container Orchestrators
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/db');
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
});

// Home Page Route
app.get('/', authenticateToken, studentController.getHome);

// Mount Feature Routes
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/alumni', alumniRoutes);
app.use('/ai', aiRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/advice', adviceRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('auth/login', {
    title: '404 - Page Not Found',
    error: 'The requested page does not exist.',
    message: null,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).send('Internal Server Error: ' + err.message);
});

// Start Server when run directly
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`AI-Powered Alumni Career Intelligence System`);
    console.log(`Server listening at: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
  });

  // Graceful Shutdown for Container Lifecycle
  const shutdown = () => {
    console.log('Received shutdown signal, closing server gracefully...');
    if (server) {
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
