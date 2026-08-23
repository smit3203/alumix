const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/finder', authenticateToken, aiController.getAiFinder);
router.post('/finder', authenticateToken, aiController.postAiSearch);

module.exports = router;
