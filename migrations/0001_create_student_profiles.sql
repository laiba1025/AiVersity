-- Migration: create student_profiles table
CREATE TABLE IF NOT EXISTS student_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  program TEXT NOT NULL,
  current_semester INTEGER,
  curriculum JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index on user_id for quick lookup
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);
