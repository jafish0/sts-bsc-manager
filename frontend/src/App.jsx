import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import TeamCodeEntry from './pages/TeamCodeEntry'
import Demographics from './pages/Demographics'
import STSS from './pages/STSS'
import ProQOL from './pages/ProQOL'
import STSIOA from './pages/STSIOA'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import CollaborativesList from './pages/CollaborativesList'
import CollaborativeDetail from './pages/CollaborativeDetail'
import CompletionTracking from './pages/CompletionTracking'
import DataVisualization from './pages/DataVisualization'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Assessment Routes */}
          <Route path="/" element={<TeamCodeEntry />} />
          <Route path="/demographics" element={<Demographics />} />
          <Route path="/stss" element={<STSS />} />
          <Route path="/proqol" element={<ProQOL />} />
          <Route path="/stsioa" element={<STSIOA />} />
          
          {/* Admin Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
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

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App