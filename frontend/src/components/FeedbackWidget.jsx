import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Route → human-readable page label. Falls back to document.title.
const PAGE_LABELS = [
  [/^\/admin\/collaboratives\/[^/]+$/, 'Collaborative Detail'],
  [/^\/admin\/collaboratives$/, 'Collaboratives List'],
  [/^\/admin\/event\//, 'Event Detail'],
  [/^\/admin\/trainer$/, 'Trainer Dashboard'],
  [/^\/admin\/trainings/, 'Standalone Trainings'],
  [/^\/admin\/registrations/, 'Registrations Admin'],
  [/^\/admin\/ceu\//, 'CEU Roster'],
  [/^\/admin\/team-report\//, 'Team Report'],
  [/^\/admin\/smartie-goals\//, 'SMARTIE Goals'],
  [/^\/admin\/pdsa\//, 'PDSA Cycles'],
  [/^\/admin\/completion$/, 'Completion Tracking'],
  [/^\/admin\/data-visualization$/, 'Data Visualization'],
  [/^\/admin\/resources$/, 'Resources'],
  [/^\/admin\/forum/, 'Community Forum'],
  [/^\/admin\/change-framework$/, 'Change Framework'],
  [/^\/admin\/staff$/, 'Staff Directory'],
  [/^\/admin\/sts-pat/, 'STS-PAT'],
  [/^\/admin$/, 'Dashboard'],
]
function pageLabelFor(path) {
  for (const [re, label] of PAGE_LABELS) {
    if (re.test(path)) return label
  }
  return document.title || path
}

// Floating contextual-feedback widget for the demo/UAT phase. Rendered for
// admin-level users only (mounted in App behind isAdminLevel). Captures a
// viewport screenshot via html2canvas plus route/page/program/collab/user
// context, and writes to app_feedback (+ feedback-screenshots bucket).
// Triage happens outside the app (Cowork artifact over the table).
export default function FeedbackWidget() {
  const location = useLocation()
  const { user, profile, isAdminLevel } = useAuth()

  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('bug')
  const [severity, setSeverity] = useState('medium')
  const [message, setMessage] = useState('')
  const [screenshotBlob, setScreenshotBlob] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  if (!isAdminLevel) return null

  const openPanel = async () => {
    setOpen(true)
    setCapturing(true)
    try {
      // Capture before the panel paints so the widget itself isn't in shot.
      const canvas = await html2canvas(document.body, {
        ignoreElements: (el) => el.dataset?.feedbackWidget === 'true',
        logging: false,
        scale: Math.min(1, 1600 / window.innerWidth), // cap width ~1600px
      })
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      setScreenshotBlob(blob)
    } catch (err) {
      console.warn('Screenshot capture failed (feedback still works):', err)
      setScreenshotBlob(null)
    } finally {
      setCapturing(false)
    }
  }

  const close = () => {
    setOpen(false)
    setMessage('')
    setScreenshotBlob(null)
  }

  const submit = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      // Upload screenshot first (best-effort)
      let screenshotPath = null
      if (screenshotBlob) {
        const path = `${user.id}/${Date.now()}.png`
        const { error: upErr } = await supabase.storage
          .from('feedback-screenshots')
          .upload(path, screenshotBlob, { contentType: 'image/png' })
        if (!upErr) screenshotPath = path
        else console.warn('Screenshot upload failed:', upErr.message)
      }

      // Collab context if we're on a collaborative-scoped page
      const collabMatch = location.pathname.match(/\/admin\/(?:collaboratives|ceu)\/([0-9a-f-]{36})/)
      const collaborativeId = collabMatch ? collabMatch[1] : null

      const { error } = await supabase.from('app_feedback').insert({
        user_id: user.id,
        user_email: profile?.email || user.email,
        user_role: profile?.role || null,
        route: location.pathname,
        page_label: pageLabelFor(location.pathname),
        program_type: null, // populated by triage if needed; route context covers most cases
        collaborative_id: collaborativeId,
        category,
        severity,
        message: message.trim(),
        screenshot_path: screenshotPath,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
      })
      if (error) throw error

      close()
      setToast('Feedback submitted — thank you!')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      alert('Could not submit feedback: ' + (err.message || String(err)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-feedback-widget="true">
      {/* Floating button */}
      {!open && (
        <button
          onClick={openPanel}
          title="Send feedback about this page"
          style={{
            position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 9000,
            background: TEAL, color: 'white', border: 'none',
            borderRadius: '999px', padding: '0.65rem 1.1rem',
            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >💬 Feedback</button>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 9000,
          background: '#166534', color: 'white', borderRadius: '8px',
          padding: '0.75rem 1.25rem', fontSize: '0.9rem', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>{toast}</div>
      )}

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 9001,
          background: 'var(--bg-card, white)', borderRadius: '0.75rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          width: 'min(380px, calc(100vw - 2.5rem))', padding: '1rem',
          border: '1px solid var(--border, #e5e7eb)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--text-heading, #0E1F56)' }}>Send feedback</strong>
            <button onClick={close} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted, #6b7280)' }}>×</button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #6b7280)', marginBottom: '0.6rem' }}>
            Page: <strong>{pageLabelFor(location.pathname)}</strong>
            {capturing
              ? ' · capturing screenshot…'
              : screenshotBlob ? ' · 📸 screenshot attached' : ' · (no screenshot)'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                <option value="bug">🐞 Bug</option>
                <option value="confusing">😕 Confusing</option>
                <option value="idea">💡 Idea</option>
                <option value="question">❓ Question</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} style={inputStyle}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>What happened / what do you think?</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder="Describe what you saw, what you expected, or your idea…"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            autoFocus
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.6rem' }}>
            <button onClick={close} disabled={submitting} style={{ background: 'transparent', color: 'var(--text-secondary, #374151)', border: '1px solid var(--border-light, #d1d5db)', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
            <button
              onClick={submit}
              disabled={submitting || !message.trim()}
              style={{ background: NAVY, color: 'white', border: 'none', padding: '0.45rem 1.1rem', borderRadius: '6px', cursor: submitting ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: !message.trim() ? 0.5 : 1 }}
            >{submitting ? 'Sending…' : 'Submit'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '0.2rem' }
const inputStyle = {
  width: '100%', padding: '0.45rem 0.6rem',
  border: '1px solid var(--border-light, #d1d5db)', borderRadius: '6px',
  fontSize: '0.85rem', boxSizing: 'border-box',
  background: 'var(--bg-card, white)', color: 'var(--text-primary, #1f2937)',
}
