-- Add index on key_preview to speed up API key lookup by preview
CREATE INDEX IF NOT EXISTS idx_api_keys_preview ON api_keys (key_preview);
