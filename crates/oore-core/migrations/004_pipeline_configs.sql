-- Pipeline infrastructure for build execution
-- Enables Codemagic-compatible YAML pipeline configs and build step tracking

-- Pipeline configs (UI-stored, fallback when no codemagic.yaml in repo)
CREATE TABLE pipeline_configs (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'default',
    config_yaml TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repository_id, name)
);

-- Only one active config per repository
CREATE UNIQUE INDEX idx_pipeline_configs_active
ON pipeline_configs(repository_id) WHERE is_active = 1;

-- Build step execution tracking
CREATE TABLE build_steps (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    script TEXT,
    timeout_secs INTEGER,
    ignore_failure INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failure', 'skipped', 'cancelled')),
    exit_code INTEGER,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(build_id, step_index)
);

-- Build logs (file path index, stores metadata not content)
CREATE TABLE build_logs (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    stream TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
    log_file_path TEXT NOT NULL,  -- Relative to logs_dir (e.g., "{build_id}/step-{n}-stdout.log")
    line_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(build_id, step_index, stream)
);

-- Indexes for efficient queries
CREATE INDEX idx_pipeline_configs_repository ON pipeline_configs(repository_id);
CREATE INDEX idx_build_steps_build ON build_steps(build_id);
CREATE INDEX idx_build_logs_build ON build_logs(build_id);

-- Extend builds table with pipeline-specific fields
ALTER TABLE builds ADD COLUMN workflow_name TEXT;
ALTER TABLE builds ADD COLUMN config_source TEXT CHECK (config_source IN ('repository', 'stored'));
ALTER TABLE builds ADD COLUMN error_message TEXT;
