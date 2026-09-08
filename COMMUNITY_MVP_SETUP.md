# Member and Community MVP setup

The shipped browser configuration is intentionally disabled. It contains no service-role key, OAuth secret, social URL, or user-upload path.

## Database migration

Apply `supabase/migrations/20260908113000_create_member_community.sql` only after reconciling the remote migration history with this clone. The current CLI dry-run reports remote versions missing locally (`20260901010000`, `20260907220000`), so do **not** run migration repair, pull, or push blindly. First audit those existing AS1-era migrations, then use the approved migration workflow to apply the new member/community migration.

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
