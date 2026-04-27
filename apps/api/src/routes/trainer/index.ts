import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { authMiddleware } from '../../middleware/auth.js'

export async function trainerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/dashboard', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.authUser.id

    if (request.authUser.role !== 'TRAINER') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Trainer only' } })
    }

    const consultations = await prisma.consultation.findMany({
      where: { trainerId: userId, isActive: true },
      include: {
        athlete: {
          include: {
            profile: true,
            trainingLogs: {
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        },
        forms: {
          include: {
            _count: { select: { responses: true } },
          },
        },
      },
    })

    const totalStudents = consultations.length

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const trainedToday = consultations.filter(
      (c) => c.athlete.trainingLogs[0] && c.athlete.trainingLogs[0].startedAt >= todayStart
    ).length

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const needsAttention: {
      athleteId: string
      name: string
      avatar: string | null
      reason: string
      daysSinceLastWorkout?: number
    }[] = []

    for (const c of consultations) {
      const lastLog = c.athlete.trainingLogs[0]
      const noRecentWorkout = !lastLog || lastLog.startedAt < fiveDaysAgo

      if (noRecentWorkout) {
        const daysSince = lastLog
          ? Math.floor((Date.now() - lastLog.startedAt.getTime()) / (1000 * 60 * 60 * 24))
          : undefined
        needsAttention.push({
          athleteId: c.athlete.id,
          name: c.athlete.profile?.name ?? c.athlete.email,
          avatar: c.athlete.profile?.avatar ?? null,
          reason: daysSince != null ? `Sem treino há ${daysSince} dias` : 'Nenhum treino registrado',
          daysSinceLastWorkout: daysSince,
        })
        continue
      }

      const pendingForm = c.forms.find((f) => f._count.responses === 0)
      if (pendingForm) {
        needsAttention.push({
          athleteId: c.athlete.id,
          name: c.athlete.profile?.name ?? c.athlete.email,
          avatar: c.athlete.profile?.avatar ?? null,
          reason: 'Formulário pendente',
        })
      }
    }

    const studentIds = consultations.map((c) => c.athleteId)
    const recentLogs = studentIds.length
      ? await prisma.trainingLog.findMany({
          where: { userId: { in: studentIds }, finishedAt: { not: null } },
          orderBy: { startedAt: 'desc' },
          take: 5,
          include: {
            user: { include: { profile: true } },
            workout: true,
          },
        })
      : []

    const recentActivity = recentLogs.map((log) => ({
      studentName: log.user.profile?.name ?? log.user.email,
      workoutName: log.workout?.name ?? 'Treino livre',
      loggedAt: log.startedAt.toISOString(),
    }))

    return reply.send({
      data: { totalStudents, trainedToday, needsAttention, recentActivity },
    })
  })
}
