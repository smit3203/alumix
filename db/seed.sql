-- Seed Data for AI-Powered Alumni Career Intelligence System

-- 1. Departments
INSERT INTO departments (id, name, code) VALUES
(1, 'Computer Engineering', 'CE'),
(2, 'Information Technology', 'IT'),
(3, 'Electronics & Communication Engineering', 'ECE'),
(4, 'Mechanical Engineering', 'ME'),
(5, 'Civil Engineering', 'CE_CIVIL'),
(6, 'Electrical Engineering', 'EE')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for departments
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));

-- 2. Companies
INSERT INTO companies (id, name, industry, location) VALUES
(1, 'Google', 'Technology / Search', 'Mountain View, CA / Bangalore, India'),
(2, 'Microsoft', 'Software & Cloud', 'Redmond, WA / Hyderabad, India'),
(3, 'Amazon', 'E-Commerce & Cloud', 'Seattle, WA / Bangalore, India'),
(4, 'CrowdStrike', 'Cybersecurity', 'Austin, TX / Pune, India'),
(5, 'Palo Alto Networks', 'Cybersecurity', 'Santa Clara, CA / Bangalore, India'),
(6, 'Goldman Sachs', 'Financial Services', 'New York, NY / Bangalore, India'),
(7, 'Uber', 'Transportation & Tech', 'San Francisco, CA / Bangalore, India'),
(8, 'NVIDIA', 'Semiconductors & AI', 'Santa Clara, CA / Pune, India')
ON CONFLICT (id) DO NOTHING;

SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies));

-- 3. Skills
INSERT INTO skills (id, name, category) VALUES
(1, 'Cybersecurity', 'Security'),
(2, 'Network Security', 'Security'),
(3, 'Penetration Testing', 'Security'),
(4, 'Python', 'Programming'),
(5, 'Java', 'Programming'),
(6, 'C++', 'Programming'),
(7, 'JavaScript', 'Programming'),
(8, 'TypeScript', 'Programming'),
(9, 'Data Structures & Algorithms', 'Core CS'),
(10, 'Machine Learning', 'AI/ML'),
(11, 'Deep Learning', 'AI/ML'),
(12, 'React.js', 'Web Development'),
(13, 'Node.js', 'Web Development'),
(14, 'PostgreSQL', 'Databases'),
(15, 'Docker & Kubernetes', 'DevOps & Cloud'),
(16, 'AWS', 'DevOps & Cloud'),
(17, 'System Design', 'Software Engineering'),
(18, 'CI/CD Pipelines', 'DevOps')
ON CONFLICT (id) DO NOTHING;

SELECT setval('skills_id_seq', (SELECT MAX(id) FROM skills));

-- 4. Interests
INSERT INTO interests (id, name) VALUES
(1, 'Cybersecurity & Ethical Hacking'),
(2, 'Artificial Intelligence & Machine Learning'),
(3, 'Full Stack Web Development'),
(4, 'Cloud Computing & Infrastructure'),
(5, 'Competitive Programming & DSA'),
(6, 'Open Source Contribution'),
(7, 'Finance & FinTech'),
(8, 'UI/UX Design')
ON CONFLICT (id) DO NOTHING;

SELECT setval('interests_id_seq', (SELECT MAX(id) FROM interests));
