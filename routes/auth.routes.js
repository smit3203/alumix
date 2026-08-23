const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

router.get('/register', authController.getRegister);
router.post('/register/student', authController.postRegisterStudent);
router.post('/register/alumni', authController.postRegisterAlumni);

router.get('/logout', authController.postLogout);
router.post('/logout', authController.postLogout);

module.exports = router;
