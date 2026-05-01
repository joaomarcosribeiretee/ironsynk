-- Reconcile Program.goals: DB already has goals TrainingGoal[] from original setup.
-- The local schema previously drifted to goal TrainingGoal?; this restores the array.
ALTER TABLE "Program" DROP COLUMN IF EXISTS "goal";
