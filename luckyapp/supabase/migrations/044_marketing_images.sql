-- ============================================================================
-- 044: Marketing images — per-org overrides for fixed image "slots" on the
-- public marketing site (luckylandscapes.com)
-- ============================================================================
-- Each editable <img> on the marketing site carries a stable slot_key (e.g.
-- 'service-garden-beds-feature'), declared as data-ll-img="<slot_key>" in the
-- HTML and mirrored in SLOT_REGISTRY on the luckyapp Website Images page. A
-- row in this table OVERRIDES the static image the site ships with for that
-- slot; absence of a row = the site keeps its bundled default. This lets Riley
-- swap page graphics from his phone without editing code or redeploying — the
-- same managed-content pattern as marketing_gallery.
--
-- Public read: /api/marketing/images returns { slots: { key: {url,alt,...} } }.
-- The marketing site's loadMarketingImagesFromLuckyapp() (main.js) fetches it
-- and swaps src/alt on [data-ll-img] elements, falling back to the bundled
-- image on any failure.
--
-- Storage: REUSES the existing public `marketing-gallery` bucket (created in
-- 039). Files are keyed `<orgId>/slots/<slotKey>-<ts>.<ext>` so the first path
-- segment is the org_id and the existing storage write policy
-- (marketing_gallery_member_insert/update/delete, which gate on
-- (storage.foldername(name))[1] = org_id) applies unchanged — no new bucket or
-- storage policy needed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Stable identifier for the image slot. Must match data-ll-img="<slot_key>"
  -- in the marketing HTML and the SLOT_REGISTRY entry in luckyapp.
  slot_key      TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  image_path    TEXT,
  -- Alt text for accessibility / SEO. NULL = the site keeps the static alt.
  alt           TEXT,
  image_width   INTEGER,
  image_height  INTEGER,
  image_bytes   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  -- One override per slot per org. The Website Images page upserts on this.
  UNIQUE (org_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_marketing_images_org ON marketing_images(org_id);

ALTER TABLE marketing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_images_select" ON marketing_images FOR SELECT
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_images_insert" ON marketing_images FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_images_update" ON marketing_images FOR UPDATE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_images_delete" ON marketing_images FOR DELETE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE marketing_images; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
