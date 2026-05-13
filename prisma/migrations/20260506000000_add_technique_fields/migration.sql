-- AlterEnum: add technique values
ALTER TYPE "SetTechnique" ADD VALUE IF NOT EXISTS 'WARMUP';
ALTER TYPE "SetTechnique" ADD VALUE IF NOT EXISTS 'FEEDER';
ALTER TYPE "SetTechnique" ADD VALUE IF NOT EXISTS 'BISET';
ALTER TYPE "SetTechnique" ADD VALUE IF NOT EXISTS 'SUPERSET';

-- AlterTable: add technique fields to TrainingExercise
ALTER TABLE "TrainingExercise"
  ADD COLUMN IF NOT EXISTS "technique" "SetTechnique" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "techniqueConfig" JSONB,
  ADD COLUMN IF NOT EXISTS "supersetGroupId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrainingExercise_supersetGroupId_idx"
  ON "TrainingExercise"("supersetGroupId")
  WHERE "supersetGroupId" IS NOT NULL;
