-- CreateTable
CREATE TABLE "public"."review_feedback" (
    "id" TEXT NOT NULL,
    "designSplitId" TEXT,
    "artifactId" TEXT,
    "moduleId" TEXT,
    "reviewer" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ratings" JSONB,
    "comments" TEXT NOT NULL,
    "findings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_feedback_designSplitId_idx" ON "public"."review_feedback"("designSplitId");

-- CreateIndex
CREATE INDEX "review_feedback_artifactId_idx" ON "public"."review_feedback"("artifactId");

-- CreateIndex
CREATE INDEX "review_feedback_moduleId_idx" ON "public"."review_feedback"("moduleId");

-- AddForeignKey
ALTER TABLE "public"."review_feedback" ADD CONSTRAINT "review_feedback_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
