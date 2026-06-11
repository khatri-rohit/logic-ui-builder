-- DropIndex
DROP INDEX IF EXISTS "FrameVersion_generationId_frameId_versionNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "FrameVersion_projectId_frameId_versionNumber_key" ON "FrameVersion"("projectId", "frameId", "versionNumber");
