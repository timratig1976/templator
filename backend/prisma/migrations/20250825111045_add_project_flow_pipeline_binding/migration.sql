-- AlterTable
ALTER TABLE "public"."project_flows" ADD COLUMN     "pinnedPipelineVersionId" TEXT,
ADD COLUMN     "pipelineId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."project_flows" ADD CONSTRAINT "project_flows_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "public"."pipeline_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_flows" ADD CONSTRAINT "project_flows_pinnedPipelineVersionId_fkey" FOREIGN KEY ("pinnedPipelineVersionId") REFERENCES "public"."pipeline_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
