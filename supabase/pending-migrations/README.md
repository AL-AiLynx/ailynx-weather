# Pending migrations — not applied

Files in this directory are deliberately outside `supabase/migrations/`, so the
Supabase migration runner cannot select them. Moving a file here does not alter
Production migration history or schema.

- `20260908113000_create_member_community.sql` is **CONFLICTING** with the
  audited Production membership baseline and must not be applied or history-marked.
- `20260908170000_verify_as1_dominance_canonical_identity.sql` is
  **NOT_APPLIED**. It is an independent dominance data change that requires its
  own approved Production review.

Do not move either file back into `supabase/migrations/` merely to unblock an
unrelated migration. An approved change plan must resolve each file first.
