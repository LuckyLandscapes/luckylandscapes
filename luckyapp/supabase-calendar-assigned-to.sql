-- ============================================================
-- Migration: Add assigned_to column to calendar_events table
-- Purpose: Allow calendar events to track which team members
--          are assigned, so workers can see their scheduled work.
-- ============================================================

-- Add assigned_to column (jsonb array of team_member IDs)
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS assigned_to jsonb DEFAULT '[]'::jsonb;

-- Optional: Copy assigned_to from linked jobs (for existing events)
-- UPDATE calendar_events ce
-- SET assigned_to = j.assigned_to
-- FROM jobs j
-- WHERE ce.job_id = j.id AND ce.assigned_to = '[]'::jsonb;
