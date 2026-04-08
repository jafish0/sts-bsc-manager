import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import TeamCodeEntry from './pages/TeamCodeEntry'
import Demographics from './pages/Demographics'
import STSS from './pages/STSS'
import ProQOL from './pages/ProQOL'
import STSIOA from './pages/STSIOA'
import AssessmentComplete from './pages/AssessmentComplete'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import TeamDashboard from './pages/TeamDashboard'
import CollaborativesList from './pages/CollaborativesList'
import CollaborativeDetail from './pages/CollaborativeDetail'
import CompletionTracking from './pages/CompletionTracking'
import DataVisualization from './pages/DataVisualization'
import TeamReport from './pages/TeamReport'
import SmartieGoals from './pages/SmartieGoals'
import SetPassword from './pages/SetPassword'
import Resources from './pages/Resources'
import ForumThreadList from './pages/ForumThreadList'
import ForumThread from './pages/ForumThread'
import ChangeFramework from './pages/ChangeFramework'
import StaffDirectory from './pages/StaffDirectory'
import TeamMembers from './pages/TeamMembers'

// Detect invite/recovery tokens in URL hash and redirect to /set-password
function AuthRedirectHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const hash = window.location.hash
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      // Preserve the hash so Supabase client can process the token
      navigate('/set-password' + hash, { replace: true })
    }
  }, [location, navigate])

  return null
}

// Routes agency_admin/team_leader to TeamDashboard, super_admin to AdminDashboard
function DashboardRouter() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (profile?.role === 'super_admin') return <AdminDashboard />
  return <TeamDashboard />
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Router>
        <AuthRedirectHandler />
        <Routes>
          {/* Public Assessment Routes */}
          <Route path="/" element={<TeamCodeEntry />} />
          <Route path="/demographics" element={<Demographics />} />
          <Route path="/stss" element={<STSS />} />
          <Route path="/proqol" element={<ProQOL />} />
          <Route path="/stsioa" element={<STSIOA />} />
          <Route path="/complete" element={<AssessmentComplete />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <DashboardRouter />
            </ProtectedRoute>
          } />
          <Route path="/admin/collaboratives" element={
            <ProtectedRoute>
              <CollaborativesList />
            </ProtectedRoute>
          } />
          <Route path="/admin/collaboratives/:id" element={
            <ProtectedRoute>
              <CollaborativeDetail />
            </ProtectedRoute>
          } />
          <Route path="/admin/completion" element={
            <ProtectedRoute>
              <CompletionTracking />
            </ProtectedRoute>
          } />
          <Route path="/admin/data-visualization" element={
            <ProtectedRoute>
              <DataVisualization />
            </ProtectedRoute>
          } />
          <Route path="/admin/team-report/:teamId" element={
            <ProtectedRoute>
              <TeamReport />
            </ProtectedRoute>
          } />
          <Route path="/admin/smartie-goals/:teamId" element={
            <ProtectedRoute>
              <SmartieGoals />
            </ProtectedRoute>
          } />
          <Route path="/admin/resources" element={
            <ProtectedRoute>
              <Resources />
            </ProtectedRoute>
          } />
          <Route path="/admin/forum" element={
            <ProtectedRoute>
              <ForumThreadList />
            </ProtectedRoute>
          } />
          <Route path="/admin/forum/:threadId" element={
            <ProtectedRoute>
              <ForumThread />
            </ProtectedRoute>
          } />
          <Route path="/admin/change-framework" element={
            <ProtectedRoute>
              <ChangeFramework />
            </ProtectedRoute>
          } />
          <Route path="/admin/staff" element={
            <ProtectedRoute>
              <StaffDirectory />
            </ProtectedRoute>
          } />
          <Route path="/admin/team/:teamId/members" element={
            <ProtectedRoute>
              <TeamMembers />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App