-- AlterTable
ALTER TABLE "public"."pipeline_runs" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'frontend_user',
ADD COLUMN     "originInfo" JSONB;

-- AlterTable
ALTER TABLE "public"."step_runs" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'frontend_user',
ADD COLUMN     "originInfo" JSONB;

-- CreateIndex
CREATE INDEX "pipeline_runs_origin_idx" ON "public"."pipeline_runs"("origin");

-- CreateIndex
CREATE INDEX "step_runs_origin_idx" ON "public"."step_runs"("origin");

