import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logDownload } from '../utils/logDownload'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// The three categories a per-event material can carry, written to the existing
// bsc_event_documents.document_type column. 'agenda' doubles as the driver for
// the AgendaBanner on EventDetail and team dashboards, so categorizing a file
// as Agenda here keeps that behavior working. Resource Mapping / Goals PDFs
// are just Handouts by decision (Josh, 2026-08-26) — do NOT add a category.
const MATERIAL_CATEGORIES = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'slides', label: 'PowerPoint Slides' },
  { value: 'handout', label: 'Handout' },
]

const CATEGORY_BADGE = {
  agenda: { bg: '#dbeafe', color: '#1e40af', label: 'Agenda' },
  slides: { bg: '#fef3c7', color: '#92400e', label: 'Slides' },
  handout: { bg: '#dcfce7', color: '#166534', label: 'Handout' },
  general: { bg: '#f3f4f6', color: '#6b7280', label: 'Material' },
}

function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Per-event training-materials panel for CollaborativeDetail's events list.
// Same upload mechanics as EventDetail's Session Materials section (storage
// upload first, DB row second, storage cleanup on row failure), plus the
// category picker that drives the labelled grouping on the participant hub.
export default function EventMaterialsManager({ eventId, canManage, onCountChange }) {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [category, setCategory] = useState('handout')
  const [dragActive, setDragActive] = useState(false)

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('bsc_event_documents')
      .select('id, file_name, file_size, mime_type, storage_path, document_type, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (!error) {
      setDocuments(data || [])
      if (onCountChange) onCountChange((data || []).length)
    }
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const uploadFiles = async (files) => {
    setUploadError(null)
    setUploading(true)
    try {
      for (const file of files) {
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
        const storagePath = `${eventId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('event-documents')
          .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' })
        if (upErr) throw upErr

        const { error: insErr } = await supabase.from('bsc_event_documents').insert({
          event_id: eventId,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          document_type: category,
          uploaded_by: user?.id || null,
        })
        if (insErr) {
          await supabase.storage.from('event-documents').remove([storagePath])
          throw insErr
        }
      }
      await fetchDocuments()
    } catch (err) {
      setUploadError(err.message || String(err))
    } finally {
      setUploading(false)
    }
  }

  const handleInput = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) await uploadFiles(files)
    if (e.target) e.target.value = ''
  }

  const handleDownload = async (doc) => {
    const { data, error } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(doc.storage_path, 3600)
    if (error) { alert('Could not generate download link'); return }
    logDownload({ documentId: doc.id, userId: user?.id || null })
    window.open(data.signedUrl, '_blank')
  }

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    await supabase.storage.from('event-documents').remove([doc.storage_path])
    const { error } = await supabase.from('bsc_event_documents').delete().eq('id', doc.id)
    if (error) { alert('Error deleting document: ' + error.message); return }
    fetchDocuments()
  }

  const handleRecategorize = async (doc, newType) => {
    const { data, error } = await supabase
      .from('bsc_event_documents')
      .update({ document_type: newType })
      .eq('id', doc.id)
      .select('id')
    // An RLS refusal comes back as 0 rows with no error — surface it instead
    // of letting the UI silently snap back on reload.
    if (error || !data || data.length === 0) {
      alert('Could not change the category' + (error ? ': ' + error.message : '.'))
      return
    }
    fetchDocuments()
  }

  return (
    <div style={{
      marginTop: '0.5rem', padding: '0.75rem',
      background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px',
    }}>
      {canManage && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
            Category:{' '}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: '0.3rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.78rem' }}
            >
              {MATERIAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label style={{
            background: TEAL, color: 'white', padding: '0.35rem 0.8rem', borderRadius: '6px',
            cursor: uploading ? 'wait' : 'pointer', fontSize: '0.78rem', fontWeight: 600,
          }}>
            {uploading ? 'Uploading…' : '+ Upload file(s)'}
            <input type="file" multiple onChange={handleInput} disabled={uploading} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {canManage && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
          onDrop={async (e) => {
            e.preventDefault()
            setDragActive(false)
            const files = Array.from(e.dataTransfer?.files || [])
            if (files.length > 0) await uploadFiles(files)
          }}
          style={{
            border: `2px dashed ${dragActive ? TEAL : '#e5e7eb'}`,
            background: dragActive ? `${TEAL}10` : 'transparent',
            borderRadius: '6px', padding: '0.6rem', marginBottom: '0.6rem',
            textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', transition: 'all 0.15s',
          }}
        >
          {dragActive ? 'Drop to upload' : `Drag files here to upload as ${MATERIAL_CATEGORIES.find(c => c.value === category)?.label || 'material'}`}
        </div>
      )}

      {uploadError && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          Upload failed: {uploadError}
        </div>
      )}

      {documents.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No materials for this session yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {documents.map(d => {
            const badge = CATEGORY_BADGE[d.document_type] || CATEGORY_BADGE.general
            return (
              <li key={d.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '0.5rem', padding: '0.4rem 0', borderTop: '1px solid #f3f4f6', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: '1 1 200px' }}>
                  <span style={{
                    background: badge.bg, color: badge.color, padding: '0.1rem 0.45rem',
                    borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                  }}>{badge.label}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 500, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{fmtBytes(d.file_size)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
                  {canManage && (
                    <select
                      value={['agenda', 'slides', 'handout'].includes(d.document_type) ? d.document_type : 'handout'}
                      onChange={(e) => handleRecategorize(d, e.target.value)}
                      title="Change category"
                      style={{ padding: '0.2rem 0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.7rem', color: '#6b7280' }}
                    >
                      {MATERIAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  )}
                  <button onClick={() => handleDownload(d)} style={{
                    background: NAVY, color: 'white', border: 'none', padding: '0.25rem 0.6rem',
                    borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                  }}>Download</button>
                  {canManage && (
                    <button onClick={() => handleDelete(d)} style={{
                      background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5',
                      padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem',
                    }}>Delete</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
