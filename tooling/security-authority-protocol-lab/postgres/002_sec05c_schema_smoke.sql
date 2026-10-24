-- SEC-05C schema smoke. Disposable database/keys only. NOT enrollment QA.
\set ON_ERROR_STOP on

DO $$
DECLARE
  a UUID := '11111111-1111-4111-8111-111111111111';
  b UUID := '22222222-2222-4222-8222-222222222222';
  invite UUID := '123e4567-e89b-42d3-a456-426614174000';
  next_invite UUID := '123e4567-e89b-42d3-a456-426614174001';
  issued TIMESTAMPTZ := '2026-10-21T00:00:00Z';
  old_key BYTEA := decode(repeat('aa', 32), 'hex');
  other_key BYTEA := decode(repeat('bb', 32), 'hex');
  new_key BYTEA := decode(repeat('cc', 32), 'hex');
BEGIN
  INSERT INTO negresco_sec05c_lab.accounts
    (account_id, registry_revision, registry_epoch, owner_auth_generation)
  VALUES (a, 1, 1, 1), (b, 1, 1, 1);

  -- Fake 44-byte blobs are for SQL constraints only; they are NOT Ed25519 keys.
  INSERT INTO negresco_sec05c_lab.devices
    (account_id, public_key_fingerprint, ed25519_spki, lifecycle)
  VALUES
    (a, old_key, decode(repeat('01', 44), 'hex'), 'ACTIVE'),
    (b, other_key, decode(repeat('02', 44), 'hex'), 'ACTIVE');

  INSERT INTO negresco_sec05c_lab.invites
    (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
     candidate_spki, registry_revision, registry_epoch, approving_sequence,
     nonce_digest, issued_at, expires_at, owner_auth_generation)
  VALUES
    (a, invite, old_key, new_key, decode(repeat('03', 44), 'hex'),
     1, 1, 1, decode(repeat('33', 32), 'hex'), issued,
     issued + INTERVAL '5 minutes', 1);

  -- Unique live invitation per account, even if the UUID and nonce differ.
  BEGIN
    INSERT INTO negresco_sec05c_lab.invites
      (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
       candidate_spki, registry_revision, registry_epoch, approving_sequence,
       nonce_digest, issued_at, expires_at, owner_auth_generation)
    VALUES
      (a, next_invite, old_key, new_key, decode(repeat('03', 44), 'hex'),
       1, 1, 2, decode(repeat('44', 32), 'hex'), issued,
       issued + INTERVAL '5 minutes', 1);
    RAISE EXCEPTION 'PENDING uniqueness NOT enforced';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Account B can independently have the same invite UUID and same nonce digest;
  -- server cryptographic signatures MUST bind the account to prevent crossing.
  INSERT INTO negresco_sec05c_lab.invites
    (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
     candidate_spki, registry_revision, registry_epoch, approving_sequence,
     nonce_digest, issued_at, expires_at, owner_auth_generation)
  VALUES
    (b, invite, other_key, new_key, decode(repeat('03', 44), 'hex'),
     1, 1, 1, decode(repeat('33', 32), 'hex'), issued,
     issued + INTERVAL '5 minutes', 1);

  -- Invalid TTL never becomes a persisted invitation.
  BEGIN
    INSERT INTO negresco_sec05c_lab.invites
      (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
       candidate_spki, registry_revision, registry_epoch, approving_sequence,
       nonce_digest, issued_at, expires_at, owner_auth_generation)
    VALUES
      (a, next_invite, old_key, new_key, decode(repeat('03', 44), 'hex'),
       1, 1, 2, decode(repeat('44', 32), 'hex'), issued,
       issued + INTERVAL '6 minutes', 1);
    RAISE EXCEPTION 'TTL check NOT enforced';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A terminal tombstone permits a DIFFERENT nonce, never old nonce reuse.
  UPDATE negresco_sec05c_lab.invites
    SET lifecycle = 'CONSUMED', finalized_at = issued + INTERVAL '1 minute'
    WHERE account_id = a AND invitation_id = invite;

  BEGIN
    INSERT INTO negresco_sec05c_lab.invites
      (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
       candidate_spki, registry_revision, registry_epoch, approving_sequence,
       nonce_digest, issued_at, expires_at, owner_auth_generation)
    VALUES
      (a, next_invite, old_key, new_key, decode(repeat('03', 44), 'hex'),
       1, 1, 2, decode(repeat('33', 32), 'hex'), issued,
       issued + INTERVAL '5 minutes', 1);
    RAISE EXCEPTION 'nonce replay uniqueness NOT enforced';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO negresco_sec05c_lab.invites
    (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
     candidate_spki, registry_revision, registry_epoch, approving_sequence,
     nonce_digest, issued_at, expires_at, owner_auth_generation)
  VALUES
    (a, next_invite, old_key, new_key, decode(repeat('03', 44), 'hex'),
     1, 1, 2, decode(repeat('44', 32), 'hex'), issued,
     issued + INTERVAL '5 minutes', 1);

  -- Receipt stored once. A repeated commit cannot insert the same key again.
  INSERT INTO negresco_sec05c_lab.enrollment_receipts
    (account_id, invitation_id, idempotency_digest,
     candidate_fingerprint, committed_revision, committed_epoch)
  VALUES
    (a, invite, decode(repeat('55', 32), 'hex'), new_key, 2, 2);

  BEGIN
    INSERT INTO negresco_sec05c_lab.enrollment_receipts
      (account_id, invitation_id, idempotency_digest,
       candidate_fingerprint, committed_revision, committed_epoch)
    VALUES
      (a, invite, decode(repeat('55', 32), 'hex'), new_key, 2, 2);
    RAISE EXCEPTION 'duplicate receipt NOT rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  IF (SELECT count(*) FROM negresco_sec05c_lab.invites WHERE account_id = a) <> 2 THEN
    RAISE EXCEPTION 'Unexpected account-scoped invite count';
  END IF;
  IF (SELECT count(*) FROM negresco_sec05c_lab.enrollment_receipts WHERE account_id = a) <> 1 THEN
    RAISE EXCEPTION 'Unexpected account-scoped receipt count';
  END IF;
  RAISE NOTICE 'PASS: PostgreSQL account scopes, one PENDING invite, expiry CHECK, nonce replay and receipt uniqueness';
END $$;
