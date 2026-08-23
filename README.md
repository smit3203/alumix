# AI-Powered Alumni Career Intelligence System

A full-stack, production-ready web application built with **Node.js, Express, EJS, PostgreSQL (Neon/Local), Qdrant Vector Database, and Groq LLM API**.

---

## Key Features

- **Home Page**: Interactive dashboard displaying system statistics, featured alumni cards, latest career advice, and navigation.
- **Alumni Finder**: Structured alumni directory powered directly by parameterized PostgreSQL queries with multi-attribute filtering (Name, Graduation Year, Branch, Company, Job Role, Skills, Location).
- **AI Finder**: Natural-language semantic search engine powered by Groq LLM query parsing and Qdrant vector embedding similarity matching.
- **Data Intelligence Dashboard (Insights)**: Visual analytics generated from PostgreSQL data using Chart.js (Career distribution, top skills, top companies, department breakdown).
- **Advice System**: Student & Alumni Q&A forum supporting question creation, alumni answers, and live editing.
- **Alumni Career Survey**: Complete 55-question onboarding survey covering academic background, skills, competitions, placement journey, and reflections.
- **Career Journey Timeline**: Interactive timeline manager for alumni job progression.
- **Mandatory Qdrant Vector Sync**: Automatically re-embeds and updates Qdrant vector points whenever an alumnus updates profile, skills, career timeline, survey answers, or advice.
- **Authentication**: Robust JWT access token (1h) and refresh token (7d) authentication stored in HTTP-only cookies with role-based access control (`student`, `alumni`, `admin`).

---

## Architecture & Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, Modern CSS3 (Glassmorphism & Dark Mode), JavaScript, EJS Server-Side Templates, Chart.js |
| **Backend** | Node.js, Express.js (MVC Architecture) |
| **Database** | PostgreSQL (Local PostgreSQL / Neon Cloud PostgreSQL) via `pg` connection pool |
| **Vector DB** | Qdrant (`@qdrant/js-client-rest`) |
| **LLM** | Groq API (`groq-sdk`, model: `llama-3.3-70b-versatile`) |
| **Embeddings**| `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, 384 dimensions, Cosine distance) |
| **Auth** | JWT (`jsonwebtoken`), Bcrypt password hashing (`bcryptjs`), Cookie-Parser |

---

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (Local installation or [Neon PostgreSQL](https://neon.tech/))
- Qdrant Vector DB (Docker or Cloud instance)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

`.env` Contents:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (PostgreSQL / Neon)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alumni_db
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=alumni_db
PGSSL=false

# Authentication Secrets
JWT_ACCESS_SECRET=super_secret_access_key_change_in_production_12345
JWT_REFRESH_SECRET=super_secret_refresh_key_change_in_production_67890

# AI & LLM Service Configuration
GROQ_API_KEY=gsk_your_groq_api_key_here

# Vector Database (Qdrant) Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Embedding Model Configuration
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
```

---

## Service & Database Setup

### 1. Neon / Local PostgreSQL Setup
- Create a PostgreSQL database named `alumni_db`.
- If using Neon, copy your PostgreSQL connection string into `DATABASE_URL` and set `PGSSL=true`.

### 2. Qdrant Setup
To run Qdrant locally via Docker:
```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 3. Groq API Setup
- Sign up at [Groq Console](https://console.groq.com/).
- Generate an API Key and set it in `GROQ_API_KEY`.

### 4. Running Database Schema & Seed Data
Execute the built-in seeding script which creates tables, populates initial taxonomy, seeds alumni/student accounts, and initializes Qdrant vector embeddings:
```bash
npm run seed
```

---

## How to Start the Server

```bash
# Production Mode
npm start

# Development Mode (With Auto-Reload)
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## AI Finder & Qdrant Vector Architecture

```
Student Natural Language Query
          |
          v
  Groq LLM Parser (llama-3.3-70b-versatile) ---> Returns Extracted Requirements JSON
          |
          v
  Local Embedding Generator (@xenova/transformers - 384 dimensions)
          |
          v
  Qdrant Vector Search (alumni_vectors collection, Cosine distance)
          |
          v
  Top Matching Alumni Vector IDs (Top 5-10)
          |
          v
  PostgreSQL Record Fetch & Score Computation
          |
          v
  Groq Rationale Generator ---> "Why Matched" Explanation Card
```

---

## Qdrant Vector Synchronization Flow

Whenever an alumnus updates their profile, technical skills, career journey entries, 55-question survey responses, or advice text:

1. **PostgreSQL Update**: Writes changes directly to PostgreSQL tables (Source of Truth).
2. **Document Reconstruction**: `qdrant.service.js` constructs a consolidated semantic text representation of the alumnus.
3. **Embedding Generation**: `embedding.service.js` generates a fresh 384-dimensional vector embedding.
4. **Qdrant Point Upsert**: `qdrantClient.upsert` updates the point corresponding to the alumnus ID in Qdrant `alumni_vectors`.

This guarantees zero stale vector entries and immediate real-time search accuracy.

---

## Demo Credentials

- **Student Login**: `student.rahul@college.edu` / `Password123!`
- **Alumni Login**: `alex.security@alumni.org` / `Password123!`
- **Alumni Login (AI/ML)**: `sarah.ai@alumni.org` / `Password123!`
