-- CreateTable
CREATE TABLE "public"."validation_results" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT,
    "designSplitId" TEXT,
    "validator" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "validation_results_designSplitId_idx" ON "public"."validation_results"("designSplitId");

-- CreateIndex
CREATE INDEX "validation_results_artifactId_idx" ON "public"."validation_results"("artifactId");

-- AddForeignKey
ALTER TABLE "public"."validation_results" ADD CONSTRAINT "validation_results_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
