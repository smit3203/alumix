const db = require('../config/db');
const qdrantService = require('../services/qdrant.service');

/**
 * Render Advice Q&A Page
 */
exports.getAdviceIndex = async (req, res) => {
  try {
    const questionsRes = await db.query(
      `SELECT q.id, q.title, q.content, q.created_at,
              sp.name AS student_name, sp.year AS student_year, d.name AS department_name
       FROM questions q
       JOIN student_profiles sp ON q.student_id = sp.id
       LEFT JOIN departments d ON sp.department_id = d.id
       ORDER BY q.created_at DESC`
    );

    const questions = questionsRes.rows;

    // Fetch answers for each question
    const answersRes = await db.query(
      `SELECT ans.id, ans.question_id, ans.content, ans.created_at, ans.alumni_id,
              ap.name AS alumni_name, ap.job_role AS alumni_role, ap.company_name AS alumni_company
       FROM answers ans
       JOIN alumni_profiles ap ON ans.alumni_id = ap.id
       ORDER BY ans.created_at ASC`
    );

    const answersMap = {};
    answersRes.rows.forEach((a) => {
      if (!answersMap[a.question_id]) answersMap[a.question_id] = [];
      answersMap[a.question_id].push(a);
    });

    questions.forEach((q) => {
      q.answers = answersMap[q.id] || [];
    });

    res.render('advice/index', {
      title: 'Advice - Student & Alumni Q&A',
      questions,
      user: req.user,
      success: req.query.success ? 'Your action was submitted successfully!' : null,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching advice questions:', error);
    res.status(500).render('advice/index', {
      title: 'Advice - Student & Alumni Q&A',
      questions: [],
      user: req.user,
      error: 'Failed to load Q&A forum.',
    });
  }
};

/**
 * Post Question (Student only)
 */
exports.postQuestion = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).send('Only students can post questions.');
  }

  const { title, content } = req.body;
  if (!title || !content) {
    return res.redirect('/advice?error=missing_fields');
  }

  try {
    const studentRes = await db.query('SELECT id FROM student_profiles WHERE user_id = $1', [req.user.id]);
    if (studentRes.rows.length === 0) return res.status(404).send('Student profile not found.');

    const studentId = studentRes.rows[0].id;
    await db.query('INSERT INTO questions (student_id, title, content) VALUES ($1, $2, $3)', [
      studentId,
      title.trim(),
      content.trim(),
    ]);

    res.redirect('/advice?success=1');
  } catch (error) {
    console.error('Error creating question:', error);
    res.redirect('/advice?error=failed');
  }
};

/**
 * Post Answer (Alumni only, triggers mandatory Qdrant Sync)
 */
exports.postAnswer = async (req, res) => {
  if (req.user.role !== 'alumni') {
    return res.status(403).send('Only alumni can answer questions.');
  }

  const { question_id, content } = req.body;
  if (!question_id || !content || !content.trim()) {
    return res.redirect('/advice?error=missing_content');
  }

  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');

    const alumniId = alumniRes.rows[0].id;
    await db.query('INSERT INTO answers (question_id, alumni_id, content) VALUES ($1, $2, $3)', [
      parseInt(question_id, 10),
      alumniId,
      content.trim(),
    ]);

    // MANDATORY QDRANT SYNCHRONIZATION
    await qdrantService.syncAlumniToQdrant(alumniId);

    res.redirect('/advice?success=1');
  } catch (error) {
    console.error('Error posting answer:', error);
    res.redirect('/advice?error=failed');
  }
};

/**
 * Edit Answer (Alumni only, triggers mandatory Qdrant Sync)
 */
exports.postEditAnswer = async (req, res) => {
  if (req.user.role !== 'alumni') {
    return res.status(403).send('Only alumni can edit answers.');
  }

  const { answer_id, content } = req.body;

  try {
    const alumniRes = await db.query('SELECT id FROM alumni_profiles WHERE user_id = $1', [req.user.id]);
    if (alumniRes.rows.length === 0) return res.status(404).send('Alumni profile not found.');

    const alumniId = alumniRes.rows[0].id;
    await db.query('UPDATE answers SET content = $1, updated_at = NOW() WHERE id = $2 AND alumni_id = $3', [
      content.trim(),
      parseInt(answer_id, 10),
      alumniId,
    ]);

    // MANDATORY QDRANT SYNCHRONIZATION
    await qdrantService.syncAlumniToQdrant(alumniId);

    res.redirect('/advice?success=1');
  } catch (error) {
    console.error('Error editing answer:', error);
    res.redirect('/advice?error=failed');
  }
};
