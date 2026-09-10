# Production migration history reconciliation

> Read-only reconciliation record for Production project `jggazwqwalincsjegieo` on 2026-09-10.
> This is not a migration and must never be applied to a database.

## Evidence and restored canonical sources

`supabase migration fetch --project-ref jggazwqwalincsjegieo` fetched the two
remote-history sources that were absent from the canonical tree:

| Version | Name | Applied at (UTC) | Canonical result |
| --- | --- | --- | --- |
| `20260901010000` | `create_as1_live_archive_ledgers` | `2026-09-01 01:00:00` | Restored verbatim as `../migrations/20260901010000_create_as1_live_archive_ledgers.sql` |
| `20260907220000` | `create_ailynx_history_packets` | `2026-09-07 22:00:00` | Restored verbatim as `../migrations/20260907220000_create_ailynx_history_packets.sql` |

The same remote history also records the already-present migrations
`20260908091500_create_pwa_visit_counter` and
`20260909010000_create_server_verified_admin`.

No Production schema, migration-history, data, function, or deployment operation
was performed during this reconciliation.

## Pending files outside the migration runner

| Version | Classification | Reason |
| --- | --- | --- |
| `20260908113000_create_member_community` | `CONFLICTING` | It is not in remote history and conflicts with the audited Production membership baseline: it redefines `profiles`, moves plan state into that table, changes Auth-trigger behavior, and introduces incompatible profile policies. It is retained at `../pending-migrations/20260908113000_create_member_community.sql`. See `20260908190000_membership_production_reference.md`. |
| `20260908170000_verify_as1_dominance_canonical_identity` | `NOT_APPLIED` | It is not in remote history and is an independent preflighted data update to dominance registry identity values. It is retained at `../pending-migrations/20260908170000_verify_as1_dominance_canonical_identity.sql` pending a separate Production change review. |
| `20260910150000_recover_us100_profile_mismatch_observations` | `NOT_APPLIED` | It is intentionally pending and was not applied in this reconciliation. |

## No-op plan and recovery readiness

The restored remote-history files make the previously missing Production versions
locally reproducible. Do not run `supabase migration repair`: the two unrelated
unapplied files are retained outside the migration runner, not history-marked.

The recovery migration is assessed separately by the recovery-hardening change.
This reconciliation record does not authorize its Production application.
