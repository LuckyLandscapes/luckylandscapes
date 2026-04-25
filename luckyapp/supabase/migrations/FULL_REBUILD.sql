-- ============================================================================
-- 🍀 LUCKY LANDSCAPES — COMPLETE DATABASE REBUILD
-- ============================================================================
-- Run this ONCE in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Paste entire file → Run (Ctrl+Enter)
--
-- This is a consolidated script from all 12 migrations.
-- It creates everything your app needs from scratch.
-- ============================================================================


-- =============================================
-- 0. EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================
-- 1. CORE TABLES
-- =============================================

-- Organizations (multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  industry    TEXT DEFAULT 'landscaping',
  logo_url    TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  website     TEXT,
  settings    JSONB DEFAULT '{}',
  plan        TEXT DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Team Members (auth.users ↔ organizations)
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT DEFAULT 'worker'
              CHECK (role IN ('owner','admin','worker','member','viewer','sales','crew_lead','crew')),
  avatar_url  TEXT,
  hourly_rate NUMERIC(8,2) DEFAULT 15.00,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT DEFAULT 'Lincoln',
  state       TEXT DEFAULT 'NE',
  zip         TEXT,
  tags        TEXT[] DEFAULT ARRAY['lead']::TEXT[],
  notes       TEXT,
  source      TEXT DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Quotes (line items stored as JSONB)
CREATE TABLE IF NOT EXISTS quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_number  INTEGER NOT NULL DEFAULT 0,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES team_members(id) ON DELETE SET NULL,
  status        TEXT DEFAULT 'draft'
                CHECK (status IN ('draft','sent','viewed','accepted','declined','expired')),
  category      TEXT,
  project_type  TEXT,
  lot_sqft      NUMERIC,
  lot_geojson   JSONB,
  items         JSONB DEFAULT '[]'::JSONB,
  subtotal      NUMERIC(12,2) DEFAULT 0,
  tax_rate      NUMERIC(5,4) DEFAULT 0,
  tax           NUMERIC(12,2) DEFAULT 0,
  discount      NUMERIC(12,2) DEFAULT 0,
  total         NUMERIC(12,2) DEFAULT 0,
  notes         TEXT,
  internal_notes TEXT,
  valid_days    INT DEFAULT 30,
  sent_at       TIMESTAMPTZ,
  viewed_at     TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Services Catalog
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT DEFAULT 'each',
  default_price NUMERIC(10,2) DEFAULT 0,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Materials Catalog
CREATE TABLE IF NOT EXISTS materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  subcategory   TEXT,
  name          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT,
  unit_alt      TEXT,
  cost_low      NUMERIC(10,4) DEFAULT 0,
  cost_high     NUMERIC(10,4) DEFAULT 0,
  supplier      TEXT,
  image_url     TEXT,
  image_emoji   TEXT,
  image         TEXT,
  is_favorite   BOOLEAN DEFAULT false,
  sold_out      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_id      UUID REFERENCES quotes(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  created_by    UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- =============================================
-- 2. JOBS & CALENDAR
-- =============================================

-- Jobs (converted from accepted quotes)
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id            UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  status              TEXT DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  description         TEXT,
  address             TEXT,
  scheduled_date      DATE,
  scheduled_time      TIME,
  estimated_duration  INTERVAL DEFAULT '4 hours',
  assigned_to         UUID[] DEFAULT ARRAY[]::UUID[],
  crew_notes          TEXT,
  total               NUMERIC(12,2) DEFAULT 0,
  revenue             NUMERIC(12,2) DEFAULT 0,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  type            TEXT DEFAULT 'other'
                  CHECK (type IN ('quote_appointment','job','meeting','other')),
  date            DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  all_day         BOOLEAN DEFAULT false,
  color           TEXT DEFAULT '#3a9c4a',
  notes           TEXT,
  assigned_to     JSONB DEFAULT '[]'::JSONB,
  google_event_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);


-- =============================================
-- 3. TIME TRACKING & FINANCIALS
-- =============================================

-- Time Entries (crew clock in/out)
CREATE TABLE IF NOT EXISTS time_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  job_id            UUID REFERENCES jobs(id) ON DELETE SET NULL,
  clock_in          TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out         TIMESTAMPTZ,
  duration_minutes  INTEGER,
  break_minutes     INTEGER DEFAULT 0,
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Job Expenses (per-job costs)
CREATE TABLE IF NOT EXISTS job_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  category        TEXT NOT NULL
                  CHECK (category IN ('materials','equipment','fuel','dump_fees','subcontractor','permits','other')),
  description     TEXT NOT NULL DEFAULT '',
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  receipt_url     TEXT,
  created_by      UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unpaid'
                  CHECK (status IN ('unpaid','partial','paid','overdue','cancelled')),
  subtotal        NUMERIC(12,2) DEFAULT 0,
  tax_rate        NUMERIC(5,4) DEFAULT 0,
  tax             NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) DEFAULT 0,
  amount_paid     NUMERIC(12,2) DEFAULT 0,
  due_date        DATE,
  paid_date       DATE,
  items           JSONB DEFAULT '[]'::JSONB,
  notes           TEXT,
  payment_method  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Job Media (photos/videos)
CREATE TABLE IF NOT EXISTS job_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by     UUID,
  file_path       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size       BIGINT DEFAULT 0,
  thumbnail_url   TEXT,
  caption         TEXT DEFAULT '',
  pinned          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Company Expenses (overhead / non-job costs)
CREATE TABLE IF NOT EXISTS company_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category            TEXT NOT NULL CHECK (category IN (
    'vehicle','insurance','rent','utilities','software','marketing',
    'office_supplies','fuel','payroll_tax','other'
  )),
  description         TEXT NOT NULL DEFAULT '',
  amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring           BOOLEAN DEFAULT false,
  recurring_interval  TEXT CHECK (recurring_interval IN ('weekly','biweekly','monthly','quarterly','yearly')),
  receipt_url         TEXT,
  vendor              TEXT,
  created_by          UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);


-- =============================================
-- 4. HELPER FUNCTIONS
-- =============================================

-- Get the current user's org_id (used by ALL RLS policies)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id FROM team_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Auto-increment quote numbers per org
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = 0 THEN
    SELECT COALESCE(MAX(quote_number), 1000) + 1
    INTO NEW.quote_number
    FROM quotes
    WHERE org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Onboarding RPC: creates org + team member, bypassing RLS for first-time users
CREATE OR REPLACE FUNCTION create_org_and_member(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_org_email TEXT,
  p_user_id UUID,
  p_full_name TEXT,
  p_member_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_member_id UUID;
  v_existing_member RECORD;
BEGIN
  -- Check if user already has a team membership
  SELECT tm.id, tm.org_id, o.name AS org_name, o.slug AS org_slug, o.industry AS org_industry, tm.full_name, tm.role
  INTO v_existing_member
  FROM team_members tm
  JOIN organizations o ON o.id = tm.org_id
  WHERE tm.user_id = p_user_id AND tm.is_active = true
  LIMIT 1;

  IF v_existing_member.id IS NOT NULL THEN
    RETURN json_build_object(
      'member_id', v_existing_member.id,
      'org_id', v_existing_member.org_id,
      'org_name', v_existing_member.org_name,
      'org_slug', v_existing_member.org_slug,
      'org_industry', v_existing_member.org_industry,
      'full_name', v_existing_member.full_name,
      'role', v_existing_member.role
    );
  END IF;

  -- Create org
  INSERT INTO organizations (name, slug, email, industry)
  VALUES (p_org_name, p_org_slug, p_org_email, 'landscaping')
  RETURNING id INTO v_org_id;

  -- Create team member as owner
  INSERT INTO team_members (org_id, user_id, full_name, email, role)
  VALUES (v_org_id, p_user_id, p_full_name, p_member_email, 'owner')
  RETURNING id INTO v_member_id;

  RETURN json_build_object(
    'member_id', v_member_id,
    'org_id', v_org_id,
    'org_name', p_org_name,
    'org_slug', p_org_slug,
    'org_industry', 'landscaping',
    'full_name', p_full_name,
    'role', 'owner'
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_org_and_member TO authenticated;

-- Auto-cleanup old unpinned job media (30 days)
CREATE OR REPLACE FUNCTION cleanup_old_job_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM job_media
  WHERE created_at < now() - interval '30 days'
    AND pinned = false;
END;
$$;


-- =============================================
-- 5. TRIGGERS
-- =============================================

-- Quote number auto-increment
CREATE TRIGGER trigger_set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_number();

-- updated_at auto-update
CREATE TRIGGER trigger_organizations_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_customers_updated
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_quotes_updated
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_team_members_updated
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================
-- 6. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_expenses ENABLE ROW LEVEL SECURITY;

-- ---- ORGANIZATIONS ----
CREATE POLICY "org_insert" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "org_read" ON organizations FOR SELECT
  TO authenticated USING (id = get_user_org_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE
  TO authenticated USING (id = get_user_org_id());

-- ---- TEAM MEMBERS ----
CREATE POLICY "team_insert" ON team_members FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "team_read" ON team_members FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR org_id = get_user_org_id());
CREATE POLICY "team_update" ON team_members FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- CUSTOMERS ----
CREATE POLICY "customers_select" ON customers FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- QUOTES ----
CREATE POLICY "quotes_select" ON quotes FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "quotes_insert" ON quotes FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "quotes_delete" ON quotes FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- SERVICES ----
CREATE POLICY "services_select" ON services FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "services_insert" ON services FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "services_update" ON services FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "services_delete" ON services FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- MATERIALS ----
CREATE POLICY "materials_select" ON materials FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "materials_insert" ON materials FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "materials_update" ON materials FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "materials_delete" ON materials FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- ACTIVITY ----
CREATE POLICY "activity_select" ON activity FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "activity_insert" ON activity FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "activity_delete" ON activity FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- JOBS ----
CREATE POLICY "jobs_select" ON jobs FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "jobs_insert" ON jobs FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "jobs_update" ON jobs FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "jobs_delete" ON jobs FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- CALENDAR EVENTS ----
CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- TIME ENTRIES ----
-- Members see their own; admins/owners see all in org
CREATE POLICY "time_entries_select_own" ON time_entries FOR SELECT
  TO authenticated
  USING (member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "time_entries_select_admin" ON time_entries FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT org_id FROM team_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin') AND is_active = true
  ));

CREATE POLICY "time_entries_insert" ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (member_id IN (
    SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "time_entries_update_own" ON time_entries FOR UPDATE
  TO authenticated
  USING (member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "time_entries_update_admin" ON time_entries FOR UPDATE
  TO authenticated
  USING (org_id IN (
    SELECT org_id FROM team_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin') AND is_active = true
  ));

CREATE POLICY "time_entries_delete" ON time_entries FOR DELETE
  TO authenticated
  USING (org_id IN (
    SELECT org_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  ));

-- ---- JOB EXPENSES ----
CREATE POLICY "job_expenses_select" ON job_expenses FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "job_expenses_insert" ON job_expenses FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "job_expenses_update" ON job_expenses FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "job_expenses_delete" ON job_expenses FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- INVOICES ----
CREATE POLICY "invoices_all" ON invoices FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

-- ---- JOB MEDIA ----
CREATE POLICY "job_media_select" ON job_media FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "job_media_insert" ON job_media FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "job_media_update" ON job_media FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "job_media_delete" ON job_media FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ---- COMPANY EXPENSES ----
CREATE POLICY "company_expenses_select" ON company_expenses FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "company_expenses_insert" ON company_expenses FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "company_expenses_update" ON company_expenses FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "company_expenses_delete" ON company_expenses FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());


-- =============================================
-- 7. INDEXES (performance)
-- =============================================

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Team Members
CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);

-- Quotes
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);

-- Services
CREATE INDEX IF NOT EXISTS idx_services_org ON services(org_id);

-- Materials
CREATE INDEX IF NOT EXISTS idx_materials_org ON materials(org_id);

-- Activity
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_customer ON activity(customer_id);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote ON jobs(quote_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Calendar Events
CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_job ON calendar_events(job_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);

-- Time Entries
CREATE INDEX IF NOT EXISTS idx_time_entries_org ON time_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_member ON time_entries(member_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);

-- Job Expenses
CREATE INDEX IF NOT EXISTS idx_job_expenses_org ON job_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_job_expenses_job ON job_expenses(job_id);
CREATE INDEX IF NOT EXISTS idx_job_expenses_category ON job_expenses(category);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Job Media
CREATE INDEX IF NOT EXISTS idx_job_media_org ON job_media(org_id);
CREATE INDEX IF NOT EXISTS idx_job_media_job ON job_media(job_id);
CREATE INDEX IF NOT EXISTS idx_job_media_created ON job_media(created_at);

-- Company Expenses
CREATE INDEX IF NOT EXISTS idx_company_expenses_org ON company_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_company_expenses_date ON company_expenses(date);
CREATE INDEX IF NOT EXISTS idx_company_expenses_category ON company_expenses(category);

-- Jobs completed_at
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at ON jobs(completed_at);


-- =============================================
-- 8. STORAGE BUCKETS
-- =============================================

-- Job media bucket (photos/videos — 50 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('job-media', 'job-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Quote PDFs bucket (5 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('quote-pdfs', 'quote-pdfs', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Drop old storage policies first (these survive a database nuke)
DROP POLICY IF EXISTS "job_media_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "job_media_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "job_media_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "job_media_storage_all" ON storage.objects;
DROP POLICY IF EXISTS "quote_pdfs_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "quote_pdfs_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "quote_pdfs_storage_all" ON storage.objects;
-- Also drop any old policy names from previous migrations
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role full access" ON storage.objects;

-- Storage policies: job-media
CREATE POLICY "job_media_storage_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'job-media');
CREATE POLICY "job_media_storage_select" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'job-media');
CREATE POLICY "job_media_storage_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'job-media');
CREATE POLICY "job_media_storage_all" ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'job-media') WITH CHECK (bucket_id = 'job-media');

-- Storage policies: quote-pdfs
CREATE POLICY "quote_pdfs_storage_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'quote-pdfs');
CREATE POLICY "quote_pdfs_storage_select" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'quote-pdfs');
CREATE POLICY "quote_pdfs_storage_all" ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'quote-pdfs') WITH CHECK (bucket_id = 'quote-pdfs');


-- =============================================
-- 9. REALTIME (live updates in the app)
-- =============================================
-- Wrapped in DO blocks so it won't fail if tables are already in the publication
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE customers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE quotes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE activity; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE jobs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE time_entries; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE job_expenses; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoices; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE job_media; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE company_expenses; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================
-- ✅ DONE! Your database is fully rebuilt.
-- =============================================
-- Next steps:
--   1. Log in to your Lucky App — it will auto-create your org & team member
--   2. If you had pg_cron enabled before, re-enable it and run:
--      SELECT cron.schedule('cleanup-old-job-media', '0 3 * * *', 'SELECT cleanup_old_job_media()');
-- =============================================
