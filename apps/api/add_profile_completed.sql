-- Add profile_completed flag to track setup status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- Create an index for faster queries during auth routing
CREATE INDEX IF NOT EXISTS idx_profiles_profile_completed ON profiles(profile_completed);
