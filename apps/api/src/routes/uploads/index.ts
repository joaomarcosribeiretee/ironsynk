import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import {
  PostMediaSignedUrlSchema,
  POST_MEDIA_MAX_IMAGE_BYTES,
  POST_MEDIA_MAX_VIDEO_BYTES,
} from '@ironsynk/shared'
import { supabaseAdmin } from '../../lib/supabase.js'
import { authMiddleware } from '../../middleware/auth.js'

export const POST_MEDIA_BUCKET = 'post-media'

// Strip path separators / unsafe chars so the client fileName can't escape the user prefix.
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'file'
}

function maxBytesForType(fileType: string): number {
  return fileType.startsWith('video/') ? POST_MEDIA_MAX_VIDEO_BYTES : POST_MEDIA_MAX_IMAGE_BYTES
}

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/uploads/post-media/signed-url — issue a signed upload URL for post media.
  // Client uploads the file directly to Supabase Storage, then sends the public URL in the post body.
  fastify.post('/post-media/signed-url', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = PostMediaSignedUrlSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      })
    }
    const { fileName, fileType, postDraftId } = parsed.data
    const userId = request.authUser.id

    const draftId = postDraftId ?? randomUUID()
    const safeName = sanitizeFileName(fileName)
    const objectPath = `${userId}/${draftId}/${Date.now()}-${safeName}`

    const { data, error } = await supabaseAdmin.storage
      .from(POST_MEDIA_BUCKET)
      .createSignedUploadUrl(objectPath)

    if (error || !data) {
      request.log.error(error, 'Failed to create signed upload URL for post media')
      return reply.status(500).send({ error: { code: 'STORAGE_ERROR', message: 'Failed to create upload URL' } })
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(POST_MEDIA_BUCKET).getPublicUrl(objectPath)

    return reply.status(201).send({
      data: {
        bucket: POST_MEDIA_BUCKET,
        postDraftId: draftId,
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
        publicUrl: publicUrlData.publicUrl,
        contentType: fileType,
        maxSizeBytes: maxBytesForType(fileType),
      },
    })
  })
}
