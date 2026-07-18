-- Repo record of a uniqueness guard for public.tow_images.
--
-- tow_images lives only in Supabase (no CREATE TABLE in this migrations folder).
-- Apply this manually in the Supabase SQL editor (same pattern as other
-- live-only schema changes). Do not assume `supabase db push` has created
-- the base table.
--
-- Why UNIQUE (image_url):
--   Mobile driver app (towing-driver-app/lib/tow-images.ts) dedupes before
--   insert via findExistingTowImage(tow_id, image_url), where image_url is the
--   full storage public URL for a deterministic path
--   `{towId}/{imageType}_{photoId}.jpg`. That URL is globally unique per photo
--   (tow id is embedded in the path), so a single-column unique index is the
--   correct DB-level safety net and is equivalent to (tow_id, image_url) for
--   current writers.
--
-- Precondition (verified before drafting): no duplicate image_url values exist.
-- If APPLY fails with a unique-violation, dedupe live rows first, then retry.

CREATE UNIQUE INDEX IF NOT EXISTS tow_images_image_url_uniq
  ON public.tow_images (image_url);
