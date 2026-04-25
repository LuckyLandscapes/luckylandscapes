-- ============================================================
-- Lucky Landscapes — Break Time Tracking Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add break_minutes column to time_entries
-- This tracks unpaid break time taken during a shift (in minutes).
-- Legal break options are presented to workers at clock-out time.
-- Break minutes are deducted from paid hours in labor cost calculations.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;

-- Add a comment for documentation
COMMENT ON COLUMN time_entries.break_minutes IS 'Unpaid break time in minutes, deducted from total shift hours for payroll';

SELECT 'Migration complete! break_minutes column added to time_entries.' AS status;
