-- SEC-05D CI-ONLY TEST FUNCTION. DO NOT DEPLOY OR EXPOSE AS AN API.
-- This is NOT an authorization/enrollment procedure. It does NOT verify
-- identity, owner consent, Ed25519, session tokens or hardware. It never
-- inserts a device and cannot confer account/device privileges.
-- Its sole purpose is exercising PostgreSQL atomicity, row-lock serialization,
-- failure rollback, terminal states and receipt idempotency in a throwaway DB.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION negresco_sec05c_lab.ci_rehearse_receipt_only(
  p_account UUID,
  p_invitation UUID,
  p_idempotency_digest BYTEA,
  p_expected_owner_generation BIGINT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  current_account negresco_sec05c_lab.accounts%ROWTYPE;
  current_invite negresco_sec05c_lab.invites%ROWTYPE;
  approver negresco_sec05c_lab.devices%ROWTYPE;
  existing_receipt negresco_sec05c_lab.enrollment_receipts%ROWTYPE;
  checked_at TIMESTAMPTZ;
BEGIN
  IF p_account IS NULL OR p_invitation IS NULL OR p_idempotency_digest IS NULL
     OR octet_length(p_idempotency_digest) <> 32
     OR p_expected_owner_generation IS NULL OR p_expected_owner_generation < 1 THEN
    RETURN 'DENY_INVALID_INPUT';
  END IF;

  -- Deliberately serialize all concurrent workers for THIS account across
  -- separate database connections and app processes, not just one JVM mutex.
  SELECT * INTO current_account FROM negresco_sec05c_lab.accounts
    WHERE account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN 'DENY_UNKNOWN_ACCOUNT'; END IF;

  -- Idempotency is account-scoped, never a bearer token. A production backend
  -- MUST authenticate session/account before exposing even a receipt status.
  SELECT * INTO existing_receipt
    FROM negresco_sec05c_lab.enrollment_receipts
    WHERE account_id = p_account AND idempotency_digest = p_idempotency_digest;
  IF FOUND THEN
    IF existing_receipt.invitation_id <> p_invitation THEN
      RETURN 'DENY_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN 'ALREADY_RECORDED_NO_GRANT';
  END IF;

  SELECT * INTO current_invite FROM negresco_sec05c_lab.invites
    WHERE account_id = p_account AND invitation_id = p_invitation FOR UPDATE;
  IF NOT FOUND THEN RETURN 'DENY_UNKNOWN_INVITATION'; END IF;
  IF current_invite.lifecycle <> 'PENDING' THEN RETURN 'DENY_TERMINAL_INVITATION'; END IF;

  -- Capture database time AFTER acquiring row locks, never client-supplied
  -- time nor transaction_timestamp() frozen before waiting in a lock queue.
  checked_at := clock_timestamp();
  IF checked_at >= current_invite.expires_at THEN
    UPDATE negresco_sec05c_lab.invites
      SET lifecycle = 'EXPIRED', finalized_at = checked_at
      WHERE account_id = p_account AND invitation_id = p_invitation;
    RETURN 'DENY_EXPIRED';
  END IF;

  IF current_account.registry_revision <> current_invite.registry_revision
    OR current_account.registry_epoch <> current_invite.registry_epoch
    OR current_account.owner_auth_generation <> current_invite.owner_auth_generation
    OR current_account.owner_auth_generation <> p_expected_owner_generation THEN
    RETURN 'DENY_STALE_ACCOUNT_STATE';
  END IF;

  SELECT * INTO approver FROM negresco_sec05c_lab.devices
    WHERE account_id = p_account
      AND public_key_fingerprint = current_invite.approver_fingerprint
    FOR UPDATE;
  IF NOT FOUND OR approver.lifecycle <> 'ACTIVE' THEN
    RETURN 'DENY_REVOKED_OR_UNKNOWN_APPROVER';
  END IF;
  IF current_invite.approving_sequence <= approver.last_approving_sequence THEN
    RETURN 'DENY_REPLAYED_SEQUENCE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM negresco_sec05c_lab.devices
      WHERE account_id = p_account
        AND public_key_fingerprint = current_invite.candidate_fingerprint
  ) THEN RETURN 'DENY_ALREADY_KNOWN_CANDIDATE'; END IF;
  IF current_account.registry_revision >= 9223372036854775806
     OR current_account.registry_epoch >= 9223372036854775806 THEN
    RETURN 'DENY_COUNTER_OVERFLOW';
  END IF;

  -- TEST REHEARSAL ONLY: advance fixture counters and store an irreversible
  -- receipt, but NEVER INSERT a trusted candidate device. No signed proofs
  -- have been checked in this CI routine. Real registration must be a separate
  -- authenticated and cryptographically verified ACID operation.
  UPDATE negresco_sec05c_lab.devices SET
    last_approving_sequence = current_invite.approving_sequence
    WHERE account_id = p_account AND public_key_fingerprint = current_invite.approver_fingerprint;
  UPDATE negresco_sec05c_lab.accounts SET
    registry_revision = registry_revision + 1,
    registry_epoch = registry_epoch + 1
    WHERE account_id = p_account;
  UPDATE negresco_sec05c_lab.invites SET
    lifecycle = 'CONSUMED', finalized_at = checked_at
    WHERE account_id = p_account AND invitation_id = p_invitation;
  INSERT INTO negresco_sec05c_lab.enrollment_receipts
    (account_id, invitation_id, idempotency_digest,
     candidate_fingerprint, committed_revision, committed_epoch)
  VALUES
    (p_account, p_invitation, p_idempotency_digest,
     current_invite.candidate_fingerprint,
     current_account.registry_revision + 1, current_account.registry_epoch + 1);
  RETURN 'RECORDED_FIXTURE_ONLY';
END;
$$;

COMMENT ON FUNCTION negresco_sec05c_lab.ci_rehearse_receipt_only(UUID, UUID, BYTEA, BIGINT)
  IS 'SEC-05D CI-only transaction rehearsal; NO authentication/signature validation/enrollment; never deploy';
