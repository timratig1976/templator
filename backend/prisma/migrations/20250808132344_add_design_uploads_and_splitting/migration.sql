-- CreateTable
CREATE TABLE "public"."design_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "storageUrl" TEXT NOT NULL,
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

    CONSTRAINT "design_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."split_assets" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageUrl" TEXT,
    "meta" JSONB,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_uploads_userId_idx" ON "public"."design_uploads"("userId");

-- CreateIndex
CREATE INDEX "design_splits_designUploadId_idx" ON "public"."design_splits"("designUploadId");

-- CreateIndex
CREATE INDEX "design_splits_status_idx" ON "public"."design_splits"("status");

-- CreateIndex
CREATE INDEX "split_assets_splitId_idx" ON "public"."split_assets"("splitId");

-- CreateIndex
CREATE INDEX "split_assets_kind_idx" ON "public"."split_assets"("kind");

-- AddForeignKey
ALTER TABLE "public"."design_splits" ADD CONSTRAINT "design_splits_designUploadId_fkey" FOREIGN KEY ("designUploadId") REFERENCES "public"."design_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."split_assets" ADD CONSTRAINT "split_assets_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "public"."design_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
