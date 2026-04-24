-- ============================================
-- Fix team_members role constraint
-- Run this in Supabase SQL Editor (one time)
-- ============================================
-- The original CHECK constraint only allows a few roles.
-- The app uses 'worker' which isn't in the list, causing silent insert failures.

-- Drop the old constraint (works regardless of which migration created it)
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;

-- Add updated constraint with ALL roles the app uses
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check 
  CHECK (role IN ('owner','admin','worker','member','viewer','sales','crew_lead','crew'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint 
WHERE conrelid = 'team_members'::regclass AND contype = 'c';
