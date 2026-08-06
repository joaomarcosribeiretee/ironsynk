import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  CreateLoggedMealSchema,
  UpdateLoggedMealSchema,
  AddLoggedMealFoodSchema,
  UpdateLoggedMealFoodSchema,
  type LoggedMeal,
  type LoggedMealFood,
} from '@ironsynk/shared'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'
import { macrosForQuantity, sumMacros, foodView, type FoodRow } from '../../lib/nutrition.js'

// Free logging: meals recorded straight onto a day. These never read or write
// Meal/MealLog, so nothing here can shift plan adherence. The planned-diet
// endpoints live in ./index.ts and stay the single source of adherence.

function notFound(reply: FastifyReply, message = 'Not found'): FastifyReply {
  return reply.status(404).send({ error: { code: 'NOT_FOUND', message } })
}
function forbidden(reply: FastifyReply): FastifyReply {
  return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'You do not own this resource' } })
}

// Date-only value in UTC, matching the @db.Date column.
function dateOnly(iso?: string): Date {
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y as number, (m as number) - 1, d as number))
  }
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function loggedFoodView(lf: {
  id: string
  loggedMealId: string
  foodId: string
  quantityG: number
  isCooked: boolean
  food: FoodRow
}): LoggedMealFood {
  return {
    id: lf.id,
    loggedMealId: lf.loggedMealId,
    foodId: lf.foodId,
    quantityG: lf.quantityG,
    isCooked: lf.isCooked,
    food: foodView(lf.food),
    macros: macrosForQuantity(lf.food, lf.quantityG),
  }
}

type LoggedMealRow = {
  id: string
  name: string
  order: number
  timeMinutes: number | null
  source: LoggedMeal['source']
  sourceMealId: string | null
  isCheat: boolean
  notes: string | null
  foods: Parameters<typeof loggedFoodView>[0][]
}

function loggedMealView(m: LoggedMealRow): LoggedMeal {
  const foods = m.foods.map(loggedFoodView)
  return {
    id: m.id,
    name: m.name,
    order: m.order,
    timeMinutes: m.timeMinutes,
    source: m.source,
    sourceMealId: m.sourceMealId,
    isCheat: m.isCheat,
    notes: m.notes,
    foods,
    macros: sumMacros(foods.map((f) => f.macros)),
  }
}

// Timed meals in clock order, untimed ones after them keeping their own order.
function byTime(a: LoggedMeal, b: LoggedMeal): number {
  const ta = a.timeMinutes ?? Infinity
  const tb = b.timeMinutes ?? Infinity
  return ta === tb ? a.order - b.order : ta - tb
}

// The daily log row is shared with the planned flow (water, notes, meal logs);
// free logging just hangs its meals off the same day.
async function ensureDailyLog(userId: string, date: Date) {
  return prisma.dailyNutritionLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  })
}

// Load a logged meal and assert the day it belongs to is the caller's.
async function loadOwnedLoggedMeal(id: string, userId: string, reply: FastifyReply) {
  const meal = await prisma.loggedMeal.findUnique({ where: { id }, include: { dailyLog: true } })
  if (!meal) { notFound(reply, 'Logged meal not found'); return null }
  if (meal.dailyLog.userId !== userId) { forbidden(reply); return null }
  return meal
}

export async function freeLogRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /log?date=YYYY-MM-DD — a day's logged meals with totals (default today).
  fastify.get('/log', { preHandler: authMiddleware }, async (request, reply) => {
    const { date: dateParam } = request.query as { date?: string }
    const date = dateOnly(dateParam)

    const dailyLog = await prisma.dailyNutritionLog.findUnique({
      where: { userId_date: { userId: request.authUser.id, date } },
      include: {
        loggedMeals: { orderBy: { order: 'asc' }, include: { foods: { include: { food: true } } } },
      },
    })

    const meals = (dailyLog?.loggedMeals ?? []).map(loggedMealView).sort(byTime)
    const summed = sumMacros(meals.map((m) => m.macros))
    return reply.send({
      data: {
        date: toDateString(date),
        meals,
        totals: {
          ...summed,
          totalMeals: meals.length,
          totalFoods: meals.reduce((n, m) => n + m.foods.length, 0),
        },
      },
    })
  })

  // POST /log/meals — create an empty logged meal on a day.
  fastify.post('/log/meals', { preHandler: authMiddleware }, async (request, reply) => {
    const body = CreateLoggedMealSchema.parse(request.body)
    const date = dateOnly(body.date)
    const dailyLog = await ensureDailyLog(request.authUser.id, date)

    const last = await prisma.loggedMeal.findFirst({
      where: { dailyNutritionLogId: dailyLog.id },
      orderBy: { order: 'desc' },
    })
    const meal = await prisma.loggedMeal.create({
      data: {
        dailyNutritionLogId: dailyLog.id,
        name: body.name,
        order: (last?.order ?? -1) + 1,
        timeMinutes: body.timeMinutes ?? null,
        isCheat: body.isCheat ?? false,
        notes: body.notes ?? null,
      },
      include: { foods: { include: { food: true } } },
    })
    return reply.status(201).send({ data: { meal: loggedMealView(meal) } })
  })

  // PUT /log/meals/:id
  fastify.put('/log/meals/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateLoggedMealSchema.parse(request.body)
    const existing = await loadOwnedLoggedMeal(id, request.authUser.id, reply)
    if (!existing) return reply

    const meal = await prisma.loggedMeal.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...('timeMinutes' in body && { timeMinutes: body.timeMinutes }),
        ...(body.isCheat !== undefined && { isCheat: body.isCheat }),
        ...('notes' in body && { notes: body.notes }),
      },
      include: { foods: { include: { food: true } } },
    })
    return reply.send({ data: { meal: loggedMealView(meal) } })
  })

  // DELETE /log/meals/:id — foods cascade with the meal.
  fastify.delete('/log/meals/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await loadOwnedLoggedMeal(id, request.authUser.id, reply)
    if (!existing) return reply

    await prisma.$transaction(async (tx) => {
      await tx.loggedMealFood.deleteMany({ where: { loggedMealId: id } })
      await tx.loggedMeal.delete({ where: { id } })
    })
    return reply.send({ data: { success: true } })
  })

  // POST /log/meals/:id/foods — add a food with a gram quantity.
  fastify.post('/log/meals/:id/foods', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = AddLoggedMealFoodSchema.parse(request.body)
    const meal = await loadOwnedLoggedMeal(id, request.authUser.id, reply)
    if (!meal) return reply

    const food = await prisma.food.findUnique({ where: { id: body.foodId } })
    if (!food) return notFound(reply, 'Food not found')

    const loggedFood = await prisma.loggedMealFood.create({
      data: { loggedMealId: id, foodId: body.foodId, quantityG: body.quantityG, isCooked: body.isCooked ?? false },
      include: { food: true },
    })
    return reply.status(201).send({ data: { loggedMealFood: loggedFoodView(loggedFood) } })
  })

  // PUT /log/meal-foods/:id — change quantity / cooked flag.
  fastify.put('/log/meal-foods/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateLoggedMealFoodSchema.parse(request.body)

    const existing = await prisma.loggedMealFood.findUnique({
      where: { id },
      include: { loggedMeal: { include: { dailyLog: true } } },
    })
    if (!existing) return notFound(reply, 'Logged meal food not found')
    if (existing.loggedMeal.dailyLog.userId !== request.authUser.id) return forbidden(reply)

    const updated = await prisma.loggedMealFood.update({
      where: { id },
      data: {
        ...(body.quantityG !== undefined && { quantityG: body.quantityG }),
        ...(body.isCooked !== undefined && { isCooked: body.isCooked }),
      },
      include: { food: true },
    })
    return reply.send({ data: { loggedMealFood: loggedFoodView(updated) } })
  })

  // DELETE /log/meal-foods/:id
  fastify.delete('/log/meal-foods/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.loggedMealFood.findUnique({
      where: { id },
      include: { loggedMeal: { include: { dailyLog: true } } },
    })
    if (!existing) return notFound(reply, 'Logged meal food not found')
    if (existing.loggedMeal.dailyLog.userId !== request.authUser.id) return forbidden(reply)

    await prisma.loggedMealFood.delete({ where: { id } })
    return reply.send({ data: { success: true } })
  })
}
