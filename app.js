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

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`AI-Powered Alumni Career Intelligence System`);
  console.log(`Server listening at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

module.exports = app;
