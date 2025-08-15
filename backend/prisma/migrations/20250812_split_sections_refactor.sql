-- Migration: Refactor SplitAsset to separate SplitSection and SplitAsset
-- This creates proper normalization between logical sections and physical assets

-- Step 1: Create the new SplitSection table
CREATE TABLE "split_sections" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sectionType" TEXT,
    "sectionName" TEXT,
    "bounds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_sections_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes for SplitSection
CREATE INDEX "split_sections_splitId_order_idx" ON "split_sections"("splitId", "order");
CREATE INDEX "split_sections_splitId_idx" ON "split_sections"("splitId");

-- Step 3: Add foreign key constraint for SplitSection
ALTER TABLE "split_sections" ADD CONSTRAINT "split_sections_splitId_fkey" 
    FOREIGN KEY ("splitId") REFERENCES "design_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create temporary backup of current SplitAsset data
CREATE TABLE "split_assets_backup" AS SELECT * FROM "split_assets";

-- Step 5: Migrate JSON assets to SplitSection table
INSERT INTO "split_sections" (
    "id", 
    "splitId", 
    "order", 
    "sectionType", 
    "sectionName",
    "bounds", 
    "metadata", 
    "createdAt"
)
SELECT 
    "id",
    "splitId",
    COALESCE("order", 0),
    COALESCE("meta"->>'sectionType', 'unknown'),
    COALESCE("meta"->>'sectionName', 'Section ' || COALESCE("order", 0)),
    CASE 
        WHEN "meta"->>'bounds' IS NOT NULL THEN ("meta"->'bounds')::jsonb
        ELSE NULL 
    END,
    "meta",
    "createdAt"
FROM "split_assets" 
WHERE "kind" = 'json';

-- Step 6: Add sectionId column to SplitAsset table
ALTER TABLE "split_assets" ADD COLUMN "sectionId" TEXT;

-- Step 7: Update existing image-crop assets to link to sections
-- This matches image-crops to sections by order (assuming they correspond)
UPDATE "split_assets" 
SET "sectionId" = (
    SELECT ss."id" 
    FROM "split_sections" ss 
    WHERE ss."splitId" = "split_assets"."splitId" 
    AND ss."order" = "split_assets"."order"
    LIMIT 1
)
WHERE "kind" = 'image-crop' AND "sectionId" IS NULL;

-- Step 8: Remove JSON assets from SplitAsset table (they're now in SplitSection)
DELETE FROM "split_assets" WHERE "kind" = 'json';

-- Step 9: Update SplitAsset table structure
-- Remove the 'order' column since it's now in SplitSection
ALTER TABLE "split_assets" DROP COLUMN IF EXISTS "order";

-- Remove 'meta' column for image assets (metadata is now in SplitSection)
-- Keep it for now but we could clean this up later
-- ALTER TABLE "split_assets" DROP COLUMN IF EXISTS "meta";

-- Step 10: Add foreign key constraint for sectionId
ALTER TABLE "split_assets" ADD CONSTRAINT "split_assets_sectionId_fkey" 
    FOREIGN KEY ("sectionId") REFERENCES "split_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 11: Create new indexes for the updated SplitAsset table
CREATE INDEX "split_assets_sectionId_kind_idx" ON "split_assets"("sectionId", "kind");
CREATE INDEX "split_assets_sectionId_idx" ON "split_assets"("sectionId");

-- Step 12: Update the kind column to be more specific for remaining assets
UPDATE "split_assets" SET "kind" = 'image-crop' WHERE "kind" IN ('image', 'crop');

-- Step 13: Add constraints to ensure data integrity
ALTER TABLE "split_sections" ADD CONSTRAINT "split_sections_order_check" CHECK ("order" >= 0);
ALTER TABLE "split_assets" ADD CONSTRAINT "split_assets_kind_check" 
    CHECK ("kind" IN ('image-crop', 'thumbnail', 'preview', 'processed'));

-- Step 14: Create a view for backward compatibility (optional)
CREATE VIEW "legacy_split_assets_view" AS
SELECT 
    sa."id",
    ss."splitId",
    sa."kind",
    sa."storageUrl",
    ss."order",
    jsonb_build_object(
        'sectionId', ss."id",
        'sectionType', ss."sectionType", 
        'sectionName', ss."sectionName",
        'bounds', ss."bounds"
    ) as "meta",
    sa."createdAt",
    sa."projectId"
FROM "split_assets" sa
JOIN "split_sections" ss ON sa."sectionId" = ss."id"
UNION ALL
SELECT 
    ss."id",
    ss."splitId", 
    'json' as "kind",
    NULL as "storageUrl",
    ss."order",
    ss."metadata" as "meta",
    ss."createdAt",
    NULL as "projectId"
FROM "split_sections" ss;

-- Migration completed successfully
-- Summary:
-- - Created SplitSection table for logical split definitions
-- - Migrated JSON assets to SplitSection 
-- - Updated SplitAsset to reference sections via sectionId
-- - Maintained data integrity with proper foreign keys
-- - Created indexes for performance
-- - Added backward compatibility view
