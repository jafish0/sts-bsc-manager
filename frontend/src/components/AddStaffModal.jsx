import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { COLORS } from '../utils/constants'

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
    sort_order: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        sort_order: staff.sort_order || 0
      })
    }
  }, [staff])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.full_name.trim()) {
      setError('Name is required')
      return
    }
    setError('')
    setLoading(true)

    const payload = {
      full_name: formData.full_name.trim(),
      title: formData.title.trim() || null,
      role_title: formData.role_title.trim() || null,
      organization: formData.organization.trim() || null,
      bio: formData.bio.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      collaborative_id: formData.collaborative_id || null,
      sort_order: parseInt(formData.sort_order) || 0
    }

    try {
      if (isEditing) {
        const { error: err } = await supabase
          .from('bsc_staff')
          .update(payload)
          .eq('id', staff.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('bsc_staff')
          .insert(payload)
        if (err) throw err
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
          {/* Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Full Name *</label>
            <input type="text" value={formData.full_name} onChange={(e) => handleChange('full_name', e.target.value)}
              style={inputStyle} placeholder="e.g., Jane Smith" required
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
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
