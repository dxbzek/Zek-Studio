import { supabase } from '@/lib/supabase'

const BUCKET = 'brand-avatars'

/**
 * Upload a brand avatar to storage and return its public URL.
 * Path convention: `{brand_id}/avatar-{timestamp}.{ext}` — the first segment
 * is checked by the RLS policy against brand_profiles.user_id.
 */
export async function uploadBrandAvatar(brandId: string, file: File): Promise<string> {
  const extFromType = file.type.split('/')[1]
  const extFromName = file.name.includes('.') ? file.name.split('.').pop() : null
  const ext = (extFromName || extFromType || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${brandId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Best-effort delete of the storage object that backs a public URL. Used when
 * the user clears their avatar so we don't leave orphans behind. Callers
 * should `.catch(() => {})` — failure is non-fatal.
 */
export async function removeBrandAvatar(publicUrl: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return
  const path = publicUrl.slice(idx + marker.length)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
