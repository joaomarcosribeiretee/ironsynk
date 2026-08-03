import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  CreateNutritionPlanSchema,
  UpdateNutritionPlanSchema,
  CreateMealSchema,
  UpdateMealSchema,
  ReorderMealsSchema,
  AddMealFoodSchema,
  UpdateMealFoodSchema,
  CreateFoodSchema,
  CacheOffFoodSchema,
  type Macros,
  type MealFood,
  type DailyMeal,
  type FoodSearchResult,
} from '@ironsynk/shared'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'
import { macrosForQuantity, sumMacros } from '../../lib/nutrition.js'
import { searchOpenFoodFacts, getOpenFoodFactsProduct } from '../../lib/open-food-facts.js'
import { freeLogRoutes } from './free-log.js'

// ── helpers ───────────────────────────────────

function notFound(reply: FastifyReply, message = 'Not found'): FastifyReply {
  return reply.status(404).send({ error: { code: 'NOT_FOUND', message } })
}
function forbidden(reply: FastifyReply): FastifyReply {
  return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'You do not own this resource' } })
}

// Today's date as a UTC date-only value, matching the @db.Date column.
function todayDateOnly(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type FoodRow = {
  id: string
  name: string
  brand: string | null
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number | null
  isCustom: boolean
  createdById: string | null
  sourceId: string | null
}

function mealFoodView(mf: { id: string; mealId: string; foodId: string; quantityG: number; isCooked: boolean; food: FoodRow }): MealFood {
  return {
    id: mf.id,
    mealId: mf.mealId,
    foodId: mf.foodId,
    quantityG: mf.quantityG,
    isCooked: mf.isCooked,
    food: mf.food,
    macros: macrosForQuantity(mf.food, mf.quantityG),
  }
}

// Load a plan and assert ownership. Returns the plan or sends the error response.
async function loadOwnedPlan(planId: string, userId: string, reply: FastifyReply) {
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } })
  if (!plan) { notFound(reply, 'Nutrition plan not found'); return null }
  if (plan.userId !== userId) { forbidden(reply); return null }
  return plan
}

// Load a meal (with its plan) and assert ownership.
async function loadOwnedMeal(mealId: string, userId: string, reply: FastifyReply) {
  const meal = await prisma.meal.findUnique({ where: { id: mealId }, include: { plan: true } })
  if (!meal) { notFound(reply, 'Meal not found'); return null }
  if (meal.plan.userId !== userId) { forbidden(reply); return null }
  return meal
}

export async function nutritionRoutes(fastify: FastifyInstance): Promise<void> {
  // Free logging shares the /nutrition prefix but keeps its own file: it is a
  // parallel way to track a day, not part of the planned-diet flow.
  await fastify.register(freeLogRoutes)

  // ═══════════════════════════════════════════
  // FOODS
  // ═══════════════════════════════════════════

  // GET /foods/search?q=&limit= — local Food table first, OFF to top up.
  fastify.get('/foods/search', { preHandler: authMiddleware }, async (request, reply) => {
    const q = request.query as { q?: string; limit?: string }
    const term = (q.q ?? '').trim()
    const limit = Math.min(parseInt(q.limit ?? '20', 10) || 20, 50)
    if (term.length < 2) {
      return reply.send({ data: { results: [] } })
    }

    const local = await prisma.food.findMany({
      where: { name: { contains: term, mode: 'insensitive' } },
      orderBy: [{ isCustom: 'desc' }, { name: 'asc' }],
      take: limit,
    })

    const results: FoodSearchResult[] = local.map((f) => ({ ...f, source: 'local' as const }))

    // Only reach out to OFF when the local bank did not fill the page.
    if (results.length < limit) {
      const cachedSourceIds = new Set(local.map((f) => f.sourceId).filter(Boolean))
      const off = await searchOpenFoodFacts(term, limit - results.length)
      for (const item of off) {
        // Skip OFF products we already have cached locally.
        if (item.sourceId && cachedSourceIds.has(item.sourceId)) continue
        results.push(item)
        if (results.length >= limit) break
      }
    }

    return reply.send({ data: { results } })
  })

  // GET /foods/:id — local id, or "off:<code>" to fetch a live OFF product.
  fastify.get('/foods/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (id.startsWith('off:')) {
      const product = await getOpenFoodFactsProduct(id.slice(4))
      if (!product) return notFound(reply, 'Food not found')
      return reply.send({ data: { food: product } })
    }

    const food = await prisma.food.findUnique({ where: { id } })
    if (!food) return notFound(reply, 'Food not found')
    return reply.send({ data: { food: { ...food, source: 'local' } } })
  })

  // POST /foods — create a custom food (macros per 100g).
  fastify.post('/foods', { preHandler: authMiddleware }, async (request, reply) => {
    const body = CreateFoodSchema.parse(request.body)
    const food = await prisma.food.create({
      data: {
        name: body.name,
        brand: body.brand ?? null,
        calories: body.calories,
        proteinG: body.proteinG,
        carbsG: body.carbsG,
        fatG: body.fatG,
        fiberG: body.fiberG ?? null,
        isCustom: true,
        createdById: request.authUser.id,
      },
    })
    return reply.status(201).send({ data: { food: { ...food, source: 'local' } } })
  })

  // POST /foods/cache-off — persist a selected OFF product into the local bank.
  fastify.post('/foods/cache-off', { preHandler: authMiddleware }, async (request, reply) => {
    const body = CacheOffFoodSchema.parse(request.body)

    // Already cached? Return the existing row (idempotent).
    const existing = await prisma.food.findFirst({ where: { sourceId: body.sourceId } })
    if (existing) return reply.send({ data: { food: { ...existing, source: 'local' } } })

    const product = await getOpenFoodFactsProduct(body.sourceId)
    if (!product) {
      return reply.status(502).send({ error: { code: 'OFF_UNAVAILABLE', message: 'Could not fetch product from Open Food Facts' } })
    }

    const food = await prisma.food.create({
      data: {
        name: product.name,
        brand: product.brand,
        calories: product.calories,
        proteinG: product.proteinG,
        carbsG: product.carbsG,
        fatG: product.fatG,
        fiberG: product.fiberG,
        isCustom: false,
        sourceId: product.sourceId,
      },
    })
    return reply.status(201).send({ data: { food: { ...food, source: 'local' } } })
  })

  // ═══════════════════════════════════════════
  // NUTRITION PLANS
  // ═══════════════════════════════════════════

  // POST /plans
  fastify.post('/plans', { preHandler: authMiddleware }, async (request, reply) => {
    const body = CreateNutritionPlanSchema.parse(request.body)
    // First plan becomes active automatically; later plans start inactive.
    const activeCount = await prisma.nutritionPlan.count({ where: { userId: request.authUser.id, isActive: true } })
    const plan = await prisma.nutritionPlan.create({
      data: {
        userId: request.authUser.id,
        name: body.name,
        goal: body.goal ?? null,
        targetCalories: body.targetCalories ?? null,
        targetProteinG: body.targetProteinG ?? null,
        targetCarbsG: body.targetCarbsG ?? null,
        targetFatG: body.targetFatG ?? null,
        targetWaterMl: body.targetWaterMl ?? null,
        notes: body.notes ?? null,
        isActive: activeCount === 0,
      },
    })
    return reply.status(201).send({ data: { plan } })
  })

  // GET /plans — list own plans with a meal count.
  fastify.get('/plans', { preHandler: authMiddleware }, async (request, reply) => {
    const plans = await prisma.nutritionPlan.findMany({
      where: { userId: request.authUser.id },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { meals: true } } },
    })
    return reply.send({
      data: { plans: plans.map(({ _count, ...p }) => ({ ...p, mealsCount: _count.meals })) },
    })
  })

  // GET /plans/:id — full plan with meals, foods and per-meal macros.
  fastify.get('/plans/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const plan = await prisma.nutritionPlan.findUnique({
      where: { id },
      include: {
        meals: {
          orderBy: { order: 'asc' },
          include: { foods: { include: { food: true } } },
        },
      },
    })
    if (!plan) return notFound(reply, 'Nutrition plan not found')
    if (plan.userId !== request.authUser.id) return forbidden(reply)

    const meals = plan.meals.map((m) => {
      const foods = m.foods.map(mealFoodView)
      return {
        id: m.id,
        nutritionPlanId: m.nutritionPlanId,
        name: m.name,
        order: m.order,
        targetTimeHour: m.targetTimeHour,
        foods,
        plannedMacros: sumMacros(foods.map((f) => f.macros)),
      }
    })
    const { meals: _drop, ...planFields } = plan
    return reply.send({ data: { plan: { ...planFields, meals } } })
  })

  // PUT /plans/:id
  fastify.put('/plans/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateNutritionPlanSchema.parse(request.body)
    const plan = await loadOwnedPlan(id, request.authUser.id, reply)
    if (!plan) return reply

    const updated = await prisma.nutritionPlan.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...('goal' in body && { goal: body.goal }),
        ...('targetCalories' in body && { targetCalories: body.targetCalories }),
        ...('targetProteinG' in body && { targetProteinG: body.targetProteinG }),
        ...('targetCarbsG' in body && { targetCarbsG: body.targetCarbsG }),
        ...('targetFatG' in body && { targetFatG: body.targetFatG }),
        ...('targetWaterMl' in body && { targetWaterMl: body.targetWaterMl }),
        ...('notes' in body && { notes: body.notes }),
        updatedAt: new Date(),
      },
    })
    return reply.send({ data: { plan: updated } })
  })

  // POST /plans/:id/activate — make this the single active plan.
  fastify.post('/plans/:id/activate', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const plan = await loadOwnedPlan(id, request.authUser.id, reply)
    if (!plan) return reply

    const updated = await prisma.$transaction(async (tx) => {
      await tx.nutritionPlan.updateMany({
        where: { userId: request.authUser.id, isActive: true, NOT: { id } },
        data: { isActive: false },
      })
      return tx.nutritionPlan.update({ where: { id }, data: { isActive: true } })
    })
    return reply.send({ data: { plan: updated } })
  })

  // DELETE /plans/:id — blocked while prescribed to an athlete (trainer link).
  fastify.delete('/plans/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const plan = await loadOwnedPlan(id, request.authUser.id, reply)
    if (!plan) return reply

    const prescriptions = await prisma.prescribedNutrition.count({ where: { nutritionPlanId: id } })
    if (prescriptions > 0) {
      return reply.status(409).send({
        error: { code: 'PLAN_IN_USE', message: 'Plan is prescribed to an athlete and cannot be deleted' },
      })
    }

    await prisma.$transaction(async (tx) => {
      const mealIds = (await tx.meal.findMany({ where: { nutritionPlanId: id }, select: { id: true } })).map((m) => m.id)
      await tx.mealFood.deleteMany({ where: { mealId: { in: mealIds } } })
      await tx.mealLog.deleteMany({ where: { mealId: { in: mealIds } } })
      await tx.meal.deleteMany({ where: { nutritionPlanId: id } })
      await tx.planSupplement.deleteMany({ where: { nutritionPlanId: id } })
      await tx.nutritionPlan.delete({ where: { id } })
    })
    return reply.send({ data: { success: true } })
  })

  // ═══════════════════════════════════════════
  // MEALS
  // ═══════════════════════════════════════════

  // POST /plans/:planId/meals — append a meal to the plan.
  fastify.post('/plans/:planId/meals', { preHandler: authMiddleware }, async (request, reply) => {
    const { planId } = request.params as { planId: string }
    const body = CreateMealSchema.parse(request.body)
    const plan = await loadOwnedPlan(planId, request.authUser.id, reply)
    if (!plan) return reply

    const last = await prisma.meal.findFirst({ where: { nutritionPlanId: planId }, orderBy: { order: 'desc' } })
    const meal = await prisma.meal.create({
      data: {
        nutritionPlanId: planId,
        name: body.name,
        order: (last?.order ?? -1) + 1,
        targetTimeHour: body.targetTimeHour ?? null,
      },
    })
    return reply.status(201).send({ data: { meal } })
  })

  // PUT /meals/:mealId
  fastify.put('/meals/:mealId', { preHandler: authMiddleware }, async (request, reply) => {
    const { mealId } = request.params as { mealId: string }
    const body = UpdateMealSchema.parse(request.body)
    const meal = await loadOwnedMeal(mealId, request.authUser.id, reply)
    if (!meal) return reply

    const updated = await prisma.meal.update({
      where: { id: mealId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...('targetTimeHour' in body && { targetTimeHour: body.targetTimeHour }),
      },
    })
    return reply.send({ data: { meal: updated } })
  })

  // PUT /plans/:planId/meals/reorder — persist a new meal order.
  fastify.put('/plans/:planId/meals/reorder', { preHandler: authMiddleware }, async (request, reply) => {
    const { planId } = request.params as { planId: string }
    const body = ReorderMealsSchema.parse(request.body)
    const plan = await loadOwnedPlan(planId, request.authUser.id, reply)
    if (!plan) return reply

    const planMeals = await prisma.meal.findMany({ where: { nutritionPlanId: planId }, select: { id: true } })
    const planMealIds = new Set(planMeals.map((m) => m.id))
    // Reject if the payload is not exactly this plan's meal set.
    if (body.mealIds.length !== planMeals.length || !body.mealIds.every((mid) => planMealIds.has(mid))) {
      return reply.status(400).send({ error: { code: 'INVALID_ORDER', message: 'mealIds must match the plan meals exactly' } })
    }

    await prisma.$transaction(
      body.mealIds.map((mid, index) => prisma.meal.update({ where: { id: mid }, data: { order: index } })),
    )
    const meals = await prisma.meal.findMany({ where: { nutritionPlanId: planId }, orderBy: { order: 'asc' } })
    return reply.send({ data: { meals } })
  })

  // DELETE /meals/:mealId
  fastify.delete('/meals/:mealId', { preHandler: authMiddleware }, async (request, reply) => {
    const { mealId } = request.params as { mealId: string }
    const meal = await loadOwnedMeal(mealId, request.authUser.id, reply)
    if (!meal) return reply

    await prisma.$transaction(async (tx) => {
      await tx.mealFood.deleteMany({ where: { mealId } })
      await tx.mealLog.deleteMany({ where: { mealId } })
      await tx.meal.delete({ where: { id: mealId } })
    })
    return reply.send({ data: { success: true } })
  })

  // ═══════════════════════════════════════════
  // MEAL FOODS
  // ═══════════════════════════════════════════

  // POST /meals/:mealId/foods — add a food to a meal with a gram quantity.
  fastify.post('/meals/:mealId/foods', { preHandler: authMiddleware }, async (request, reply) => {
    const { mealId } = request.params as { mealId: string }
    const body = AddMealFoodSchema.parse(request.body)
    const meal = await loadOwnedMeal(mealId, request.authUser.id, reply)
    if (!meal) return reply

    const food = await prisma.food.findUnique({ where: { id: body.foodId } })
    if (!food) return notFound(reply, 'Food not found')

    const mealFood = await prisma.mealFood.create({
      data: { mealId, foodId: body.foodId, quantityG: body.quantityG, isCooked: body.isCooked ?? false },
      include: { food: true },
    })
    return reply.status(201).send({ data: { mealFood: mealFoodView(mealFood) } })
  })

  // PUT /meal-foods/:id — change quantity / cooked flag.
  fastify.put('/meal-foods/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateMealFoodSchema.parse(request.body)

    const existing = await prisma.mealFood.findUnique({ where: { id }, include: { meal: { include: { plan: true } } } })
    if (!existing) return notFound(reply, 'Meal food not found')
    if (existing.meal.plan.userId !== request.authUser.id) return forbidden(reply)

    const updated = await prisma.mealFood.update({
      where: { id },
      data: {
        ...(body.quantityG !== undefined && { quantityG: body.quantityG }),
        ...(body.isCooked !== undefined && { isCooked: body.isCooked }),
      },
      include: { food: true },
    })
    return reply.send({ data: { mealFood: mealFoodView(updated) } })
  })

  // DELETE /meal-foods/:id
  fastify.delete('/meal-foods/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.mealFood.findUnique({ where: { id }, include: { meal: { include: { plan: true } } } })
    if (!existing) return notFound(reply, 'Meal food not found')
    if (existing.meal.plan.userId !== request.authUser.id) return forbidden(reply)

    await prisma.mealFood.delete({ where: { id } })
    return reply.send({ data: { success: true } })
  })

  // ═══════════════════════════════════════════
  // DAILY EXECUTION
  // ═══════════════════════════════════════════

  // GET /today — active plan for today with completion state + totals.
  fastify.get('/today', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.authUser.id
    const date = todayDateOnly()

    const plan = await prisma.nutritionPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        meals: { orderBy: { order: 'asc' }, include: { foods: { include: { food: true } } } },
      },
    })

    const emptyTotals = {
      targetCalories: plan?.targetCalories ?? null,
      consumedCalories: 0,
      targetProteinG: plan?.targetProteinG ?? null,
      consumedProteinG: 0,
      targetCarbsG: plan?.targetCarbsG ?? null,
      consumedCarbsG: 0,
      targetFatG: plan?.targetFatG ?? null,
      consumedFatG: 0,
      completedMeals: 0,
      totalMeals: plan?.meals.length ?? 0,
      adherencePercent: 0,
    }

    if (!plan) {
      return reply.send({ data: { date: toDateString(date), plan: null, meals: [], totals: emptyTotals } })
    }

    // Ensure today's DailyNutritionLog exists (auto-create).
    const dailyLog = await prisma.dailyNutritionLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
      include: { mealLogs: true },
    })
    const doneByMeal = new Map(dailyLog.mealLogs.map((ml) => [ml.mealId, ml]))

    const consumed: Macros[] = []
    let completedMeals = 0
    const meals: DailyMeal[] = plan.meals.map((m) => {
      const foods = m.foods.map(mealFoodView)
      const plannedMacros = sumMacros(foods.map((f) => f.macros))
      const log = doneByMeal.get(m.id)
      const isCompleted = log?.isDone ?? false
      if (isCompleted) {
        completedMeals += 1
        consumed.push(plannedMacros)
      }
      return {
        mealId: m.id,
        name: m.name,
        order: m.order,
        targetTimeHour: m.targetTimeHour,
        isCompleted,
        completedAt: log?.completedAt ?? null,
        foods,
        plannedMacros,
      }
    })

    const consumedTotals = sumMacros(consumed)
    const totalMeals = plan.meals.length
    const totals = {
      targetCalories: plan.targetCalories,
      consumedCalories: consumedTotals.calories,
      targetProteinG: plan.targetProteinG,
      consumedProteinG: consumedTotals.proteinG,
      targetCarbsG: plan.targetCarbsG,
      consumedCarbsG: consumedTotals.carbsG,
      targetFatG: plan.targetFatG,
      consumedFatG: consumedTotals.fatG,
      completedMeals,
      totalMeals,
      adherencePercent: totalMeals === 0 ? 0 : Math.round((completedMeals / totalMeals) * 100),
    }

    const { meals: _drop, ...planFields } = plan
    return reply.send({ data: { date: toDateString(date), plan: planFields, meals, totals } })
  })

  // POST /meals/:mealId/complete — mark a meal done for today.
  fastify.post('/meals/:mealId/complete', { preHandler: authMiddleware }, async (request, reply) => {
    const meal = await loadOwnedMeal((request.params as { mealId: string }).mealId, request.authUser.id, reply)
    if (!meal) return reply
    const dailyLog = await ensureTodayLog(request.authUser.id)

    const mealLog = await prisma.mealLog.upsert({
      where: { dailyNutritionLogId_mealId: { dailyNutritionLogId: dailyLog.id, mealId: meal.id } },
      create: { dailyNutritionLogId: dailyLog.id, mealId: meal.id, isDone: true, completedAt: new Date() },
      update: { isDone: true, completedAt: new Date() },
    })
    return reply.send({ data: { mealLog } })
  })

  // DELETE /meals/:mealId/complete — unmark a meal for today.
  fastify.delete('/meals/:mealId/complete', { preHandler: authMiddleware }, async (request, reply) => {
    const meal = await loadOwnedMeal((request.params as { mealId: string }).mealId, request.authUser.id, reply)
    if (!meal) return reply
    const dailyLog = await ensureTodayLog(request.authUser.id)

    const mealLog = await prisma.mealLog.upsert({
      where: { dailyNutritionLogId_mealId: { dailyNutritionLogId: dailyLog.id, mealId: meal.id } },
      create: { dailyNutritionLogId: dailyLog.id, mealId: meal.id, isDone: false, completedAt: null },
      update: { isDone: false, completedAt: null },
    })
    return reply.send({ data: { mealLog } })
  })
}

// Auto-create today's daily log if absent.
async function ensureTodayLog(userId: string) {
  const date = todayDateOnly()
  return prisma.dailyNutritionLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  })
}
