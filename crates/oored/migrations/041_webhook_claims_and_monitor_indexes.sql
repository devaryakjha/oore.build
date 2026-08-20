ALTER TABLE integration_webhooks
ADD COLUMN processing_started_at INTEGER;

ALTER TABLE integration_webhooks
ADD COLUMN next_attempt_at INTEGER;

CREATE TABLE IF NOT EXISTS webhook_build_claims (
    webhook_id TEXT NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    build_id TEXT NOT NULL,
    PRIMARY KEY (webhook_id, pipeline_id)
) WITHOUT ROWID;

-- Preserve existing builds while claiming one canonical build for old duplicate rows.
INSERT OR IGNORE INTO webhook_build_claims (webhook_id, pipeline_id, build_id)
SELECT webhook_id, pipeline_id, id
FROM builds
WHERE webhook_id IS NOT NULL
ORDER BY created_at, id;

CREATE INDEX IF NOT EXISTS idx_builds_status_updated_at
ON builds(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_builds_status_started_at
ON builds(status, started_at);

CREATE INDEX IF NOT EXISTS idx_runners_heartbeat_status
ON runners(last_heartbeat_at, status);
