-- Add new columns to TrainingLog
ALTER TABLE "TrainingLog" ADD COLUMN "isFreeWorkout" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrainingLog" ADD COLUMN "workoutName" TEXT;
ALTER TABLE "TrainingLog" ADD COLUMN "programName" TEXT;
ALTER TABLE "TrainingLog" ADD COLUMN "totalVolume" DOUBLE PRECISION;
ALTER TABLE "TrainingLog" ADD COLUMN "totalSets" INTEGER;
ALTER TABLE "TrainingLog" ADD COLUMN "totalValidSets" INTEGER;
ALTER TABLE "TrainingLog" ADD COLUMN "hasChanges" BOOLEAN NOT NULL DEFAULT false;

-- Create ExecutionExercise table
CREATE TABLE "ExecutionExercise" (
    "id" TEXT NOT NULL,
    "trainingLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "trainingExId" TEXT,
    "order" INTEGER NOT NULL,
    "exerciseNotes" TEXT,
    CONSTRAINT "ExecutionExercise_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutionExercise_trainingLogId_idx" ON "ExecutionExercise"("trainingLogId");

ALTER TABLE "ExecutionExercise" ADD CONSTRAINT "ExecutionExercise_trainingLogId_fkey"
    FOREIGN KEY ("trainingLogId") REFERENCES "TrainingLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutionExercise" ADD CONSTRAINT "ExecutionExercise_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update SetLog: make repsCompleted and weightKg nullable
ALTER TABLE "SetLog" ALTER COLUMN "repsCompleted" DROP NOT NULL;
ALTER TABLE "SetLog" ALTER COLUMN "weightKg" DROP NOT NULL;

-- Add new columns to SetLog
ALTER TABLE "SetLog" ADD COLUMN "executionExerciseId" TEXT;
ALTER TABLE "SetLog" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SetLog" ADD COLUMN "techniqueConfig" JSONB;
ALTER TABLE "SetLog" ADD COLUMN "isChecked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SetLog" ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "SetLog" ADD COLUMN "plannedSetId" TEXT;

ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_executionExerciseId_fkey"
    FOREIGN KEY ("executionExerciseId") REFERENCES "ExecutionExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
