import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROGRAM_TYPE_COLORS, CREATABLE_PROGRAM_TYPES, getProgramBranding } from '../config/programConfig'
import { parseScheduleLines, htmlToScheduleLines, rowsToBscEvents } from '../utils/scheduleParser'

// Build the locked, pre-populated event list for a given program type.
// Falls back to STS-BSC defaults if program has none defined.
function buildDefaultEvents(programType) {
  const branding = getProgramBranding(programType)
  const defaults = branding.defaultEvents || []
  return defaults.map(d => ({
    event_type: d.event_type,
    title: d.title,
    event_date: '',
    start_time: '',
    end_time: '',
    location: 'Virtual',
    zoom_link: '',
    sequence_number: d.sequence_number,
    locked: true,
  }))
}

const EVENT_TYPES = [
  { value: 'learning_session', label: 'Learning Session', audience: 'all_teams' },
  { value: 'all_team_call', label: 'All-Team Call', audience: 'all_teams' },
  { value: 'senior_leader_call', label: 'Senior Leader Call', audience: 'senior_leaders' },
  { value: 'other', label: 'Other', audience: 'all_teams' }
]

const inputStyle = {
  width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb',
  borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box'
}

// Helper: add days to a date string
function addDays(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function CreateCollaborativeModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    program_type: 'sts_bsc'
  })

  // CTAC trainer/coordinator assignment. Pre-populates the current user as both
  // trainer and coordinator (whoever is creating the collaborative). Other
  // super_admins can be added in the multi-select.
  const [superAdmins, setSuperAdmins] = useState([])
  const [trainerIds, setTrainerIds] = useState(() => user?.id ? [user.id] : [])
  const [coordinatorId, setCoordinatorId] = useState(() => user?.id || '')

  // Pre-populate the standard schedule for the selected program type.
  // Default events are sourced from each program's welcome packet / agenda — see programConfig.js.
  // Resets when program_type changes (see effect below).
  const [bscEvents, setBscEvents] = useState(() => buildDefaultEvents(formData.program_type))

  // Auto-computed assessment dates from LS3
  const [assessmentDates, setAssessmentDates] = useState({
    baseline_start_date: '', baseline_end_date: '',
    endline_start_date: '', endline_end_date: '',
    followup_6mo_start_date: '', followup_6mo_end_date: '',
    followup_12mo_start_date: '', followup_12mo_end_date: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset event list to the program's defaults whenever program_type changes.
  useEffect(() => {
    setBscEvents(buildDefaultEvents(formData.program_type))
  }, [formData.program_type])

  // Load all active super_admins for the trainer/coordinator pickers.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to load super_admins:', error)
          return
        }
        setSuperAdmins(data || [])
      })
    return () => { cancelled = true }
  }, [])

  // Toggle a super_admin in/out of the trainerIds set.
  const toggleTrainer = (uid) => {
    setTrainerIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])
  }

  // Helper: get first and last Learning Sessions by sequence_number (program-agnostic).
  const learningSessions = bscEvents
    .filter(e => e.event_type === 'learning_session')
    .slice()
    .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
  const firstLs = learningSessions[0]
  const lastLs = learningSessions[learningSessions.length - 1]

  // Auto-compute assessment dates when LS dates change.
  // Anchored to the first LS (baseline) and the last LS (endline + follow-ups).
  useEffect(() => {
    if (firstLs?.event_date) {
      // Baseline: 4 weeks before first LS through day before first LS
      setAssessmentDates(prev => ({
        ...prev,
        baseline_start_date: addDays(firstLs.event_date, -28),
        baseline_end_date: addDays(firstLs.event_date, -1)
      }))
    }

    if (lastLs?.event_date) {
      // Endline: 2 weeks after last LS through 6 weeks after
      const endlineStart = addDays(lastLs.event_date, 14)
      const endlineEnd = addDays(lastLs.event_date, 42)
      // 6mo follow-up: 6 months after last LS (180 days) ± 3 weeks
      const sixMoCenter = addDays(lastLs.event_date, 180)
      const sixMoStart = addDays(sixMoCenter, -21)
      const sixMoEnd = addDays(sixMoCenter, 21)
      // 12mo follow-up: 12 months after last LS (365 days) ± 3 weeks
      const twelveMoCenter = addDays(lastLs.event_date, 365)
      const twelveMoStart = addDays(twelveMoCenter, -21)
      const twelveMoEnd = addDays(twelveMoCenter, 21)

      setAssessmentDates(prev => ({
        ...prev,
        endline_start_date: endlineStart,
        endline_end_date: endlineEnd,
        followup_6mo_start_date: sixMoStart,
        followup_6mo_end_date: sixMoEnd,
        followup_12mo_start_date: twelveMoStart,
        followup_12mo_end_date: twelveMoEnd
      }))
    }
  }, [firstLs?.event_date, lastLs?.event_date])

  const addEvent = () => {
    // Per-program default label + type for the newly-added event row.
    // (TIC LC and TIPE LC default to "Implementation Session"; STS-BSC and FourC
    //  default to "All-Team Call".) Defined in programConfig.js.
    const branding = getProgramBranding(formData.program_type)
    const { label, event_type } = branding.addEventDefault || { label: 'All-Team Call', event_type: 'all_team_call' }
    // Number additions independently from pre-populated events: count rows whose
    // title already starts with this label so successive clicks produce 1, 2, 3...
    const count = bscEvents.filter(e => typeof e.title === 'string' && e.title.startsWith(label)).length
    const newEvt = {
      event_type,
      title: `${label} ${count + 1}`,
      event_date: '', start_time: '', end_time: '', location: 'Virtual',
      zoom_link: '',
      sequence_number: null, locked: false
    }
    setBscEvents(prev => [...prev, newEvt])
  }

  const updateEvent = (idx, field, value) => {
    setBscEvents(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      if (field === 'event_type' && !updated[idx].locked) {
        const countOfType = prev.filter((e, i) => i !== idx && e.event_type === value).length
        const typeLabel = EVENT_TYPES.find(t => t.value === value)?.label || value
        updated[idx].title = `${typeLabel} ${countOfType + 1}`
      }
      return updated
    })
  }

  const removeEvent = (idx) => {
    setBscEvents(prev => prev.filter((_, i) => i !== idx))
  }

  // --- Schedule row reordering (drag handle + ↑/↓ buttons) ---
  // Creation-time convenience only: it lets the list mirror the order printed
  // on the real schedule document (CTAC interleaves sessions and calls rather
  // than grouping by type). Nothing downstream depends on row order — every
  // consumer of bsc_events sorts by event_date. sequence_number IS recomputed
  // per event_type so "Learning Session N" numbering follows visual order;
  // numbering is never mixed across types, and added rows (null sequence)
  // stay null.
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [dragArmedIdx, setDragArmedIdx] = useState(null)

  const moveEvent = (from, to) => {
    setBscEvents(prev => {
      if (from == null || to == null || from === to) return prev
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      const counters = {}
      return next.map(e => {
        if (e.sequence_number == null) return e
        counters[e.event_type] = (counters[e.event_type] || 0) + 1
        return { ...e, sequence_number: counters[e.event_type] }
      })
    })
  }

  const endDrag = () => { setDragIdx(null); setDragOverIdx(null); setDragArmedIdx(null) }

  // --- Schedule document import ---
  // CTAC schedules arrive as Word tables (session label / date / time range).
  // Parsed client-side; NEVER auto-applied — the preview below requires an
  // explicit Confirm, and a failed parse leaves whatever is already typed alone.
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState(null) // { rows, unmatched, source }
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [dropActive, setDropActive] = useState(false)

  // Rows the user has already filled in — Confirm replaces them, so warn first.
  const typedRowCount = bscEvents.filter(
    e => e.event_date || e.start_time || e.end_time || e.zoom_link
  ).length

  const runImport = (lines, source) => {
    const { rows, unmatched } = parseScheduleLines(lines)
    if (rows.length === 0) {
      setImportPreview(null)
      setImportError(
        source === 'file'
          ? 'Could not read a schedule from this file — please enter the dates manually.'
          : 'Could not read a schedule from that text — please enter the dates manually.'
      )
      return
    }
    setImportError('')
    setImportPreview({ rows, unmatched, source })
  }

  const handleScheduleFile = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setImportPreview(null)
      setImportError('That is not a .docx file — use "or paste your schedule" below for PDFs, emails, or Excel.')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      // Loaded on demand so mammoth stays out of the initial bundle.
      const mod = await import('mammoth')
      const mammoth = mod.default || mod
      const arrayBuffer = await file.arrayBuffer()
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
      runImport(htmlToScheduleLines(html), 'file')
    } catch (err) {
      console.error('Schedule import failed:', err)
      setImportPreview(null)
      setImportError('Could not read a schedule from this file — please enter the dates manually.')
    } finally {
      setImporting(false)
    }
  }

  const applyImport = () => {
    if (!importPreview?.rows?.length) return
    setBscEvents(rowsToBscEvents(importPreview.rows))
    setImportPreview(null)
    setPasteOpen(false)
    setPasteText('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.name.trim()) {
      setError('Collaborative name is required')
      setLoading(false)
      return
    }

    // Validate first and last Learning Session dates are set
    if (!firstLs?.event_date || !lastLs?.event_date) {
      setError('Please set dates for the first and last Learning Sessions')
      setLoading(false)
      return
    }

    // Validate at least one trainer + a coordinator
    if (!coordinatorId) {
      setError('Please select an event coordinator')
      setLoading(false)
      return
    }
    if (trainerIds.length === 0 && !coordinatorId) {
      setError('Please assign at least one trainer')
      setLoading(false)
      return
    }

    // Derive start/end from first LS and follow-up window
    const startDate = addDays(firstLs.event_date, -30) // 30 days before first LS
    const endDate = assessmentDates.followup_12mo_end_date || addDays(lastLs.event_date, 400)

    try {
      const { data, error: insertError } = await supabase
        .from('collaboratives')
        .insert([{
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          program_type: formData.program_type,
          start_date: startDate,
          end_date: endDate,
          baseline_start_date: assessmentDates.baseline_start_date || null,
          baseline_end_date: assessmentDates.baseline_end_date || null,
          endline_start_date: assessmentDates.endline_start_date || null,
          endline_end_date: assessmentDates.endline_end_date || null,
          followup_6mo_start_date: assessmentDates.followup_6mo_start_date || null,
          followup_6mo_end_date: assessmentDates.followup_6mo_end_date || null,
          followup_12mo_start_date: assessmentDates.followup_12mo_start_date || null,
          followup_12mo_end_date: assessmentDates.followup_12mo_end_date || null,
          status: formData.status
        }])
        .select()
        .single()

      if (insertError) throw insertError

      // Insert BSC events
      const eventsToInsert = bscEvents
        .filter(evt => evt.event_date)
        .map(evt => {
          const typeInfo = EVENT_TYPES.find(t => t.value === evt.event_type)
          return {
            collaborative_id: data.id,
            event_type: evt.event_type,
            title: evt.title || evt.event_type,
            event_date: evt.event_date,
            start_time: evt.start_time || null,
            end_time: evt.end_time || null,
            location: evt.location || null,
            zoom_link: evt.zoom_link?.trim() || null,
            audience: typeInfo?.audience || 'all_teams',
            sequence_number: evt.sequence_number
          }
        })

      if (eventsToInsert.length > 0) {
        const { error: eventsError } = await supabase
          .from('bsc_events')
          .insert(eventsToInsert)
        if (eventsError) console.error('Error inserting events:', eventsError)
      }

      // Insert trainer + coordinator assignments. Coordinator is implicitly a
      // trainer too — union the sets.
      const trainerUserIds = Array.from(new Set([...trainerIds, coordinatorId])).filter(Boolean)
      if (trainerUserIds.length > 0) {
        const trainerRows = trainerUserIds.map(uid => ({
          collaborative_id: data.id,
          user_id: uid,
          is_coordinator: uid === coordinatorId,
        }))
        const { error: trainersError } = await supabase
          .from('collaborative_trainers')
          .insert(trainerRows)
        if (trainersError) console.error('Error inserting trainers:', trainersError)
      }

      onSuccess()
    } catch (err) {
      console.error('Error creating collaborative:', err)
      setError(err.message || 'Failed to create collaborative')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
          maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#0E1F56', marginTop: 0, marginBottom: '0.5rem' }}>
          Create New Collaborative
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Set up a new breakthrough series collaborative with Learning Sessions and assessment windows
        </p>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Collaborative Name *
            </label>
            <input type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Fall 2025 Child Welfare BSC" required
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Program Type */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Program Type *
            </label>
            <select
              value={formData.program_type}
              onChange={(e) => handleChange('program_type', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
            >
              {CREATABLE_PROGRAM_TYPES.map((key) => (
                <option key={key} value={key}>{PROGRAM_TYPE_COLORS[key].label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Description
            </label>
            <textarea value={formData.description} onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this collaborative..." rows={2}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* CTAC Trainers + Event Coordinator */}
          <div style={{ background: '#eff6ff', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #bfdbfe' }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1rem', marginTop: 0, marginBottom: '0.25rem' }}>
              CTAC Trainers & Coordinator *
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              Assign which CTAC admins are running this collaborative. The coordinator is the named contact for participant questions; they're automatically included as a trainer.
            </p>

            {/* Coordinator dropdown */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: '#374151', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                Event Coordinator
              </label>
              <select
                value={coordinatorId}
                onChange={(e) => setCoordinatorId(e.target.value)}
                style={{ ...inputStyle, padding: '0.6rem', fontSize: '0.9rem', background: 'white' }}
                required
              >
                <option value="">— Select a coordinator —</option>
                {superAdmins.map(sa => (
                  <option key={sa.id} value={sa.id}>{sa.full_name} ({sa.email})</option>
                ))}
              </select>
            </div>

            {/* Trainer multi-select (checkboxes) */}
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                Additional Trainers
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {superAdmins.map(sa => {
                  const isCoord = sa.id === coordinatorId
                  const checked = isCoord || trainerIds.includes(sa.id)
                  return (
                    <label
                      key={sa.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: checked ? '#dbeafe' : 'white',
                        border: `1px solid ${checked ? '#2563eb' : '#e5e7eb'}`,
                        borderRadius: '6px', padding: '0.5rem 0.6rem',
                        cursor: isCoord ? 'not-allowed' : 'pointer',
                        opacity: isCoord ? 0.7 : 1,
                        fontSize: '0.85rem'
                      }}
                      title={isCoord ? 'Coordinator is automatically a trainer' : ''}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isCoord}
                        onChange={() => toggleTrainer(sa.id)}
                        style={{ accentColor: '#2563eb', flexShrink: 0 }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sa.full_name}{isCoord && ' (Coordinator)'}
                      </span>
                    </label>
                  )
                })}
              </div>
              {superAdmins.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
                  No active super_admins found.
                </p>
              )}
            </div>
          </div>

          {/* BSC Schedule — Required, moved up */}
          <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #bbf7d0' }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1rem', marginTop: 0, marginBottom: '0.25rem' }}>
              BSC Schedule *
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Default schedule pre-populated from the program's standard agenda. Set dates for at least the first and last Learning Sessions — assessment windows are auto-calculated from those. Other dates (calls, intermediate sessions) are optional; leave blank to skip. Every title can be renamed to match your program's wording.
            </p>

            {/* Schedule import: drop a .docx, or paste any tabular text.
                Always previews first — never auto-applies. */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDropActive(false)
                handleScheduleFile(e.dataTransfer?.files?.[0])
              }}
              style={{
                border: `2px dashed ${dropActive ? '#00A79D' : '#bbf7d0'}`,
                background: dropActive ? '#ecfdf5' : 'white',
                borderRadius: '8px', padding: '0.85rem', marginBottom: '0.75rem', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
                {importing ? 'Reading document…' : 'Drop a schedule document here to fill in dates'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                Word .docx ·{' '}
                <label style={{ color: '#00A79D', cursor: 'pointer', textDecoration: 'underline' }}>
                  browse
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) => { handleScheduleFile(e.target.files?.[0]); e.target.value = '' }}
                    style={{ display: 'none' }}
                  />
                </label>{' '}
                ·{' '}
                <button
                  type="button"
                  onClick={() => setPasteOpen(o => !o)}
                  style={{ background: 'none', border: 'none', color: '#00A79D', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.75rem', padding: 0 }}
                >
                  or paste your schedule
                </button>
              </div>

              {pasteOpen && (
                <div style={{ marginTop: '0.6rem', textAlign: 'left' }}>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={5}
                    placeholder={'Paste rows from a PDF, email, or spreadsheet — one per line, e.g.\nLearning Session 1    10/27/26    10:00 am - 2:30 pm'}
                    style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                  <button
                    type="button"
                    onClick={() => runImport(pasteText.split(/\r?\n/), 'paste')}
                    disabled={!pasteText.trim()}
                    style={{
                      marginTop: '0.4rem', background: pasteText.trim() ? '#00A79D' : '#d1d5db',
                      color: 'white', border: 'none', borderRadius: '6px',
                      padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                      cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >Read schedule</button>
                </div>
              )}

              {importError && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.4rem 0.6rem', textAlign: 'left' }}>
                  {importError}
                </div>
              )}
            </div>

            {/* Parsed preview — explicit Confirm required before anything changes */}
            {importPreview && (
              <div style={{ background: 'white', border: '2px solid #00A79D', borderRadius: '8px', padding: '0.85rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0E1F56', marginBottom: '0.4rem' }}>
                  Found {importPreview.rows.length} event{importPreview.rows.length === 1 ? '' : 's'} — review before applying
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', color: '#374151' }}>
                      <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>Title</th>
                      <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>Start</th>
                      <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.3rem 0.4rem' }}>{r.title}</td>
                        <td style={{ padding: '0.3rem 0.4rem', color: '#6b7280' }}>
                          {r.event_type === 'learning_session' ? 'Learning Session' : 'All-Team Call'}
                        </td>
                        <td style={{ padding: '0.3rem 0.4rem' }}>{r.event_date}</td>
                        <td style={{ padding: '0.3rem 0.4rem' }}>{r.start_time || '—'}</td>
                        <td style={{ padding: '0.3rem 0.4rem' }}>{r.end_time || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {importPreview.unmatched.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
                    <strong>{importPreview.unmatched.length} row{importPreview.unmatched.length === 1 ? '' : 's'} could not be interpreted</strong> and will be skipped — add {importPreview.unmatched.length === 1 ? 'it' : 'them'} manually:
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                      {importPreview.unmatched.map((u, i) => (
                        <li key={i}>“{u.raw}” — {u.problems.join('; ')}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {typedRowCount > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#92400e' }}>
                    ⚠️ This replaces the {bscEvents.length} row{bscEvents.length === 1 ? '' : 's'} below, including {typedRowCount} you have already filled in.
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button type="button" onClick={applyImport} style={{
                    background: '#00A79D', color: 'white', border: 'none', borderRadius: '6px',
                    padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  }}>Confirm — use these dates</button>
                  <button type="button" onClick={() => setImportPreview(null)} style={{
                    background: 'none', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px',
                    padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                </div>
              </div>
            )}

            {bscEvents.map((evt, idx) => (
              <div
                key={idx}
                // Only draggable while its handle is held, so the date/time
                // inputs inside stay normally interactive.
                draggable={dragArmedIdx === idx}
                onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragOverIdx !== idx) setDragOverIdx(idx) }}
                onDrop={(e) => { e.preventDefault(); moveEvent(dragIdx, idx); endDrag() }}
                onDragEnd={endDrag}
                style={{
                  background: 'white', border: evt.locked ? '2px solid #00A79D30' : '1px solid #e5e7eb',
                  borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem',
                  opacity: dragIdx === idx ? 0.4 : 1,
                  borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
                    ? '3px solid #00A79D'
                    : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.4rem' }}>
                  {/* Drag handle — arms dragging for this row only. ↑/↓ below
                      are the keyboard/no-drag fallback. */}
                  <span
                    onMouseDown={() => setDragArmedIdx(idx)}
                    onMouseUp={() => setDragArmedIdx(null)}
                    title="Drag to reorder"
                    style={{
                      cursor: 'grab', color: '#9ca3af', fontSize: '1rem',
                      lineHeight: 1, padding: '0 0.15rem', flexShrink: 0, userSelect: 'none',
                    }}
                  >≡</span>
                  {/* Title is editable on EVERY row, including pre-populated
                      (locked) ones — CTAC's real schedules rename the defaults
                      (e.g. "Learning Call 1" → "Implementation Session 1 (call)").
                      Only the title changes; event_type / sequence_number are
                      untouched, so the assessment-window calculation (which keys
                      off learning_session dates) is unaffected. */}
                  <input
                    type="text"
                    value={evt.title || ''}
                    onChange={(e) => updateEvent(idx, 'title', e.target.value)}
                    placeholder="Event title"
                    title="Rename this event"
                    style={{
                      flex: 1, minWidth: 0,
                      fontSize: '0.8rem', fontWeight: '700',
                      color: evt.locked ? '#00A79D' : '#374151',
                      background: 'white', border: '1px solid #e5e7eb',
                      borderRadius: '4px', padding: '0.3rem 0.4rem',
                    }}
                  />
                  <button type="button" onClick={() => moveEvent(idx, idx - 1)} disabled={idx === 0}
                    title="Move up" style={{
                      background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      color: idx === 0 ? '#e5e7eb' : '#6b7280', fontSize: '0.9rem',
                      padding: '0 0.1rem', lineHeight: 1, flexShrink: 0
                    }}>↑</button>
                  <button type="button" onClick={() => moveEvent(idx, idx + 1)} disabled={idx === bscEvents.length - 1}
                    title="Move down" style={{
                      background: 'none', border: 'none', cursor: idx === bscEvents.length - 1 ? 'not-allowed' : 'pointer',
                      color: idx === bscEvents.length - 1 ? '#e5e7eb' : '#6b7280', fontSize: '0.9rem',
                      padding: '0 0.1rem', lineHeight: 1, flexShrink: 0
                    }}>↓</button>
                  <button type="button" onClick={() => removeEvent(idx)} title="Remove this event" style={{
                    background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                    fontSize: '1.1rem', padding: '0', lineHeight: '1', flexShrink: 0
                  }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: evt.locked ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr 1fr', gap: '0.4rem' }}>
                  {!evt.locked && (
                    <select value={evt.event_type} onChange={(e) => updateEvent(idx, 'event_type', e.target.value)} style={inputStyle}>
                      {EVENT_TYPES.filter(t => t.value !== 'learning_session').map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  )}
                  <input type="date" value={evt.event_date} onChange={(e) => updateEvent(idx, 'event_date', e.target.value)}
                    style={{ ...inputStyle, borderColor: evt.locked && !evt.event_date ? '#f59e0b' : '#e5e7eb' }} />
                  <input type="time" value={evt.start_time} onChange={(e) => updateEvent(idx, 'start_time', e.target.value)}
                    style={inputStyle} placeholder="Start" />
                  <input type="time" value={evt.end_time} onChange={(e) => updateEvent(idx, 'end_time', e.target.value)}
                    style={inputStyle} placeholder="End" />
                  {!evt.locked && (
                    <input type="text" value={evt.location} onChange={(e) => updateEvent(idx, 'location', e.target.value)}
                      style={inputStyle} placeholder="Location" />
                  )}
                </div>
                {/* Zoom link (full width below the row) */}
                <input
                  type="url"
                  value={evt.zoom_link || ''}
                  onChange={(e) => updateEvent(idx, 'zoom_link', e.target.value)}
                  placeholder="🎦 Zoom link (optional) — paste https://zoom.us/j/..."
                  style={{ ...inputStyle, marginTop: '0.4rem' }}
                />
              </div>
            ))}

            <button type="button" onClick={addEvent} style={{
              background: 'none', border: '1px dashed #00A79D', color: '#00A79D',
              borderRadius: '6px', padding: '0.4rem 1rem', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: '600', width: '100%', marginTop: '0.25rem'
            }}>+ Add Additional Event</button>
          </div>

          {/* Assessment Timepoints — Auto-calculated */}
          <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #e5e7eb' }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1rem', marginTop: 0, marginBottom: '0.25rem' }}>
              Assessment Windows
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              Auto-calculated from Learning Session dates. You can adjust if needed.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: '600', color: '#374151' }}>Timepoint</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>Opens</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>Closes</div>

              <div style={{ color: '#374151' }}>Baseline</div>
              <input type="date" value={assessmentDates.baseline_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, baseline_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.baseline_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, baseline_end_date: e.target.value }))}
                style={inputStyle} />

              <div style={{ color: '#374151' }}>Endline</div>
              <input type="date" value={assessmentDates.endline_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, endline_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.endline_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, endline_end_date: e.target.value }))}
                style={inputStyle} />

              <div style={{ color: '#374151' }}>6-Month</div>
              <input type="date" value={assessmentDates.followup_6mo_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_6mo_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.followup_6mo_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_6mo_end_date: e.target.value }))}
                style={inputStyle} />

              <div style={{ color: '#374151' }}>12-Month</div>
              <input type="date" value={assessmentDates.followup_12mo_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_12mo_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.followup_12mo_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_12mo_end_date: e.target.value }))}
                style={inputStyle} />
            </div>

            {!firstLs?.event_date && (
              <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0 }}>
                Set Learning Session dates above to auto-calculate assessment windows.
              </p>
            )}
          </div>

          {/* Status */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>Status</label>
            <select value={formData.status} onChange={(e) => handleChange('status', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading}
              style={{ background: '#e5e7eb', color: '#374151', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', opacity: loading ? 0.6 : 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 167, 157, 0.3)' }}>
              {loading ? 'Creating...' : 'Create Collaborative'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCollaborativeModal
