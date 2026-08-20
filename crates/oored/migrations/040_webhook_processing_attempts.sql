ALTER TABLE integration_webhooks
ADD COLUMN processing_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_status_received
ON integration_webhooks(status, received_at);
