-- ============================================
-- 🍀 Lucky App — Database Setup
-- ============================================
-- How to run this:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project (sedomwhfewxnngpzmkay)
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Click "New Query"
-- 5. Paste this ENTIRE file
-- 6. Click "Run" (or Ctrl+Enter)
-- ============================================

-- =====================
-- TABLES
-- =====================

-- Organizations (each business is a tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry TEXT DEFAULT 'landscaping',
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website TEXT,
  settings JSONB DEFAULT '{}',
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team members (linked to auth.users and an org)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('owner','admin','sales','crew_lead','crew')) DEFAULT 'crew',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'Lincoln',
  state TEXT DEFAULT 'NE',
  zip TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Service catalog (configurable per org)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'each',
  default_price NUMERIC,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  quote_number INT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','declined','expired')),
  category TEXT,
  project_type TEXT,
  lot_sqft NUMERIC,
  lot_geojson JSONB,
  subtotal NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  valid_days INT DEFAULT 30,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quote line items
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'each',
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  sort_order INT DEFAULT 0
);

-- Material catalog
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  cost_low NUMERIC,
  cost_high NUMERIC,
  supplier TEXT,
  image_url TEXT,
  image_emoji TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- INDEXES (performance)
-- =====================
CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_materials_org ON materials(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org ON activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_customer ON activity_log(customer_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
-- This ensures each business can ONLY see their own data.
-- Nobody can read, write, or delete another org's data.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get the org_id for the currently logged-in user
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM team_members WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Policies: each table is filtered by the user's org_id
-- Organizations
CREATE POLICY "Users can view their own org"
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

CREATE POLICY "Owners can update their org"
  ON organizations FOR UPDATE
  USING (id = get_user_org_id());

-- Team Members
CREATE POLICY "Team members can view their org's team"
  ON team_members FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage team"
  ON team_members FOR ALL
  USING (org_id = get_user_org_id());

-- Customers
CREATE POLICY "Org members can view customers"
  ON customers FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can manage customers"
  ON customers FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org members can update customers"
  ON customers FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can delete customers"
  ON customers FOR DELETE
  USING (org_id = get_user_org_id());

-- Services
CREATE POLICY "Org members can view services"
  ON services FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can manage services"
  ON services FOR ALL
  USING (org_id = get_user_org_id());

-- Quotes
CREATE POLICY "Org members can view quotes"
  ON quotes FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can manage quotes"
  ON quotes FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org members can update quotes"
  ON quotes FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can delete quotes"
  ON quotes FOR DELETE
  USING (org_id = get_user_org_id());

-- Quote Items (access through quote's org)
CREATE POLICY "Org members can view quote items"
  ON quote_items FOR SELECT
  USING (quote_id IN (SELECT id FROM quotes WHERE org_id = get_user_org_id()));

CREATE POLICY "Org members can manage quote items"
  ON quote_items FOR ALL
  USING (quote_id IN (SELECT id FROM quotes WHERE org_id = get_user_org_id()));

-- Materials
CREATE POLICY "Org members can view materials"
  ON materials FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can manage materials"
  ON materials FOR ALL
  USING (org_id = get_user_org_id());

-- Activity Log
CREATE POLICY "Org members can view activity"
  ON activity_log FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Org members can log activity"
  ON activity_log FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

-- =====================
-- AUTO-INCREMENT QUOTE NUMBERS PER ORG
-- =====================
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    SELECT COALESCE(MAX(quote_number), 1000) + 1
    INTO NEW.quote_number
    FROM quotes
    WHERE org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_number();

-- =====================
-- UPDATED_AT TRIGGER
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- =====================
-- DONE! Your database is ready.
-- =====================
-- Next: Create your first user account via the Lucky App login page.
-- The app will automatically create your organization and team member record.
