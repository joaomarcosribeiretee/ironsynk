import { prisma } from './prisma.js'

export type ProgramAccess = 'owner' | 'assigned' | null

/**
 * Resolve a user's access level to a program.
 * - 'owner'    — the user created the program
 * - 'assigned' — the program was prescribed to the user via an active consultation
 * - null       — program does not exist or the user has no access
 *
 * Use for READ paths only. Mutations remain owner-only at the route level.
 */
export async function getProgramAccess(programId: string, userId: string): Promise<ProgramAccess> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { createdById: true },
  })
  if (!program) return null
  if (program.createdById === userId) return 'owner'

  const assigned = await prisma.prescribedProgram.findFirst({
    where: { programId, consultation: { athleteId: userId, isActive: true } },
    select: { id: true },
  })
  return assigned ? 'assigned' : null
}

/** Program ids assigned to a user via active consultations. */
export async function getAssignedProgramIds(userId: string): Promise<string[]> {
  const links = await prisma.prescribedProgram.findMany({
    where: { consultation: { athleteId: userId, isActive: true } },
    select: { programId: true },
  })
  return links.map((l) => l.programId)
}
