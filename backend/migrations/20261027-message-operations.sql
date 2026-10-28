-- Additive migration. No existing records are changed or removed.
BEGIN;

CREATE TABLE IF NOT EXISTS message_operations (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id VARCHAR(255) NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  subscription_id VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  environment VARCHAR(10) NOT NULL CHECK (environment IN ('live','test')),
  state VARCHAR(20) NOT NULL CHECK (state IN ('PROCESSING','ACCEPTED','REJECTED','UNKNOWN')),
  response JSONB,
  http_status INTEGER,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, instance_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS message_operations_owner_created ON message_operations(user_id, created_at DESC);

COMMIT;
