-- Backfill `format` for entries that pre-date the column (format is null).
--
-- Platform-based inference: TikTok / YouTube / Instagram are video-first
-- in the brand's actual posting mix, so default to reel. LinkedIn /
-- Facebook / Twitter default to static. Users can edit any entry to a
-- different format afterward — the filter chips will then find them.

update public.calendar_entries
set format = case
  when platform in ('tiktok', 'youtube', 'instagram') then 'reel'
  else 'static'
end,
updated_at = now()
where format is null;
