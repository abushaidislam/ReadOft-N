-- Readoft demo seed for users (50 authors, 100 readers)
-- Run this in your Supabase SQL editor after applying schema.sql
-- Default password for all seeded accounts: password123

-- Needs pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Shared bcrypt hash for 'password123'
-- Generated with bcryptjs (cost 10)
-- node -e "require('bcryptjs').hash('password123',10).then(console.log)"
-- $2b$10$wLI00IhPbF7jEhhwoBzq2OLsu6YavP7i2.2egaQd6JCqAQPj5lYYq
-- Supabase SQL editor does not support psql variables (\set),
-- so we inline the hash directly below as a constant.
-- If you run via psql, you can revert to \set and use :'pwd'.

-- 50 authors
with s as (
  select g::int as n, to_char(g, 'FM000') as pad from generate_series(1,50) g
)
insert into users (id, email, password_hash, name, role, bio, avatar_url, created_at)
select 
  gen_random_uuid(),
  'author' || pad || '@seed.local',
  '$2b$10$wLI00IhPbF7jEhhwoBzq2OLsu6YavP7i2.2egaQd6JCqAQPj5lYYq',
  'Author ' || pad,
  'author',
  'I write about CS, logic and math. Author ' || pad || ' at Readoft.',
  'https://i.pravatar.cc/150?img=' || ((n - 1) % 70 + 1),
  now() - (n || ' days')::interval
from s
on conflict (email) do nothing;

-- 100 readers
with s as (
  select g::int as n, to_char(g, 'FM000') as pad from generate_series(1,100) g
)
insert into users (id, email, password_hash, name, role, bio, avatar_url, created_at)
select 
  gen_random_uuid(),
  'reader' || pad || '@seed.local',
  '$2b$10$wLI00IhPbF7jEhhwoBzq2OLsu6YavP7i2.2egaQd6JCqAQPj5lYYq',
  'Reader ' || pad,
  'reader',
  'Avid reader who follows authors and bookmarks articles. Reader ' || pad || '.',
  'https://api.dicebear.com/8.x/adventurer/png?seed=reader-' || pad,
  now() - (n || ' hours')::interval
from s
on conflict (email) do nothing;

-- Optional: mark a handful of authors as verified to showcase UI
update users
set is_verified = true
where role = 'author' and (random() < 0.2);
