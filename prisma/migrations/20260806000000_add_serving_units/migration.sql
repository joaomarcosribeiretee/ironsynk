-- Practical serving units for food logging.
--
-- Purely additive and all-nullable: every existing MealFood keeps its
-- quantityG, reads as a gram entry, and macros keep being computed from
-- quantityG exactly as before.
--
-- Food gains the serving its data source publishes (Open Food Facts fills
-- these on cache); MealFood gains the wording the user actually picked so
-- "2 servings" is still shown as "2 servings" later instead of "60 g".

ALTER TABLE "Food" ADD COLUMN "baseUnit" TEXT;
ALTER TABLE "Food" ADD COLUMN "servingSizeG" DOUBLE PRECISION;
ALTER TABLE "Food" ADD COLUMN "servingLabel" TEXT;

ALTER TABLE "MealFood" ADD COLUMN "servingUnit" TEXT;
ALTER TABLE "MealFood" ADD COLUMN "servingQuantity" DOUBLE PRECISION;
