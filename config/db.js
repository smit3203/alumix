const { Pool } = require('pg');
require('dotenv').config();

let poolConfig = {};

const dbUrl = process.env.DATABASE_URL || '';

if (dbUrl) {
  const isCloudDb = 
    dbUrl.includes('neon.tech') ||
    dbUrl.includes('render.com') ||
    dbUrl.includes('railway') ||
    dbUrl.includes('supabase') ||
    dbUrl.includes('amazonaws.com') ||
    dbUrl.includes('sslmode=require') ||
    process.env.PGSSL === 'true' ||
    process.env.NODE_ENV === 'production';

  poolConfig = {
    connectionString: dbUrl,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
} else {
  poolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'alumni_db',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
