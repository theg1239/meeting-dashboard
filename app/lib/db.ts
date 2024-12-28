import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const pool = new Pool({
  connectionString: databaseUrl,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
