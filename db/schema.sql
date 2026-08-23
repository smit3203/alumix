-- PostgreSQL Schema for AI-Powered Alumni Career Intelligence System

-- Drop tables if exists for clean environment reset (in reverse dependency order)
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS alumni_survey_responses CASCADE;
DROP TABLE IF EXISTS career_journeys CASCADE;
DROP TABLE IF EXISTS alumni_interests CASCADE;
DROP TABLE IF EXISTS alumni_skills CASCADE;
DROP TABLE IF EXISTS alumni_profiles CASCADE;
DROP TABLE IF EXISTS student_interests CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS interests CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'alumni', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Refresh Tokens Table
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Departments Table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE
);

-- 4. Companies Table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    industry VARCHAR(100),
    location VARCHAR(255)
);

-- 5. Interests Table
CREATE TABLE interests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 6. Skills Table
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'Technical'
);

-- 7. Student Profiles Table
CREATE TABLE student_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    enrollment_number VARCHAR(100) UNIQUE NOT NULL,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    year INT NOT NULL, -- e.g. 1, 2, 3, 4
    graduation_year INT NOT NULL,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Student Interests Junction Table
CREATE TABLE student_interests (
    student_id INT REFERENCES student_profiles(id) ON DELETE CASCADE,
    interest_id INT REFERENCES interests(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, interest_id)
);

-- 9. Alumni Profiles Table
CREATE TABLE alumni_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    graduation_year INT NOT NULL,
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255), -- Fallback or custom display name
    job_role VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    bio TEXT,
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    experience_years INT DEFAULT 0,
    mentorship_available BOOLEAN DEFAULT FALSE,
    referral_available BOOLEAN DEFAULT FALSE,
    advice_text TEXT,
    survey_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Alumni Skills Junction Table
CREATE TABLE alumni_skills (
    alumni_id INT REFERENCES alumni_profiles(id) ON DELETE CASCADE,
    skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (alumni_id, skill_id)
);

-- 11. Alumni Interests Junction Table
CREATE TABLE alumni_interests (
    alumni_id INT REFERENCES alumni_profiles(id) ON DELETE CASCADE,
    interest_id INT REFERENCES interests(id) ON DELETE CASCADE,
    PRIMARY KEY (alumni_id, interest_id)
);

-- 12. Career Journeys Table
CREATE TABLE career_journeys (
    id SERIAL PRIMARY KEY,
    alumni_id INT REFERENCES alumni_profiles(id) ON DELETE CASCADE,
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    start_year INT NOT NULL,
    end_year INT, -- NULL means present
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Alumni Survey Responses Table (55-Question Flexible Storage)
CREATE TABLE alumni_survey_responses (
    id SERIAL PRIMARY KEY,
    alumni_id INT REFERENCES alumni_profiles(id) ON DELETE CASCADE,
    question_no INT NOT NULL,
    answer_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_alumni_question UNIQUE (alumni_id, question_no)
);

-- 14. Questions (Advice System - Student Questions)
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES student_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Answers (Advice System - Alumni Answers)
CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    alumni_id INT REFERENCES alumni_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for Performant PostgreSQL Filtering
CREATE INDEX idx_alumni_dept ON alumni_profiles(department_id);
CREATE INDEX idx_alumni_grad_year ON alumni_profiles(graduation_year);
CREATE INDEX idx_alumni_company ON alumni_profiles(company_id);
CREATE INDEX idx_alumni_job_role ON alumni_profiles(job_role);
CREATE INDEX idx_alumni_location ON alumni_profiles(location);
CREATE INDEX idx_survey_alumni_question ON alumni_survey_responses(alumni_id, question_no);
