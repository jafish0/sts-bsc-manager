import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { DOMAIN_OPTIONS as FALLBACK_DOMAINS } from '../utils/constants'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

const TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word Doc (.docx)' },
  { value: 'doc', label: 'Word Doc (.doc)' },
  { value: 'pptx', label: 'PowerPoint (.pptx)' },
  { value: 'youtube', label: 'YouTube Video' },
  { value: 'link', label: 'External Link' }
]

const FILE_TYPES = ['pdf', 'docx', 'doc', 'pptx']

function AddResourceModal({ onClose, onSuccess, domains: propDomains, categories }) {
  // If categories are provided, use category mode (tags); otherwise domain mode
  const useCategories = categories && categories.length > 0
  const options = useCategories ? categories : (propDomains && propDomains.length > 0 ? propDomains : FALLBACK_DOMAINS)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDomains, setSelectedDomains] = useState([])
  const [resourceType, setResourceType] = useState('pdf')
  const [file, setFile] = useState(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleDomain = (value) => {
    setSelectedDomains(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]
    )
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (!selected) return
    if (selected.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB')
      return
    }
    setFile(selected)
    setError('')
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Title is required'); return }
    if (selectedDomains.length === 0) { setError(useCategories ? 'Select at least one category' : 'Select at least one domain'); return }
    if (FILE_TYPES.includes(resourceType) && !file) { setError('Please select a file'); return }
    if (resourceType === 'youtube' && !youtubeUrl.trim()) { setError('YouTube URL is required'); return }
    if (resourceType === 'link' && !linkUrl.trim()) { setError('Link URL is required'); return }

    if (resourceType === 'youtube') {
      const ytMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
      if (!ytMatch) { setError('Please enter a valid YouTube URL'); return }
    }

    setLoading(true)
    try {
      let filePath = null
      let fileName = null

      if (FILE_TYPES.includes(resourceType) && file) {
        const ext = file.name.split('.').pop()
        const uniqueName = `${crypto.randomUUID()}.${ext}`
        filePath = `resources/${uniqueName}`
        fileName = file.name

        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(filePath, file)

        if (uploadError) throw uploadError
      }

      const insertData = {
        title: title.trim(),
        description: description.trim() || null,
        resource_type: resourceType,
        file_path: filePath,
        file_name: fileName,
        youtube_url: resourceType === 'youtube' ? youtubeUrl.trim() : null,
        link_url: resourceType === 'link' ? linkUrl.trim() : null,
      }

      if (useCategories) {
        insertData.tags = selectedDomains
        insertData.domains = []
      } else {
        insertData.domains = selectedDomains
        insertData.tags = []
      }

      const { error: insertError } = await supabase
        .from('resources')
        .insert(insertData)

      if (insertError) {
        if (filePath) await supabase.storage.from('resources').remove([filePath])
        throw insertError
      }

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Add resource error:', err)
      setError(err.message || 'Failed to add resource')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb',
    borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  }
  const labelStyle = {
    display: 'block', color: '#374151', fontSize: '0.9rem',
    fontWeight: '600', marginBottom: '0.5rem'
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
        <h2 style={{ color: NAVY, marginTop: 0, marginBottom: '0.25rem' }}>Add Resource</h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Add a resource to the shared library. All teams will be able to access it.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Title *</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource title" required style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = TEAL}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description" rows={2}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              onFocus={(e) => e.target.style.borderColor = TEAL}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Domain/Category Checkboxes */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>{useCategories ? 'Category(s)' : 'Domain(s)'} *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {options.map(d => (
                <label
                  key={d.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem', borderRadius: '6px', cursor: 'pointer',
                    background: selectedDomains.includes(d.value) ? '#e0f7f5' : '#f9fafb',
                    border: `1px solid ${selectedDomains.includes(d.value) ? TEAL : '#e5e7eb'}`,
                    fontSize: '0.85rem', transition: 'all 0.15s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDomains.includes(d.value)}
                    onChange={() => toggleDomain(d.value)}
                    style={{ accentColor: TEAL }}
                  />
                  <span style={{ color: '#374151' }}>{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Resource Type */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Resource Type *</label>
            <select
              value={resourceType} onChange={(e) => setResourceType(e.target.value)}
              style={inputStyle}
            >
              {TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Conditional: File Upload */}
          {FILE_TYPES.includes(resourceType) && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Upload File *</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.pptx"
                onChange={handleFileChange}
                style={{ fontSize: '0.9rem' }}
              />
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Max file size: 10MB
              </p>
            </div>
          )}

          {/* Conditional: YouTube URL */}
          {resourceType === 'youtube' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>YouTube URL *</label>
              <input
                type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtu.be/... or https://youtube.com/watch?v=..."
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = TEAL}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          )}

          {/* Conditional: External Link */}
          {resourceType === 'link' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Link URL *</label>
              <input
                type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/resource"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = TEAL}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          )}

          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b',
              padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading} style={{
              background: '#e5e7eb', color: '#374151', padding: '0.75rem 1.5rem',
              borderRadius: '8px', border: 'none', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem',
              opacity: loading ? 0.6 : 1
            }}>Cancel</button>
            <button type="submit" disabled={loading} style={{
              background: loading ? '#9ca3af' : `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
              color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px',
              border: 'none', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem', boxShadow: loading ? 'none' : '0 4px 12px rgba(0,167,157,0.3)'
            }}>{loading ? 'Adding...' : 'Add Resource'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddResourceModal
