import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'
import CreateCollaborativeModal from '../components/CreateCollaborativeModal'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'

function CollaborativesList() {
  const [collaboratives, setCollaboratives] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active') // 'active', 'completed', 'all'
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { profile, signOut } = useAuth()
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

      if (filter === 'active') {
        query = query.eq('status', 'active')
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed')
      }

      const { data, error } = await query

      if (error) throw error
      setCollaboratives(data || [])
    } catch (error) {
      console.error('Error fetching collaboratives:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    fetchCollaboratives() // Refresh the list
  }

  const getStatusBadge = (collaborative) => {
    const status = collaborative.status || 'active'
    
    const statusConfig = {
      'active': { text: 'Active', color: '#10b981', bg: '#d1fae5' },
      'upcoming': { text: 'Upcoming', color: '#0ea5e9', bg: '#e0f2fe' },
      'completed': { text: 'Completed', color: '#6b7280', bg: '#f3f4f6' }
    }
    
    return statusConfig[status] || statusConfig['active']
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #0E1F56 0%, #00A79D 100%)',
        color: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
             onClick={() => navigate('/dashboard')}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
              {profile?.email}
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>
              {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role}
            </p>
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
              e.target.style.background = 'white'
              e.target.style.color = '#0E1F56'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)'
              e.target.style.color = 'white'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Top Actions Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem'
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
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            + Create New Collaborative
          </button>
        </div>

        {/* Collaboratives Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <p style={{ fontSize: '1.125rem' }}>Loading collaboratives...</p>
          </div>
        ) : collaboratives.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1.5rem', marginBottom: '1rem' }}>
              No Collaboratives Found
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              {filter === 'active' 
                ? "You don't have any active collaboratives yet." 
                : filter === 'completed'
                ? "No completed collaboratives found."
                : "Get started by creating your first collaborative!"}
            </p>
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
              Create Your First Collaborative
            </button>
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
                  onClick={() => navigate(`/collaboratives/${collab.id}`)}
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
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#0E1F56', margin: 0, fontSize: '1.25rem', flex: 1 }}>
                      {collab.name}
                    </h3>
                    <span style={{
                      background: status.bg,
                      color: status.color,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      marginLeft: '0.5rem',
                      whiteSpace: 'nowrap'
                    }}>
                      {status.text}
                    </span>
                  </div>

                  {collab.description && (
                    <p style={{ 
                      color: '#6b7280', 
                      fontSize: '0.9rem', 
                      marginBottom: '1rem',
                      lineHeight: '1.5'
                    }}>
                      {collab.description.length > 100 
                        ? collab.description.substring(0, 100) + '...' 
                        : collab.description}
                    </p>
                  )}

                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Start Date</div>
                      <div>{formatDate(collab.start_date)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>End Date</div>
                      <div>{formatDate(collab.end_date)}</div>
                    </div>
                  </div>

                  <div style={{ 
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#00A79D',
                    fontWeight: '600',
                    textAlign: 'right'
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

export default CollaborativesList