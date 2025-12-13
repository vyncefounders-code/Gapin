const pg = require('pg');

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gapin',
  user: process.env.DB_USER || 'gapin',
  password: process.env.DB_PASSWORD || 'gapin123',
});

const initDb = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Users table created');

    // Create events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        topic VARCHAR(255) NOT NULL,
        message JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Events table created');

    // Create index on events table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_topic_created 
      ON events(topic, created_at DESC);
    `);
    console.log('✓ Events index created');

    console.log('\n✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

initDb();
