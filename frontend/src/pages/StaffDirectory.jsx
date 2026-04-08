import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS } from '../utils/constants'
import AddStaffModal from '../components/AddStaffModal'
import ctacLogo from '../assets/CTAC_white.png'

export default function StaffDirectory() {
  const navigate = useNavigate()
  const { isSuperAdmin, profile } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [collaboratives, setCollaboratives] = useState([])
  const [filterCollabId, setFilterCollabId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [expandedBios, setExpandedBios] = useState({})

  useEffect(() => {
    fetchStaff()
    if (isSuperAdmin) fetchCollaboratives()
  }, [])

  const fetchStaff = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bsc_staff')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) console.error('Error fetching staff:', error)
    setStaff(data || [])
    setLoading(false)
  }

  const fetchCollaboratives = async () => {
    const { data } = await supabase
      .from('collaboratives')
      .select('id, name')
      .order('name')
    setCollaboratives(data || [])
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Remove ${s.full_name} from the staff directory?`)) return
    const { error } = await supabase
      .from('bsc_staff')
      .update({ is_active: false })
      .eq('id', s.id)
    if (error) { alert('Error: ' + error.message); return }
    setStaff(prev => prev.filter(x => x.id !== s.id))
  }

  const handleModalSuccess = () => {
    setShowModal(false)
    setEditingStaff(null)
    fetchStaff()
  }

  const toggleBio = (id) => {
    setExpandedBios(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Filter staff: super admins filter by dropdown, team users see global + their collaborative
  let filteredStaff = staff
  if (isSuperAdmin && filterCollabId) {
    filteredStaff = staff.filter(s => s.collaborative_id === filterCollabId || s.collaborative_id === null)
  } else if (!isSuperAdmin && profile?.team_id) {
    // Team users see global staff + their collaborative's staff (RLS handles this already, but filter client-side too)
    filteredStaff = staff
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`,
        color: 'white', padding: '1.5rem 2rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer' }}
            onClick={() => navigate('/admin')}>
            <img src={ctacLogo} alt="CTAC" style={{ height: '45px' }} />
            <div>
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700' }}>Project Staff</h1>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
                BSC faculty and support team
              </p>
            </div>
          </div>
          {isSuperAdmin && (
            <button onClick={() => { setEditingStaff(null); setShowModal(true) }} style={{
              background: 'var(--bg-card)', color: COLORS.navy, padding: '0.6rem 1.25rem',
              borderRadius: '8px', border: 'none', fontWeight: '600',
              cursor: 'pointer', fontSize: '0.9rem'
            }}>+ Add Staff Member</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        {/* Back + Filter row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={() => navigate('/admin')} style={{
            background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '0.5rem 1rem',
            borderRadius: '8px', border: '1px solid var(--border)', fontWeight: '600',
            cursor: 'pointer', fontSize: '0.9rem'
          }}>← Back to Dashboard</button>

          {isSuperAdmin && collaboratives.length > 0 && (
            <select
              value={filterCollabId}
              onChange={(e) => setFilterCollabId(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem', border: '2px solid #e5e7eb',
                borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)'
              }}
            >
              <option value="">All Collaboratives</option>
              {collaboratives.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading staff directory...</div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No staff members found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {filteredStaff.map(s => {
              const bioExpanded = expandedBios[s.id]
              const bioLong = s.bio && s.bio.length > 200
              const displayBio = bioLong && !bioExpanded ? s.bio.slice(0, 200) + '...' : s.bio

              return (
                <div key={s.id} style={{
                  background: 'var(--bg-card)', borderRadius: '0.75rem',
                  padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #f3f4f6',
                  display: 'flex', flexDirection: 'column'
                }}>
                  {/* Initials Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.teal})`,
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', fontWeight: '700', flexShrink: 0
                    }}>
                      {s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: COLORS.navy, fontWeight: '700', fontSize: '1.05rem' }}>
                        {s.full_name}{s.title ? `, ${s.title}` : ''}
                      </div>
                      {s.role_title && (
                        <div style={{ color: COLORS.teal, fontSize: '0.85rem', fontWeight: '600' }}>
                          {s.role_title}
                        </div>
                      )}
                    </div>
                  </div>

                  {s.organization && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      {s.organization}
                    </div>
                  )}

                  {s.bio && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '0.5rem', flex: 1 }}>
                      {displayBio}
                      {bioLong && (
                        <button onClick={() => toggleBio(s.id)} style={{
                          background: 'none', border: 'none', color: COLORS.teal,
                          cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', padding: '0 0.25rem'
                        }}>{bioExpanded ? 'Show less' : 'Read more'}</button>
                      )}
                    </div>
                  )}

                  {/* Contact info */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
                    {s.email && (
                      <a href={`mailto:${s.email}`} style={{
                        color: COLORS.teal, fontSize: '0.8rem', textDecoration: 'none', fontWeight: '500'
                      }}>{s.email}</a>
                    )}
                    {s.phone && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.phone}</span>
                    )}
                  </div>

                  {/* Collaborative badge */}
                  {isSuperAdmin && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.65rem', background: s.collaborative_id ? '#e0f2fe' : '#f3f4f6',
                        color: s.collaborative_id ? '#0369a1' : '#6b7280',
                        padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: '600'
                      }}>
                        {s.collaborative_id ? collaboratives.find(c => c.id === s.collaborative_id)?.name || 'Specific' : 'Global'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => { setEditingStaff(s); setShowModal(true) }} style={{
                          background: 'none', border: 'none', color: 'var(--text-faint)',
                          cursor: 'pointer', fontSize: '0.75rem'
                        }}>Edit</button>
                        <button onClick={() => handleDelete(s)} style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', fontSize: '0.75rem'
                        }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <AddStaffModal
          staff={editingStaff}
          collaboratives={collaboratives}
          onClose={() => { setShowModal(false); setEditingStaff(null) }}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}
