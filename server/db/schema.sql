-- Readoft Supabase schema (PostgreSQL)
-- Run this in Supabase SQL editor

-- Users
create table if not exists users (
  id uuid primary key,
  email text unique not null,
  password_hash text not null,
  name text not null,
  role text not null default 'reader' check (role in ('reader','author','admin')),
  bio text not null default '',
  avatar_url text not null default '',
  avatar_path text not null default '',
  created_at timestamptz not null default now()
);

-- Ensure avatar_path exists on existing databases
alter table users add column if not exists avatar_path text not null default '';

-- Articles
create table if not exists articles (
  id uuid primary key,
  title text not null,
  content text not null,
  author_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('draft','pending','published')),
  tags text[] not null default '{}',
  categories text[] not null default '{}',
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add thumbnail column for articles
alter table articles add column if not exists thumbnail_url text not null default '';
alter table articles add column if not exists thumbnail_path text not null default '';

-- Likes (unique by user/article)
create table if not exists article_likes (
  user_id uuid not null references users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- Follows
create table if not exists user_follows (
  follower_id uuid not null references users(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  check (follower_id <> author_id)
);

-- Helper functions for like counters
create or replace function increment_like_count(p_article_id uuid)
returns void language sql as $$
  update articles set like_count = like_count + 1 where id = p_article_id;
$$;

create or replace function decrement_like_count(p_article_id uuid)
returns void language sql as $$
  update articles set like_count = greatest(like_count - 1, 0) where id = p_article_id;
$$;

-- Suggested indexes
create index if not exists idx_articles_status on articles(status);
create index if not exists idx_articles_author on articles(author_id);
create index if not exists idx_articles_tags on articles using gin(tags);
create index if not exists idx_articles_categories on articles using gin(categories);

-- Categories master list
create table if not exists categories (
  id uuid primary key,
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_name on categories(name);

-- Reading history per user/article
create table if not exists article_reads (
  user_id uuid not null references users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  duration_seconds integer not null default 0,
  last_read_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
create index if not exists idx_reads_user_last on article_reads(user_id, last_read_at desc);
