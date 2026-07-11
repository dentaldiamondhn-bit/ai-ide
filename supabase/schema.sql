-- ============================================================
-- AI-IDE Database Schema (clean install)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop existing tables if they exist (order matters for FKs)
DROP TABLE IF EXISTS ai_ide_chats CASCADE;
DROP TABLE IF EXISTS ai_ide_settings CASCADE;
DROP TABLE IF EXISTS skills CASCADE;

-- 1. Chats table
CREATE TABLE ai_ide_chats (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Chat',
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  model       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_ide_chats_user_id ON ai_ide_chats(user_id);
CREATE INDEX idx_ai_ide_chats_updated_at ON ai_ide_chats(updated_at DESC);

ALTER TABLE ai_ide_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chats"
  ON ai_ide_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chats"
  ON ai_ide_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats"
  ON ai_ide_chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats"
  ON ai_ide_chats FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on chats"
  ON ai_ide_chats FOR ALL
  USING (true)
  WITH CHECK (true);


-- 2. Settings table
CREATE TABLE ai_ide_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL DEFAULT 'app_settings',
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

CREATE INDEX idx_ai_ide_settings_user_id ON ai_ide_settings(user_id);

ALTER TABLE ai_ide_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON ai_ide_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own settings"
  ON ai_ide_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON ai_ide_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on settings"
  ON ai_ide_settings FOR ALL
  USING (true)
  WITH CHECK (true);


-- 3. Skills table
CREATE TABLE skills (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  prompt      TEXT DEFAULT '',
  category    TEXT DEFAULT '',
  tags        JSONB DEFAULT '[]'::jsonb,
  is_public   BOOLEAN DEFAULT true,
  created_by  UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  version     INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_category ON skills(category);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public skills"
  ON skills FOR SELECT
  USING (is_public = true);

CREATE POLICY "Authenticated users can create skills"
  ON skills FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update skills"
  ON skills FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete skills"
  ON skills FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access on skills"
  ON skills FOR ALL
  USING (true)
  WITH CHECK (true);


-- 4. Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ai_ide_chats_updated_at
  BEFORE UPDATE ON ai_ide_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_ai_ide_settings_updated_at
  BEFORE UPDATE ON ai_ide_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
