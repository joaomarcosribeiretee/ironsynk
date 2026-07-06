-- Prevent duplicate completion rows for the same meal on the same daily log,
-- and enable idempotent upsert when marking/unmarking a meal as completed.
CREATE UNIQUE INDEX "MealLog_dailyNutritionLogId_mealId_key" ON "MealLog"("dailyNutritionLogId", "mealId");
