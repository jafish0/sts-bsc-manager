import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import AddTeamModal from '../components/AddTeamModal'
import ctacLogo from '../assets/CTAC_white.png'

export default function CollaborativeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [collaborative, setCollaborative] = useState(null)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddTeamModal, setShowAddTeamModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'active'
  })

  useEffect(() => {
    fetchCollaborative()
    fetchTeams()
  }, [id])

  const fetchCollaborative = async () => {
    try {
      const { data, error } = await supabase
        .from('collaboratives')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      setCollaborative(data)
      setEditForm({
        name: data.name,
        description: data.description || '',
        start_date: data.start_date,
        end_date: data.end_date || '',
        status: data.status || 'active'
      })
    } catch (error) {
      console.error('Error fetching collaborative:', error)
      alert('Error loading collaborative details')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_codes (
            id,
            code,
            timepoint,
            created_at
          )
        `)
        .eq('collaborative_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('collaboratives')
        .update(editForm)
        .eq('id', id)

      if (error) throw error

      setCollaborative({ ...collaborative, ...editForm })
      setIsEditing(false)
      alert('Collaborative updated successfully!')
    } catch (error) {
      console.error('Error updating collaborative:', error)
      alert('Error updating collaborative')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      name: collaborative.name,
      description: collaborative.description || '',
      start_date: collaborative.start_date,
      end_date: collaborative.end_date || '',
      status: collaborative.status || 'active'
    })
    setIsEditing(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Code copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('Failed to copy code')
    }
  }

  const getTimepointLabel = (timepoint) => {
    const labels = {
      baseline: 'Baseline',
      endline: 'Endline',
      '6_month': '6-Month Follow-up',
      '12_month': '12-Month Follow-up'
    }
    return labels[timepoint] || timepoint
  }

  const handleAddTeamSuccess = () => {
    setShowAddTeamModal(false)
    fetchTeams()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <div>Loading collaborative details...</div>
        </div>
      </div>
    )
  }

  if (!collaborative) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2 style={{ color: '#374151', marginBottom: '1rem' }}>Collaborative Not Found</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            The collaborative you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/admin/collaboratives')}
            style={{
              background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Back to Collaboratives
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0E1F56 0%, #1a2f6f 100%)' }}>
      {/* Header */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '1.5rem 2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer' }}
            onClick={() => navigate('/admin/collaboratives')}>
            <img 
              src={ctacLogo} 
              alt="CTAC" 
              style={{ height: '50px', width: 'auto' }}
            />
            <div>
              <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Collaborative Details</h1>
              <p style={{ fontSize: '0.875rem', margin: 0, opacity: 0.9 }}>
                View and manage collaborative information
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '2px solid white',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.color = '#0E1F56'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.color = 'white'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/collaboratives')}
          style={{
            background: 'white',
            color: '#6b7280',
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          ← Back to Collaboratives
        </button>

        {/* Collaborative Info Card */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ color: '#0E1F56', fontSize: '1.875rem', margin: '0 0 0.5rem 0' }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{
                      fontSize: '1.875rem',
                      fontWeight: '700',
                      padding: '0.5rem',
                      border: '2px solid #0E1F56',
                      borderRadius: '8px',
                      width: '100%'
                    }}
                  />
                ) : (
                  collaborative.name
                )}
              </h2>
              <span style={{
                background: collaborative.status === 'active' ? '#d1fae5' : '#f3f4f6',
                color: collaborative.status === 'active' ? '#10b981' : '#6b7280',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                {collaborative.status === 'active' ? 'Active' : 'Completed'}
              </span>
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                  color: 'white',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    background: '#e5e7eb',
                    color: '#374151',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: saving ? '#9ca3af' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                    color: 'white',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              {collaborative.description && (
                <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  {collaborative.description}
                </p>
              )}

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '2px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Start Date</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0E1F56' }}>
                    {formatDate(collaborative.start_date)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>End Date</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0E1F56' }}>
                    {formatDate(collaborative.end_date)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Teams</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#00A79D' }}>
                    {teams.length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Teams Section */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0E1F56', margin: 0 }}>
              Teams
            </h3>
            <button
              onClick={() => setShowAddTeamModal(true)}
              style={{
                background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 12px rgba(0, 167, 157, 0.3)'
              }}
            >
              + Add Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>👥</div>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem', fontWeight: '600' }}>No teams yet</p>
              <p style={{ fontSize: '0.95rem' }}>Add your first team to get started</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0E1F56', margin: '0 0 0.5rem 0' }}>
                      {team.team_name}
                    </h4>
                    <p style={{ color: '#6b7280', fontSize: '0.95rem', margin: 0 }}>
                      {team.agency_name}
                    </p>
                  </div>

                  {team.contact_name && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      <strong>Contact:</strong> {team.contact_name}
                      {team.contact_email && ` (${team.contact_email})`}
                    </div>
                  )}

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: '1rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    {team.team_codes && team.team_codes.map((code) => (
                      <div
                        key={code.id}
                        style={{
                          background: '#f9fafb',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                          {getTimepointLabel(code.timepoint)}
                        </div>
                        <div style={{ 
                          fontSize: '1.125rem', 
                          fontWeight: '700', 
                          color: '#0E1F56',
                          fontFamily: 'monospace',
                          marginBottom: '0.75rem',
                          letterSpacing: '0.05em'
                        }}>
                          {code.code}
                        </div>
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: 'none',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}
                        >
                          📋 Copy Code
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <AddTeamModal
          collaborativeId={id}
          onClose={() => setShowAddTeamModal(false)}
          onSuccess={handleAddTeamSuccess}
        />
      )}
    </div>
  )
}