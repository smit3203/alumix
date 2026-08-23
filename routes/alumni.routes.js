const express = require('express');
const router = express.Router();
const alumniController = require('../controllers/alumni.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Alumni Finder (Structured PostgreSQL directory)
router.get('/finder', authenticateToken, alumniController.getAlumniFinder);

// Alumni Profile view
router.get('/profile/:id', authenticateToken, alumniController.getAlumniProfile);

// Alumni Profile Edit
router.get('/edit-profile', authenticateToken, authorizeRoles('alumni'), alumniController.getEditProfile);
router.post('/edit-profile', authenticateToken, authorizeRoles('alumni'), alumniController.postEditProfile);

// Alumni Career Journey Timeline
router.get('/career', authenticateToken, authorizeRoles('alumni'), alumniController.getCareerTimeline);
router.post('/career/add', authenticateToken, authorizeRoles('alumni'), alumniController.postAddCareerJourney);
router.post('/career/delete/:id', authenticateToken, authorizeRoles('alumni'), alumniController.deleteCareerJourney);

// Alumni Onboarding 55-Question Survey
router.get('/survey', authenticateToken, authorizeRoles('alumni'), alumniController.getSurvey);
router.post('/survey', authenticateToken, authorizeRoles('alumni'), alumniController.postSurvey);

module.exports = router;
