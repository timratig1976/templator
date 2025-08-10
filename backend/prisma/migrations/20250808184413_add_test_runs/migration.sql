-- CreateTable
CREATE TABLE "public"."test_run" (
    "id" TEXT NOT NULL,
    "designSplitId" TEXT,
    "artifactId" TEXT,
    "moduleId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "test_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_result" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_run_designSplitId_idx" ON "public"."test_run"("designSplitId");

-- CreateIndex
CREATE INDEX "test_run_artifactId_idx" ON "public"."test_run"("artifactId");

-- CreateIndex
CREATE INDEX "test_run_moduleId_idx" ON "public"."test_run"("moduleId");

-- CreateIndex
CREATE INDEX "test_result_testRunId_idx" ON "public"."test_result"("testRunId");

-- AddForeignKey
ALTER TABLE "public"."test_run" ADD CONSTRAINT "test_run_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_result" ADD CONSTRAINT "test_result_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "public"."test_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
