-- AiLynx member/community MVP.  This migration intentionally does not touch AS1 tables.
create extension if not exists pgcrypto;

create or replace function public.new_referral_code()
returns text language sql volatile as $$
  select upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique,
  avatar_url text,
  language text not null default 'ko' check (language in ('ko', 'en')),
  plan text not null default 'FREE' check (plan in ('FREE', 'PLUS', 'PREMIUM', 'PRO')),
  referral_code text not null unique default public.new_referral_code() check (referral_code ~ '^[A-Z0-9]{12}$'),
  referred_by uuid references public.profiles(user_id),
  community_xp integer not null default 0 check (community_xp >= 0),
  community_level integer not null default 1 check (community_level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_roles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('MODERATOR', 'ADMIN')),
  created_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(user_id),
  referred_user_id uuid not null unique references public.profiles(user_id),
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_user_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'HIDDEN', 'DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1500),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'HIDDEN', 'DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  reaction text not null check (char_length(reaction) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, reaction)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  target_kind text not null check (target_kind in ('POST', 'COMMENT', 'CHAT')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_kind, target_id)
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  title text not null check (char_length(title) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.chat_rooms (slug, title) values ('general', 'General') on conflict (slug) do nothing;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 800),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'HIDDEN', 'DELETED')),
  created_at timestamptz not null default now()
);

create table if not exists public.community_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  event_type text not null check (event_type in ('POST_CREATED', 'COMMENT_CREATED', 'CHAT_PARTICIPATION', 'REACTION_RECEIVED', 'REFERRAL_SUCCESS')),
  source_kind text not null,
  source_id uuid not null,
  xp_delta integer not null check (xp_delta <> 0),
  created_at timestamptz not null default now(),
  unique (user_id, event_type, source_kind, source_id)
);

create index if not exists community_posts_visible_idx on public.community_posts (status, created_at desc);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, created_at desc);

create or replace function public.is_community_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_roles where user_id = auth.uid());
$$;

create or replace function public.ensure_community_text()
returns trigger language plpgsql as $$
begin
  if new.content ~* '(https?://[^[:space:]]+[[:space:]]+){2,}' then
    raise exception 'COMMUNITY_URL_SPAM_REJECTED';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_community_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent_count integer;
begin
  if tg_table_name = 'chat_messages' then
    select count(*) into recent_count from public.chat_messages where author_id = new.author_id and created_at > now() - interval '1 minute';
    if recent_count >= 6 then raise exception 'CHAT_RATE_LIMITED'; end if;
  elsif tg_table_name = 'community_comments' then
    select count(*) into recent_count from public.community_comments where author_id = new.author_id and created_at > now() - interval '1 minute';
    if recent_count >= 6 then raise exception 'COMMENT_RATE_LIMITED'; end if;
  else
    select count(*) into recent_count from public.community_posts where author_id = new.author_id and created_at > now() - interval '1 minute';
    if recent_count >= 2 then raise exception 'POST_RATE_LIMITED'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.award_community_xp(p_user_id uuid, p_event text, p_source_kind text, p_source_id uuid, p_xp integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_xp_events (user_id, event_type, source_kind, source_id, xp_delta)
  values (p_user_id, p_event, p_source_kind, p_source_id, p_xp)
  on conflict (user_id, event_type, source_kind, source_id) do nothing;
  if found then
    update public.profiles set community_xp = community_xp + p_xp,
      community_level = greatest(1, floor(sqrt((community_xp + p_xp) / 100.0))::integer + 1), updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.on_community_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award_community_xp(new.author_id,
    case tg_table_name when 'community_posts' then 'POST_CREATED' when 'community_comments' then 'COMMENT_CREATED' else 'CHAT_PARTICIPATION' end,
    tg_table_name, new.id,
    case tg_table_name when 'community_posts' then 10 when 'community_comments' then 3 else 1 end);
  return new;
end;
$$;

create trigger community_posts_text before insert or update of content on public.community_posts for each row execute function public.ensure_community_text();
create trigger community_comments_text before insert or update of content on public.community_comments for each row execute function public.ensure_community_text();
create trigger chat_messages_text before insert or update of content on public.chat_messages for each row execute function public.ensure_community_text();
create trigger community_posts_rate before insert on public.community_posts for each row execute function public.enforce_community_rate_limit();
create trigger community_comments_rate before insert on public.community_comments for each row execute function public.enforce_community_rate_limit();
create trigger chat_messages_rate before insert on public.chat_messages for each row execute function public.enforce_community_rate_limit();
create trigger community_posts_xp after insert on public.community_posts for each row execute function public.on_community_activity();
create trigger community_comments_xp after insert on public.community_comments for each row execute function public.on_community_activity();
create trigger chat_messages_xp after insert on public.chat_messages for each row execute function public.on_community_activity();

create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, avatar_url) values (new.id, new.raw_user_meta_data ->> 'avatar_url') on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_profile();

create or replace function public.complete_community_onboarding(p_nickname text, p_language text, p_referral_code text default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare target uuid; result public.profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_nickname !~ '^[A-Za-z0-9가-힣_]{3,24}$' then raise exception 'INVALID_NICKNAME'; end if;
  if p_language not in ('ko', 'en') then raise exception 'INVALID_LANGUAGE'; end if;
  if exists (select 1 from public.profiles where nickname = p_nickname and user_id <> auth.uid()) then raise exception 'NICKNAME_TAKEN'; end if;
  select user_id into target from public.profiles where referral_code = upper(coalesce(p_referral_code, ''));
  if target = auth.uid() then raise exception 'SELF_REFERRAL_REJECTED'; end if;
  if p_referral_code is not null and target is null then raise exception 'REFERRAL_NOT_FOUND'; end if;
  update public.profiles set nickname = p_nickname, language = p_language, referred_by = coalesce(referred_by, target), updated_at = now()
    where user_id = auth.uid() returning * into result;
  if target is not null and result.referred_by = target then
    insert into public.referral_events (referrer_id, referred_user_id) values (target, auth.uid()) on conflict (referred_user_id) do nothing;
    if found then perform public.award_community_xp(target, 'REFERRAL_SUCCESS', 'referral', auth.uid(), 25); end if;
  end if;
  return result;
end;
$$;

alter table public.profiles enable row level security;
alter table public.community_roles enable row level security;
alter table public.referral_events enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.community_xp_events enable row level security;

create policy profiles_public_read on public.profiles for select using (true);
create policy posts_read on public.community_posts for select using (status = 'ACTIVE' or author_id = auth.uid() or public.is_community_moderator());
create policy posts_insert on public.community_posts for insert with check (author_id = auth.uid() and status = 'ACTIVE');
create policy posts_update on public.community_posts for update using (author_id = auth.uid() or public.is_community_moderator()) with check (author_id = auth.uid() or public.is_community_moderator());
create policy comments_read on public.community_comments for select using (status = 'ACTIVE' or author_id = auth.uid() or public.is_community_moderator());
create policy comments_insert on public.community_comments for insert with check (author_id = auth.uid() and status = 'ACTIVE');
create policy comments_update on public.community_comments for update using (author_id = auth.uid() or public.is_community_moderator()) with check (author_id = auth.uid() or public.is_community_moderator());
create policy reactions_read on public.community_reactions for select using (true);
create policy reactions_insert on public.community_reactions for insert with check (user_id = auth.uid());
create policy reactions_delete on public.community_reactions for delete using (user_id = auth.uid());
create policy reports_insert on public.community_reports for insert with check (reporter_id = auth.uid());
create policy reports_read_own on public.community_reports for select using (reporter_id = auth.uid() or public.is_community_moderator());
create policy rooms_read on public.chat_rooms for select using (is_active or public.is_community_moderator());
create policy chat_read on public.chat_messages for select using (status = 'ACTIVE' or author_id = auth.uid() or public.is_community_moderator());
create policy chat_insert on public.chat_messages for insert with check (author_id = auth.uid() and status = 'ACTIVE' and exists (select 1 from public.chat_rooms where id = room_id and is_active));
create policy chat_update on public.chat_messages for update using (author_id = auth.uid() or public.is_community_moderator()) with check (author_id = auth.uid() or public.is_community_moderator());
create policy xp_read_own on public.community_xp_events for select using (user_id = auth.uid());

revoke all on public.profiles, public.community_roles, public.referral_events, public.community_posts, public.community_comments, public.community_reactions, public.community_reports, public.chat_rooms, public.chat_messages, public.community_xp_events from anon;
grant select on public.profiles, public.community_posts, public.community_comments, public.community_reactions, public.chat_rooms, public.chat_messages to authenticated;
grant insert, update on public.community_posts, public.community_comments, public.community_reactions, public.community_reports, public.chat_messages to authenticated;
grant execute on function public.complete_community_onboarding(text, text, text) to authenticated;

alter publication supabase_realtime add table public.chat_messages;
