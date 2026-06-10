import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Searchable + status-filterable roster modal for one registration link.
// Used by both CollaborativeDetail (per-collab Registrations list) and
// the new RegistrationsAdmin page (cross-collab Registrations list).
//
// Props:
//   linkId: string (registration link id)
//   linkTitle: string (display title)
//   onClose(): void
//   onChange?(): called after a manual promote/cancel so the parent can
//     refresh per-link counts.
export default function RegistrationRosterModal({ linkId, linkTitle, onClose, onChange }) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('event_registrations')
      .select('id, full_name, email, responses, status, registered_at, cancelled_at, checked_in_at, waitlist_position, cancel_token, confirmation_sent_at')
      .eq('registration_link_id', linkId)
      .order('registered_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [linkId])

  const promoteWaitlister = async (regId) => {
    if (!window.confirm('Promote this person off the waitlist to registered?')) return
    await supabase.from('event_registrations')
      .update({ status: 'registered', waitlist_position: null }).eq('id', regId)
    await load()
    onChange?.()
  }

  // Admin cancel goes through the cancel-registration edge function (same
  // path as the public /cancel-registration/:token page) so the top
  // waitlister auto-promotes and both cancellation + promotion emails fire.
  // A direct status UPDATE here would silently skip all of that.
  const cancelRegistrationAdmin = async (row) => {
    if (!window.confirm('Cancel this registration? If there is a waitlist, the top person will be automatically promoted and emailed.')) return
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-registration`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_token: row.cancel_token }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) { alert('Cancel failed: ' + (json.error || `HTTP ${resp.status}`)); return }
      if (json.promoted_email) {
        alert(`Cancelled. ${json.promoted_email} was promoted off the waitlist and notified.`)
      }
    } catch (err) {
      alert('Cancel failed: ' + (err.message || String(err)))
      return
    }
    await load()
    onChange?.()
  }

  // Re-invoke the confirmation email for a row whose send failed (or never
  // happened). The edge function stamps confirmation_sent_at on success.
  const resendConfirmation = async (row) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-registration-email`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: row.id, kind: 'confirmation' }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) { alert('Resend failed: ' + (json.error || `HTTP ${resp.status}`)); return }
    } catch (err) {
      alert('Resend failed: ' + (err.message || String(err)))
      return
    }
    await load()
  }

  const exportCsv = () => {
    if (rows.length === 0) return
    const keysSet = new Set()
    rows.forEach(r => Object.keys(r.responses || {}).forEach(k => keysSet.add(k)))
    const responseKeys = Array.from(keysSet).filter(k => k !== 'full_name' && k !== 'email' && k !== 'email_confirm')
    const headers = ['Status', 'Full Name', 'Email', 'Registered At', 'Cancelled At', 'Checked In At', 'Waitlist #', ...responseKeys]
    const out = rows.map(r => [
      r.status, r.full_name, r.email,
      r.registered_at || '', r.cancelled_at || '', r.checked_in_at || '',
      r.waitlist_position == null ? '' : String(r.waitlist_position),
      ...responseKeys.map(k => String(r.responses?.[k] ?? '')),
    ])
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers, ...out].map(row => row.map(escape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations_${(linkTitle || 'roster').replace(/[^a-zA-Z0-9]+/g, '_')}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filtered = rows
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      const t = search.trim().toLowerCase()
      if (!t) return true
      return (r.full_name || '').toLowerCase().includes(t) || (r.email || '').toLowerCase().includes(t)
    })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '0.75rem', maxWidth: '1100px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: NAVY }}>Roster — {linkTitle}</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={exportCsv} disabled={rows.length === 0} style={{ background: TEAL, color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: rows.length === 0 ? 0.5 : 1 }}>Download CSV</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '14rem', padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' }}>
            <option value="all">All ({rows.length})</option>
            <option value="registered">Registered ({rows.filter(r => r.status === 'registered').length})</option>
            <option value="waitlisted">Waitlisted ({rows.filter(r => r.status === 'waitlisted').length})</option>
            <option value="checked_in">Checked in ({rows.filter(r => r.status === 'checked_in').length})</option>
            <option value="cancelled">Cancelled ({rows.filter(r => r.status === 'cancelled').length})</option>
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: '#9ca3af', fontStyle: 'italic', padding: '1rem 0' }}>No registrations yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Agency</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Role</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Registered</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    <span style={statusBadge(r.status)}>
                      {r.status}{r.status === 'waitlisted' && r.waitlist_position != null && ` #${r.waitlist_position}`}
                    </span>
                    {r.status !== 'cancelled' && !r.confirmation_sent_at && (
                      <span
                        title="No confirmation email has gone out for this registration"
                        style={{ display: 'inline-block', marginLeft: '0.35rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}
                      >⚠ not sent</span>
                    )}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>{r.full_name}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}><a href={`mailto:${r.email}`} style={{ color: NAVY }}>{r.email}</a></td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#6b7280' }}>{r.responses?.agency || ''}</td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#6b7280' }}>{r.responses?.role || ''}</td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#6b7280', fontSize: '0.78rem' }}>{r.registered_at ? new Date(r.registered_at).toLocaleDateString() : ''}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {r.status === 'waitlisted' && (
                        <button onClick={() => promoteWaitlister(r.id)} title="Promote to registered" style={{ background: '#16a34a', color: 'white', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>↑</button>
                      )}
                      {r.status !== 'cancelled' && !r.confirmation_sent_at && (
                        <button onClick={() => resendConfirmation(r)} title="Resend confirmation email" style={{ background: '#fef3c7', color: '#92400e', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>✉ Resend</button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button onClick={() => cancelRegistrationAdmin(r)} title="Cancel registration (promotes top waitlister if any)" style={{ background: 'transparent', color: '#991b1b', border: '1px solid #991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function statusBadge(status) {
  const map = {
    registered: { bg: '#dcfce7', color: '#166534' },
    waitlisted: { bg: '#fef3c7', color: '#92400e' },
    cancelled: { bg: '#fee2e2', color: '#991b1b' },
    checked_in: { bg: '#dbeafe', color: '#1e40af' },
  }
  const m = map[status] || { bg: '#f3f4f6', color: '#6b7280' }
  return {
    background: m.bg, color: m.color,
    padding: '0.1rem 0.5rem', borderRadius: '999px',
    fontSize: '0.7rem', fontWeight: 700,
  }
}
