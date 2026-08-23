const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const qdrantService = require('../services/qdrant.service');

async function seedDatabase() {
  console.log('Starting Database Seeding Process...');

  try {
    // 0. Test DB connection & auto-create database if needed
    try {
      await db.query('SELECT 1');
    } catch (connErr) {
      if (connErr.code === '3D000') { // database "alumni_db" does not exist
        console.log('Database "alumni_db" does not exist. Creating it now...');
        const { Client } = require('pg');
        const rootClient = new Client({
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || 'postgres',
          host: process.env.PGHOST || 'localhost',
          port: parseInt(process.env.PGPORT || '5432', 10),
          database: 'postgres',
        });
        await rootClient.connect();
        await rootClient.query('CREATE DATABASE alumni_db;');
        await rootClient.end();
        console.log('Database "alumni_db" created successfully.');
      } else {
        throw connErr;
      }
    }

    // 1. Read and run schema.sql
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.query(schemaSql);
    console.log('Database schema created successfully.');

    // 2. Read and run seed.sql
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
    await db.query(seedSql);
    console.log('Seed taxonomy (departments, companies, skills, interests) inserted.');

    const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

    // 3. Insert Users & Alumni Profiles
    const alumniData = [
      {
        email: 'alex.security@alumni.org',
        name: 'Alex Rivera',
        dept_id: 1, // CE
        grad_year: 2020,
        company_id: 4, // CrowdStrike
        company_name: 'CrowdStrike',
        job_role: 'Senior Cybersecurity Engineer',
        location: 'Austin, TX / Remote',
        bio: 'Specializing in cloud security, threat detection, penetration testing, and zero-trust architecture. Active mentor for cybersecurity aspirants.',
        linkedin: 'https://linkedin.com/in/alexrivera-sec',
        github: 'https://github.com/alexrivera-sec',
        exp: 5,
        mentorship: true,
        referral: true,
        advice: 'Start building hands-on security labs, practice CTFs, and understand networking fundamentals early in your 2nd year.',
        skills: [1, 2, 3, 4, 15, 16], // Cybersecurity, Network Sec, PenTest, Python, Docker, AWS
        career: [
          { title: 'Senior Cybersecurity Engineer', company: 'CrowdStrike', start: 2022, end: null, current: true, desc: 'Lead threat response and cloud infrastructure security analysis.' },
          { title: 'Security Analyst', company: 'Palo Alto Networks', start: 2020, end: 2022, current: false, desc: 'Performed vulnerability assessments and penetration testing.' }
        ]
      },
      {
        email: 'sarah.ai@alumni.org',
        name: 'Sarah Chen',
        dept_id: 1, // CE
        grad_year: 2021,
        company_id: 1, // Google
        company_name: 'Google',
        job_role: 'AI / Machine Learning Engineer',
        location: 'Mountain View, CA / Bangalore',
        bio: 'Working on LLM optimization, deep learning, and vector retrieval pipelines at Google AI.',
        linkedin: 'https://linkedin.com/in/sarahchen-ai',
        github: 'https://github.com/sarahchen-ai',
        exp: 4,
        mentorship: true,
        referral: true,
        advice: 'Master Linear Algebra, Data Structures, and PyTorch. Building end-to-end AI applications sets you apart.',
        skills: [4, 6, 9, 10, 11, 14], // Python, C++, DSA, ML, Deep Learning, Postgres
        career: [
          { title: 'Machine Learning Engineer', company: 'Google', start: 2021, end: null, current: true, desc: 'Developing LLM infrastructure and neural search algorithms.' }
        ]
      },
      {
        email: 'marcus.web@alumni.org',
        name: 'Marcus Vance',
        dept_id: 2, // IT
        grad_year: 2022,
        company_id: 2, // Microsoft
        company_name: 'Microsoft',
        job_role: 'Full Stack Software Engineer',
        location: 'Redmond, WA / Hyderabad',
        bio: 'Frontend and backend architect for Azure cloud console using React, Node.js, and TypeScript.',
        linkedin: 'https://linkedin.com/in/marcusvance',
        github: 'https://github.com/marcusvance',
        exp: 3,
        mentorship: true,
        referral: false,
        advice: 'Focus on writing clean, modular JavaScript/TypeScript and master SQL database design.',
        skills: [7, 8, 12, 13, 14, 18], // JS, TS, React, Node, Postgres, CI/CD
        career: [
          { title: 'Software Engineer II', company: 'Microsoft', start: 2023, end: null, current: true, desc: 'Building high-throughput cloud management microservices.' },
          { title: 'Associate Engineer', company: 'Amazon', start: 2022, end: 2023, current: false, desc: 'Backend development for AWS serverless APIs.' }
        ]
      },
      {
        email: 'priya.fintech@alumni.org',
        name: 'Priya Sharma',
        dept_id: 3, // ECE
        grad_year: 2019,
        company_id: 6, // Goldman Sachs
        company_name: 'Goldman Sachs',
        job_role: 'Quant Developer / Vice President',
        location: 'New York, NY / Bangalore',
        bio: 'Designing high-frequency trading platforms and financial risk analysis models.',
        linkedin: 'https://linkedin.com/in/priyasharma-fin',
        github: 'https://github.com/priyasharma-fin',
        exp: 6,
        mentorship: true,
        referral: true,
        advice: 'Strong math skills, low-latency C++ programming, and system design are keys to FinTech.',
        skills: [5, 6, 9, 17], // Java, C++, DSA, System Design
        career: [
          { title: 'Vice President - Quantitative Tech', company: 'Goldman Sachs', start: 2023, end: null, current: true, desc: 'Lead algorithmic trading platform engineering team.' },
          { title: 'Quantitative Analyst', company: 'Goldman Sachs', start: 2019, end: 2023, current: false, desc: 'Built real-time market risk engine.' }
        ]
      }
    ];

    for (const a of alumniData) {
      // Create user
      const uRes = await db.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        [a.email, defaultPasswordHash, 'alumni']
      );
      const userId = uRes.rows[0].id;

      // Create Alumni Profile
      const apRes = await db.query(
        `INSERT INTO alumni_profiles
         (user_id, name, department_id, graduation_year, company_id, company_name, job_role, location, bio, linkedin_url, github_url, experience_years, mentorship_available, referral_available, advice_text, survey_completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
         RETURNING id`,
        [
          userId,
          a.name,
          a.dept_id,
          a.grad_year,
          a.company_id,
          a.company_name,
          a.job_role,
          a.location,
          a.bio,
          a.linkedin,
          a.github,
          a.exp,
          a.mentorship,
          a.referral,
          a.advice,
        ]
      );
      const alumniId = apRes.rows[0].id;

      // Insert Skills
      for (const sId of a.skills) {
        await db.query('INSERT INTO alumni_skills (alumni_id, skill_id) VALUES ($1, $2)', [alumniId, sId]);
      }

      // Insert Career Journeys
      for (const c of a.career) {
        await db.query(
          `INSERT INTO career_journeys (alumni_id, job_title, company_name, start_year, end_year, is_current, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [alumniId, c.title, c.company, c.start, c.end, c.current, c.desc]
        );
      }

      // Insert 55 Survey Answers for each Alumni
      for (let qNo = 1; qNo <= 55; qNo++) {
        let answer = `Sample answer for question ${qNo}`;
        if (qNo === 1) answer = 'Computer Engineering';
        if (qNo === 2) answer = a.grad_year;
        if (qNo === 3) answer = '8–9';
        if (qNo === 5) answer = a.job_role.includes('Security') ? 'Cybersecurity' : 'Artificial Intelligence/Machine Learning';
        if (qNo === 7) answer = ['Python', 'C++', 'JavaScript'];
        if (qNo === 12) answer = 6;
        if (qNo === 19) answer = 'Yes';
        if (qNo === 27) answer = a.job_role;
        if (qNo === 28) answer = 'Campus Placement';
        if (qNo === 35) answer = 'Problem solving and system design';
        if (qNo === 48) answer = 'Learning how to self-teach complex engineering topics quickly.';
        if (qNo === 55) answer = a.advice;

        await db.query(
          `INSERT INTO alumni_survey_responses (alumni_id, question_no, answer_json)
           VALUES ($1, $2, $3)`,
          [alumniId, qNo, JSON.stringify(answer)]
        );
      }

      // MANDATORY VECTOR SYNC FOR SEEDED ALUMNI!
      console.log(`Syncing Qdrant Vector for Alumni: ${a.name}...`);
      await qdrantService.syncAlumniToQdrant(alumniId);
    }

    // 4. Insert Student Users & Profiles
    const studentsData = [
      {
        email: 'student.rahul@college.edu',
        name: 'Rahul Verma',
        enrollment: 'ENR2024001',
        dept_id: 1,
        year: 2,
        grad_year: 2027,
        bio: '2nd year Computer Engineering student passionate about cybersecurity, network security, and ethical hacking.'
      },
      {
        email: 'student.ananya@college.edu',
        name: 'Ananya Roy',
        enrollment: 'ENR2024002',
        dept_id: 2,
        year: 3,
        grad_year: 2026,
        bio: '3rd year IT student interested in full-stack web development and Cloud computing.'
      }
    ];

    const studentIds = [];
    for (const s of studentsData) {
      const uRes = await db.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        [s.email, defaultPasswordHash, 'student']
      );
      const userId = uRes.rows[0].id;

      const spRes = await db.query(
        `INSERT INTO student_profiles (user_id, name, enrollment_number, department_id, year, graduation_year, bio)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [userId, s.name, s.enrollment, s.dept_id, s.year, s.grad_year, s.bio]
      );
      studentIds.push(spRes.rows[0].id);
    }

    // 5. Insert Sample Advice Forum Questions & Answers
    const q1Res = await db.query(
      `INSERT INTO questions (student_id, title, content)
       VALUES ($1, $2, $3) RETURNING id`,
      [
        studentIds[0],
        'How should a 2nd year student prepare for cybersecurity internships at top security firms?',
        'I am currently in my 2nd year of Computer Engineering. I want to build a career in cybersecurity. What projects, certifications, and skills should I focus on?'
      ]
    );
    const q1Id = q1Res.rows[0].id;

    // Alumni Alex answers question
    await db.query(
      `INSERT INTO answers (question_id, alumni_id, content)
       VALUES ($1, $2, $3)`,
      [
        q1Id,
        1, // Alex Rivera (Cybersecurity)
        'Focus on networking fundamentals (TCP/IP, OSI model), learn Python scripting for automation, and practice CTFs on TryHackMe or HackTheBox. Build labs documenting active directory exploitation or cloud vulnerability assessments!'
      ]
    );

    console.log('=======================================================');
    console.log('Seeding completed successfully!');
    console.log('Demo Credentials:');
    console.log('  Student: student.rahul@college.edu / Password123!');
    console.log('  Alumni:  alex.security@alumni.org / Password123!');
    console.log('=======================================================');
  } catch (error) {
    console.error('Error during database seeding:', error);
  } finally {
    process.exit();
  }
}

seedDatabase();
