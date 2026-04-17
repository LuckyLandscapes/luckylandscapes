-- ============================================================
-- Lucky App — Full Database Schema
-- Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  email       TEXT,
  phone       TEXT,
  industry    TEXT DEFAULT 'landscaping',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Team Members (links auth.users → organizations)
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,  -- references auth.users(id)
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  avatar_url  TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 3. Customers
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  tags        TEXT[] DEFAULT ARRAY['lead']::TEXT[],
  notes       TEXT,
  source      TEXT DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 4. Quotes (line items stored as JSONB array)
CREATE TABLE IF NOT EXISTS quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_number  INTEGER NOT NULL,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','declined')),
  category      TEXT,
  items         JSONB DEFAULT '[]'::JSONB,
  total         NUMERIC(12,2) DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Auto-increment quote numbers per org
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1001;

-- 5. Activity Log
CREATE TABLE IF NOT EXISTS activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_id      UUID REFERENCES quotes(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 6. Materials Catalog
CREATE TABLE IF NOT EXISTS materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  unit        TEXT,
  unit_alt    TEXT,
  cost_low    NUMERIC(10,4) DEFAULT 0,
  cost_high   NUMERIC(10,4) DEFAULT 0,
  supplier    TEXT,
  image       TEXT,
  sold_out    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 7. Services Catalog
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  unit          TEXT,
  default_price NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Helper function: get the org_id for the current authenticated user
-- ============================================================
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

-- ============================================================
-- Row Level Security — each org can only see their own data
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Organizations: members can read their own org
CREATE POLICY "org_read" ON organizations FOR SELECT
  TO authenticated
  USING (id = get_user_org_id());

-- Allow any authenticated user to create an org (signup / first-login)
CREATE POLICY "org_insert" ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow org owners to update their org
CREATE POLICY "org_update" ON organizations FOR UPDATE
  TO authenticated
  USING (id = get_user_org_id());

-- Team Members: read own org's members or own record
CREATE POLICY "team_read" ON team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR org_id = get_user_org_id());

-- Allow authenticated users to insert their own membership
CREATE POLICY "team_insert" ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Customers: full CRUD for org members
CREATE POLICY "customers_select" ON customers FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (org_id = get_user_org_id());

-- Quotes: full CRUD for org members
CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "quotes_insert" ON quotes FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "quotes_update" ON quotes FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "quotes_delete" ON quotes FOR DELETE USING (org_id = get_user_org_id());

-- Activity: full CRUD for org members
CREATE POLICY "activity_select" ON activity FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "activity_insert" ON activity FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "activity_delete" ON activity FOR DELETE USING (org_id = get_user_org_id());

-- Materials: read + manage for org members
CREATE POLICY "materials_select" ON materials FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "materials_insert" ON materials FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "materials_update" ON materials FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "materials_delete" ON materials FOR DELETE USING (org_id = get_user_org_id());

-- Services: read + manage for org members
CREATE POLICY "services_select" ON services FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "services_insert" ON services FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "services_update" ON services FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "services_delete" ON services FOR DELETE USING (org_id = get_user_org_id());

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_customer ON activity(customer_id);
CREATE INDEX IF NOT EXISTS idx_materials_org ON materials(org_id);
CREATE INDEX IF NOT EXISTS idx_services_org ON services(org_id);
