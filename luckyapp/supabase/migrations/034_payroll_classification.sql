-- ============================================================
-- 034: Payroll classification + employer burden
-- Run in Supabase SQL Editor → New Query
-- ============================================================
-- Why this exists:
--   The /team page treats every member as a W-2 employee with a flat
--   hourly rate, so "Pay" understates what the business actually spends
--   on labor (payroll tax + workers comp can add 12-18% on top of gross).
--   It also gets owners and 1099 vendors wrong — they don't trigger
--   employer-side payroll tax.
--
-- Model:
--   - team_members.payroll_classification enum:
--       'w2_employee'      → gross + FICA + FUTA + SUTA + WC (default)
--       '1099_contractor'  → vendor invoice; no employer payroll tax
--       'owner_excluded'   → LLC owner taking draws; not on payroll
--   - Federal/state burden percentages live in code (finance.js) — they're
--     law, not user-configurable. Only the WC rate (carrier-specific) is
--     stored on the org via the existing organizations.settings JSONB:
--       settings.payroll = {
--         wcClassCode:      '0042',          -- NCCI Landscape Gardening
--         wcRatePer100:     null,            -- $/100 of payroll, real number once policy bound
--         wcExperienceMod:  1.00,            -- new business default
--         wcCarrier:        '',              -- 'Farm Bureau' once bound
--         wcEstimatePct:    0.05,            -- 5% placeholder when wcRatePer100 is null
--       }
--     No schema change needed for the org — settings JSONB already exists.
-- ============================================================

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS payroll_classification TEXT NOT NULL DEFAULT 'w2_employee'
  CHECK (payroll_classification IN ('w2_employee', '1099_contractor', 'owner_excluded'));

COMMENT ON COLUMN team_members.payroll_classification IS
  'How this person is paid for tax purposes. w2_employee = on payroll, employer pays FICA/FUTA/SUTA/WC on top of gross. 1099_contractor = invoiced as vendor, no employer tax (issue 1099-NEC at year-end). owner_excluded = LLC owner draw, not payroll.';

-- ============================================================
-- OPTIONAL one-time setup for Lucky Landscapes specifically.
-- Uncomment + run after the column is added if you want to flip the
-- two known non-W2 people right away. Safe to skip and do via the UI.
-- ============================================================
-- UPDATE team_members SET payroll_classification = '1099_contractor'
--   WHERE email = 'macoy.w@outlook.com';
-- UPDATE team_members SET payroll_classification = 'owner_excluded'
--   WHERE email = 'rileykopf@luckylandscapes.com';
