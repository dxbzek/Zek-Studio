-- Production role assignments on calendar entries (all optional)
alter table public.calendar_entries
  add column if not exists assigned_editor   text,  -- team member email
  add column if not exists assigned_shooter  text,  -- team member email
  add column if not exists assigned_talent   text;  -- team member email (on-screen person)
