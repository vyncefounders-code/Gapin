CREATE TABLE aibbar_events (
  id UUID PRIMARY KEY,
  ai_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_aibbar_ai_id ON aibbar_events(ai_id);
CREATE INDEX idx_aibbar_type ON aibbar_events(event_type);
CREATE INDEX idx_aibbar_created ON aibbar_events(created_at DESC);
