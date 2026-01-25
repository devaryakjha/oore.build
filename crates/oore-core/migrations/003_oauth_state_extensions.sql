-- Extend oauth_state for tracking setup completion
-- These columns allow the CLI to poll for completion status

ALTER TABLE oauth_state ADD COLUMN completed_at TEXT;
ALTER TABLE oauth_state ADD COLUMN error_message TEXT;
ALTER TABLE oauth_state ADD COLUMN app_id INTEGER;
ALTER TABLE oauth_state ADD COLUMN app_name TEXT;
