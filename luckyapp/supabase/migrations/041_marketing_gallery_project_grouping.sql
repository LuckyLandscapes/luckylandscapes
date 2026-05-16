-- ============================================================================
-- 041: Marketing gallery — project grouping
-- ============================================================================
-- Photos in the marketing_gallery table are individual rows (each with its
-- own title, description, tags). This migration adds an optional grouping
-- field so multiple photos from the same job can collapse into a single
-- "project card" on the public site.
--
-- How it works:
-- • NULL / empty project_name → photo renders as its own card (singleton).
-- • Non-empty project_name → photos with the same value (within the org)
--   group into one card; the card shows the project name + photo count.
--   The lightbox then carousels through the project's photos.
--
-- This is a free-text field, NOT a foreign key to a separate projects
-- table. Riley can rename a project by editing each row's project_name
-- (or via a bulk rename in the future). Keeping it as a string means
-- adding a new "project" doesn't require any UI/DB work — just type a
-- new name in the upload form.
--
-- Existing rows get NULL (continue to render as singletons). The legacy
-- portfolio import is updated to set project_name = the original project
-- title, so importing "Lawn Maintenance" (6 photos) creates 6 rows that
-- all share project_name = 'Lawn Maintenance' and group back into one
-- card on the public site.
-- ============================================================================

ALTER TABLE marketing_gallery
  ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Index supports fast group-by lookups when the upload modal suggests
-- existing project names for autocomplete.
CREATE INDEX IF NOT EXISTS idx_marketing_gallery_org_project_name
  ON marketing_gallery(org_id, project_name)
  WHERE project_name IS NOT NULL;
