import { supabase } from './supabase'

// Trainer headshots live in the PUBLIC `trainer-photos` bucket (they render on
// anonymous hub pages; a private bucket would need an anon-readable SELECT
// policy, which is the storage/RLS subquery trap CLAUDE.md records). Paths are
// random, so nothing can be walked by user id.
const BUCKET = 'trainer-photos'
const MAX_EDGE = 512          // px on the long edge — hub pages open on phones
const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

export const PHOTO_ACCEPT_ATTR = ACCEPT.join(',')

export function trainerPhotoUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Downscale to ~512px on the long edge and re-encode as JPEG. A 4 MB camera
// photo rendered at thumbnail size is a slow page for no benefit.
export async function downscaleImage(file) {
  if (!ACCEPT.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG or WebP image.')
  }
  const bitmap = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  // Flatten transparency onto white so PNG logos don't come out black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (typeof bitmap.close === 'function') bitmap.close()
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.86)
  })
  if (blob.size > MAX_BYTES) throw new Error('That image is still over 2 MB after resizing — please pick a smaller one.')
  return blob
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read the image.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Full replace flow:
//   1. upload the downscaled image under a random name
//   2. set_person_bio() swaps the pointer (self or super_admin; a linked
//      directory row updates the ACCOUNT) and returns the previous path
//   3. delete the previous object — it is unreferenced now, so the bucket's
//      DELETE policy admits any staff member; files do not orphan.
// Target is { userId } or { staffId }.
export async function replacePersonPhoto(file, target) {
  const blob = await downscaleImage(file)
  const path = `${crypto.randomUUID()}.jpg`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
  if (upErr) throw new Error('Upload failed: ' + upErr.message)

  const { data, error: rpcErr } = await supabase.rpc('set_person_bio', {
    p_target_user: target.userId || null,
    p_staff_id: target.staffId || null,
    p_photo_path: path,
    p_update_photo: true,
  })
  if (rpcErr) {
    // Don't leave the fresh upload orphaned if the pointer swap was refused.
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(rpcErr.message)
  }
  const old = data?.old_photo_path
  if (old && old !== path) {
    // Best effort; a refusal here leaves a stray file, not a broken page.
    await supabase.storage.from(BUCKET).remove([old])
  }
  return path
}

// Remove a person's photo: clear the pointer first, then delete the object.
export async function removePersonPhoto(target) {
  const { data, error } = await supabase.rpc('set_person_bio', {
    p_target_user: target.userId || null,
    p_staff_id: target.staffId || null,
    p_photo_path: null,
    p_update_photo: true,
  })
  if (error) throw new Error(error.message)
  const old = data?.old_photo_path
  if (old) await supabase.storage.from(BUCKET).remove([old])
}

// Save a bio through the same RPC (self or super_admin). Empty → NULL.
export async function savePersonBio(bio, target) {
  const { error } = await supabase.rpc('set_person_bio', {
    p_target_user: target.userId || null,
    p_staff_id: target.staffId || null,
    p_bio: bio ?? null,
    p_update_bio: true,
  })
  if (error) throw new Error(error.message)
}
