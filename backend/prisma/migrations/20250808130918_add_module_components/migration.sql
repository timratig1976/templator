-- CreateTable
CREATE TABLE "public"."module_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "complexity_level" TEXT NOT NULL,
    "hubspot_version_compatibility" TEXT[],
    "html_template" TEXT NOT NULL,
    "css_styles" TEXT,
    "javascript_code" TEXT,
    "fields_definition" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT NOT NULL,
    "tags" TEXT[],
    "quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "validation_status" TEXT NOT NULL,
    "rating" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL,
    "interfaces" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_components_category_idx" ON "public"."module_components"("category");

-- CreateIndex
CREATE INDEX "module_components_type_idx" ON "public"."module_components"("type");
