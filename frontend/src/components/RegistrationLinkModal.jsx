import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'
const RED = '#ef4444'

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'email_confirm', label: 'Confirm Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Dropdown (select)' },
  { value: 'radio', label: 'Radio buttons' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'number', label: 'Number' },
]

const SEEDED_SCHEMA = [
  { key: 'full_name', label: 'Name', type: 'text', required: true, system: true },
  { key: 'email', label: 'Email', type: 'email', required: true, system: true },
  { key: 'email_confirm', label: 'Confirm Email', type: 'email_confirm', required: true, system: true, matches: 'email' },
  { key: 'agency', label: 'Agency', type: 'text', required: true },
  { key: 'role', label: 'Role at agency', type: 'text', required: true },
]

const COMMON_FIELD_PRESETS = [
  { key: 'phone', label: 'Phone (optional, for SMS reminders)', type: 'phone', required: false },
  { key: 'districts', label: 'District(s) Served', type: 'text', required: false },
  { key: 'state', label: 'State', type: 'text', required: false },
  { key: 'how_heard', label: 'How did you hear about this training?', type: 'textarea', required: false },
  { key: 'accommodations', label: 'Accommodation needs (optional)', type: 'textarea', required: false },
]

// Create / edit a registration link (admin-only).
// Props:
//   collaborativeId: string
//   eventsForCollab: [{id, title, event_date, ...}]
//   editingLink?: existing link row (if editing); null if creating
//   onClose(): void
//   onSaved(savedLink): void
export default function RegistrationLinkModal({ collaborativeId, eventsForCollab, editingLink, onClose, onSaved }) {
  const { user } = useAuth()

  const [title, setTitle] = useState(editingLink?.title || '')
  const [description, setDescription] = useState(editingLink?.description || '')
  const [capacity, setCapacity] = useState(editingLink?.capacity || '')
  const [waitlistEnabled, setWaitlistEnabled] = useState(editingLink?.waitlist_enabled ?? true)
  const [opensAt, setOpensAt] = useState(editingLink?.registration_opens_at ? toLocal(editingLink.registration_opens_at) : '')
  const [closesAt, setClosesAt] = useState(editingLink?.registration_closes_at ? toLocal(editingLink.registration_closes_at) : '')
  const [isActive, setIsActive] = useState(editingLink?.is_active ?? true)
  const [selectedEventIds, setSelectedEventIds] = useState(new Set())
  const [schema, setSchema] = useState(editingLink?.form_schema?.length ? editingLink.form_schema : SEEDED_SCHEMA)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedLink, setSavedLink] = useState(null) // for share link display
  const [section, setSection] = useState('basics') // 'basics' | 'events' | 'fields'

  useEffect(() => {
    // When editing, load which events are covered
    if (editingLink) {
      ;(async () => {
        const { data } = await supabase
          .from('event_registration_link_events')
          .select('event_id')
          .eq('registration_link_id', editingLink.id)
        setSelectedEventIds(new Set((data || []).map(r => r.event_id)))
      })()
    } else {
      // New link: default to all events selected
      setSelectedEventIds(new Set(eventsForCollab.map(e => e.id)))
    }
  }, [editingLink, eventsForCollab])

  const toggleEvent = (eventId) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId)
      return next
    })
  }

  const moveField = (idx, dir) => {
    setSchema(prev => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(idx, 1)
      copy.splice(newIdx, 0, moved)
      return copy
    })
  }

  const updateField = (idx, patch) => {
    setSchema(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  const removeField = (idx) => {
    if (schema[idx].system) return
    setSchema(prev => prev.filter((_, i) => i !== idx))
  }

  const addCustomField = () => {
    const key = `custom_${Date.now().toString(36)}`
    setSchema(prev => [...prev, { key, label: 'New field', type: 'text', required: false }])
  }

  const addCommonField = (preset) => {
    if (schema.some(f => f.key === preset.key)) return // already added
    setSchema(prev => [...prev, { ...preset }])
  }

  const handleSave = async () => {
    setError(null)
    if (!title.trim()) { setError('Title is required'); return }
    if (capacity !== '' && (Number.isNaN(Number(capacity)) || Number(capacity) <= 0)) { setError('Capacity must be a positive number or blank'); return }
    if (selectedEventIds.size === 0) { setError('Pick at least one event'); return }

    setSaving(true)
    try {
      const payload = {
        collaborative_id: collaborativeId,
        title: title.trim(),
        description: description.trim() || null,
        capacity: capacity === '' ? null : Number(capacity),
        waitlist_enabled: waitlistEnabled,
        registration_opens_at: opensAt ? new Date(opensAt).toISOString() : null,
        registration_closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        form_schema: schema,
        is_active: isActive,
      }

      let saved
      if (editingLink) {
        const { data, error: e } = await supabase
          .from('event_registration_links')
          .update(payload).eq('id', editingLink.id).select().single()
        if (e) throw e
        saved = data
        // Replace the events covered: simplest correct approach is delete-then-insert
        await supabase.from('event_registration_link_events').delete().eq('registration_link_id', editingLink.id)
      } else {
        const { data, error: e } = await supabase
          .from('event_registration_links')
          .insert({ ...payload, created_by: user?.id || null }).select().single()
        if (e) throw e
        saved = data
      }

      // Insert event links
      const eventRows = Array.from(selectedEventIds).map(eid => ({ registration_link_id: saved.id, event_id: eid }))
      if (eventRows.length > 0) {
        const { error: eErr } = await supabase.from('event_registration_link_events').insert(eventRows)
        if (eErr) throw eErr
      }

      setSavedLink(saved)
      onSaved?.(saved)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const shareUrl = (savedLink || editingLink) ? `https://bsc.ctac.app/register/${(savedLink || editingLink).token}` : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '0.75rem', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: NAVY }}>
            {editingLink ? 'Edit Registration Link' : 'Create Registration Link'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        {/* Section nav */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          {[
            ['basics', 'Basics'],
            ['events', `Events (${selectedEventIds.size})`],
            ['fields', `Form fields (${schema.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                background: section === id ? NAVY : 'transparent',
                color: section === id ? 'white' : '#374151',
                border: '1px solid ' + (section === id ? NAVY : '#d1d5db'),
                padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
              }}
            >{label}</button>
          ))}
        </div>

        {section === 'basics' && (
          <div>
            <Field label="Title" required>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g., Demo 2026 Collaborative Registration" />
            </Field>
            <Field label="Description (optional)">
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Shown on the registration page above the form." />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Capacity (blank = unlimited)">
                <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} style={inputStyle} placeholder="e.g., 50" />
              </Field>
              <Field label="Waitlist">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', paddingTop: '0.5rem' }}>
                  <input type="checkbox" checked={waitlistEnabled} onChange={e => setWaitlistEnabled(e.target.checked)} />
                  Allow waitlist when full
                </label>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Registration opens (optional)">
                <input type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Registration closes (optional)">
                <input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                Active (uncheck to immediately close registration)
              </label>
            </Field>
          </div>
        )}

        {section === 'events' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 0 }}>
              All events in this collaborative are checked by default. Uncheck any to scope this registration link to a subset.
            </p>
            {eventsForCollab.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No events on this collaborative yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {eventsForCollab.map(ev => (
                  <li key={ev.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedEventIds.has(ev.id)} onChange={() => toggleEvent(ev.id)} />
                      <span><strong>{ev.title}</strong> · {ev.event_date}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === 'fields' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 0 }}>
              Drag is not enabled in V1 — use ↑ ↓ to reorder. The five seeded fields can be edited but not deleted.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {schema.map((f, idx) => (
                <li key={f.key + idx} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '0.4rem', background: f.system ? '#f9fafb' : 'white' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 8rem auto', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <button onClick={() => moveField(idx, -1)} disabled={idx === 0} style={miniBtn}>↑</button>
                      <button onClick={() => moveField(idx, +1)} disabled={idx === schema.length - 1} style={miniBtn}>↓</button>
                    </div>
                    <input type="text" value={f.label} onChange={e => updateField(idx, { label: e.target.value })} style={inputStyle} placeholder="Field label" />
                    <select value={f.type} onChange={e => updateField(idx, { type: e.target.value })} disabled={f.system} style={inputStyle}>
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => removeField(idx)} disabled={f.system} title={f.system ? 'System field — cannot delete' : 'Delete field'} style={{ background: 'transparent', border: 'none', color: f.system ? '#d1d5db' : RED, cursor: f.system ? 'not-allowed' : 'pointer', fontSize: '1.1rem' }}>🗑</button>
                  </div>
                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.78rem', color: '#374151' }}>
                    <label><input type="checkbox" checked={!!f.required} onChange={e => updateField(idx, { required: e.target.checked })} /> Required</label>
                    {(f.type === 'select' || f.type === 'radio') && (
                      <input type="text" placeholder="Options, comma-separated (label1=value1, label2=value2)" value={(f.options || []).map(o => `${o.label}=${o.value}`).join(', ')} onChange={e => {
                        const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        const opts = parts.map(p => {
                          const eq = p.indexOf('=')
                          return eq >= 0 ? { label: p.slice(0, eq).trim(), value: p.slice(eq + 1).trim() } : { label: p, value: p }
                        })
                        updateField(idx, { options: opts })
                      }} style={{ ...inputStyle, fontSize: '0.78rem' }} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button onClick={addCustomField} style={{ background: TEAL, color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>+ Add custom field</button>
              {COMMON_FIELD_PRESETS.map(p => (
                <button key={p.key} onClick={() => addCommonField(p)} disabled={schema.some(f => f.key === p.key)} style={{ background: 'transparent', color: NAVY, border: `1px solid ${NAVY}`, padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: schema.some(f => f.key === p.key) ? 'not-allowed' : 'pointer', fontSize: '0.78rem', opacity: schema.some(f => f.key === p.key) ? 0.5 : 1 }}>+ {p.label}</button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</div>
        )}

        {shareUrl && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, marginBottom: '0.25rem' }}>Public registration link:</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <code style={{ flex: 1, background: 'white', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', wordBreak: 'break-all' }}>{shareUrl}</code>
              <button onClick={() => { navigator.clipboard.writeText(shareUrl) }} style={{ background: '#065f46', color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>Copy</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#374151', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: TEAL, color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}
          >{saving ? 'Saving…' : (editingLink || savedLink ? 'Save changes' : 'Create registration link')}</button>
        </div>
      </div>
    </div>
  )
}

function toLocal(isoString) {
  // Convert ISO timestamp into a value usable by <input type="datetime-local">
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '0.9rem', boxSizing: 'border-box',
}

const miniBtn = {
  background: 'transparent', border: '1px solid #d1d5db',
  padding: '0.1rem 0.4rem', borderRadius: '4px',
  cursor: 'pointer', fontSize: '0.7rem',
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}
