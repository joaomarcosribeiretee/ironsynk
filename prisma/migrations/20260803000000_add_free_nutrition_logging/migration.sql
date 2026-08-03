-- Free nutrition logging: meals attached to a day instead of to a plan.
-- Purely additive — the planned-diet tables (Meal, MealFood, MealLog) are
-- untouched, so adherence keeps reading exactly the rows it read before.

-- Where a logged meal came from. MANUAL is the only source the app writes
-- today; the rest reserve room for barcode scanning, copying a plan meal and
-- AI suggestions without another migration.
CREATE TYPE "LoggedMealSource" AS ENUM ('MANUAL', 'FROM_PLAN', 'BARCODE', 'SUGGESTION');

CREATE TABLE "LoggedMeal" (
    "id" TEXT NOT NULL,
    "dailyNutritionLogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "timeMinutes" INTEGER,
    "source" "LoggedMealSource" NOT NULL DEFAULT 'MANUAL',
    "sourceMealId" TEXT,
    "isCheat" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoggedMeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoggedMealFood" (
    "id" TEXT NOT NULL,
    "loggedMealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantityG" DOUBLE PRECISION NOT NULL,
    "isCooked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LoggedMealFood_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoggedMeal_dailyNutritionLogId_idx" ON "LoggedMeal"("dailyNutritionLogId");
CREATE INDEX "LoggedMealFood_loggedMealId_idx" ON "LoggedMealFood"("loggedMealId");

ALTER TABLE "LoggedMeal" ADD CONSTRAINT "LoggedMeal_dailyNutritionLogId_fkey"
    FOREIGN KEY ("dailyNutritionLogId") REFERENCES "DailyNutritionLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoggedMeal" ADD CONSTRAINT "LoggedMeal_sourceMealId_fkey"
    FOREIGN KEY ("sourceMealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoggedMealFood" ADD CONSTRAINT "LoggedMealFood_loggedMealId_fkey"
    FOREIGN KEY ("loggedMealId") REFERENCES "LoggedMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoggedMealFood" ADD CONSTRAINT "LoggedMealFood_foodId_fkey"
    FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
