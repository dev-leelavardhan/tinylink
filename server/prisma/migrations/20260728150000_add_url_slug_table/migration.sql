-- CreateUrlSlug table for globally unique public slug namespace.
-- Each URL maps to one or more slugs (shortCode, optionally customAlias).
CREATE TABLE "UrlSlug" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "urlId" TEXT NOT NULL,

  CONSTRAINT "UrlSlug_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: every slug maps to exactly one URL.
CREATE UNIQUE INDEX "UrlSlug_slug_key" ON "UrlSlug"("slug");

-- Index for reverse lookups (find all slugs for a URL).
CREATE INDEX "UrlSlug_urlId_idx" ON "UrlSlug"("urlId");

-- Migrate existing data: insert shortCode for every URL.
-- shortCode takes priority as the primary public identifier.
INSERT INTO "UrlSlug" ("id", "slug", "urlId")
SELECT gen_random_uuid(), "shortCode", "id"
FROM "Url"
WHERE "deletedAt" IS NULL
ON CONFLICT ("slug") DO NOTHING;

-- Migrate existing data: insert customAlias where it exists and differs from shortCode.
-- Uses ON CONFLICT DO NOTHING to skip any cross-column collisions gracefully.
-- If a customAlias collides with an existing shortCode, the shortCode wins.
INSERT INTO "UrlSlug" ("id", "slug", "urlId")
SELECT gen_random_uuid(), "customAlias", "id"
FROM "Url"
WHERE "customAlias" IS NOT NULL
  AND "customAlias" != "shortCode"
  AND "deletedAt" IS NULL
ON CONFLICT ("slug") DO NOTHING;

-- Report any collisions that were skipped (for operator awareness).
DO $$
DECLARE
  collision_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO collision_count
  FROM "Url" u
  WHERE u."customAlias" IS NOT NULL
    AND u."customAlias" != u."shortCode"
    AND u."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "UrlSlug" s WHERE s."slug" = u."customAlias" AND s."urlId" = u."id"
    );

  IF collision_count > 0 THEN
    RAISE NOTICE 'Skipped % customAlias entries due to cross-column slug collisions. These aliases redirect to the shortCode owner.', collision_count;
  END IF;
END $$;

-- Add foreign key constraint.
ALTER TABLE "UrlSlug" ADD CONSTRAINT "UrlSlug_urlId_fkey"
  FOREIGN KEY ("urlId") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
