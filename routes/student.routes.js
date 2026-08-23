const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/profile', authenticateToken, studentController.getStudentProfile);
router.post('/profile', authenticateToken, studentController.updateStudentProfile);

module.exports = router;
