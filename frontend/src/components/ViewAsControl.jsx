import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'
import { COLORS } from '../utils/constants'

// Roles a super_admin can preview as. "Admin" isn't listed — exiting preview
// returns to the real admin experience. value maps to a user_profiles.role.
const PREVIEW_ROLES = [
  { value: 'trainer_admin', label: 'CTAC Admin' },
  { value: 'agency_admin', label: 'Team Leader' },
  { value: 'team_member', label: 'Team Member' },
]

// trainer_admin (CTAC Admin) is collaborative-scoped, not team-scoped:
// preview it by picking a collaborative only. The other roles need a team.
const roleNeedsTeam = (role) => role !== 'trainer_admin'

const roleLabel = (role) =>
  PREVIEW_ROLES.find(r => r.value === role)?.label || role

/**
 * Super-admin-only "View as" preview control. Renders nothing for everyone
 * else. While previewing, shows a persistent top banner with an exit button;
 * otherwise shows a small launcher (bottom-left) that opens a role/collab/team
 * picker. Front-end preview only — see AuthContext for the override mechanics.
 */
function ViewAsControl() {
  const navigate = useNavigate()
  const { isRealSuperAdmin, previewing, viewAs, setViewAs } = useAuth()

  const [open, setOpen] = useState(false)
  const [collabs, setCollabs] = useState([])
  const [teams, setTeams] = useState([])
  const [role, setRole] = useState('team_member')
  const [collabId, setCollabId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [loadingTeams, setLoadingTeams] = useState(false)

  // Load collaboratives when the picker opens.
  useEffect(() => {
    if (!open) return
    supabase
      .from('collaboratives')
      .select('id, name, program_type')
      .order('name')
      .then(({ data }) => setCollabs(data || []))
  }, [open])

  // Load teams whenever the selected collaborative changes.
  useEffect(() => {
    if (!collabId) { setTeams([]); setTeamId(''); return }
    setLoadingTeams(true)
    supabase
      .from('teams')
      .select('id, team_name, display_name, agency_name')
      .eq('collaborative_id', collabId)
      .order('team_name')
      .then(({ data }) => {
        setTeams(data || [])
        setTeamId('')
        setLoadingTeams(false)
      })
  }, [collabId])

  if (!isRealSuperAdmin) return null

  const needsTeam = roleNeedsTeam(role)
  const canStart = collabId && (!needsTeam || teamId)

  const startPreview = () => {
    if (!canStart) return
    const collab = collabs.find(c => c.id === collabId)
    const team = teams.find(t => t.id === teamId)
    setViewAs({
      role,
      collaborativeId: collabId,
      teamId: needsTeam ? teamId : null,
      programType: collab?.program_type || null,
      teamName: needsTeam ? (team?.display_name || team?.team_name || null) : null,
      collaborativeName: collab?.name || null,
    })
    setOpen(false)
    navigate('/admin')
  }

  const exitPreview = () => {
    setViewAs(null)
    navigate('/admin')
  }

  // --- Persistent banner while previewing ---
  if (previewing) {
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9500,
          background: COLORS.navy, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
          padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)', flexWrap: 'wrap',
        }}
      >
        <span>
          👁 Previewing as <span style={{ color: COLORS.teal }}>{roleLabel(viewAs.role)}</span>
          {viewAs.teamName ? ` — ${viewAs.teamName}` : ''}
          {viewAs.collaborativeName ? ` (${viewAs.collaborativeName})` : ''}
        </span>
        <button
          onClick={exitPreview}
          style={{
            background: 'white', color: COLORS.navy, border: 'none',
            borderRadius: '6px', padding: '0.3rem 0.85rem', fontWeight: 700,
            fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          Exit preview
        </button>
      </div>
    )
  }

  // --- Launcher + picker panel ---
  return (
    <div style={{ position: 'fixed', bottom: '1.25rem', left: '1.25rem', zIndex: 9000 }}>
      {open && (
        <div
          style={{
            position: 'absolute', bottom: '3.25rem', left: 0, width: '300px',
            background: 'var(--bg-card, white)', color: 'var(--text, #111827)',
            border: '1px solid var(--border, #e5e7eb)', borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: '1rem',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: COLORS.navy }}>
            👁 View as…
          </div>

          <label style={labelStyle}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
            {PREVIEW_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <label style={labelStyle}>Collaborative</label>
          <select value={collabId} onChange={(e) => setCollabId(e.target.value)} style={inputStyle}>
            <option value="">Select a collaborative…</option>
            {collabs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {needsTeam ? (
            <>
              <label style={labelStyle}>Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={inputStyle}
                disabled={!collabId || loadingTeams}
              >
                <option value="">
                  {loadingTeams ? 'Loading teams…' : !collabId ? 'Pick a collaborative first' : teams.length ? 'Select a team…' : 'No teams in this collaborative'}
                </option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {(t.display_name || t.team_name)}{t.agency_name ? ` — ${t.agency_name}` : ''}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)', marginTop: '0.5rem' }}>
              CTAC Admin is scoped to the whole collaborative — no team needed.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              onClick={startPreview}
              disabled={!canStart}
              style={{
                flex: 1, background: !canStart ? '#9ca3af' : COLORS.teal,
                color: 'white', border: 'none', borderRadius: '8px',
                padding: '0.5rem', fontWeight: 700, fontSize: '0.85rem',
                cursor: !canStart ? 'not-allowed' : 'pointer',
              }}
            >
              Start preview
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent', color: 'var(--text-muted, #6b7280)',
                border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px',
                padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: COLORS.navy, color: 'white', border: 'none',
          borderRadius: '999px', padding: '0.6rem 1rem', fontWeight: 700,
          fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        👁 View as…
      </button>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-muted, #6b7280)', margin: '0.5rem 0 0.25rem',
}
const inputStyle = {
  width: '100%', padding: '0.5rem', borderRadius: '8px',
  border: '1px solid var(--border, #e5e7eb)', fontSize: '0.85rem',
  boxSizing: 'border-box', background: 'var(--bg-input, white)', color: 'inherit',
}

export default ViewAsControl
