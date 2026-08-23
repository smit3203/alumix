const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/insights', authenticateToken, analyticsController.getInsights);

module.exports = router;
