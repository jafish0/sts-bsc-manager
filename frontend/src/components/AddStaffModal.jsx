import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabase'
import { COLORS } from '../utils/constants'
import PersonAvatar from './PersonAvatar'
import { PHOTO_ACCEPT_ATTR, replacePersonPhoto, removePersonPhoto, savePersonBio } from '../utils/trainerPhoto'

// Staff directory row editor (super_admin only — bsc_staff RLS).
//
// Bio and photo go through set_person_bio(), not a direct column write: a
// directory row linked to an app account (bsc_staff.user_id) must update the
// ACCOUNT's bio, otherwise the copy shown on the public hubs goes stale while
// this form looks saved. The `staff` prop comes from staff_directory_resolved()
// so its bio/photo_path are already the resolved values.
export default function AddStaffModal({ staff, collaboratives, onClose, onSuccess }) {
  const isEditing = !!staff
  const [formData, setFormData] = useState({
    full_name: '',
    title: '',
    role_title: '',
    organization: '',
    bio: '',
    email: '',
    phone: '',
    collaborative_id: '',
    sort_order: 0,
    user_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState([])  // staff accounts for the "linked account" picker
  const [photoPath, setPhotoPath] = useState(staff?.photo_path || null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (staff) {
      setFormData({
        full_name: staff.full_name || '',
        title: staff.title || '',
        role_title: staff.role_title || '',
        organization: staff.organization || '',
        bio: staff.bio || '',
        email: staff.email || '',
        phone: staff.phone || '',
        collaborative_id: staff.collaborative_id || '',
        sort_order: staff.sort_order || 0,
        user_id: staff.user_id || ''
      })
      setPhotoPath(staff.photo_path || null)
    }
  }, [staff])

  useEffect(() => {
    // super_admin/trainer_admin accounts, for linking a directory row to the
    // person's login. Inviting Jessica or Stephanie later is then one pick.
    supabase.rpc('staff_for_trainer_assignment').then(({ data }) => setAccounts(Array.isArray(data) ? data : []))
  }, [])

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !staff?.id) return
    setPhotoBusy(true); setError('')
    try {
      const path = await replacePersonPhoto(file, { staffId: staff.id })
      setPhotoPath(path)
    } catch (err) {
      setError(err.message)
    } finally {
      setPhotoBusy(false)
    }
  }
  const onRemovePhoto = async () => {
    if (!staff?.id || !window.confirm('Remove this photo?')) return
    setPhotoBusy(true); setError('')
    try {
      await removePersonPhoto({ staffId: staff.id })
      setPhotoPath(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.full_name.trim()) {
      setError('Name is required')
      return
    }
    setError('')
    setLoading(true)

    // bio is deliberately NOT in the row payload — see the note at the top.
    const payload = {
      full_name: formData.full_name.trim(),
      title: formData.title.trim() || null,
      role_title: formData.role_title.trim() || null,
      organization: formData.organization.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      collaborative_id: formData.collaborative_id || null,
      sort_order: parseInt(formData.sort_order) || 0,
      user_id: formData.user_id || null
    }

    try {
      let staffId = staff?.id
      if (isEditing) {
        const { data, error: err } = await supabase
          .from('bsc_staff')
          .update(payload)
          .eq('id', staff.id)
          .select('id')
        if (err) throw err
        if (!data || data.length === 0) throw new Error('No permission to edit this staff member.')
      } else {
        const { data, error: err } = await supabase
          .from('bsc_staff')
          .insert(payload)
          .select('id')
          .single()
        if (err) throw err
        staffId = data.id
      }
      // Bio through the RPC: lands on the linked account if there is one,
      // else on the directory row.
      const bioBefore = (staff?.bio || '').trim()
      if (!isEditing || formData.bio.trim() !== bioBefore || (staff?.user_id || '') !== (formData.user_id || '')) {
        await savePersonBio(formData.bio.trim() || null, { staffId })
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem',
    border: '2px solid #e5e7eb', borderRadius: '8px',
    fontSize: '0.95rem', boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  }
  const labelStyle = {
    display: 'block', color: '#374151', fontSize: '0.85rem',
    fontWeight: '600', marginBottom: '0.35rem'
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: '12px', padding: '2rem',
          maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: COLORS.navy, marginTop: 0, marginBottom: '1.5rem' }}>
          {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Photo (edit mode only — the row has to exist before a photo can point at it) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <PersonAvatar name={formData.full_name || staff?.full_name} photoPath={photoPath} size={72} />
            <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.45 }}>
              {isEditing ? (
                <>
                  <input ref={fileRef} type="file" accept={PHOTO_ACCEPT_ATTR} onChange={onPickPhoto} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} style={{ background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>{photoBusy ? 'Uploading…' : (photoPath ? 'Replace photo' : 'Add photo')}</button>
                    {photoPath && <button type="button" onClick={onRemovePhoto} disabled={photoBusy} style={{ background: 'transparent', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Remove</button>}
                  </div>
                  Photos are published on public hub pages. JPEG, PNG or WebP up to 2 MB; resized to about 512px.
                </>
              ) : 'Save the staff member first, then add a photo.'}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Full Name *</label>
            <input type="text" value={formData.full_name} onChange={(e) => handleChange('full_name', e.target.value)}
              style={inputStyle} placeholder="e.g., Jane Smith" required
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Linked app account — when set, the ACCOUNT's bio and photo are what
              every page shows; this row's own copies become historical. */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Linked app account</label>
            <select value={formData.user_id} onChange={(e) => handleChange('user_id', e.target.value)} style={inputStyle}>
              <option value="">Not linked (no account yet)</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.full_name || '(no name)'} — {a.email}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem' }}>
              Link to the person's CTAC App login so their bio and photo are the same everywhere. Leave unlinked for staff who don't have an account yet.
            </div>
          </div>

          {/* Title / Credentials */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Title / Credentials</label>
            <input type="text" value={formData.title} onChange={(e) => handleChange('title', e.target.value)}
              style={inputStyle} placeholder="e.g., Ph.D., LCSW"
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Role Title */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Role Title</label>
            <input type="text" value={formData.role_title} onChange={(e) => handleChange('role_title', e.target.value)}
              style={inputStyle} placeholder="e.g., Project Coordinator"
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Organization */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Organization</label>
            <input type="text" value={formData.organization} onChange={(e) => handleChange('organization', e.target.value)}
              style={inputStyle} placeholder="e.g., University of Kentucky"
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Bio</label>
            <textarea value={formData.bio} onChange={(e) => handleChange('bio', e.target.value)}
              rows={4} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Short biography..."
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Email + Phone row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)}
                style={inputStyle} placeholder="name@org.edu"
                onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)}
                style={inputStyle} placeholder="(555) 123-4567"
                onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
            </div>
          </div>

          {/* Collaborative */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Collaborative</label>
              <select value={formData.collaborative_id} onChange={(e) => handleChange('collaborative_id', e.target.value)}
                style={inputStyle}>
                <option value="">Global (All Collaboratives)</option>
                {collaboratives.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sort Order</label>
              <input type="number" value={formData.sort_order} onChange={(e) => handleChange('sort_order', e.target.value)}
                style={inputStyle} min="0"
                onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b',
              padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading} style={{
              background: '#e5e7eb', color: '#374151', padding: '0.75rem 1.5rem',
              borderRadius: '8px', border: 'none', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem'
            }}>Cancel</button>
            <button type="submit" disabled={loading} style={{
              background: loading ? '#9ca3af' : `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 100%)`,
              color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px',
              border: 'none', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 167, 157, 0.3)'
            }}>{loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Staff Member'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
