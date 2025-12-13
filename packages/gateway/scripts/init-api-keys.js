import pool from '../src/db/client.js';

async function initApiKeyTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      key_hash VARCHAR(255) NOT NULL,
      label VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      rate_limit INTEGER DEFAULT 60000, -- 60 requests/min
      active BOOLEAN DEFAULT TRUE
    );
  `);

  console.log("API Keys table ready");
  process.exit(0);
}

initApiKeyTable();
