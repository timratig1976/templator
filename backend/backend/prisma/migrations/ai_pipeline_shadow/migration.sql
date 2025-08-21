-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."split_assets" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageUrl" TEXT,
    "meta" JSONB,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,

    CONSTRAINT "split_assets_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."module_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "cssContent" TEXT,
    "jsContent" TEXT,
    "tags" TEXT[],
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prompt_data" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "sectionId" TEXT,
    "prompt" TEXT NOT NULL,
    "context" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prompt_results" (
    "id" TEXT NOT NULL,
    "promptDataId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "basePrompt" TEXT NOT NULL,
    "contexts" JSONB NOT NULL,
    "tags" TEXT[],
    "rating" DOUBLE PRECISION,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prompt_generations" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "enhancedPrompt" TEXT NOT NULL,
    "result" TEXT,
    "rating" DOUBLE PRECISION,
    "feedback" TEXT,
    "contextData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_generations_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."design_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "storageUrl" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."design_splits" (
    "id" TEXT NOT NULL,
    "designUploadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "design_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_processes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompts" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "author" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompt_test_results" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "testFileId" TEXT,
    "testFileName" TEXT,
    "input" JSONB,
    "output" JSONB,
    "metrics" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "executionTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompt_metrics" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "context" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."static_test_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "complexity" TEXT,
    "tags" TEXT[],
    "description" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "static_test_files_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."pipeline_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pipeline_versions" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "dag" JSONB NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."step_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."step_versions" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "defaultConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ir_schemas" (
    "id" TEXT NOT NULL,
    "stepVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ir_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pipeline_runs" (
    "id" TEXT NOT NULL,
    "pipelineVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."step_runs" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "stepVersionId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "params" JSONB,
    "error" TEXT,

    CONSTRAINT "step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ir_artifacts" (
    "id" TEXT NOT NULL,
    "stepRunId" TEXT NOT NULL,
    "irJson" JSONB NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "validationErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ir_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metric_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "aggregation" TEXT,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metric_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metric_profile_items" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "config" JSONB,

    CONSTRAINT "metric_profile_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metric_results" (
    "id" TEXT NOT NULL,
    "stepRunId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "stringValue" TEXT,
    "passed" BOOLEAN,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."step_output_links" (
    "id" TEXT NOT NULL,
    "stepRunId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_output_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "split_assets_splitId_idx" ON "public"."split_assets"("splitId");

-- CreateIndex
CREATE INDEX "split_assets_kind_idx" ON "public"."split_assets"("kind");

-- CreateIndex
CREATE INDEX "split_assets_projectId_idx" ON "public"."split_assets"("projectId");

-- CreateIndex
CREATE INDEX "test_run_designSplitId_idx" ON "public"."test_run"("designSplitId");

-- CreateIndex
CREATE INDEX "test_run_artifactId_idx" ON "public"."test_run"("artifactId");

-- CreateIndex
CREATE INDEX "test_run_moduleId_idx" ON "public"."test_run"("moduleId");

-- CreateIndex
CREATE INDEX "test_result_testRunId_idx" ON "public"."test_result"("testRunId");

-- CreateIndex
CREATE INDEX "review_feedback_designSplitId_idx" ON "public"."review_feedback"("designSplitId");

-- CreateIndex
CREATE INDEX "review_feedback_artifactId_idx" ON "public"."review_feedback"("artifactId");

-- CreateIndex
CREATE INDEX "review_feedback_moduleId_idx" ON "public"."review_feedback"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_data_pipelineId_sectionId_key" ON "public"."prompt_data"("pipelineId", "sectionId");

-- CreateIndex
CREATE INDEX "module_components_category_idx" ON "public"."module_components"("category");

-- CreateIndex
CREATE INDEX "module_components_type_idx" ON "public"."module_components"("type");

-- CreateIndex
CREATE INDEX "design_uploads_userId_idx" ON "public"."design_uploads"("userId");

-- CreateIndex
CREATE INDEX "design_splits_designUploadId_idx" ON "public"."design_splits"("designUploadId");

-- CreateIndex
CREATE INDEX "design_splits_status_idx" ON "public"."design_splits"("status");

-- CreateIndex
CREATE INDEX "design_splits_projectId_idx" ON "public"."design_splits"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_processes_name_key" ON "public"."ai_processes"("name");

-- CreateIndex
CREATE INDEX "ai_prompts_processId_isActive_idx" ON "public"."ai_prompts"("processId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompts_processId_version_key" ON "public"."ai_prompts"("processId", "version");

-- CreateIndex
CREATE INDEX "ai_prompt_test_results_promptId_idx" ON "public"."ai_prompt_test_results"("promptId");

-- CreateIndex
CREATE INDEX "ai_prompt_test_results_testFileId_idx" ON "public"."ai_prompt_test_results"("testFileId");

-- CreateIndex
CREATE INDEX "ai_prompt_metrics_promptId_metricType_idx" ON "public"."ai_prompt_metrics"("promptId", "metricType");

-- CreateIndex
CREATE INDEX "generated_artifacts_designSplitId_idx" ON "public"."generated_artifacts"("designSplitId");

-- CreateIndex
CREATE INDEX "generated_artifacts_type_idx" ON "public"."generated_artifacts"("type");

-- CreateIndex
CREATE INDEX "validation_results_designSplitId_idx" ON "public"."validation_results"("designSplitId");

-- CreateIndex
CREATE INDEX "validation_results_artifactId_idx" ON "public"."validation_results"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_definitions_name_key" ON "public"."pipeline_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_versions_pipelineId_version_key" ON "public"."pipeline_versions"("pipelineId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_key_key" ON "public"."step_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "step_versions_stepId_version_key" ON "public"."step_versions"("stepId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ir_schemas_stepVersionId_version_key" ON "public"."ir_schemas"("stepVersionId", "version");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_idx" ON "public"."pipeline_runs"("status");

-- CreateIndex
CREATE INDEX "step_runs_pipelineRunId_idx" ON "public"."step_runs"("pipelineRunId");

-- CreateIndex
CREATE INDEX "step_runs_stepVersionId_idx" ON "public"."step_runs"("stepVersionId");

-- CreateIndex
CREATE INDEX "step_runs_nodeKey_idx" ON "public"."step_runs"("nodeKey");

-- CreateIndex
CREATE INDEX "ir_artifacts_stepRunId_idx" ON "public"."ir_artifacts"("stepRunId");

-- CreateIndex
CREATE UNIQUE INDEX "metric_definitions_key_key" ON "public"."metric_definitions"("key");

-- CreateIndex
CREATE INDEX "metric_profile_items_profileId_idx" ON "public"."metric_profile_items"("profileId");

-- CreateIndex
CREATE INDEX "metric_profile_items_metricId_idx" ON "public"."metric_profile_items"("metricId");

-- CreateIndex
CREATE INDEX "metric_results_stepRunId_idx" ON "public"."metric_results"("stepRunId");

-- CreateIndex
CREATE INDEX "metric_results_metricKey_idx" ON "public"."metric_results"("metricKey");

-- CreateIndex
CREATE INDEX "step_output_links_stepRunId_idx" ON "public"."step_output_links"("stepRunId");

-- CreateIndex
CREATE INDEX "step_output_links_targetType_targetId_idx" ON "public"."step_output_links"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "public"."split_assets" ADD CONSTRAINT "split_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."split_assets" ADD CONSTRAINT "split_assets_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "public"."design_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_run" ADD CONSTRAINT "test_run_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_result" ADD CONSTRAINT "test_result_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "public"."test_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."review_feedback" ADD CONSTRAINT "review_feedback_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prompt_results" ADD CONSTRAINT "prompt_results_promptDataId_fkey" FOREIGN KEY ("promptDataId") REFERENCES "public"."prompt_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prompt_generations" ADD CONSTRAINT "prompt_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."design_splits" ADD CONSTRAINT "design_splits_designUploadId_fkey" FOREIGN KEY ("designUploadId") REFERENCES "public"."design_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."design_splits" ADD CONSTRAINT "design_splits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompts" ADD CONSTRAINT "ai_prompts_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."ai_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt_test_results" ADD CONSTRAINT "ai_prompt_test_results_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "public"."ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt_metrics" ADD CONSTRAINT "ai_prompt_metrics_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "public"."ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_artifacts" ADD CONSTRAINT "generated_artifacts_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."validation_results" ADD CONSTRAINT "validation_results_designSplitId_fkey" FOREIGN KEY ("designSplitId") REFERENCES "public"."design_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pipeline_versions" ADD CONSTRAINT "pipeline_versions_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "public"."pipeline_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_versions" ADD CONSTRAINT "step_versions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."step_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ir_schemas" ADD CONSTRAINT "ir_schemas_stepVersionId_fkey" FOREIGN KEY ("stepVersionId") REFERENCES "public"."step_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipelineVersionId_fkey" FOREIGN KEY ("pipelineVersionId") REFERENCES "public"."pipeline_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_runs" ADD CONSTRAINT "step_runs_stepVersionId_fkey" FOREIGN KEY ("stepVersionId") REFERENCES "public"."step_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_runs" ADD CONSTRAINT "step_runs_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "public"."pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ir_artifacts" ADD CONSTRAINT "ir_artifacts_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "public"."step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metric_profile_items" ADD CONSTRAINT "metric_profile_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."metric_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metric_profile_items" ADD CONSTRAINT "metric_profile_items_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "public"."metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metric_results" ADD CONSTRAINT "metric_results_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "public"."step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_output_links" ADD CONSTRAINT "step_output_links_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "public"."step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

