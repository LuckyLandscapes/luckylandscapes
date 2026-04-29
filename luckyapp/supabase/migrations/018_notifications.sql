-- ============================================================
-- Notifications + Web Push Subscriptions
-- Run AFTER 017_quote_public_links.sql
-- ============================================================

-- 1. notifications — server-driven feed, also used for in-app realtime updates.
--    user_id NULL means "org-wide" (every active admin/owner can see it).
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID,                              -- references auth.users(id); NULL = org-wide
  type        TEXT NOT NULL,                     -- e.g. 'quote_accepted','invoice_paid'
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,                              -- in-app deep link, e.g. /quotes/<id>
  data        JSONB DEFAULT '{}'::JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON notifications(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id);

-- 2. push_subscriptions — Web Push endpoints registered by team members.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,                     -- references auth.users(id)
  endpoint    TEXT NOT NULL UNIQUE,              -- push service URL — globally unique per browser
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_org_user
  ON push_subscriptions(org_id, user_id);

-- 3. RLS — clients can only read/manage rows for their own org. Server (service role) bypasses RLS.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- notifications: org members can read their org's notifications and update read_at on their own.
DROP POLICY IF EXISTS "notifications_read" ON notifications;
CREATE POLICY "notifications_read" ON notifications FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

-- push_subscriptions: a user can only see/manage their own subscriptions within their org.
DROP POLICY IF EXISTS "push_subs_read_own" ON push_subscriptions;
CREATE POLICY "push_subs_read_own" ON push_subscriptions FOR SELECT
  USING (org_id = get_user_org_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "push_subs_insert_own" ON push_subscriptions;
CREATE POLICY "push_subs_insert_own" ON push_subscriptions FOR INSERT
  WITH CHECK (org_id = get_user_org_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions;
CREATE POLICY "push_subs_delete_own" ON push_subscriptions FOR DELETE
  USING (org_id = get_user_org_id() AND user_id = auth.uid());

-- 4. Realtime — let the browser subscribe to insert/update events on notifications.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
