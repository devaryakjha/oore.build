-- Add config_format column to track YAML vs HUML
-- Rename config_yaml to config_content for clarity

-- SQLite doesn't support RENAME COLUMN in older versions, so we need to recreate the table
-- First, create a new table with the updated schema
CREATE TABLE pipeline_configs_new (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'default',
    config_content TEXT NOT NULL,
    config_format TEXT NOT NULL DEFAULT 'yaml' CHECK (config_format IN ('yaml', 'huml')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repository_id, name)
);

-- Copy data from old table (all existing configs are YAML)
INSERT INTO pipeline_configs_new (id, repository_id, name, config_content, config_format, is_active, created_at, updated_at)
SELECT id, repository_id, name, config_yaml, 'yaml', is_active, created_at, updated_at
FROM pipeline_configs;

-- Drop old table
DROP TABLE pipeline_configs;

-- Rename new table
ALTER TABLE pipeline_configs_new RENAME TO pipeline_configs;

-- Recreate indexes
CREATE INDEX idx_pipeline_configs_repository ON pipeline_configs(repository_id);
CREATE UNIQUE INDEX idx_pipeline_configs_active ON pipeline_configs(repository_id) WHERE is_active = 1;
