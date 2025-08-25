-- DropForeignKey
ALTER TABLE "public"."split_assets" DROP CONSTRAINT "split_assets_splitId_fkey";

-- CreateTable
CREATE TABLE "public"."prompt_assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "owner" TEXT,
    "quality" JSONB,
    "flags" JSONB,
    "promptContent" JSONB NOT NULL,
    "irSchema" JSONB,
    "stepId" TEXT,
    "stepVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "category" TEXT,
    "process" TEXT,
    "step" TEXT,
    "requestId" TEXT,
    "model" TEXT,
    "durationMs" INTEGER,
    "tokensTotal" INTEGER,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "prompt" TEXT,
    "error" TEXT,
    "message" TEXT,
    "initiator" TEXT,
    "rag" JSONB,
    "input" JSONB,
    "output" JSONB,
    "quality" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_logs_pkey" PRIMARY KEY ("id")
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
    "process" TEXT,
    "activeVersionId" TEXT,
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
    "prompt" JSONB,
    "productionPromptId" TEXT,
    "defaultPromptId" TEXT,
    "aiPromptId" TEXT,
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
    "origin" TEXT NOT NULL DEFAULT 'frontend_user',
    "originInfo" JSONB,

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
    "origin" TEXT NOT NULL DEFAULT 'frontend_user',
    "originInfo" JSONB,

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
CREATE TABLE "public"."project_flows" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."domain_phases" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."domain_phase_steps" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "pinnedStepVersionId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_phase_steps_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "prompt_assets_stepId_idx" ON "public"."prompt_assets"("stepId");

-- CreateIndex
CREATE INDEX "prompt_assets_stepVersionId_idx" ON "public"."prompt_assets"("stepVersionId");

-- CreateIndex
CREATE INDEX "ai_logs_timestamp_idx" ON "public"."ai_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_logs_process_idx" ON "public"."ai_logs"("process");

-- CreateIndex
CREATE INDEX "ai_logs_level_idx" ON "public"."ai_logs"("level");

-- CreateIndex
CREATE INDEX "ai_logs_category_idx" ON "public"."ai_logs"("category");

-- CreateIndex
CREATE INDEX "ai_logs_requestId_idx" ON "public"."ai_logs"("requestId");

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
CREATE UNIQUE INDEX "pipeline_definitions_name_key" ON "public"."pipeline_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_versions_pipelineId_version_key" ON "public"."pipeline_versions"("pipelineId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_key_key" ON "public"."step_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_activeVersionId_key" ON "public"."step_definitions"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "step_versions_stepId_version_key" ON "public"."step_versions"("stepId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ir_schemas_stepVersionId_version_key" ON "public"."ir_schemas"("stepVersionId", "version");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_idx" ON "public"."pipeline_runs"("status");

-- CreateIndex
CREATE INDEX "pipeline_runs_origin_idx" ON "public"."pipeline_runs"("origin");

-- CreateIndex
CREATE INDEX "step_runs_pipelineRunId_idx" ON "public"."step_runs"("pipelineRunId");

-- CreateIndex
CREATE INDEX "step_runs_stepVersionId_idx" ON "public"."step_runs"("stepVersionId");

-- CreateIndex
CREATE INDEX "step_runs_nodeKey_idx" ON "public"."step_runs"("nodeKey");

-- CreateIndex
CREATE INDEX "step_runs_origin_idx" ON "public"."step_runs"("origin");

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
CREATE UNIQUE INDEX "project_flows_key_key" ON "public"."project_flows"("key");

-- CreateIndex
CREATE INDEX "domain_phases_flowId_idx" ON "public"."domain_phases"("flowId");

-- CreateIndex
CREATE INDEX "domain_phases_orderIndex_idx" ON "public"."domain_phases"("orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "domain_phases_flowId_key_key" ON "public"."domain_phases"("flowId", "key");

-- CreateIndex
CREATE INDEX "domain_phase_steps_phaseId_idx" ON "public"."domain_phase_steps"("phaseId");

-- CreateIndex
CREATE INDEX "domain_phase_steps_stepId_idx" ON "public"."domain_phase_steps"("stepId");

-- CreateIndex
CREATE INDEX "domain_phase_steps_orderIndex_idx" ON "public"."domain_phase_steps"("orderIndex");

-- CreateIndex
CREATE INDEX "step_output_links_stepRunId_idx" ON "public"."step_output_links"("stepRunId");

-- CreateIndex
CREATE INDEX "step_output_links_targetType_targetId_idx" ON "public"."step_output_links"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "public"."split_assets" ADD CONSTRAINT "split_assets_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "public"."design_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompts" ADD CONSTRAINT "ai_prompts_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."ai_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt_test_results" ADD CONSTRAINT "ai_prompt_test_results_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "public"."ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt_metrics" ADD CONSTRAINT "ai_prompt_metrics_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "public"."ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pipeline_versions" ADD CONSTRAINT "pipeline_versions_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "public"."pipeline_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_definitions" ADD CONSTRAINT "step_definitions_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "public"."step_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_versions" ADD CONSTRAINT "step_versions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."step_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_versions" ADD CONSTRAINT "step_versions_aiPromptId_fkey" FOREIGN KEY ("aiPromptId") REFERENCES "public"."ai_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_versions" ADD CONSTRAINT "step_versions_productionPromptId_fkey" FOREIGN KEY ("productionPromptId") REFERENCES "public"."prompt_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_versions" ADD CONSTRAINT "step_versions_defaultPromptId_fkey" FOREIGN KEY ("defaultPromptId") REFERENCES "public"."prompt_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ir_schemas" ADD CONSTRAINT "ir_schemas_stepVersionId_fkey" FOREIGN KEY ("stepVersionId") REFERENCES "public"."step_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipelineVersionId_fkey" FOREIGN KEY ("pipelineVersionId") REFERENCES "public"."pipeline_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_runs" ADD CONSTRAINT "step_runs_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "public"."pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_runs" ADD CONSTRAINT "step_runs_stepVersionId_fkey" FOREIGN KEY ("stepVersionId") REFERENCES "public"."step_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ir_artifacts" ADD CONSTRAINT "ir_artifacts_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "public"."step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metric_profile_items" ADD CONSTRAINT "metric_profile_items_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "public"."metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metric_profile_items" ADD CONSTRAINT "metric_profile_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."metric_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metric_results" ADD CONSTRAINT "metric_results_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "public"."step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."domain_phases" ADD CONSTRAINT "domain_phases_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "public"."project_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."domain_phase_steps" ADD CONSTRAINT "domain_phase_steps_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "public"."domain_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."domain_phase_steps" ADD CONSTRAINT "domain_phase_steps_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."step_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."domain_phase_steps" ADD CONSTRAINT "domain_phase_steps_pinnedStepVersionId_fkey" FOREIGN KEY ("pinnedStepVersionId") REFERENCES "public"."step_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_output_links" ADD CONSTRAINT "step_output_links_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "public"."step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
