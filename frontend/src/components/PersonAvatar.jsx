import { useState } from 'react'
import { trainerPhotoUrl } from '../utils/trainerPhoto'

// Headshot if there is one, initials otherwise — never a broken image. Used
// wherever a person's bio renders (public training hub, Trainer Dashboard,
// Staff Directory, the standalone-training Trainer tab).
//
// `photoPath` is the storage path stored in user_profiles.photo_path /
// bsc_staff.photo_path; it resolves to a public URL on the trainer-photos
// bucket. A load error falls back to initials, so a deleted or unreachable
// object degrades the same way as no photo at all.
export default function PersonAvatar({ name, photoPath, size = 48, navy = '#0E1F56', teal = '#00A79D' }) {
  const [broken, setBroken] = useState(false)
  const initials = (name || '?').trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const url = photoPath && !broken ? trainerPhotoUrl(photoPath) : null
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  }
  if (url) {
    return (
      <img
        src={url}
        alt={name ? `Photo of ${name}` : 'Photo'}
        onError={() => setBroken(true)}
        style={{ ...base, objectFit: 'cover', background: '#e5e7eb' }}
      />
    )
  }
  return (
    <div
      aria-label={name ? `${name} (no photo)` : 'No photo'}
      style={{ ...base, background: `linear-gradient(135deg, ${navy}, ${teal})`, color: 'white', fontWeight: 700, fontSize: size * 0.38 }}
    >{initials}</div>
  )
}
