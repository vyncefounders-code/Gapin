const pg = require('pg');

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gapin',
  user: process.env.DB_USER || 'gapin',
  password: process.env.DB_PASSWORD || 'gapin123',
});

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');

const initDb = async () => {
  try {
    // If migrations directory exists, run all .sql files in order
    if (fs.existsSync(MIGRATIONS_DIR)) {
      const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        console.log(`Running migration: ${file}`);
        await pool.query(sql);
      }
      console.log('\n✅ All migrations applied from', MIGRATIONS_DIR);
    } else {
      console.log('No migrations directory found, creating base tables');
      // Fallback: create minimal tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          topic VARCHAR(255) NOT NULL,
          message JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('\n✅ Base tables created');
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

initDb();
