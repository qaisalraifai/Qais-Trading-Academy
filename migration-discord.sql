-- شغّلي هاد بـ Supabase → SQL Editor → New Query → Run

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS discord_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_username TEXT;
