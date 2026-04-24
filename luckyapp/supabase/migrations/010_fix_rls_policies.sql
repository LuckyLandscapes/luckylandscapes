-- ============================================================
-- COMPLETE FIX — Run this ONCE in Supabase SQL Editor
-- Fixes "new row violates row-level security policy" error
-- ============================================================

-- ============================================================
-- STEP 1: Create an RPC function that bypasses RLS for onboarding
-- SECURITY DEFINER runs with the function owner's privileges,
-- so RLS doesn't block the insert for new users.
-- ============================================================

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
    -- Already has a membership, return it
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

  -- Create team member
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


-- ============================================================
-- STEP 2: Recreate the helper function (in case it's missing)
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
-- STEP 3: Drop ALL existing policies and recreate them clean
-- ============================================================

-- ORGANIZATIONS
DO $$ BEGIN
  DROP POLICY IF EXISTS "org_read" ON organizations;
  DROP POLICY IF EXISTS "org_insert" ON organizations;
  DROP POLICY IF EXISTS "org_update" ON organizations;
  DROP POLICY IF EXISTS "org_select" ON organizations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_insert" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "org_read" ON organizations FOR SELECT
  TO authenticated USING (id = get_user_org_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE
  TO authenticated USING (id = get_user_org_id());

-- TEAM MEMBERS
DO $$ BEGIN
  DROP POLICY IF EXISTS "team_read" ON team_members;
  DROP POLICY IF EXISTS "team_insert" ON team_members;
  DROP POLICY IF EXISTS "team_select" ON team_members;
  DROP POLICY IF EXISTS "team_update" ON team_members;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_insert" ON team_members FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "team_read" ON team_members FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR org_id = get_user_org_id());

-- CUSTOMERS
DO $$ BEGIN
  DROP POLICY IF EXISTS "customers_select" ON customers;
  DROP POLICY IF EXISTS "customers_insert" ON customers;
  DROP POLICY IF EXISTS "customers_update" ON customers;
  DROP POLICY IF EXISTS "customers_delete" ON customers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- QUOTES
DO $$ BEGIN
  DROP POLICY IF EXISTS "quotes_select" ON quotes;
  DROP POLICY IF EXISTS "quotes_insert" ON quotes;
  DROP POLICY IF EXISTS "quotes_update" ON quotes;
  DROP POLICY IF EXISTS "quotes_delete" ON quotes;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON quotes FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "quotes_insert" ON quotes FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "quotes_delete" ON quotes FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- ACTIVITY
DO $$ BEGIN
  DROP POLICY IF EXISTS "activity_select" ON activity;
  DROP POLICY IF EXISTS "activity_insert" ON activity;
  DROP POLICY IF EXISTS "activity_delete" ON activity;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select" ON activity FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "activity_insert" ON activity FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "activity_delete" ON activity FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- MATERIALS
DO $$ BEGIN
  DROP POLICY IF EXISTS "materials_select" ON materials;
  DROP POLICY IF EXISTS "materials_insert" ON materials;
  DROP POLICY IF EXISTS "materials_update" ON materials;
  DROP POLICY IF EXISTS "materials_delete" ON materials;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select" ON materials FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "materials_insert" ON materials FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "materials_update" ON materials FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "materials_delete" ON materials FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- SERVICES
DO $$ BEGIN
  DROP POLICY IF EXISTS "services_select" ON services;
  DROP POLICY IF EXISTS "services_insert" ON services;
  DROP POLICY IF EXISTS "services_update" ON services;
  DROP POLICY IF EXISTS "services_delete" ON services;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select" ON services FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "services_insert" ON services FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "services_update" ON services FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "services_delete" ON services FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());


-- ============================================================
-- VERIFY: List all policies
-- ============================================================
SELECT tablename, policyname, cmd, permissive FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
