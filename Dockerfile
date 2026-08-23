# ==============================================================================
# Production Dockerfile for AI-Powered Alumni Career Intelligence System
# ==============================================================================

FROM node:20-alpine AS base

# Install curl for container health check
RUN apk add --no-cache curl python3 make g++

WORKDIR /app

# Install dependencies with production caching
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source code
COPY . .

# Ensure secure production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose Web Application Port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start Application Server
CMD ["node", "app.js"]
