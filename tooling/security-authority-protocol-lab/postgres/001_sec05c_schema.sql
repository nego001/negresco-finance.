-- SEC-05C DESIGN FIXTURE ONLY. NOT deployed, not a running backend.
-- PostgreSQL 16+ illustrative DDL. No security claims without authenticated
-- server code, strict DB privileges, real key custody and integration tests.
BEGIN;

CREATE SCHEMA IF NOT EXISTS negresco_sec05c_lab;

CREATE TABLE IF NOT EXISTS negresco_sec05c_lab.accounts (
  account_id UUID PRIMARY KEY,
  registry_revision BIGINT NOT NULL CHECK (registry_revision >= 1),
  registry_epoch BIGINT NOT NULL CHECK (registry_epoch >= 1),
  owner_auth_generation BIGINT NOT NULL CHECK (owner_auth_generation >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (registry_epoch <= registry_revision)
);

CREATE TABLE IF NOT EXISTS negresco_sec05c_lab.devices (
  account_id UUID NOT NULL REFERENCES negresco_sec05c_lab.accounts(account_id),
  public_key_fingerprint BYTEA NOT NULL CHECK (octet_length(public_key_fingerprint) = 32),
  -- This is a public key, NOT a private key or an authorization credential.
  ed25519_spki BYTEA NOT NULL CHECK (octet_length(ed25519_spki) = 44),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('ACTIVE', 'REVOKED')),
  last_approving_sequence BIGINT NOT NULL DEFAULT 0
    CHECK (last_approving_sequence >= 0 AND last_approving_sequence < 9223372036854775807),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (account_id, public_key_fingerprint),
  CHECK ((lifecycle = 'ACTIVE' AND revoked_at IS NULL)
    OR (lifecycle = 'REVOKED' AND revoked_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS negresco_sec05c_lab.invites (
  account_id UUID NOT NULL REFERENCES negresco_sec05c_lab.accounts(account_id),
  invitation_id UUID NOT NULL,
  approver_fingerprint BYTEA NOT NULL CHECK (octet_length(approver_fingerprint) = 32),
  candidate_fingerprint BYTEA NOT NULL CHECK (octet_length(candidate_fingerprint) = 32),
  candidate_spki BYTEA NOT NULL CHECK (octet_length(candidate_spki) = 44),
  registry_revision BIGINT NOT NULL CHECK (registry_revision >= 1),
  registry_epoch BIGINT NOT NULL CHECK (registry_epoch >= 1),
  approving_sequence BIGINT NOT NULL CHECK (
    approving_sequence > 0 AND approving_sequence < 9223372036854775807
  ),
  nonce_digest BYTEA NOT NULL CHECK (octet_length(nonce_digest) = 32),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  owner_auth_generation BIGINT NOT NULL CHECK (owner_auth_generation >= 1),
  lifecycle TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (lifecycle IN ('PENDING', 'CONSUMED', 'EXPIRED', 'CANCELLED', 'INVALIDATED')),
  finalized_at TIMESTAMPTZ,
  PRIMARY KEY (account_id, invitation_id),
  FOREIGN KEY (account_id, approver_fingerprint)
    REFERENCES negresco_sec05c_lab.devices(account_id, public_key_fingerprint),
  UNIQUE (account_id, nonce_digest),
  CHECK (approver_fingerprint <> candidate_fingerprint),
  CHECK (registry_epoch <= registry_revision),
  CHECK (expires_at = issued_at + INTERVAL '5 minutes'),
  CHECK ((lifecycle = 'PENDING' AND finalized_at IS NULL)
    OR (lifecycle <> 'PENDING' AND finalized_at IS NOT NULL))
);

-- In a future transaction the backend MUST first expire old PENDING rows.
-- Database uniqueness then prevents two simultaneously pending invites per account.
CREATE UNIQUE INDEX IF NOT EXISTS invites_one_pending_per_account
  ON negresco_sec05c_lab.invites(account_id)
  WHERE lifecycle = 'PENDING';

CREATE TABLE IF NOT EXISTS negresco_sec05c_lab.enrollment_receipts (
  account_id UUID NOT NULL,
  invitation_id UUID NOT NULL,
  -- Stable binary digest of a server-scoped idempotency token, not a bearer token.
  idempotency_digest BYTEA NOT NULL CHECK (octet_length(idempotency_digest) = 32),
  candidate_fingerprint BYTEA NOT NULL CHECK (octet_length(candidate_fingerprint) = 32),
  committed_revision BIGINT NOT NULL CHECK (committed_revision >= 1),
  committed_epoch BIGINT NOT NULL CHECK (committed_epoch >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id, idempotency_digest),
  UNIQUE (account_id, invitation_id),
  FOREIGN KEY (account_id, invitation_id)
    REFERENCES negresco_sec05c_lab.invites(account_id, invitation_id),
  CHECK (committed_epoch <= committed_revision)
);

-- DB administrator must REVOKE direct table writes from application clients;
-- authenticated backend role must be least-privileged and audited. No grants
-- or RLS policies are included because authn/authz has NOT been implemented.
COMMIT;
