import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error)
      alert('Error logging out')
    } else {
      navigate('/login')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ 
        background: '#0E1F56', 
        color: 'white', 
        padding: '1.5rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.875rem' }}>STS-BSC Manager</h1>
            <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>
              Admin Dashboard
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: '#00A79D',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0E1F56', marginBottom: '0.5rem' }}>
            Welcome back!
          </h2>
          <p style={{ color: '#6b7280' }}>
            Manage your breakthrough series collaboratives and monitor assessment progress.
          </p>
        </div>

        {/* Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <button
            onClick={() => navigate('/admin/collaboratives')}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0E1F56'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Manage Collaboratives
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Create and manage breakthrough series collaboratives
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/completion')}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Completion Tracking
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Monitor assessment completion across teams
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/data-visualization')}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Data Visualization
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              View charts and graphs of assessment results
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}