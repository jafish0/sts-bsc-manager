import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Create / edit a standalone training. Mirrors RegistrationLinkModal UX
// with collapsible-style sections (Basics / Delivery / Trainer / Materials).
// Materials/agenda upload is wired through EventDetail after creation —
// V1 keeps this modal focused on event metadata.
//
// Props:
//   editingEvent?: existing bsc_events row with kind='standalone_training'
//   onClose(): void
//   onSaved(savedEvent): void
export default function StandaloneTrainingModal({ editingEvent, onClose, onSaved }) {
  const { user } = useAuth()

  const isEdit = !!editingEvent

  const [title, setTitle] = useState(editingEvent?.title || '')
  const [description, setDescription] = useState(editingEvent?.description || '')
  const [isMultiDay, setIsMultiDay] = useState(!!editingEvent?.end_date)
  const [eventDate, setEventDate] = useState(editingEvent?.event_date || '')
  const [endDate, setEndDate] = useState(editingEvent?.end_date || '')
  const [startTime, setStartTime] = useState(editingEvent?.start_time?.slice(0,5) || '')
  const [endTime, setEndTime] = useState(editingEvent?.end_time?.slice(0,5) || '')
  const [intro, setIntro] = useState(editingEvent?.training_hub_intro || '')

  // Delivery mode: derived from zoom_link presence. In-person if zoom_link is null AND any location field is set; default to 'in_person' on create.
  const initialMode = editingEvent
    ? (editingEvent.zoom_link ? 'online' : 'in_person')
    : 'in_person'
  const [mode, setMode] = useState(initialMode)
  const [zoomLink, setZoomLink] = useState(editingEvent?.zoom_link || '')
  const [locationName, setLocationName] = useState(editingEvent?.location_name || '')
  const [address, setAddress] = useState(editingEvent?.address || '')
  const [city, setCity] = useState(editingEvent?.city || '')
  const [state, setState] = useState(editingEvent?.state || '')
  const [zip, setZip] = useState(editingEvent?.zip || '')
  const [room, setRoom] = useState(editingEvent?.room || '')
  const [parkingNotes, setParkingNotes] = useState(editingEvent?.parking_notes || '')
  const [accessibilityNotes, setAccessibilityNotes] = useState(editingEvent?.accessibility_notes || '')

  const [section, setSection] = useState('basics')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Trainer info (creator). Read-only in V1.
  const [trainer, setTrainer] = useState(null)
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const trainerId = editingEvent?.created_by || user.id
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, bio')
        .eq('id', trainerId)
        .maybeSingle()
      setTrainer(data || null)
    })()
  }, [user?.id, editingEvent?.created_by])

  const handleSave = async () => {
    setError(null)
    if (!title.trim()) { setError('Title is required'); return }
    if (!eventDate) { setError('Start date is required'); return }
    if (isMultiDay && !endDate) { setError('End date is required for multi-day trainings'); return }
    if (isMultiDay && endDate < eventDate) { setError('End date must be on or after start date'); return }

    setSaving(true)
    try {
      const payload = {
        kind: 'standalone_training',
        title: title.trim(),
        description: description.trim() || null,
        event_type: 'other',  // legacy required column; standalone trainings aren't a learning_session
        audience: 'all_teams',  // legacy required column; not meaningful for standalone
        event_date: eventDate,
        end_date: isMultiDay ? endDate : null,
        start_time: startTime || null,
        end_time: endTime || null,
        training_hub_intro: intro.trim() || null,
        zoom_link: mode === 'online' ? (zoomLink.trim() || null) : null,
        location: mode === 'in_person'
          ? [locationName, room].filter(Boolean).join(' — ') || null
          : null,
        location_name: mode === 'in_person' ? (locationName.trim() || null) : null,
        address: mode === 'in_person' ? (address.trim() || null) : null,
        city: mode === 'in_person' ? (city.trim() || null) : null,
        state: mode === 'in_person' ? (state.trim() || null) : null,
        zip: mode === 'in_person' ? (zip.trim() || null) : null,
        room: mode === 'in_person' ? (room.trim() || null) : null,
        parking_notes: mode === 'in_person' ? (parkingNotes.trim() || null) : null,
        accessibility_notes: mode === 'in_person' ? (accessibilityNotes.trim() || null) : null,
      }

      let saved
      if (isEdit) {
        const { data, error: e } = await supabase
          .from('bsc_events')
          .update(payload).eq('id', editingEvent.id).select().single()
        if (e) throw e
        saved = data
      } else {
        // Generate 16-byte hex hub_token on create
        const hubToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('')
        const { data, error: e } = await supabase
          .from('bsc_events')
          .insert({ ...payload, hub_token: hubToken, created_by: user?.id || null })
          .select().single()
        if (e) throw e
        saved = data
      }

      onSaved?.(saved)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '0.75rem', maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: NAVY }}>{isEdit ? 'Edit Standalone Training' : 'Create Standalone Training'}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        {/* Section nav */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          {[
            ['basics', 'Basics'],
            ['delivery', `Delivery (${mode === 'in_person' ? 'in-person' : 'online'})`],
            ['trainer', 'Trainer'],
            ['hub', 'Hub intro'],
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
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g., Trauma-Informed Care for Foster Parents" />
            </Field>
            <Field label="Description (optional, plain text)">
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Short description shown on the registration link form." />
            </Field>
            <Field label="Multi-day training?">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={isMultiDay} onChange={e => setIsMultiDay(e.target.checked)} />
                This training runs across multiple consecutive days
              </label>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: isMultiDay ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
              <Field label={isMultiDay ? 'Start date' : 'Date'} required>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
              </Field>
              {isMultiDay && (
                <Field label="End date" required>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                </Field>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Start time (each day)">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="End time (each day)">
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            {isMultiDay && (
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.5rem' }}>
                For multi-day trainings, the start/end times apply to each day. Hub access window is from start of Day 1 through end of last day + 30 min.
              </div>
            )}
          </div>
        )}

        {section === 'delivery' && (
          <div>
            <Field label="Delivery mode" required>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.9rem' }}>
                  <input type="radio" name="mode" value="in_person" checked={mode === 'in_person'} onChange={() => setMode('in_person')} /> In-person
                </label>
                <label style={{ fontSize: '0.9rem' }}>
                  <input type="radio" name="mode" value="online" checked={mode === 'online'} onChange={() => setMode('online')} /> Online
                </label>
              </div>
            </Field>

            {mode === 'online' && (
              <Field label="Zoom (or video conferencing) link">
                <input type="url" value={zoomLink} onChange={e => setZoomLink(e.target.value)} placeholder="https://zoom.us/j/..." style={inputStyle} />
              </Field>
            )}

            {mode === 'in_person' && (
              <>
                <Field label="Location name (e.g., venue or building)">
                  <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} style={inputStyle} placeholder="University of Kentucky — Singletary Center" />
                </Field>
                <Field label="Street address">
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="160 Patterson Drive" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                  <Field label="City"><input type="text" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></Field>
                  <Field label="State"><input type="text" value={state} onChange={e => setState(e.target.value)} style={inputStyle} placeholder="KY" /></Field>
                  <Field label="ZIP"><input type="text" value={zip} onChange={e => setZip(e.target.value)} style={inputStyle} /></Field>
                </div>
                <Field label="Room (optional)">
                  <input type="text" value={room} onChange={e => setRoom(e.target.value)} style={inputStyle} placeholder="Room 121" />
                </Field>
                <Field label="Parking notes (optional)">
                  <textarea value={parkingNotes} onChange={e => setParkingNotes(e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Free parking in Lot J after 5pm; metered before." />
                </Field>
                <Field label="Accessibility notes (optional)">
                  <textarea value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Wheelchair-accessible entrance on the east side. Hearing-loop available." />
                </Field>
              </>
            )}
          </div>
        )}

        {section === 'trainer' && (
          <TrainerSection
            user={user}
            trainer={trainer}
            onBioSaved={(newBio) => setTrainer(t => t ? { ...t, bio: newBio } : t)}
          />
        )}

        {section === 'hub' && (
          <div>
            <Field label="Training hub intro (markdown)">
              <textarea
                value={intro}
                onChange={e => setIntro(e.target.value)}
                rows={10}
                placeholder={'## Welcome!\n\nThanks for joining today. The agenda is available below — please download it for reference.\n\n**Lunch** is on your own from 12:00–1:00. Restaurants nearby:\n- Greens & Such (across the street)\n- Quick Wraps (1 block east)'}
                style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Shown on the training hub above the agenda. Supports markdown — use # for headings, **bold**, *italic*, - for bullet lists, [text](url) for links.
              </div>
            </Field>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#374151', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: TEAL, color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}
          >{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create training')}</button>
        </div>

        {!isEdit && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#6b7280' }}>
            After you create the training, you'll be taken to the manage page where you can upload an agenda, add materials, generate a sign-in QR code, and create a registration link.
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '0.9rem', boxSizing: 'border-box',
}

// Trainer section with inline bio editor (only for the current user — V1 doesn't
// let admins edit another user's bio). Bio is markdown; surfaces on the
// participant training hub at /training/:hub_token.
function TrainerSection({ user, trainer, onBioSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isSelf = trainer?.id && user?.id && trainer.id === user.id

  const startEdit = () => {
    setDraft(trainer?.bio || '')
    setEditing(true)
  }
  const cancel = () => { setEditing(false); setError(null) }
  const save = async () => {
    setError(null)
    setSaving(true)
    const { error: e } = await supabase
      .from('user_profiles').update({ bio: draft.trim() || null }).eq('id', user.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    onBioSaved?.(draft.trim() || null)
    setEditing(false)
  }

  if (!trainer) return <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Loading trainer info…</div>

  return (
    <div>
      <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.75rem' }}>
        You are the trainer for this training. Co-trainer support is deferred to V2.
      </div>
      <div style={{ padding: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, color: NAVY }}>{trainer.full_name || trainer.email}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>{trainer.email}</div>
          </div>
          {isSelf && !editing && (
            <button onClick={startEdit} style={{ background: 'transparent', color: NAVY, border: `1px solid ${NAVY}`, padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
              {trainer.bio ? 'Edit bio' : 'Add bio'}
            </button>
          )}
        </div>

        {!editing ? (
          <div style={{ fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap' }}>
            {trainer.bio || <em style={{ color: '#9ca3af' }}>No bio set yet. {isSelf ? 'Click "Add bio" above to write one — it shows on the participant training hub.' : ''}</em>}
          </div>
        ) : (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              placeholder={'## About me\n\nJosh is a senior researcher at the University of Kentucky Center on Trauma and Children, where he leads...\n\nSupports markdown.'}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db', borderRadius: '6px',
                fontSize: '0.9rem', boxSizing: 'border-box',
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                resize: 'vertical',
              }}
            />
            {error && (
              <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={save} disabled={saving} style={{ background: TEAL, color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>{saving ? 'Saving…' : 'Save bio'}</button>
              <button onClick={cancel} disabled={saving} style={{ background: 'transparent', color: '#374151', border: '1px solid #d1d5db', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}
