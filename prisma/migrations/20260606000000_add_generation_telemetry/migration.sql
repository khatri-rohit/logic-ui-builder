-- CreateTable
CREATE TABLE "GenerationTelemetry" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "screenName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "tokenCount" INTEGER,
    "errorType" TEXT,
    "screenClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationTelemetry_model_screenClass_createdAt_idx" ON "GenerationTelemetry"("model", "screenClass", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationTelemetry_generationId_idx" ON "GenerationTelemetry"("generationId");
