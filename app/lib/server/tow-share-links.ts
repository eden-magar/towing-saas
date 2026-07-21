import 'server-only'
import {
  TOW_IMAGES_BUCKET,
  TOW_IMAGE_SIGNED_URL_TTL_SEC,
  normalizeTowImagePath,
} from '@/app/lib/queries/tow-images-storage'
import { getSupabaseAdmin } from '@/app/lib/server/supabase-admin'

export type ValidShareLink = {
  tow_id: string
}

/**
 * Resolve a share token to its tow_id only when the link is still valid.
 * Uses service role. Returns null for missing / revoked / expired (same outcome).
 */
export async function getValidShareLink(
  token: string
): Promise<ValidShareLink | null> {
  const trimmed = token.trim()
  if (!trimmed) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('tow_share_links')
    .select('tow_id, expires_at, revoked_at')
    .eq('token', trimmed)
    .maybeSingle()

  if (error) {
    console.error('[tow-share-links] getValidShareLink failed', error)
    return null
  }
  if (!data?.tow_id) return null
  if (data.revoked_at) return null
  if (new Date(data.expires_at).getTime() <= Date.now()) return null

  return { tow_id: data.tow_id as string }
}

export type ShareGalleryImage = {
  id: string
  signedUrl: string
}

/** Load only image paths for a tow and mint short-lived signed URLs (service role). */
export async function listTowImagesForShareGallery(
  towId: string
): Promise<ShareGalleryImage[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('tow_images')
    .select('id, image_url')
    .eq('tow_id', towId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[tow-share-links] gallery images load failed', error)
    throw error
  }

  const rows = data ?? []
  const out: ShareGalleryImage[] = []

  for (const row of rows) {
    const path = normalizeTowImagePath(row.image_url as string)
    if (!path) continue

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(TOW_IMAGES_BUCKET)
      .createSignedUrl(path, TOW_IMAGE_SIGNED_URL_TTL_SEC)

    if (signError || !signed?.signedUrl) {
      console.error('[tow-share-links] signed URL failed', {
        path,
        error: signError,
      })
      continue
    }

    out.push({ id: row.id as string, signedUrl: signed.signedUrl })
  }

  return out
}
