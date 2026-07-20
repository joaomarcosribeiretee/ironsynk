import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import { randomUUID } from 'node:crypto'
import {
  PostMediaSignedUrlSchema,
  POST_MEDIA_MAX_IMAGE_BYTES,
  POST_MEDIA_MAX_VIDEO_BYTES,
} from '@ironsynk/shared'
import { supabaseAdmin } from '../../lib/supabase.js'
import { authMiddleware } from '../../middleware/auth.js'

export const POST_MEDIA_BUCKET = 'post-media'

const POST_MEDIA_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']

// Preferred per-object cap. NOTE: a bucket's fileSizeLimit cannot exceed the
// project's global upload limit — Supabase rejects creation with HTTP 413
// ("The object exceeded the maximum allowed size") otherwise. We try with this
// limit, then fall back to the project default if it's too high.
const POST_MEDIA_BUCKET_OPTIONS = {
  public: true,
  fileSizeLimit: '120MB',
  allowedMimeTypes: POST_MEDIA_ALLOWED_MIME,
}

// Same options without an explicit size cap: the bucket inherits the project's
// global upload limit. Used as fallback when fileSizeLimit > global limit.
const POST_MEDIA_BUCKET_OPTIONS_NO_LIMIT = {
  public: true,
  allowedMimeTypes: POST_MEDIA_ALLOWED_MIME,
}

// Supabase Storage signals a missing bucket with this message / a 404. Used to
// turn the opaque "The related resource does not exist" into a clear error.
function isBucketMissingError(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return (
    error.status === 404 ||
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('bucket not found')
  )
}

// fileSizeLimit above the project's global upload limit → HTTP 413.
function isSizeLimitError(error: { message?: string; status?: number; statusCode?: string } | null): boolean {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return error.status === 413 || error.statusCode === '413' || message.includes('exceeded the maximum allowed size')
}

/**
 * Ensure the post-media storage bucket exists. Idempotent: checks first, only
 * creates when missing, and treats an "already exists" race as success.
 * Throws on any other failure so startup can log a real reason instead of
 * silently swallowing it.
 */
export async function ensurePostMediaBucket(log: FastifyBaseLogger): Promise<void> {
  const { data: existing, error: getError } = await supabaseAdmin.storage.getBucket(POST_MEDIA_BUCKET)
  if (existing) {
    return
  }
  if (getError && !isBucketMissingError(getError)) {
    log.error(getError, `Failed to check storage bucket "${POST_MEDIA_BUCKET}"`)
    throw new Error(`Unable to verify storage bucket "${POST_MEDIA_BUCKET}": ${getError.message}`)
  }

  let { error: createError } = await supabaseAdmin.storage.createBucket(
    POST_MEDIA_BUCKET,
    POST_MEDIA_BUCKET_OPTIONS,
  )

  // fileSizeLimit exceeds the project's global limit → retry inheriting the global.
  if (isSizeLimitError(createError)) {
    log.warn(
      `Bucket "${POST_MEDIA_BUCKET}" fileSizeLimit (${POST_MEDIA_BUCKET_OPTIONS.fileSizeLimit}) exceeds the project global upload limit; creating with the project default instead.`,
    )
    ;({ error: createError } = await supabaseAdmin.storage.createBucket(
      POST_MEDIA_BUCKET,
      POST_MEDIA_BUCKET_OPTIONS_NO_LIMIT,
    ))
  }

  if (createError && !/already exists/i.test(createError.message ?? '')) {
    log.error(createError, `Failed to create storage bucket "${POST_MEDIA_BUCKET}"`)
    throw new Error(`Unable to create storage bucket "${POST_MEDIA_BUCKET}": ${createError.message}`)
  }
  log.info(`Storage bucket "${POST_MEDIA_BUCKET}" is ready`)
}

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

    let { data, error } = await supabaseAdmin.storage
      .from(POST_MEDIA_BUCKET)
      .createSignedUploadUrl(objectPath)

    // Bucket may be missing if startup seeding failed (e.g. created later).
    // Try to create it once, then retry the signed URL before giving up.
    if (isBucketMissingError(error)) {
      try {
        await ensurePostMediaBucket(request.log)
        ;({ data, error } = await supabaseAdmin.storage
          .from(POST_MEDIA_BUCKET)
          .createSignedUploadUrl(objectPath))
      } catch (seedError) {
        request.log.error(seedError, `Storage bucket "${POST_MEDIA_BUCKET}" is missing and could not be created`)
        return reply.status(503).send({
          error: {
            code: 'STORAGE_BUCKET_MISSING',
            message: `Storage bucket "${POST_MEDIA_BUCKET}" does not exist and could not be created. Check the Supabase service role key and storage configuration.`,
          },
        })
      }
    }

    if (isBucketMissingError(error)) {
      request.log.error(error, `Storage bucket "${POST_MEDIA_BUCKET}" is missing`)
      return reply.status(503).send({
        error: {
          code: 'STORAGE_BUCKET_MISSING',
          message: `Storage bucket "${POST_MEDIA_BUCKET}" does not exist. Create it in Supabase Storage and try again.`,
        },
      })
    }

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
