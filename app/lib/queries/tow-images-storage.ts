import { supabase } from '../supabase'

export const TOW_IMAGES_BUCKET = 'tow-images'
export const TOW_IMAGE_SIGNED_URL_TTL_SEC = 3600

/** Storage path from a path or legacy public URL stored in tow_images.image_url. */
export function normalizeTowImagePath(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl
  if (pathOrUrl.startsWith('http')) {
    const extracted = pathOrUrl.split(`/${TOW_IMAGES_BUCKET}/`)[1]
    return extracted ? extracted.split('?')[0] : pathOrUrl
  }
  return pathOrUrl
}

export async function getTowImageSignedUrl(
  pathOrUrl: string
): Promise<string | null> {
  const path = normalizeTowImagePath(pathOrUrl)
  if (!path) return null

  const { data, error } = await supabase.storage
    .from(TOW_IMAGES_BUCKET)
    .createSignedUrl(path, TOW_IMAGE_SIGNED_URL_TTL_SEC)

  if (error) {
    console.error('Error creating tow image signed URL:', error)
    return null
  }

  return data.signedUrl
}

/** Replace image_url with a short-lived signed URL (keeps path in DB; display uses signed). */
export async function withSignedTowImageUrls<T extends { image_url: string }>(
  images: T[]
): Promise<T[]> {
  if (images.length === 0) return images

  return Promise.all(
    images.map(async (img) => {
      const signed = await getTowImageSignedUrl(img.image_url)
      return signed ? { ...img, image_url: signed } : img
    })
  )
}
