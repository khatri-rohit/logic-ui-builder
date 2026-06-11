-- CreateTable
CREATE TABLE "FrameVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "editedContent" TEXT,
    "prompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrameVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrameVersion_generationId_frameId_versionNumber_key" ON "FrameVersion"("generationId", "frameId", "versionNumber");

-- CreateIndex
CREATE INDEX "FrameVersion_projectId_frameId_createdAt_idx" ON "FrameVersion"("projectId", "frameId", "createdAt");

-- AddForeignKey
ALTER TABLE "FrameVersion" ADD CONSTRAINT "FrameVersion_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
