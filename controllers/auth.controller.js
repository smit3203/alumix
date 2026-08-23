const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');

/**
 * Render Login Page
 */
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login - Alumni Career System',
    error: req.query.error || null,
    message: req.query.message || null,
  });
};

/**
 * Render Register Page
 */
exports.getRegister = async (req, res) => {
  try {
    const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
    const interestsRes = await db.query('SELECT * FROM interests ORDER BY name ASC');
    res.render('auth/register', {
      title: 'Register - Alumni Career System',
      departments: deptsRes.rows,
      interests: interestsRes.rows,
      error: null,
    });
  } catch (error) {
    console.error('Error rendering register:', error.message);
    res.render('auth/register', {
      title: 'Register - Alumni Career System',
      departments: [],
      interests: [],
      error: 'Failed to load configuration lists.',
    });
  }
};

/**
 * Handle Login Submission (Students, Alumni, Admin)
 */
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('auth/login', {
      title: 'Login - Alumni Career System',
      error: 'Please provide both email and password.',
      message: null,
    });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      return res.render('auth/login', {
        title: 'Login - Alumni Career System',
        error: 'Invalid credentials.',
        message: null,
      });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login - Alumni Career System',
        error: 'Invalid credentials.',
        message: null,
      });
    }

    // Fetch Profile Details
    let profileId = null;
    let name = user.email.split('@')[0];
    let surveyCompleted = true;

    if (user.role === 'student') {
      const spRes = await db.query('SELECT id, name FROM student_profiles WHERE user_id = $1', [user.id]);
      if (spRes.rows.length > 0) {
        profileId = spRes.rows[0].id;
        name = spRes.rows[0].name;
      }
    } else if (user.role === 'alumni') {
      const apRes = await db.query('SELECT id, name, survey_completed FROM alumni_profiles WHERE user_id = $1', [user.id]);
      if (apRes.rows.length > 0) {
        profileId = apRes.rows[0].id;
        name = apRes.rows[0].name;
        surveyCompleted = apRes.rows[0].survey_completed;
      }
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      profile_id: profileId,
      name: name,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token to PostgreSQL
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.cookie('access_token', accessToken, { httpOnly: true, maxAge: 3600000 });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 3600000 });

    if (user.role === 'alumni' && !surveyCompleted) {
      return res.redirect('/alumni/survey');
    }

    res.redirect('/');
  } catch (error) {
    console.error('Error during login:', error);
    res.render('auth/login', {
      title: 'Login - Alumni Career System',
      error: 'An internal server error occurred. Please try again.',
      message: null,
    });
  }
};

/**
 * Handle Student Registration
 */
exports.postRegisterStudent = async (req, res) => {
  const { name, email, password, enrollment_number, department_id, year, graduation_year, bio } = req.body;

  try {
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
      return res.render('auth/register', {
        title: 'Register - Alumni Career System',
        departments: deptsRes.rows,
        error: 'Email is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [email.trim().toLowerCase(), passwordHash, 'student']
    );
    const userId = newUser.rows[0].id;

    // Create Student Profile
    const newStudent = await db.query(
      `INSERT INTO student_profiles (user_id, name, enrollment_number, department_id, year, graduation_year, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, name, enrollment_number, parseInt(department_id, 10), parseInt(year, 10), parseInt(graduation_year, 10), bio || '']
    );

    const payload = {
      id: userId,
      email: email.trim().toLowerCase(),
      role: 'student',
      profile_id: newStudent.rows[0].id,
      name: name,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, expiresAt]
    );

    res.cookie('access_token', accessToken, { httpOnly: true, maxAge: 3600000 });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 3600000 });

    res.redirect('/');
  } catch (error) {
    console.error('Error registering student:', error);
    const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
    res.render('auth/register', {
      title: 'Register - Alumni Career System',
      departments: deptsRes.rows,
      error: 'Registration failed: ' + error.message,
    });
  }
};

/**
 * Handle Alumni Registration
 */
exports.postRegisterAlumni = async (req, res) => {
  const {
    name,
    email,
    password,
    department_id,
    graduation_year,
    company_name,
    job_role,
    location,
    bio,
    linkedin_url,
    github_url,
  } = req.body;

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
      return res.render('auth/register', {
        title: 'Register - Alumni Career System',
        departments: deptsRes.rows,
        error: 'Email is already registered.',
      });
    }

    // Lookup or match company in database
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

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [email.trim().toLowerCase(), passwordHash, 'alumni']
    );
    const userId = newUser.rows[0].id;

    // Create Alumni Profile
    const newAlumni = await db.query(
      `INSERT INTO alumni_profiles 
       (user_id, name, department_id, graduation_year, company_id, company_name, job_role, location, bio, linkedin_url, github_url, survey_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) RETURNING id`,
      [
        userId,
        name,
        parseInt(department_id, 10),
        parseInt(graduation_year, 10),
        companyId,
        company_name || '',
        job_role,
        location || '',
        bio || '',
        linkedin_url || '',
        github_url || '',
      ]
    );

    const payload = {
      id: userId,
      email: email.trim().toLowerCase(),
      role: 'alumni',
      profile_id: newAlumni.rows[0].id,
      name: name,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, expiresAt]
    );

    res.cookie('access_token', accessToken, { httpOnly: true, maxAge: 3600000 });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 3600000 });

    // MANDATORY REQUIREMENT: Redirect alumni to survey after registration & first login!
    res.redirect('/alumni/survey');
  } catch (error) {
    console.error('Error registering alumni:', error);
    const deptsRes = await db.query('SELECT * FROM departments ORDER BY name ASC');
    res.render('auth/register', {
      title: 'Register - Alumni Career System',
      departments: deptsRes.rows,
      error: 'Alumni registration failed: ' + error.message,
    });
  }
};

/**
 * Handle Logout (Invalidate refresh token and clear cookies)
 */
exports.postLogout = async (req, res) => {
  const refreshToken = req.cookies ? req.cookies.refresh_token : null;
  if (refreshToken) {
    try {
      await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    } catch (err) {
      console.error('Error deleting refresh token during logout:', err.message);
    }
  }

  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.redirect('/auth/login?message=logged_out');
};
