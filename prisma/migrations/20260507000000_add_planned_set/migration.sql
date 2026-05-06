-- CreateTable: PlannedSet
CREATE TABLE "PlannedSet" (
  "id"              TEXT NOT NULL,
  "trainingExId"    TEXT NOT NULL,
  "order"           INTEGER NOT NULL,
  "setType"         "SetType" NOT NULL DEFAULT 'WORKING',
  "technique"       "SetTechnique" NOT NULL DEFAULT 'NONE',
  "techniqueConfig" JSONB,
  "targetReps"      TEXT,
  "targetWeight"    DOUBLE PRECISION,
  "restSeconds"     INTEGER,
  CONSTRAINT "PlannedSet_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlannedSet"
  ADD CONSTRAINT "PlannedSet_trainingExId_fkey"
  FOREIGN KEY ("trainingExId") REFERENCES "TrainingExercise"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PlannedSet_trainingExId_idx" ON "PlannedSet"("trainingExId");
