-- Add user_id foreign key to api_keys table
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Add index for querying keys by user
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
