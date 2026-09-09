import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import PersonAvatar from './PersonAvatar'
import PersonBioEditor from './PersonBioEditor'

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
  // Column defaults to true, so an existing training with no explicit value keeps
  // its current behaviour; `!== false` rather than `?? true` so an actual false
  // isn't lost.
  const [hubEnabled, setHubEnabled] = useState(editingEvent?.hub_enabled !== false)

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
        hub_enabled: hubEnabled,
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
                For multi-day trainings, the start/end times apply to each day.
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
          isEdit
            ? <TrainersSection eventId={editingEvent.id} user={user} />
            : (
              <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.55, padding: '0.85rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                You'll be added as the <strong>lead trainer</strong> automatically when this training is created.
                Add co-trainers, hand the lead to someone else, or write bios from this tab after creating it.
              </div>
            )
        )}

        {section === 'hub' && (
          <div>
            {/* Same control as the Manage page's panel. It belongs here too: the
                hub intro is edited on this tab, and writing intro copy for a hub
                that is switched off is wasted effort. */}
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem', padding: '0.7rem', background: '#f9fafb', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hubEnabled}
                onChange={e => setHubEnabled(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
                  Open an online training hub after sign-in
                </span>
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#6b7280' }}>
                  {hubEnabled
                    ? 'Attendees go to the hub to get materials online.'
                    : 'Attendees just see “Thanks for signing in!” — use this when you hand out materials in the room. The intro below stays saved for if you switch the hub back on.'}
                </span>
              </span>
            </label>

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

// Trainer assignments for an existing training (event_trainers — the "V2"
// co-trainer support). Assigned trainers appear on the public hub and can
// manage the training (can_admin_bsc_event admits them alongside created_by).
//
// Bios and photos (2026-09-09, Josh): a bio belongs to the person, not to one
// training, so this tab is READ-ONLY for trainers — each trainer edits their
// own on the Trainer Dashboard. super_admins get an inline editor here; that
// editing goes through set_person_bio() (self or super_admin), never through
// a widened user_profiles UPDATE policy.
//
// Names/emails/bios resolve through staff_for_trainer_assignment(), a SECURITY
// DEFINER RPC: user_profiles RLS lets a trainer_admin read only their own and
// team profiles, so a plain query here would show them nobody but themselves.
function TrainersSection({ eventId, user }) {
  const { isSuperAdmin } = useAuth()
  const [assignments, setAssignments] = useState([])  // event_trainers rows
  const [staff, setStaff] = useState([])              // staff directory (+ bio, photo_path)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [pickId, setPickId] = useState('')

  const load = async () => {
    setLoading(true)
    const [{ data: rows }, { data: dir }] = await Promise.all([
      supabase.from('event_trainers')
        .select('id, user_id, is_lead, sort_order, created_at')
        .eq('bsc_event_id', eventId)
        .order('is_lead', { ascending: false })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at'),
      supabase.rpc('staff_for_trainer_assignment'),
    ])
    setAssignments(rows || [])
    setStaff(Array.isArray(dir) ? dir : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  const staffById = Object.fromEntries(staff.map(s => [s.id, s]))
  const assignedIds = new Set(assignments.map(a => a.user_id))
  const addable = staff.filter(s => !assignedIds.has(s.id))

  // Every write checks the returned row count: an RLS refusal comes back as
  // 0 rows and no error (same trap as the hub toggle).
  const addTrainer = async () => {
    if (!pickId) return
    setBusy(true); setError(null)
    const nextOrder = assignments.reduce((m, a) => Math.max(m, a.sort_order ?? 0), 0) + 1
    const { data, error: e } = await supabase
      .from('event_trainers')
      .insert({ bsc_event_id: eventId, user_id: pickId, sort_order: nextOrder })
      .select('id')
    setBusy(false)
    if (e || !data || data.length === 0) { setError('Could not add trainer' + (e ? ': ' + e.message : ' (no permission).')); return }
    setPickId('')
    load()
  }

  const removeTrainer = async (a) => {
    if (assignments.length <= 1) {
      setError('A training must keep at least one trainer — add someone else before removing this one.')
      return
    }
    const who = staffById[a.user_id]?.full_name || 'this trainer'
    if (!window.confirm(`Remove ${who} from this training?${a.is_lead ? ' The next trainer will become lead.' : ''}`)) return
    setBusy(true); setError(null)
    const { data, error: e } = await supabase.from('event_trainers').delete().eq('id', a.id).select('id')
    setBusy(false)
    if (e || !data || data.length === 0) { setError('Could not remove trainer' + (e ? ': ' + e.message : ' (no permission).')); return }
    load()
  }

  const makeLead = async (a) => {
    setBusy(true); setError(null)
    const { error: e } = await supabase.rpc('set_event_lead_trainer', { p_event_id: eventId, p_user_id: a.user_id })
    setBusy(false)
    if (e) { setError('Could not change the lead: ' + e.message); return }
    load()
  }

  // super_admin saved a bio/photo inline — reflect it without a refetch.
  const onBioChanged = (userId, next) => {
    setStaff(prev => prev.map(s => s.id === userId
      ? { ...s, bio: next.bio, has_bio: !!next.bio, photo_path: next.photoPath }
      : s))
  }

  if (loading) return <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Loading trainers…</div>

  return (
    <div>
      <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.75rem', lineHeight: 1.5 }}>
        Assigned trainers are shown to participants on the training hub (lead first) and can manage this
        training — upload materials, run sign-in, see evaluations. The person who created it keeps access too.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.9rem' }}>
        {assignments.map(a => {
          const s = staffById[a.user_id]
          const isSelf = a.user_id === user?.id
          return (
            <div key={a.id} style={{ padding: '0.75rem 0.9rem', background: '#f9fafb', border: `1px solid ${a.is_lead ? TEAL : '#e5e7eb'}`, borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  {!isSuperAdmin && <PersonAvatar name={s?.full_name} photoPath={s?.photo_path} size={40} />}
                  <div>
                    <div style={{ fontWeight: 600, color: NAVY }}>
                      {s?.full_name || 'Unknown staff member'}
                      {a.is_lead && <span style={{ marginLeft: '0.5rem', background: TEAL, color: 'white', padding: '0.05rem 0.45rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>LEAD</span>}
                      {isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#6b7280' }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{s?.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {!a.is_lead && (
                    <button onClick={() => makeLead(a)} disabled={busy} style={{ background: 'transparent', color: NAVY, border: `1px solid ${NAVY}`, padding: '0.25rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Make lead</button>
                  )}
                  <button onClick={() => removeTrainer(a)} disabled={busy || assignments.length <= 1}
                    title={assignments.length <= 1 ? 'A training must keep at least one trainer' : 'Remove from this training'}
                    style={{ background: 'transparent', color: assignments.length <= 1 ? '#9ca3af' : '#991b1b', border: `1px solid ${assignments.length <= 1 ? '#e5e7eb' : '#fca5a5'}`, padding: '0.25rem 0.6rem', borderRadius: '6px', cursor: assignments.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}>Remove</button>
                </div>
              </div>

              {/* Bio + photo: super_admins edit inline (RPC); everyone else reads. */}
              <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: '#374151' }}>
                {isSuperAdmin ? (
                  <PersonBioEditor
                    compact
                    canEdit
                    target={{ userId: a.user_id }}
                    name={s?.full_name}
                    bio={s?.bio || null}
                    photoPath={s?.photo_path || null}
                    onChange={(next) => onBioChanged(a.user_id, next)}
                  />
                ) : (
                  <div>
                    {s?.bio ? (
                      <div className="hub-markdown" style={{ lineHeight: 1.5 }}><ReactMarkdown>{s.bio}</ReactMarkdown></div>
                    ) : (
                      <em style={{ color: '#9ca3af' }}>No bio yet.</em>
                    )}
                    {isSelf && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <a href="/admin/trainer" style={{ color: NAVY, fontSize: '0.78rem', fontWeight: 600 }}>
                          Edit your bio and photo on your Trainer Dashboard →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add trainer picker — name AND email so two similar names are distinguishable */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={pickId} onChange={(e) => setPickId(e.target.value)} disabled={busy || addable.length === 0}
          style={{ ...inputStyle, width: 'auto', flex: '1 1 260px' }}>
          <option value="">{addable.length === 0 ? 'Everyone on staff is already assigned' : 'Add a trainer…'}</option>
          {addable.map(s => (
            <option key={s.id} value={s.id}>{s.full_name || '(no name)'} — {s.email}{s.role === 'super_admin' ? ' (super admin)' : ''}</option>
          ))}
        </select>
        <button onClick={addTrainer} disabled={busy || !pickId} style={{ background: pickId ? TEAL : '#9ca3af', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: pickId ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 600 }}>Add</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', marginTop: '0.75rem' }}>{error}</div>
      )}
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
