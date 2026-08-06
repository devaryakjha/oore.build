ALTER TABLE trusted_proxy_settings
  ADD COLUMN proof_provider TEXT NOT NULL DEFAULT 'shared_secret'
  CHECK (proof_provider IN ('shared_secret', 'cloudflare_access'));

ALTER TABLE trusted_proxy_settings
  ADD COLUMN cloudflare_team_domain TEXT;

ALTER TABLE trusted_proxy_settings
  ADD COLUMN cloudflare_audience TEXT;
