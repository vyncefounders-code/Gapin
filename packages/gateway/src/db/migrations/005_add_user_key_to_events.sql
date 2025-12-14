-- Add user_id and key_id to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL;

-- Add indexes for querying by user and key
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_key_id ON events(key_id);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON events(user_id, created_at DESC);
