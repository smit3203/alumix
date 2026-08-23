const db = require('../config/db');
const qdrantService = require('../services/qdrant.service');

/**
 * Structured Alumni Finder (Handled directly via PostgreSQL)
 */
exports.getAlumniFinder = async (req, res) => {
  const { name, graduation_year, department_id, company_name, job_role, skill_id, location } = req.query;

  try {
    let queryText = `
      SELECT DISTINCT a.id, a.name, a.graduation_year, a.job_role, a.location, a.company_name,
             a.mentorship_available, a.referral_available, a.bio,
             d.name AS department_name, c.name AS official_company_name,
             STRING_AGG(DISTINCT s.name, ', ') AS skills_list
      FROM alumni_profiles a
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN companies c ON a.company_id = c.id
      LEFT JOIN alumni_skills aks ON a.id = aks.alumni_id
      LEFT JOIN skills s ON aks.skill_id = s.id
      WHERE 1=1
    `;
    const queryParams = [];

    if (name && name.trim()) {
      queryParams.push(`%${name.trim()}%`);
      queryText += ` AND a.name ILIKE $${queryParams.length}`;
    }

    if (graduation_year) {
      queryParams.push(parseInt(graduation_year, 10));
      queryText += ` AND a.graduation_year = $${queryParams.length}`;
    }

    if (department_id) {
      queryParams.push(parseInt(department_id, 10));
      queryText += ` AND a.department_id = $${queryParams.length}`;
    }

    if (company_name && company_name.trim()) {
      queryParams.push(`%${company_name.trim()}%`);
      queryText += ` AND (a.company_name ILIKE $${queryParams.length} OR c.name ILIKE $${queryParams.length})`;
    }

    if (job_role && job_role.trim()) {
      queryParams.push(`%${job_role.trim()}%`);
      queryText += ` AND a.job_role ILIKE $${queryParams.length}`;
    }

    if (location && location.trim()) {
      queryParams.push(`%${location.trim()}%`);
      queryText += ` AND a.location ILIKE $${queryParams.length}`;
    }

    if (skill_id) {
      queryParams.push(parseInt(skill_id, 10));
      queryText += ` AND aks.skill_id = $${queryParams.length}`;
    }

    queryText += `
      GROUP BY a.id, d.name, c.name
      ORDER BY a.name ASC
    `;

    const alumniRes = await db.query(queryText, queryParams);
    const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
    const skillsRes = await db.query('SELECT * FROM skills ORDER BY name ASC');

    res.render('alumni/dashboard', {
      title: 'Alumni Finder - Browse & Search Alumni',
      alumniList: alumniRes.rows,
      departments: deptsRes.rows,
      skills: skillsRes.rows,
      filters: req.query,
    });
  } catch (error) {
    console.error('Error in Alumni Finder:', error);
    res.status(500).render('alumni/dashboard', {
      title: 'Alumni Finder',
      alumniList: [],
      departments: [],
      skills: [],
      filters: req.query,
      error: 'Failed to retrieve alumni directory.',
    });
  }
};

/**
 * Detailed Alumni Profile Page
 */
exports.getAlumniProfile = async (req, res) => {
  const alumniId = parseInt(req.params.id, 10);

  try {
    const profileRes = await db.query(
      `SELECT a.*, d.name AS department_name, c.name AS official_company_name
       FROM alumni_profiles a
       LEFT JOIN departments d ON a.department_id = d.id
       LEFT JOIN companies c ON a.company_id = c.id
       WHERE a.id = $1`,
      [alumniId]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).render('student/dashboard', {
        title: 'Not Found',
        error: 'Alumni profile not found.',
      });
    }

    const alumni = profileRes.rows[0];

    // Skills
    const skillsRes = await db.query(
      `SELECT s.id, s.name, s.category FROM skills s
       JOIN alumni_skills aks ON aks.skill_id = s.id
       WHERE aks.alumni_id = $1 ORDER BY s.name ASC`,
      [alumniId]
    );

    // Career Journey Timeline
    const journeyRes = await db.query(
      `SELECT * FROM career_journeys
       WHERE alumni_id = $1 ORDER BY start_year DESC, id DESC`,
      [alumniId]
    );

    // Advice Answers
    const answersRes = await db.query(
      `SELECT ans.id, ans.content, ans.created_at, q.title AS question_title
       FROM answers ans
       JOIN questions q ON ans.question_id = q.id
       WHERE ans.alumni_id = $1 ORDER BY ans.created_at DESC`,
      [alumniId]
    );

    // Survey Responses
    const surveyRes = await db.query(
      `SELECT question_no, answer_json FROM alumni_survey_responses
       WHERE alumni_id = $1 ORDER BY question_no ASC`,
      [alumniId]
    );

    const isSelf = req.user && req.user.role === 'alumni' && req.user.profile_id === alumniId;

    res.render('alumni/profile', {
      title: `${alumni.name} - Alumni Profile`,
      alumni,
      skills: skillsRes.rows,
      careerJourneys: journeyRes.rows,
      answers: answersRes.rows,
      surveyResponses: surveyRes.rows,
      isSelf,
    });
  } catch (error) {
    console.error('Error fetching alumni profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Edit Alumni Profile View
 */
exports.getEditProfile = async (req, res) => {
  if (req.user.role !== 'alumni') {
    return res.status(403).send('Only alumni can edit their alumni profile.');
  }

  try {
    const alumniRes = await db.query('SELECT * FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Profile not found.');

    const alumni = alumniRes.rows[0];
    const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
    const skillsRes = await db.query('SELECT * FROM skills ORDER BY name ASC');

    const selectedSkillsRes = await db.query('SELECT skill_id FROM alumni_skills WHERE alumni_id = $1', [alumni.id]);
    const selectedSkillIds = selectedSkillsRes.rows.map((r) => r.skill_id);

    res.render('alumni/edit-profile', {
      title: 'Edit Profile - Alumni',
      alumni,
      departments: deptsRes.rows,
      skills: skillsRes.rows,
      selectedSkillIds,
      success: req.query.success ? 'Profile updated successfully & synced with AI Vector Index!' : null,
      error: null,
    });
  } catch (error) {
    console.error('Error loading edit profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Post Edit Alumni Profile (Triggers mandatory Qdrant Sync)
 */
exports.postEditProfile = async (req, res) => {
  const {
    name,
    department_id,
    graduation_year,
    company_name,
    job_role,
    location,
    experience_years,
    bio,
    linkedin_url,
    github_url,
    mentorship_available,
    referral_available,
    advice_text,
    skill_ids,
  } = req.body;

  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');
    const alumniId = alumniRes.rows[0].id;

    // Match or insert company
    let companyId = null;
    if (company_name && company_name.trim()) {
      const compRes = await db.query('SELECT id FROM companies WHERE LOWER(name) = LOWER($1)', [company_name.trim()]);
      if (compRes.rows.length > 0) {
        companyId = compRes.rows[0].id;
      } else {
        const newComp = await db.query('INSERT INTO companies (name, location) VALUES ($1, $2) RETURNING id', [
          company_name.trim(),
          location || 'Not specified',
        ]);
        companyId = newComp.rows[0].id;
      }
    }

    // 1. Update PostgreSQL Profile
    await db.query(
      `UPDATE alumni_profiles
       SET name = $1, department_id = $2, graduation_year = $3, company_id = $4, company_name = $5,
           job_role = $6, location = $7, experience_years = $8, bio = $9, linkedin_url = $10,
           github_url = $11, mentorship_available = $12, referral_available = $13, advice_text = $14,
           updated_at = NOW()
       WHERE id = $15`,
      [
        name,
        parseInt(department_id, 10),
        parseInt(graduation_year, 10),
        companyId,
        company_name || '',
        job_role,
        location || '',
        parseInt(experience_years || '0', 10),
        bio || '',
        linkedin_url || '',
        github_url || '',
        mentorship_available === 'on' || mentorship_available === 'true',
        referral_available === 'on' || referral_available === 'true',
        advice_text || '',
        alumniId,
      ]
    );

    // 2. Update Skills
    await db.query('DELETE FROM alumni_skills WHERE alumni_id = $1', [alumniId]);
    if (skill_ids) {
      const ids = Array.isArray(skill_ids) ? skill_ids : [skill_ids];
      for (const sId of ids) {
        await db.query('INSERT INTO alumni_skills (alumni_id, skill_id) VALUES ($1, $2)', [alumniId, parseInt(sId, 10)]);
      }
    }

    // 3. MANDATORY QDRANT SYNCHRONIZATION
    await qdrantService.syncAlumniToQdrant(alumniId);

    res.redirect('/alumni/edit-profile?success=1');
  } catch (error) {
    console.error('Error updating alumni profile:', error);
    res.redirect('/alumni/edit-profile?error=failed');
  }
};

/**
 * Render Career Journey Timeline View
 */
exports.getCareerTimeline = async (req, res) => {
  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Profile not found.');

    const alumniId = alumniRes.rows[0].id;
    const journeysRes = await db.query(
      'SELECT * FROM career_journeys WHERE alumni_id = $1 ORDER BY start_year DESC',
      [alumniId]
    );

    res.render('alumni/career', {
      title: 'Career Journey Timeline - Alumni',
      careerJourneys: journeysRes.rows,
      success: req.query.success ? 'Career journey updated and synced with AI Search!' : null,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching career timeline:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Add Career Journey Entry (Triggers mandatory Qdrant Sync)
 */
exports.postAddCareerJourney = async (req, res) => {
  const { job_title, company_name, start_year, end_year, is_current, description } = req.body;

  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');
    const alumniId = alumniRes.rows[0].id;

    await db.query(
      `INSERT INTO career_journeys (alumni_id, job_title, company_name, start_year, end_year, is_current, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        alumniId,
        job_title,
        company_name,
        parseInt(start_year, 10),
        end_year ? parseInt(end_year, 10) : null,
        is_current === 'on' || is_current === 'true',
        description || '',
      ]
    );

    // MANDATORY QDRANT SYNCHRONIZATION
    await qdrantService.syncAlumniToQdrant(alumniId);

    res.redirect('/alumni/career?success=1');
  } catch (error) {
    console.error('Error adding career entry:', error);
    res.redirect('/alumni/career?error=failed');
  }
};

/**
 * Delete Career Journey Entry (Triggers mandatory Qdrant Sync)
 */
exports.deleteCareerJourney = async (req, res) => {
  const entryId = parseInt(req.params.id, 10);

  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');
    const alumniId = alumniRes.rows[0].id;

    await db.query('DELETE FROM career_journeys WHERE id = $1 AND alumni_id = $2', [entryId, alumniId]);

    // MANDATORY QDRANT SYNCHRONIZATION
    await qdrantService.syncAlumniToQdrant(alumniId);

    res.redirect('/alumni/career?success=1');
  } catch (error) {
    console.error('Error deleting career entry:', error);
    res.redirect('/alumni/career?error=failed');
  }
};

/**
 * Render Alumni 55-Question Survey Page
 */
exports.getSurvey = async (req, res) => {
  try {
    const alumniRes = await db.query('SELECT * FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');

    const alumni = alumniRes.rows[0];
    const surveyRes = await db.query(
      'SELECT question_no, answer_json FROM alumni_survey_responses WHERE alumni_id = $1',
      [alumni.id]
    );

    const existingAnswers = {};
    surveyRes.rows.forEach((r) => {
      existingAnswers[r.question_no] = r.answer_json;
    });

    res.render('alumni/survey', {
      title: 'Alumni Career & Experience Survey',
      alumni,
      existingAnswers,
      error: null,
    });
  } catch (error) {
    console.error('Error loading survey:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Submit Alumni Survey (Triggers mandatory Qdrant Sync)
 */
exports.postSurvey = async (req, res) => {
  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');
    const alumniId = alumniRes.rows[0].id;

    const answersBody = req.body; // Keyed by q1, q2, ... q55

    for (let qNo = 1; qNo <= 55; qNo++) {
      const val = answersBody[`q${qNo}`];
      if (val !== undefined && val !== null) {
        // Save or update in PostgreSQL using JSONB
        await db.query(
          `INSERT INTO alumni_survey_responses (alumni_id, question_no, answer_json)
           VALUES ($1, $2, $3)
           ON CONFLICT (alumni_id, question_no)
           DO UPDATE SET answer_json = $3, updated_at = NOW()`,
          [alumniId, qNo, JSON.stringify(val)]
        );
      }
    }

    // Mark survey as completed
    await db.query('UPDATE alumni_profiles SET survey_completed = true WHERE id = $1', [alumniId]);

    // MANDATORY QDRANT SYNCHRONIZATION
    await qdrantService.syncAlumniToQdrant(alumniId);

    res.redirect(`/alumni/profile/${alumniId}`);
  } catch (error) {
    console.error('Error submitting survey:', error);
    res.status(500).send('Error saving survey responses.');
  }
};
