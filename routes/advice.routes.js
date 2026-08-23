const express = require('express');
const router = express.Router();
const adviceController = require('../controllers/advice.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, adviceController.getAdviceIndex);
router.post('/question', authenticateToken, authorizeRoles('student'), adviceController.postQuestion);
router.post('/answer', authenticateToken, authorizeRoles('alumni'), adviceController.postAnswer);
router.post('/answer/edit', authenticateToken, authorizeRoles('alumni'), adviceController.postEditAnswer);

module.exports = router;
