-- CreateTable
CREATE TABLE "public"."generated_artifacts" (
    "id" TEXT NOT NULL,
    "designSplitId" TEXT,
    "moduleId" TEXT,
    "type" TEXT NOT NULL,
    "contentUrl" TEXT,
    "content" TEXT,
    "meta" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_artifacts_designSplitId_idx" ON "public"."generated_artifacts"("designSplitId");

-- CreateIndex
CREATE INDEX "generated_artifacts_type_idx" ON "public"."generated_artifacts"("type");

-- AddForeignKey
ALTER TABLE "public"."generated_artifacts" ADD CONSTRAINT "generated_artifacts_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
