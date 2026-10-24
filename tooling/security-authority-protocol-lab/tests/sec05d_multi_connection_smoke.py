#!/usr/bin/env python3
"""SEC-05D disposable PostgreSQL multi-connection transaction test, NOT a server.

Only stdlib + psql. All accounts, public keys and digests are synthetic;
the test-only SQL routine intentionally NEVER registers a candidate device.
"""
import concurrent.futures
import subprocess
import os

DB = os.environ.get("PGDATABASE", "negresco_sec05c_lab")
HOST = os.environ.get("PGHOST", "localhost")
USER = os.environ.get("PGUSER", "postgres")
FUNCTION = "negresco_sec05c_lab.ci_rehearse_receipt_only"
ACCOUNT_A = "33333333-3333-4333-8333-333333333333"
ACCOUNT_B = "44444444-4444-4444-8444-444444444444"
ACCOUNT_EXPIRED = "55555555-5555-4555-8555-555555555555"
ACCOUNT_REVOKED = "66666666-6666-4666-8666-666666666666"
ACCOUNT_STALE = "77777777-7777-4777-8777-777777777777"
INV_A = "123e4567-e89b-42d3-a456-4266141740a1"
INV_B = "123e4567-e89b-42d3-a456-4266141740b2"
INV_EXPIRED = "123e4567-e89b-42d3-a456-4266141740c3"
INV_REVOKED = "123e4567-e89b-42d3-a456-4266141740d4"
INV_STALE = "123e4567-e89b-42d3-a456-4266141740e5"
OTHER_INV = "123e4567-e89b-42d3-a456-4266141740f6"


def psql(query: str) -> str:
    completed = subprocess.run(
        ["psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1",
         "-h", HOST, "-U", USER, "-d", DB, "-c", query],
        capture_output=True, text=True, timeout=30, check=False,
    )
    if completed.returncode:
        raise AssertionError(
            "PostgreSQL fixture error: " + completed.stderr[:2500]
        )
    return completed.stdout.strip()


def require(expected: str, result: str, scenario: str) -> None:
    assert result == expected, f"{scenario}: expected {expected!r}, got {result!r}"


def token(hex_digit: str) -> str:
    assert hex_digit in "0123456789abcdef"
    return "decode('" + hex_digit * 64 + "', 'hex')"


def consume(account: str, invite: str, key: str = "7", generation: int = 1) -> str:
    return psql(
        f"SELECT {FUNCTION}('{account}'::uuid, '{invite}'::uuid,"
        f" {token(key)}, {generation});"
    )


def seed(
    account: str, invite: str, key: str, digest: str,
    *, minutes_ago: int = 0, revoked: bool = False, last_sequence: int = 0
) -> None:
    fingerprint = token(key)
    candidate = token("c")
    spki = "decode(repeat('0a', 44), 'hex')"
    state = "REVOKED" if revoked else "ACTIVE"
    revoked_at = "clock_timestamp()" if revoked else "NULL"
    # Derive expiration from precisely the SAME issued_at value, not from a
    # second clock_timestamp() evaluation (a microsecond mismatch fails CHECK).
    psql(f"""
      BEGIN;
      INSERT INTO negresco_sec05c_lab.accounts
        (account_id, registry_revision, registry_epoch, owner_auth_generation)
        VALUES ('{account}'::uuid, 1, 1, 1);
      INSERT INTO negresco_sec05c_lab.devices
        (account_id, public_key_fingerprint, ed25519_spki,
         lifecycle, last_approving_sequence, revoked_at)
        VALUES ('{account}'::uuid, {fingerprint}, {spki},
                '{state}', {last_sequence}, {revoked_at});
      WITH fixed_time AS
        (SELECT clock_timestamp() - INTERVAL '{minutes_ago} minutes' AS issued)
      INSERT INTO negresco_sec05c_lab.invites
        (account_id, invitation_id, approver_fingerprint, candidate_fingerprint,
         candidate_spki, registry_revision, registry_epoch, approving_sequence,
         nonce_digest, issued_at, expires_at, owner_auth_generation)
      SELECT '{account}'::uuid, '{invite}'::uuid, {fingerprint},
             {candidate}, {spki}, 1, 1, 1, {token(digest)},
             fixed_time.issued, fixed_time.issued + INTERVAL '5 minutes', 1
      FROM fixed_time;
      COMMIT;
    """)


def snapshot(account: str, invite: str) -> str:
    return psql(f"""
      SELECT a.registry_revision::text || ':' || a.registry_epoch::text ||
        ':' || d.last_approving_sequence::text || ':' || i.lifecycle ||
        ':' || (SELECT count(*)::text FROM negresco_sec05c_lab.enrollment_receipts r
                 WHERE r.account_id=a.account_id) ||
        ':' || (SELECT count(*)::text FROM negresco_sec05c_lab.devices v
                 WHERE v.account_id=a.account_id AND
                   v.public_key_fingerprint = i.candidate_fingerprint)
      FROM negresco_sec05c_lab.accounts a
      JOIN negresco_sec05c_lab.invites i
        ON i.account_id=a.account_id AND i.invitation_id='{invite}'::uuid
      JOIN negresco_sec05c_lab.devices d
        ON d.account_id=a.account_id
         AND d.public_key_fingerprint=i.approver_fingerprint
      WHERE a.account_id='{account}'::uuid;
    """)


def run():
    seed(ACCOUNT_A, INV_A, "a", "1")
    seed(ACCOUNT_B, INV_B, "b", "2")
    seed(ACCOUNT_EXPIRED, INV_EXPIRED, "d", "3", minutes_ago=10)
    seed(ACCOUNT_REVOKED, INV_REVOKED, "e", "4", revoked=True)
    seed(ACCOUNT_STALE, INV_STALE, "f", "5", last_sequence=1)

    # A database abort between updating counters and returning to the caller
    # rolls EVERYTHING back, including the terminal marker and receipt.
    abort_output = psql(
        f"BEGIN; SELECT {FUNCTION}('{ACCOUNT_A}'::uuid, '{INV_A}'::uuid,"
        f" {token('7')}, 1); ROLLBACK;"
    )
    assert "RECORDED_FIXTURE_ONLY" in abort_output
    require("1:1:0:PENDING:0:0", snapshot(ACCOUNT_A, INV_A), "rollback atomically")

    require("DENY_UNKNOWN_ACCOUNT",
            consume("ffffffff-ffff-4fff-8fff-ffffffffffff", INV_A),
            "missing account")
    require("DENY_UNKNOWN_INVITATION",
            consume(ACCOUNT_B, INV_A), "cross-account invitation")
    require("DENY_UNKNOWN_INVITATION",
            consume(ACCOUNT_A, OTHER_INV), "invented invitation")
    require("DENY_STALE_ACCOUNT_STATE",
            consume(ACCOUNT_B, INV_B, generation=2), "owner generation mismatch")
    require("1:1:0:PENDING:0:0", snapshot(ACCOUNT_B, INV_B), "no partial write on deny")

    # Real database connections race against the same stored account lock.
    # Only one first commit succeeds, all other calls return an idempotent
    # status. This is deliberately NOT a production permission to enroll.
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(
            lambda _: consume(ACCOUNT_A, INV_A), range(8)
        ))
    assert results.count("RECORDED_FIXTURE_ONLY") == 1, results
    assert results.count("ALREADY_RECORDED_NO_GRANT") == 7, results
    require("2:2:1:CONSUMED:1:0",
            snapshot(ACCOUNT_A, INV_A), "one durable commit, zero device enrollment")

    # Network response lost after COMMIT: replay returns receipt status but
    # does NOT execute a second increment or create a second candidate.
    require("ALREADY_RECORDED_NO_GRANT",
            consume(ACCOUNT_A, INV_A), "retry after response loss")
    require("DENY_IDEMPOTENCY_CONFLICT",
            consume(ACCOUNT_A, OTHER_INV), "same key on another invitation")
    require("DENY_TERMINAL_INVITATION",
            consume(ACCOUNT_A, INV_A, key="8"), "different key on terminal invitation")
    require("2:2:1:CONSUMED:1:0",
            snapshot(ACCOUNT_A, INV_A), "idempotency preserves counters")

    # Accounts must not share idempotency or receipt records. B remains
    # independent of A, despite both using the same synthetic digest.
    require("RECORDED_FIXTURE_ONLY",
            consume(ACCOUNT_B, INV_B), "independent account")
    require("2:2:1:CONSUMED:1:0",
            snapshot(ACCOUNT_B, INV_B), "independent account atomic state")

    require("DENY_EXPIRED",
            consume(ACCOUNT_EXPIRED, INV_EXPIRED), "authoritative DB clock")
    require("1:1:0:EXPIRED:0:0",
            snapshot(ACCOUNT_EXPIRED, INV_EXPIRED), "expiry persisted as tombstone")
    require("DENY_TERMINAL_INVITATION",
            consume(ACCOUNT_EXPIRED, INV_EXPIRED), "expired nonce cannot revive")
    require("DENY_REVOKED_OR_UNKNOWN_APPROVER",
            consume(ACCOUNT_REVOKED, INV_REVOKED), "revoked approver")
    require("1:1:0:PENDING:0:0",
            snapshot(ACCOUNT_REVOKED, INV_REVOKED), "rejected revocation changed nothing")
    require("DENY_REPLAYED_SEQUENCE",
            consume(ACCOUNT_STALE, INV_STALE), "stale sequence")
    require("1:1:1:PENDING:0:0",
            snapshot(ACCOUNT_STALE, INV_STALE), "stale sequence changed nothing")

    print("PASS: SEC-05D 8-connection account-locked receipt race, rollback, "
          "cross-account scope, replay, expiry, revoked approver and zero enrollment")
    print("LIMIT: PostgreSQL CI rehearsal cannot authenticate accounts or verify Ed25519")


if __name__ == "__main__":
    run()
