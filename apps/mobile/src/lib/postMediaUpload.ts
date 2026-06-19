import { api } from './api'
import type { PostMediaItem, PostMediaType, PostMediaUploadFileType } from './api'

export type LocalPostMedia = {
  uri: string
  type: PostMediaType
  /** Detected MIME, mapped to a backend-supported content type before upload. */
  mime: string
  fileName: string
  /** Video duration in seconds (required for VIDEO). */
  durationSec?: number
}

const IMAGE_TYPES: PostMediaUploadFileType[] = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_TYPES: PostMediaUploadFileType[] = ['video/mp4', 'video/quicktime']

// Map an arbitrary picker MIME onto a backend-supported content type.
// iOS often yields image/heic and video/mov — coerce to the closest allowed type.
function resolveContentType(media: LocalPostMedia): PostMediaUploadFileType {
  const mime = media.mime.toLowerCase()
  if (media.type === 'IMAGE') {
    if (mime === 'image/png') return 'image/png'
    if (mime === 'image/webp') return 'image/webp'
    return 'image/jpeg'
  }
  if (mime === 'video/quicktime' || mime.endsWith('/mov') || media.fileName.toLowerCase().endsWith('.mov')) {
    return 'video/quicktime'
  }
  return 'video/mp4'
}

function extensionFor(contentType: PostMediaUploadFileType): string {
  switch (contentType) {
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/jpeg': return 'jpg'
    case 'video/quicktime': return 'mov'
    case 'video/mp4': return 'mp4'
  }
}

function safeFileName(fileName: string, contentType: PostMediaUploadFileType): string {
  const ext = extensionFor(contentType)
  const base = (fileName.split(/[\\/]/).pop() ?? 'media').replace(/[^a-zA-Z0-9._-]/g, '_')
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`
}

/**
 * Upload one selected media item to Supabase Storage via a backend-issued signed URL,
 * then return the structured PostMediaItem to attach to the post.
 */
export async function uploadPostMedia(
  media: LocalPostMedia,
  order: number,
  postDraftId: string,
): Promise<PostMediaItem> {
  const contentType = resolveContentType(media)
  const fileName = safeFileName(media.fileName, contentType)

  const { data: signed } = await api.posts.signMediaUpload({ fileName, fileType: contentType, postDraftId })

  const form = new FormData()
  form.append('cacheControl', '3600')
  // Supabase signed upload expects the file under an empty field name.
  form.append('', { uri: media.uri, name: fileName, type: contentType } as unknown as Blob)

  const res = await fetch(signed.signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body: form,
  })

  if (!res.ok) {
    throw new Error(`Falha ao enviar mídia (${res.status})`)
  }

  const item: PostMediaItem = {
    type: media.type,
    url: signed.publicUrl,
    order,
  }
  if (media.type === 'VIDEO' && media.durationSec !== undefined) {
    item.durationSec = Math.round(media.durationSec)
  }
  return item
}

export const POST_MEDIA_ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES]
