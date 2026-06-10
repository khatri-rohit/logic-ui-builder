-- Add composite index for the model-router telemetry lookup
-- Query pattern: WHERE screenClass = ? AND stage = 'stage3' AND createdAt >= ?
CREATE INDEX "GenerationTelemetry_screenClass_stage_createdAt_idx" ON "GenerationTelemetry"("screenClass", "stage", "createdAt");
