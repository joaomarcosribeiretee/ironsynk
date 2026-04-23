import type { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'
import { prisma } from '../lib/prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    authUser: {
      id: string
      email: string
      role: string
    }
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authorization = request.headers['authorization']
  if (!authorization?.startsWith('Bearer ')) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } })
    return
  }

  const token = authorization.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
    return
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !dbUser.isActive) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'User not found or deactivated' } })
    return
  }

  request.authUser = { id: dbUser.id, email: dbUser.email, role: dbUser.role }
}
