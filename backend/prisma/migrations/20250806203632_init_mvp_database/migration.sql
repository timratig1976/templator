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

-- CreateIndex
CREATE UNIQUE INDEX "prompt_data_pipelineId_sectionId_key" ON "public"."prompt_data"("pipelineId", "sectionId");

-- AddForeignKey
ALTER TABLE "public"."prompt_results" ADD CONSTRAINT "prompt_results_promptDataId_fkey" FOREIGN KEY ("promptDataId") REFERENCES "public"."prompt_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prompt_generations" ADD CONSTRAINT "prompt_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
