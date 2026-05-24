-- 045_job_wc_class.sql
--
-- Add an insurance class-code tag to each job so payroll + revenue can be
-- split by workers'-comp / general-liability classification at audit time.
--
-- Why this saves money: WC premium = payroll × rate-per-$100 per class code,
-- and GL premium is often revenue × rate-per-$1,000 per class code. Masonry /
-- hardscaping rates run far higher than lawn care. If you can't PROVE the
-- split with records, the carrier dumps ALL your payroll into the highest-rated
-- code (masonry) at audit. A per-job classification that rolls up to actual
-- payroll-by-code from time records is the audit-defensible record that lets
-- you pay the correct (lower) blended premium.
--
-- `wc_class` is a stable string KEY (e.g. 'masonry', 'landscape_gardening',
-- 'lawn_care'), NOT the raw code number — the human-facing code number + rates
-- live on organizations.settings.payroll.wcClasses (existing JSONB, no schema
-- change) so Riley can correct a code number without orphaning tagged jobs.
-- See src/lib/finance.js DEFAULT_WC_CLASSES + getWcClasses().
--
-- Nullable: existing rows have no class. The /insurance report buckets NULL
-- (and any unrecognized key) under "Unclassified" so they're visible and can
-- be tagged. New jobs created from a quote auto-inherit a class from the
-- quote category (Hardscaping→masonry, Lawn Care→lawn_care, etc.).

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS wc_class TEXT;

COMMENT ON COLUMN jobs.wc_class IS
  'Insurance class-code key (masonry | landscape_gardening | lawn_care). Code numbers + rates live on organizations.settings.payroll.wcClasses. Drives the /insurance payroll-and-revenue-by-code audit report.';
