# Member and Community MVP setup

The shipped browser configuration is intentionally disabled. It contains no service-role key, OAuth secret, social URL, or user-upload path.

## Database migration

`supabase/pending-migrations/20260908113000_create_member_community.sql` is intentionally excluded from the migration runner. It conflicts with the audited Production membership baseline, so do **not** run, repair-history-mark, or move it back into `supabase/migrations/` without a separately approved replacement design.

The migration creates the profile, referral, text-only posts/comments/reactions/reports, one general chat room/messages, roles, and XP event ledger. It enables RLS for every user-owned table. It does not change the AS1 raw ledger, ingest, TradingView, or existing weather tables.

## Auth configuration

Set `enabled: true` and the Supabase publishable/anon key in `community-config.js` only after Auth and redirect URLs are configured in Supabase. The key is public browser configuration; never place a service-role key or provider client secret in this repository.

- Google: configure its Supabase Auth provider and Google OAuth credentials, then set `providers.google` to `AVAILABLE`.
- Kakao: configure its Supabase Auth provider and Kakao credentials, then set `providers.kakao` to `AVAILABLE`.
- Toss: remains `COMING_SOON` until a reviewed server-side integration and credentials exist.
- ChatGPT: remains `COMING_SOON` until AiLynx has confirmed access to OpenAI's official Sign in with ChatGPT program and its approved integration details. Do not substitute Google OAuth or invent an OAuth endpoint.

Before enabling account creation, provide final Privacy/Terms content or URLs and confirm the onboarding consent wording.

## Official social links and emoji

Set YouTube, Discord, and Telegram only to official URLs supplied by AiLynx. Add only administrator-managed custom emoji to the `emojiManifest` in `community-config.js`; no user upload or Storage bucket is part of this MVP.
