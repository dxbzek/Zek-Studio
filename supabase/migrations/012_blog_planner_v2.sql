alter table public.blog_posts
  add column if not exists content text,
  add column if not exists has_faq boolean not null default false,
  add column if not exists has_schema boolean not null default false,
  add column if not exists has_citations boolean not null default false,
  add column if not exists has_eeat boolean not null default false,
  add column if not exists has_author_bio boolean not null default false;
