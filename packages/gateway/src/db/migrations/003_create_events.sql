CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    message JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_topic_created ON events(topic, created_at DESC);
