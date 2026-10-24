-- SEC-05K: SYNTHETIC PostgreSQL persistence fixture, NOT a banking backend.
-- This schema and its client use only disposable accounts and ciphertext HASHES.
-- No owner authentication, network service, private keys or real rekey execution.
BEGIN;
CREATE SCHEMA IF NOT EXISTS negresco_sec05k_cas_lab;

CREATE TABLE IF NOT EXISTS negresco_sec05k_cas_lab.generations (
  account_id CHAR(32) PRIMARY KEY CHECK (account_id ~ '^[0-9a-f]{32}$'),
  kit_id UUID NOT NULL,
  version BIGINT NOT NULL CHECK (version BETWEEN 1 AND 9223372036854775806),
  generation BIGINT NOT NULL CHECK (generation BETWEEN 1 AND 9223372036854775806),
  ciphertext_sha256 BYTEA NOT NULL CHECK (octet_length(ciphertext_sha256)=32)
);

CREATE TABLE IF NOT EXISTS negresco_sec05k_cas_lab.operation_receipts (
  account_id CHAR(32) NOT NULL REFERENCES negresco_sec05k_cas_lab.generations(account_id),
  operation_id UUID NOT NULL,
  before_kit UUID NOT NULL,
  before_version BIGINT NOT NULL CHECK (before_version >= 1),
  before_generation BIGINT NOT NULL CHECK (before_generation >= 1),
  before_sha256 BYTEA NOT NULL CHECK (octet_length(before_sha256)=32),
  after_kit UUID NOT NULL,
  after_version BIGINT NOT NULL CHECK (after_version >= 1),
  after_generation BIGINT NOT NULL CHECK (after_generation >= 1),
  after_sha256 BYTEA NOT NULL CHECK (octet_length(after_sha256)=32),
  committed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id,operation_id),
  CHECK (after_version = before_version + 1),
  CHECK (after_generation = before_generation + 1),
  CHECK (before_kit <> after_kit)
);
COMMIT;
