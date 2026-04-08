import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle } from '../utils/constants'
import InviteTeamMemberModal from '../components/InviteTeamMemberModal'

const ROLE_BADGES = {
  super_admin: { label: 'CTAC Admin', bg: '#ede9fe', text: '#6d28d9' },
  agency_admin: { label: 'Team Leader', bg: '#dbeafe', text: '#1e40af' },
  team_leader: { label: 'Team Leader', bg: '#dbeafe', text: '#1e40af' },
  team_member: { label: 'Team Member', bg: '#e0f2fe', text: '#0369a1' }
}

export default function TeamMembers() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isSuperAdmin, isTeamMember } = useAuth()
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [showInviteModal, setShowInviteModal] = useState(false)

  const canManage = isSuperAdmin ||
    (profile?.team_id === teamId && ['agency_admin', 'team_leader'].includes(profile?.role))

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, team_name, agency_name, collaborative_id, collaboratives (name)')
        .eq('id', teamId)
        .single()

      if (teamError) throw teamError
      setTeam(teamData)

      // Load team members
      await loadMembers()
    } catch (err) {
      console.error('Error loading team data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, agency_role, is_senior_leader, is_active, created_at, invite_accepted_at')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('role', { ascending: true })

    if (error) {
      console.error('Error loading members:', error)
      return
    }

    // Sort: agency_admin/team_leader first, then team_member, alphabetically within each group
    const sorted = (data || []).sort((a, b) => {
      const roleOrder = { agency_admin: 0, team_leader: 0, team_member: 1 }
      const aOrder = roleOrder[a.role] ?? 2
      const bOrder = roleOrder[b.role] ?? 2
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.full_name || '').localeCompare(b.full_name || '')
    })

    setMembers(sorted)
  }

  const handleResendInvite = async (member) => {
    if (!confirm(`Resend invitation email to ${member.full_name} (${member.email})?`)) return

    try {
      const { data, error: fnError } = await supabase.functions.invoke('invite-team-leader', {
        body: {
          email: member.email,
          name: member.full_name,
          team_id: teamId,
          role: member.role,
          agency_role: member.agency_role || null,
          is_senior_leader: member.is_senior_leader || false,
          resend: true
        }
      })

      if (fnError) {
        if (fnError.context?.body) {
          try {
            const body = await fnError.context.json()
            throw new Error(body.error || fnError.message)
          } catch (parseErr) {
            if (parseErr.message && parseErr.message !== fnError.message) throw parseErr
          }
        }
        throw fnError
      }
      if (data?.error) throw new Error(data.error)

      alert(`Invitation resent to ${member.email}`)
      await loadMembers()
    } catch (err) {
      console.error('Resend error:', err)
      alert('Failed to resend invite: ' + (err.message || 'Unknown error'))
    }
  }

  const handleDeactivate = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from the team? They will lose access to the dashboard.`)) return

    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: false })
      .eq('id', memberId)

    if (error) {
      console.error('Error deactivating member:', error)
      alert('Error removing team member')
      return
    }

    await loadMembers()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading team...</div>
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.red }}>Team Not Found</h2>
        <button onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    )
  }

  const leaders = members.filter(m => ['agency_admin', 'team_leader'].includes(m.role))
  const teamMembers = members.filter(m => m.role === 'team_member')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Team Members</h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                {team.agency_name} — {team.collaboratives?.name}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canManage && (
              <button
                onClick={() => setShowInviteModal(true)}
                style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
              >
                + Invite Member
              </button>
            )}
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ ...cardStyle, flex: '1', minWidth: '150px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: COLORS.navy }}>{members.length}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Members</div>
          </div>
          <div style={{ ...cardStyle, flex: '1', minWidth: '150px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: COLORS.teal }}>{leaders.length}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Team Leaders</div>
          </div>
          <div style={{ ...cardStyle, flex: '1', minWidth: '150px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0369a1' }}>{teamMembers.length}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Team Members</div>
          </div>
          <div style={{ ...cardStyle, flex: '1', minWidth: '150px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#d97706' }}>
              {members.filter(m => m.is_senior_leader).length}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Senior Leaders</div>
          </div>
        </div>

        {/* Team Leaders Section */}
        {leaders.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: COLORS.navy, fontSize: '1.15rem', marginBottom: '1rem' }}>
              Team Leaders ({leaders.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {leaders.map(member => renderMemberCard(member))}
            </div>
          </div>
        )}

        {/* Team Members Section */}
        {teamMembers.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: COLORS.navy, fontSize: '1.15rem', marginBottom: '1rem' }}>
              Team Members ({teamMembers.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {teamMembers.map(member => renderMemberCard(member))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {members.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧑‍🤝‍🧑</div>
            <h2 style={{ color: COLORS.navy, marginBottom: '0.5rem' }}>No Team Members Yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Get started by inviting team members to join the platform.
            </p>
            {canManage && (
              <button
                onClick={() => setShowInviteModal(true)}
                style={{ padding: '0.75rem 2rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
              >
                Invite First Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteTeamMemberModal
          teamId={teamId}
          teamName={team.agency_name}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => loadMembers()}
        />
      )}
    </div>
  )

  function renderMemberCard(member) {
    const initials = (member.full_name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    const roleBadge = ROLE_BADGES[member.role] || ROLE_BADGES.team_member
    const isPending = !member.invite_accepted_at

    return (
      <div key={member.id} style={{
        ...cardStyle,
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        borderLeft: `4px solid ${isPending ? '#f59e0b' : member.role === 'team_member' ? COLORS.teal : COLORS.navy}`,
        opacity: isPending ? 0.85 : 1
      }}>
        {/* Avatar */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: isPending
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.navy})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '0.9rem',
          flexShrink: 0
        }}>
          {isPending ? '✉' : initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <strong style={{ color: COLORS.navy, fontSize: '1rem' }}>{member.full_name}</strong>
            {/* Status badge */}
            <span style={{
              padding: '0.1rem 0.4rem',
              borderRadius: '9999px',
              fontSize: '0.65rem',
              fontWeight: '600',
              background: isPending ? '#fef3c7' : '#dcfce7',
              color: isPending ? '#92400e' : '#166534',
              border: `1px solid ${isPending ? '#fcd34d' : '#86efac'}`
            }}>
              {isPending ? 'Pending' : 'Active'}
            </span>
            {member.is_senior_leader && (
              <span style={{
                padding: '0.1rem 0.4rem',
                borderRadius: '9999px',
                fontSize: '0.65rem',
                fontWeight: '600',
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fcd34d'
              }}>
                Senior Leader
              </span>
            )}
          </div>

          <span style={{
            display: 'inline-block',
            padding: '0.1rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: '600',
            background: roleBadge.bg,
            color: roleBadge.text,
            marginBottom: '0.35rem'
          }}>
            {roleBadge.label}
          </span>

          {member.agency_role && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
              {member.agency_role}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>
            {member.email}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '0.25rem' }}>
            {isPending ? `Invited ${new Date(member.created_at).toLocaleDateString()}` : `Joined ${new Date(member.invite_accepted_at).toLocaleDateString()}`}
          </div>
        </div>

        {/* Actions */}
        {canManage && member.id !== user?.id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
            {isPending && (
              <button
                onClick={() => handleResendInvite(member)}
                title="Resend invitation email"
                style={{
                  background: 'none',
                  border: `1px solid ${COLORS.teal}`,
                  borderRadius: '6px',
                  padding: '0.35rem 0.6rem',
                  cursor: 'pointer',
                  color: COLORS.teal,
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = COLORS.teal; e.currentTarget.style.color = 'white' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = COLORS.teal }}
              >
                Resend
              </button>
            )}
            {member.role === 'team_member' && (
              <button
                onClick={() => handleDeactivate(member.id, member.full_name)}
                title="Remove from team"
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.6rem',
                  cursor: 'pointer',
                  color: 'var(--text-faint)',
                  fontSize: '0.75rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.color = COLORS.red }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af' }}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
}
