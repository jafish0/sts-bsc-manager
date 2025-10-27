import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'

function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img 
            src={ctacLogo} 
            alt="CTAC" 
            style={{ height: '50px', width: 'auto' }}
          />
          <div>
            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Admin Dashboard</h1>
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
              {profile?.role === 'super_admin' ? 'Super Admin' : 
               profile?.role === 'agency_admin' ? 'Agency Admin' : 
               profile?.role === 'team_leader' ? 'Team Leader' : 
               profile?.role}
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
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: '#0E1F56', marginTop: 0 }}>
            👋 Welcome, {profile?.email?.split('@')[0] || 'Admin'}!
          </h2>
          <p style={{ color: '#6b7280', marginBottom: 0 }}>
            This is your master admin dashboard. Phase 2 features are being built.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #00A79D'
          }}>
            <h3 style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
              ACTIVE COLLABORATIVES
            </h3>
            <p style={{ color: '#0E1F56', fontSize: '2rem', fontWeight: '700', margin: 0 }}>
              0
            </p>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #0E1F56'
          }}>
            <h3 style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
              TOTAL TEAMS
            </h3>
            <p style={{ color: '#0E1F56', fontSize: '2rem', fontWeight: '700', margin: 0 }}>
              0
            </p>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #10b981'
          }}>
            <h3 style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
              ASSESSMENTS COMPLETED
            </h3>
            <p style={{ color: '#0E1F56', fontSize: '2rem', fontWeight: '700', margin: 0 }}>
              0
            </p>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ color: '#0E1F56', marginTop: 0 }}>🚀 Phase 2 Features Coming Soon</h3>
          <ul style={{ color: '#6b7280', lineHeight: '1.8' }}>
            <li>Create and manage breakthrough series collaboratives</li>
            <li>Add teams and generate unique access codes</li>
            <li>Track assessment completion rates</li>
            <li>View aggregated data visualizations</li>
            <li>Add expert reviews and recommendations</li>
            <li>Discussion forums and resource repository</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard