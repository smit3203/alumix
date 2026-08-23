const { Pool } = require('pg');
require('dotenv').config();

let poolConfig = {};

if (process.env.DATABASE_URL) {
  const isCloudDb = 
    process.env.DATABASE_URL.includes('render.com') ||
    process.env.DATABASE_URL.includes('neon.tech') ||
    process.env.DATABASE_URL.includes('railway') ||
    process.env.DATABASE_URL.includes('supabase') ||
    process.env.DATABASE_URL.includes('amazonaws.com') ||
    process.env.PGSSL === 'true' ||
    process.env.NODE_ENV === 'production';

  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false,
  };
} else {
  poolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'alumni_db',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
