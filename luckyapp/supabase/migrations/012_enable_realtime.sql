-- ============================================================
-- Lucky App — Enable Supabase Realtime on tables
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Enable Realtime for all data tables
-- This allows connected clients to receive instant INSERT/UPDATE/DELETE notifications

ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity;
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;

-- Note: You can also enable this via the Supabase Dashboard:
-- Go to Database → Replication → supabase_realtime → toggle each table ON
