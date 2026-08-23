# Production Deployment Guide: AI-Powered Alumni Career Intelligence System

This document provides complete, step-by-step instructions for deploying the **AI-Powered Alumni Career Intelligence System** to production using **Docker, Docker Compose, AWS EC2, or any Ubuntu VPS**.

---

## Architecture Overview

```
                        +----------------------------+
                        | Internet / Client Browsers |
                        +----------------------------+
                                      |
                                  HTTPS:443
                                      v
                        +----------------------------+
                        |  Nginx Reverse Proxy & SSL |
                        +----------------------------+
                                      |
                                   HTTP:3000
                                      v
+-----------------------------------------------------------------------------+
|                            Docker Compose Stack                             |
|                                                                             |
|  +---------------------+   +---------------------+   +-------------------+  |
|  |     alumix_app      |   |   alumix_postgres   |   |   alumix_qdrant   |  |
|  |   Node.js/Express   |-->|    PostgreSQL 16    |   |     Qdrant DB     |  |
|  |     (Port 3000)     |   |     (Port 5432)     |   |    (Port 6333)    |  |
|  +---------------------+   +---------------------+   +-------------------+  |
|             |                         |                         |           |
+-------------|-------------------------|-------------------------|-----------+
              v                         v                         v
       [Container App]            [pgdata volume]        [qdrant_storage vol]
```

---

## Option 1: Deploy with Docker & Docker Compose (Recommended)

### 1. Provision Server (AWS EC2 / DigitalOcean / VPS)
- **OS**: Ubuntu 22.04 / 24.04 LTS
- **Instance Type**: 2 vCPU, 4GB RAM minimum (e.g. AWS `t3.medium` or DigitalOcean `$24/mo` droplet)
- **Security Group / Firewall Ports**:
  - `80` (HTTP)
  - `443` (HTTPS)
  - `22` (SSH)

---

### 2. Install Docker & Docker Compose on the Server
Connect to your server via SSH:
```bash
ssh ubuntu@your-server-ip
```

Install Docker and Docker Compose:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

### 3. Clone Repository & Setup Environment
```bash
# Clone the repository
git clone https://github.com/smit3203/alumix.git
cd alumix

# Create production .env file
cp .env.example .env
nano .env
```

Set your production values in `.env`:
```env
PORT=3000
NODE_ENV=production

# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=SetAStrongDatabasePasswordHere2026!
POSTGRES_DB=alumni_db

# Production Authentication Secrets
JWT_ACCESS_SECRET=GenerateAStrongRandomStringForAccessSecret123
JWT_REFRESH_SECRET=GenerateAStrongRandomStringForRefreshSecret456

# AI & LLM Service Configuration
GROQ_API_KEY=gsk_your_actual_groq_api_key_here

# Vector Database (Handled internally by Docker Compose)
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=

# Embedding Model
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
```

---

### 4. Build & Launch the Complete Stack
```bash
# Build images and start containers in the background
docker compose up -d --build

# Verify all 3 containers are healthy and running
docker compose ps
```

Expected output:
```text
NAME                IMAGE               COMMAND                  SERVICE             STATUS
alumix_app          alumix-app          "node app.js"            app                 running (healthy)
alumix_postgres     postgres:16-alpine  "docker-entrypoint.s…"   postgres            running (healthy)
alumix_qdrant       qdrant/qdrant       "/qdrant/qdrant"         qdrant              running
```

---

### 5. Initialize & Seed Database Schema
Run the database migration and seeding script directly inside the running `alumix_app` container:
```bash
docker compose exec app npm run seed
```

Output:
```text
Starting Database Seeding Process...
Database schema created successfully.
Seed taxonomy (departments, companies, skills, interests) inserted.
=======================================================
Seeding completed successfully!
=======================================================
```

---

### 6. Setup Nginx & Free SSL (Let's Encrypt)

Install Nginx & Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Copy the Nginx configuration:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/alumix
sudo ln -s /etc/nginx/sites-available/alumix /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Edit server_name with your actual domain
sudo nano /etc/nginx/sites-available/alumix
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Obtain a free SSL Certificate:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically configure HTTPS and auto-renewal.

---

## Health Monitoring & Logs

### Check Application Health
```bash
curl http://localhost:3000/health
```
Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-08-23T18:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "environment": "production"
}
```

### View Live Container Logs
```bash
# All logs
docker compose logs -f

# App-specific logs
docker compose logs -f app

# Database logs
docker compose logs -f postgres
```

---

## Database Backups & Maintenance

### Backup PostgreSQL Data
```bash
docker compose exec -t postgres pg_dump -U postgres alumni_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
cat backup_file.sql | docker compose exec -T postgres psql -U postgres alumni_db
```

---

## Updating Application in Production

When new code is pushed to GitHub:
```bash
git pull origin main
docker compose build app
docker compose up -d app
```
Zero data loss, automatic container swap.
