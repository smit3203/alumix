const db = require('../config/db');

/**
 * Data Intelligence Dashboard / Insights Page
 */
exports.getInsights = async (req, res) => {
  try {
    // 1. Career Distribution by Job Role
    const careerDistRes = await db.query(
      `SELECT job_role, COUNT(*) AS count
       FROM alumni_profiles
       GROUP BY job_role
       ORDER BY count DESC
       LIMIT 8`
    );

    // 2. Most Common Skills
    const skillsDistRes = await db.query(
      `SELECT s.name, COUNT(aks.alumni_id) AS count
       FROM skills s
       JOIN alumni_skills aks ON aks.skill_id = s.id
       GROUP BY s.name
       ORDER BY count DESC
       LIMIT 10`
    );

    // 3. Top Employing Companies
    const companiesDistRes = await db.query(
      `SELECT COALESCE(c.name, a.company_name) AS company, COUNT(*) AS count
       FROM alumni_profiles a
       LEFT JOIN companies c ON a.company_id = c.id
       WHERE COALESCE(c.name, a.company_name) IS NOT NULL AND COALESCE(c.name, a.company_name) != ''
       GROUP BY company
       ORDER BY count DESC
       LIMIT 8`
    );

    // 4. Department Distribution
    const deptDistRes = await db.query(
      `SELECT d.name AS department, COUNT(a.id) AS count
       FROM departments d
       LEFT JOIN alumni_profiles a ON a.department_id = d.id
       GROUP BY d.name
       ORDER BY count DESC`
    );

    res.render('analytics/dashboard', {
      title: 'Insights - Data Intelligence Dashboard',
      careerDistribution: careerDistRes.rows,
      skillsDistribution: skillsDistRes.rows,
      companiesDistribution: companiesDistRes.rows,
      departmentDistribution: deptDistRes.rows,
    });
  } catch (error) {
    console.error('Error loading analytics dashboard:', error);
    res.status(500).render('analytics/dashboard', {
      title: 'Insights - Data Intelligence Dashboard',
      careerDistribution: [],
      skillsDistribution: [],
      companiesDistribution: [],
      departmentDistribution: [],
      error: 'Failed to generate analytics metrics.',
    });
  }
};
