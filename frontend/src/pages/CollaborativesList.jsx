import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from 'react-router-dom'
import CreateCollaborativeModal from '../components/CreateCollaborativeModal'
import ctacLogo from '../assets/CTAC_white.png'

export default function CollaborativesList() {
  const [collaboratives, setCollaboratives] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState('active')
  const navigate = useNavigate()

  useEffect(() => {
    fetchCollaboratives()
  }, [filter])

  const fetchCollaboratives = async () => {
    try {
      let query = supabase
        .from('collaboratives')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setCollaboratives(data || [])
    } catch (error) {
      console.error('Error fetching collaboratives:', error)
      alert('Error loading collaboratives')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    fetchCollaboratives()
  }

  const getStatusBadge = (collaborative) => {
    const status = collaborative.status || 'active'
    
    const statusConfig = {
      active: { label: 'Active', color: '#10b981', bg: '#d1fae5' },
      completed: { label: 'Completed', color: '#6b7280', bg: '#f3f4f6' }
    }

    return statusConfig[status] || statusConfig.active
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <div>Loading collaboratives...</div>
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
            onClick={() => navigate('/admin')}>
            <img 
              src={ctacLogo} 
              alt="CTAC" 
              style={{ height: '50px', width: 'auto' }}
            />
            <div>
              <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Collaboratives Management</h1>
              <p style={{ fontSize: '0.875rem', margin: 0, opacity: 0.9 }}>
                STS Breakthrough Series Collaborative Manager
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
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Filters and Create Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setFilter('active')}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: filter === 'active' ? '#0E1F56' : 'white',
                color: filter === 'active' ? 'white' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('completed')}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: filter === 'completed' ? '#0E1F56' : 'white',
                color: filter === 'completed' ? 'white' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: filter === 'all' ? '#0E1F56' : 'white',
                color: filter === 'all' ? 'white' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              All
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 167, 157, 0.3)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 167, 157, 0.4)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 167, 157, 0.3)'
            }}
          >
            + Create New Collaborative
          </button>
        </div>

        {/* Collaboratives Grid */}
        {collaboratives.length === 0 ? (
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '4rem 2rem', 
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }}>📋</div>
            <h2 style={{ color: '#374151', marginBottom: '0.5rem' }}>No collaboratives found</h2>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              {filter === 'all' 
                ? 'Get started by creating your first collaborative'
                : `No ${filter} collaboratives at this time`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                + Create New Collaborative
              </button>
            )}
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {collaboratives.map((collab) => {
              const status = getStatusBadge(collab)
              return (
                <div
                  key={collab.id}
                  onClick={() => navigate(`/admin/collaboratives/${collab.id}`)}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderLeft: `4px solid ${status.color}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <h3 style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: '700', 
                      color: '#0E1F56',
                      margin: 0,
                      flex: 1
                    }}>
                      {collab.name}
                    </h3>
                    <span style={{
                      background: status.bg,
                      color: status.color,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      marginLeft: '0.5rem'
                    }}>
                      {status.label}
                    </span>
                  </div>

                  {collab.description && (
                    <p style={{ 
                      color: '#6b7280', 
                      fontSize: '0.9rem', 
                      marginBottom: '1rem',
                      lineHeight: '1.5'
                    }}>
                      {collab.description}
                    </p>
                  )}

                  <div style={{ 
                    display: 'flex', 
                    gap: '1.5rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#374151' }}>Start Date</div>
                      <div>{new Date(collab.start_date).toLocaleDateString()}</div>
                    </div>
                    {collab.end_date && (
                      <div>
                        <div style={{ fontWeight: '600', color: '#374151' }}>End Date</div>
                        <div>{new Date(collab.end_date).toLocaleDateString()}</div>
                      </div>
                    )}
                  </div>

                  <div style={{ 
                    marginTop: '1rem',
                    color: '#00A79D',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    View Details →
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCollaborativeModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  )
}