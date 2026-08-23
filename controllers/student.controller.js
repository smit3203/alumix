const db = require('../config/db');

/**
 * Home Page / Student Dashboard
 */
exports.getHome = async (req, res) => {
  try {
    // 1. Quick Statistics
    const alumniCountRes = await db.query('SELECT COUNT(*) FROM alumni_profiles');
    const answersCountRes = await db.query('SELECT COUNT(*) FROM answers');
    const mentorsCountRes = await db.query('SELECT COUNT(*) FROM alumni_profiles WHERE mentorship_available = true');
    const companiesCountRes = await db.query('SELECT COUNT(DISTINCT company_id) FROM alumni_profiles WHERE company_id IS NOT NULL');

    const stats = {
      totalAlumni: parseInt(alumniCountRes.rows[0].count, 10),
      totalAnswers: parseInt(answersCountRes.rows[0].count, 10),
      activeMentors: parseInt(mentorsCountRes.rows[0].count, 10),
      topCompaniesCount: parseInt(companiesCountRes.rows[0].count, 10),
    };

    // 2. Recommended Alumni (Sample of top active alumni)
    const recommendedAlumniRes = await db.query(
      `SELECT a.id, a.name, a.job_role, a.company_name, a.location, a.graduation_year,
              d.name AS department_name, c.name AS official_company_name
       FROM alumni_profiles a
       LEFT JOIN departments d ON a.department_id = d.id
       LEFT JOIN companies c ON a.company_id = c.id
       ORDER BY a.created_at DESC LIMIT 4`
    );

    // 3. Featured Alumni Advice given on student questions
    const adviceRes = await db.query(
      `SELECT ans.id, ans.content AS answer_content, ans.created_at,
              q.title AS question_title, q.content AS question_content,
              a.name AS alumni_name, a.job_role AS alumni_role, a.company_name AS alumni_company
       FROM answers ans
       JOIN questions q ON ans.question_id = q.id
       JOIN alumni_profiles a ON ans.alumni_id = a.id
       ORDER BY ans.created_at DESC LIMIT 3`
    );

    res.render('student/dashboard', {
      title: 'Home - Alumni Career Intelligence System',
      stats,
      recommendedAlumni: recommendedAlumniRes.rows,
      recentAdvice: adviceRes.rows,
      user: req.user,
    });
  } catch (error) {
    console.error('Error fetching home dashboard:', error.message);
    res.status(500).render('student/dashboard', {
      title: 'Home - Alumni Career Intelligence System',
      stats: { totalAlumni: 0, totalAnswers: 0, activeMentors: 0, topCompaniesCount: 0 },
      recommendedAlumni: [],
      recentAdvice: [],
      user: req.user,
    });
  }
};

/**
 * Get Student Profile & Edit Form
 */
exports.getStudentProfile = async (req, res) => {
  try {
    const studentRes = await db.query(
      `SELECT s.*, d.name AS department_name
       FROM student_profiles s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).send('Student profile not found.');
    }

    const student = studentRes.rows[0];
    const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
    const interestsRes = await db.query('SELECT * FROM interests ORDER BY name ASC');

    const selectedInterestsRes = await db.query(
      'SELECT interest_id FROM student_interests WHERE student_id = $1',
      [student.id]
    );
    const selectedInterestIds = selectedInterestsRes.rows.map((r) => r.interest_id);

    res.render('student/profile', {
      title: 'My Profile - Student',
      student,
      departments: deptsRes.rows,
      interests: interestsRes.rows,
      selectedInterestIds,
      success: req.query.success ? 'Profile updated successfully!' : null,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Update Student Profile
 */
exports.updateStudentProfile = async (req, res) => {
  const { name, enrollment_number, department_id, year, graduation_year, bio, interest_ids } = req.body;

  try {
    const studentRes = await db.query('SELECT id FROM student_profiles WHERE user_id = $1', [req.user.id]);
    if (studentRes.rows.length === 0) {
      return res.status(404).send('Student profile not found');
    }
    const studentId = studentRes.rows[0].id;

    // Update Profile
    await db.query(
      `UPDATE student_profiles
       SET name = $1, enrollment_number = $2, department_id = $3, year = $4, graduation_year = $5, bio = $6, updated_at = NOW()
       WHERE id = $7`,
      [name, enrollment_number, parseInt(department_id, 10), parseInt(year, 10), parseInt(graduation_year, 10), bio, studentId]
    );

    // Update Interests
    await db.query('DELETE FROM student_interests WHERE student_id = $1', [studentId]);
    if (interest_ids) {
      const ids = Array.isArray(interest_ids) ? interest_ids : [interest_ids];
      for (const iId of ids) {
        await db.query('INSERT INTO student_interests (student_id, interest_id) VALUES ($1, $2)', [
          studentId,
          parseInt(iId, 10),
        ]);
      }
    }

    res.redirect('/student/profile?success=1');
  } catch (error) {
    console.error('Error updating student profile:', error);
    res.redirect('/student/profile?error=failed');
  }
};
