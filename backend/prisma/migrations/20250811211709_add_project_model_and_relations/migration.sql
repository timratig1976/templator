-- AlterTable
ALTER TABLE "public"."design_splits" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "public"."split_assets" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_splits_projectId_idx" ON "public"."design_splits"("projectId");

-- CreateIndex
CREATE INDEX "split_assets_projectId_idx" ON "public"."split_assets"("projectId");

-- AddForeignKey
ALTER TABLE "public"."design_splits" ADD CONSTRAINT "design_splits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."split_assets" ADD CONSTRAINT "split_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
