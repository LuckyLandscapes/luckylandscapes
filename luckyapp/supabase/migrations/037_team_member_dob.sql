-- 037_team_member_dob.sql
--
-- Add date_of_birth to team_members so the app can flag FLSA child-labor
-- compliance issues. This is NOT a payroll-tax field — non-family W-2
-- employees owe full FICA/FUTA regardless of age. The relevant federal
-- rules that ARE age-driven:
--
--   - Under 18 cannot operate riding mowers >20HP, chainsaws, wood
--     chippers, trenchers, or other "hazardous occupations" listed in
--     29 CFR 570.50–570.68. Half of Lucky's crew are HS juniors so this
--     matters.
--   - Under 16: hour caps during the school year (3hr/school day,
--     18hr/school week, 8hr/non-school day per 29 CFR 570.35).
--   - Under 20: federal subminimum training wage for first 90 days
--     (FLSA §6(g)) — legal but rarely used.
--
-- The column is nullable because existing rows have no DOB and we're not
-- forcing a backfill. UI surfaces "DOB not set" prompts on team rows
-- where it's missing.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN team_members.date_of_birth IS
  'Used for FLSA child-labor compliance flags (hazardous-task restrictions, school-year hour caps). Not a tax field.';
