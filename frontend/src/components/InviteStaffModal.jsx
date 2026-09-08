import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { PROGRAM_TYPE_COLORS } from '../config/programConfig'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Super-admin "Add CTAC Staff" (Josh, 2026-09-01 feedback): invite a new
// super_admin or trainer_admin. Team invites stay where they live today
// (the team pages) — this is deliberately CTAC-staff-only.
//
// The person gets Supabase's invite email with a link to /set-password and
// chooses their own password there. No password is ever generated or emailed —
// same flow every existing account went through, and the reason the "email
// them a username + password" version of this request was not built.
export default function InviteStaffModal({ onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('trainer_admin')
  const [collaboratives, setCollaboratives] = useState([])
  const [selectedCollabs, setSelectedCollabs] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  // Set when the function refuses because the address already has an active
  // account — the right tool is then a password reset, offered inline.
  const [offerReset, setOfferReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Same call the login page's "Forgot password" uses; the recovery link lands
  // on /set-password via the existing type=recovery redirect.
  const sendPasswordReset = async () => {
    setError('')
    setSubmitting(true)
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://bsc.ctac.app/set-password',
    })
    setSubmitting(false)
    if (e) { setError('Could not send the reset email: ' + e.message); return }
    setResetSent(true)
  }

  useEffect(() => {
    let cancelled = false
    supabase
      .from('collaboratives')
      .select('id, name, program_type, status')
      .order('name')
      .then(({ data }) => { if (!cancelled) setCollaboratives(data || []) })
    return () => { cancelled = true }
  }, [])

  const toggleCollab = (id) => {
    setSelectedCollabs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const invite = async (resend = false) => {
    setError('')
    if (!name.trim() || !email.trim()) { setError('Name and email are required.'); return }
    if (role === 'trainer_admin' && selectedCollabs.size === 0) {
      setError('Pick at least one collaborative — a trainer with no assignments lands on an empty dashboard.')
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-leader`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          collaborative_ids: role === 'trainer_admin' ? [...selectedCollabs] : undefined,
          resend,
        }),
      })
      const json = await resp.json().catch(() => ({}))

      if (resp.status === 409) {
        setSubmitting(false)
        // The function refuses to re-invite someone who has already accepted
        // (they need a password reset) or who holds trainer assignments
        // (re-inviting deletes the user and the assignments cascade away).
        // Both come back with a code; only a never-accepted, unassigned
        // account is offered the delete-and-reinvite path.
        if (json.code === 'already_accepted') {
          setError(json.error)
          setOfferReset(true)
          return
        }
        if (json.code === 'has_assignments') {
          setError(json.error)
          return
        }
        if (!resend && window.confirm(`${email.trim()} already has an invite that was never accepted. Delete it and send a fresh one?`)) {
          await invite(true)
        }
        return
      }
      if (!resp.ok) throw new Error(json.error || `Invite failed (HTTP ${resp.status})`)

      setSuccess(json)
      if (onSuccess) onSuccess(json)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.65rem', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontWeight: 600, color: '#374151', marginBottom: '0.3rem', fontSize: '0.85rem' }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: '12px', padding: '2rem',
          maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: NAVY, marginTop: 0, marginBottom: '0.25rem' }}>Add CTAC Staff</h2>
        <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Sends an invite email with a link to set their own password. Team leaders and team members
          are still invited from their team's page — this is for CTAC staff accounts.
        </p>

        {success ? (
          <div>
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', lineHeight: 1.5 }}>
              ✅ Invite sent to <strong>{success.email}</strong> as{' '}
              <strong>{success.role === 'super_admin' ? 'Super Admin' : 'Trainer'}</strong>
              {success.role === 'trainer_admin' && <> with {success.collaboratives_assigned} collaborative{success.collaboratives_assigned === 1 ? '' : 's'} assigned</>}.
              They'll appear once they set a password from the email.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={onClose} style={{
                background: NAVY, color: 'white', border: 'none', padding: '0.6rem 1.4rem',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Full name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Their full name" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setOfferReset(false); setResetSent(false) }} placeholder="name@uky.edu" style={inputStyle} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Role *</label>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label style={{
                  display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem',
                  border: `2px solid ${role === 'trainer_admin' ? TEAL : '#e5e7eb'}`,
                  background: role === 'trainer_admin' ? '#e0f7f5' : 'white',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                }}>
                  <input type="radio" checked={role === 'trainer_admin'} onChange={() => setRole('trainer_admin')} style={{ marginTop: '0.15rem' }} />
                  <span>
                    <strong>Trainer</strong> (trainer_admin) — admin access scoped to the collaboratives
                    you assign below. Cross-collab tools stay hidden.
                  </span>
                </label>
                <label style={{
                  display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem',
                  border: `2px solid ${role === 'super_admin' ? NAVY : '#e5e7eb'}`,
                  background: role === 'super_admin' ? '#eaedf5' : 'white',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                }}>
                  <input type="radio" checked={role === 'super_admin'} onChange={() => setRole('super_admin')} style={{ marginTop: '0.15rem' }} />
                  <span>
                    <strong>Super Admin</strong> — sees and manages everything, every collaborative,
                    every team. CTAC director-level only.
                  </span>
                </label>
              </div>
            </div>

            {role === 'trainer_admin' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Assigned collaboratives *</label>
                {collaboratives.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Loading collaboratives…</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem' }}>
                    {collaboratives.map(c => {
                      const meta = PROGRAM_TYPE_COLORS[c.program_type] || { bg: '#f3f4f6', color: '#6b7280', label: c.program_type }
                      return (
                        <label key={c.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={selectedCollabs.has(c.id)} onChange={() => toggleCollab(c.id)} />
                          <span style={{ color: '#1f2937' }}>{c.name}</span>
                          <span style={{ background: meta.bg, color: meta.color, padding: '0.05rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>{meta.label}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ background: offerReset ? '#FFFBEB' : '#fee2e2', color: offerReset ? '#92400E' : '#991b1b', border: offerReset ? '1px solid #FDE68A' : 'none', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                {error}
                {offerReset && (
                  <div style={{ marginTop: '0.6rem' }}>
                    {resetSent ? (
                      <strong>✅ Password reset email sent to {email.trim()}.</strong>
                    ) : (
                      <button onClick={sendPasswordReset} disabled={submitting} style={{
                        background: NAVY, color: 'white', border: 'none', padding: '0.45rem 0.9rem',
                        borderRadius: '6px', cursor: submitting ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      }}>{submitting ? 'Sending…' : 'Send password reset instead'}</button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={onClose} disabled={submitting} style={{
                background: '#e5e7eb', color: '#374151', border: 'none', padding: '0.6rem 1.2rem',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}>Cancel</button>
              <button onClick={() => invite(false)} disabled={submitting} style={{
                background: submitting ? '#9ca3af' : `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
                color: 'white', border: 'none', padding: '0.6rem 1.4rem',
                borderRadius: '8px', cursor: submitting ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}>{submitting ? 'Sending…' : 'Send invite'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
