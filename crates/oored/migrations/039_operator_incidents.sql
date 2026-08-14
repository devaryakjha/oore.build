CREATE TABLE operator_incidents (
    id TEXT PRIMARY KEY NOT NULL,
    deduplication_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    reason TEXT NOT NULL,
    resource_kind TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    repair_action TEXT NOT NULL,
    repair_url TEXT NOT NULL,
    audience_resource TEXT NOT NULL,
    audience_action TEXT NOT NULL,
    first_occurrence_at INTEGER NOT NULL,
    latest_occurrence_at INTEGER NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_operator_incidents_status_severity
    ON operator_incidents (status, severity, latest_occurrence_at DESC);
CREATE INDEX idx_operator_incidents_resource
    ON operator_incidents (resource_kind, resource_id, status);

CREATE TABLE operator_incident_notifications (
    id TEXT PRIMARY KEY NOT NULL,
    incident_id TEXT NOT NULL REFERENCES operator_incidents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    read_at INTEGER,
    UNIQUE (incident_id, user_id)
);

CREATE INDEX idx_operator_incident_notifications_user
    ON operator_incident_notifications (user_id, read_at, created_at DESC);
