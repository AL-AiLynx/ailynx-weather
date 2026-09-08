# AiLynx Production membership schema reference

> **Reference snapshot only — never apply this file as a migration.**
>
> Source: read-only catalog audit of Supabase Production (`jggazwqwalincsjegieo`) on
> 2026-09-08. The five tables and their Auth triggers already exist in Production,
> but their creation migration is absent from this repository. Re-running equivalent
> DDL against Production would fail on existing objects. This file is the canonical
> reconstruction input for a future clean-environment baseline after review.

## Scope and non-goals

- Covered: `features`, `plans`, `plan_entitlements`, `profiles`, and
  `subscriptions`, including their membership-related triggers, RLS, and grants.
- Not covered: user rows, email addresses, phone numbers, addresses, provider IDs,
  or payment identifiers. No sensitive data was read into this snapshot.
- Not a Production change request. It does not authorize migration apply, RLS/Auth
  changes, subscription writes, role creation, or payment-provider configuration.

## Canonical relation

```text
auth.users (id)
  |- profiles.user_id       -- one profile, ON DELETE CASCADE
  `- subscriptions.user_id  -- one subscription, ON DELETE CASCADE

plans.code <- subscriptions.plan_code
plans.code <- plan_entitlements.plan_code -> features.code
```

The effective plan is held by `subscriptions.plan_code`, not by `profiles`.

## Reconstructed tables

### `public.features`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `code` | `text` | no | — |
| `description` | `text` | no | — |
| `category` | `text` | no | — |
| `rollout_status` | `text` | no | — |
| `created_at` | `timestamptz` | no | `now()` |

- PK: `features_pkey (code)`.
- Checks: dotted lowercase feature code; description length 1–160; category length
  1–40; rollout status in `ACTIVE`, `FUTURE`, `DISABLED`.
- Indexes: `features_pkey`.
- RLS: enabled; no policies. Grants only to `postgres` and `service_role`.

### `public.plans`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `code` | `text` | no | — |
| `display_name` | `text` | no | — |
| `rank` | `integer` | no | — |
| `active` | `boolean` | no | `true` |
| `created_at` | `timestamptz` | no | `now()` |
| `updated_at` | `timestamptz` | no | `now()` |

- PK: `plans_pkey (code)`; unique: `plans_rank_key (rank)`.
- Checks: code in `FREE`, `WEATHER`, `PRO`, `PREMIUM`; display-name length 1–40;
  `rank > 0`.
- Trigger: `plans_set_updated_at` before update, calling
  `public.set_entitlement_updated_at()`.
- RLS: enabled; no policies. Grants only to `postgres` and `service_role`.

### `public.plan_entitlements`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `plan_code` | `text` | no | — |
| `feature_code` | `text` | no | — |
| `enabled` | `boolean` | no | `true` |

- PK: `plan_entitlements_pkey (plan_code, feature_code)`.
- FKs: `plan_code -> plans(code)`; `feature_code -> features(code)`.
- Index: `plan_entitlements_feature_code_idx (feature_code)`.
- RLS: enabled; no policies. Grants only to `postgres` and `service_role`.

### `public.profiles`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `user_id` | `uuid` | no | — |
| `display_name` | `text` | yes | — |
| `country_code` | `text` | yes | — |
| `phone_e164` | `text` | yes | — |
| `phone_verified_at` | `timestamptz` | yes | — |
| `postal_code` | `text` | yes | — |
| `address_line1` | `text` | yes | — |
| `address_line2` | `text` | yes | — |
| `created_at` | `timestamptz` | no | `now()` |
| `updated_at` | `timestamptz` | no | `now()` |

- PK: `profiles_pkey (user_id)`.
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`.
- Checks: optional display name length 2–40; ISO-style upper-case country code;
  E.164 phone; postal code max 20; address lines max 200.
- Trigger: `profiles_set_updated_at` before update, calling
  `public.set_profile_updated_at()`. It clears `phone_verified_at` whenever a
  phone number changes and changes `updated_at` only when profile data changes.
- RLS: enabled.
  - `users select their own profile`: `SELECT` for `authenticated`,
    `auth.uid() = user_id`.
  - `users update their own profile`: `UPDATE` for `authenticated`, same
    `USING` and `WITH CHECK` predicate.
- Grants: `authenticated` has `SELECT`; `postgres` and `service_role` have full
  table privileges.

### `public.subscriptions`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `user_id` | `uuid` | no | — |
| `plan_code` | `text` | no | — |
| `status` | `text` | no | — |
| `source` | `text` | no | — |
| `current_period_start` | `timestamptz` | yes | — |
| `current_period_end` | `timestamptz` | yes | — |
| `cancel_at_period_end` | `boolean` | no | `false` |
| `created_at` | `timestamptz` | no | `now()` |
| `updated_at` | `timestamptz` | no | `now()` |

- PK: `subscriptions_pkey (user_id)` — exactly one subscription row per user.
- FKs: `user_id -> auth.users(id) ON DELETE CASCADE`; `plan_code -> plans(code)`.
- Checks: status in `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`, `SUSPENDED`;
  source in `SYSTEM`, `MANUAL_TEST`, `TOSS`, `KAKAOPAY`; end period is not before
  start period when both are present.
- Index: `subscriptions_plan_code_idx (plan_code)`.
- Trigger: `subscriptions_set_updated_at` before update, calling
  `public.set_entitlement_updated_at()`.
- RLS: enabled; `users select their own subscription` is `SELECT` for
  `authenticated` where `auth.uid() = user_id`.
- Grants: `authenticated` has `SELECT`; `postgres` and `service_role` have full
  table privileges.

## Auth linkage and trigger functions

Two `AFTER INSERT` triggers already exist on `auth.users`:

1. `auth_user_creates_profile` calls `public.handle_new_auth_user()` and inserts
   `profiles(user_id = new.id)` with `ON CONFLICT DO NOTHING`.
2. `auth_user_creates_subscription` calls `public.handle_new_auth_subscription()`
   and inserts `subscriptions(user_id, plan_code, status, source)` as
   `(new.id, 'FREE', 'ACTIVE', 'SYSTEM')`, also conflict-safe.

Both trigger functions are `SECURITY DEFINER` with an empty `search_path`.

## Non-sensitive seed-state audit

Canonical plans, all active:

| Code | Display name | Rank |
| --- | --- | --- |
| `FREE` | Free | 10 |
| `WEATHER` | Weather | 20 |
| `PRO` | Pro | 30 |
| `PREMIUM` | Premium | 40 |

Feature catalog by category and rollout:

| Category | Rollout | Keys |
| --- | --- | --- |
| `ai` | DISABLED | `ai.assistant` |
| `community` | ACTIVE | `community.read` |
| `community` | DISABLED | `community.write` |
| `export` | ACTIVE | `export.data` |
| `history` | FUTURE | `history.basic`, `history.extended` |
| `market` | ACTIVE | `market.core` |
| `market` | FUTURE | `dominance.basic`, `macro.dxy`, `market.expanded` |
| `satellite` | FUTURE | `satellite.as2`, `satellite.as3` |
| `viewer` | ACTIVE | `viewer.access`, `viewer.professional_details` |
| `weather` | ACTIVE | `weather.basic` |
| `weather` | FUTURE | `weather.expanded` |

Enabled entitlement sets:

- `FREE`: `community.read`, `dominance.basic`, `market.core`, `weather.basic`.
- `WEATHER`: `community.read`, `dominance.basic`, `history.basic`, `macro.dxy`,
  `market.core`, `market.expanded`, `weather.basic`, `weather.expanded`.
- `PRO`: `community.read`, `dominance.basic`, `history.basic`,
  `history.extended`, `macro.dxy`, `market.core`, `market.expanded`,
  `viewer.access`, `viewer.professional_details`, `weather.basic`,
  `weather.expanded`.
- `PREMIUM`: the PRO-style core set plus `export.data`, `satellite.as2`, and
  `satellite.as3` (14 enabled features total).

## Local conflict assessment

`migrations/20260908113000_create_member_community.sql` is **conflicting** with
this Production baseline:

- Its `profiles` declaration is a different shape (`nickname`, `avatar_url`,
  `language`, `plan`, referral and XP fields) and conflicts with the existing
  privacy/contact profile table. `CREATE TABLE IF NOT EXISTS` would hide this
  incompatibility, then later references and policies would fail or be unsafe.
- It places plan state in `profiles.plan` and recognizes `PLUS`; Production has
  no `profiles.plan`, uses `subscriptions.plan_code`, and has `WEATHER` instead.
- It replaces the existing auth profile trigger with a different function and
  does not preserve the existing automatic FREE subscription trigger.
- `community_roles` does not exist in the audited Production table list. Its
  proposed creation is a separate future design decision, not a reconciliation
  action.
- Its public profile-read policy conflicts with the current user-owned PII
  profile policy and must not be applied.

`migrations/20260908170000_verify_as1_dominance_canonical_identity.sql` is
**separate** from membership. It is not listed in remote migration history and
performs data updates after strict AS1 preflight checks. It remains outside this
reference snapshot and requires its own Production change review.

## Required next review

1. Treat this reference as the baseline for clean environments; do not run it on
   Production.
2. Replace or split the local community migration before any apply attempt so it
   extends the existing profile/subscription contract instead of redefining it.
3. Add an entitlement resolver only after Auth client configuration is approved;
   server-side protected data must check the effective subscription and enabled
   feature before sending a locked payload.
