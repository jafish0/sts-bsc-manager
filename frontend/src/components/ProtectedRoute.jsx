import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ThemeToggle from './ThemeToggle'

function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0E1F56 0%, #00A79D 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // "Remove from team" sets is_active = false (set_user_active RPC). Nothing
  // revokes the auth session itself, so a removed member's next protected
  // page load lands here instead of on their old dashboard.
  if (profile && profile.is_active === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '3rem', maxWidth: '500px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ color: '#0E1F56', marginBottom: '1rem' }}>This account has been deactivated</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            You were removed from your team. If that was a mistake, ask your team leader or CTAC to reactivate you.
          </p>
          <button
            onClick={() => signOut()}
            style={{ background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
          >Sign out</button>
        </div>
      </div>
    )
  }

  if (requireSuperAdmin && profile?.role !== 'super_admin') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '3rem',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <h1 style={{ color: '#ef4444', fontSize: '3rem', margin: '0 0 1rem 0' }}>⛔</h1>
          <h2 style={{ color: '#0E1F56', marginBottom: '1rem' }}>Access Denied</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}<ThemeToggle /></>
}

export default ProtectedRoute