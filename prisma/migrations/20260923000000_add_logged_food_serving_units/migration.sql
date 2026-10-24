-- Serving units for free logging, mirroring MealFood.
--
-- Purely additive and nullable: existing LoggedMealFood rows keep their
-- quantityG and read as gram entries. quantityG stays the value macros are
-- computed from; these columns only preserve how the user entered the portion.

ALTER TABLE "LoggedMealFood" ADD COLUMN "servingUnit" TEXT;
ALTER TABLE "LoggedMealFood" ADD COLUMN "servingQuantity" DOUBLE PRECISION;
