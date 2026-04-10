import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function SessionSignOut() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    completeSignOut()
  }, [token])

  const completeSignOut = async () => {
    try {
      const attendanceId = sessionStorage.getItem(`attendance_${token}`)

      // Get event title for display
      const { data: link } = await supabase
        .from('session_links')
        .select('bsc_events(title)')
        .eq('token', token)
        .single()

      setEventTitle(link?.bsc_events?.title || 'this session')

      if (attendanceId) {
        // Update sign-out time
        await supabase
          .from('session_attendance')
          .update({
            signed_out_at: new Date().toISOString(),
            sign_out_method: 'manual'
          })
          .eq('id', attendanceId)

        // Clear sessionStorage
        sessionStorage.removeItem(`attendance_${token}`)
      }
    } catch (err) {
      console.error('Sign-out error:', err)
      setError('There was an issue completing your sign-out, but your evaluation has been recorded.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ color: NAVY, fontSize: '1.1rem' }}>Signing out...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem', padding: '2.5rem',
        maxWidth: '550px', textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>&#128075;</div>
        <h2 style={{ color: NAVY, marginBottom: '0.5rem' }}>You've Been Signed Out</h2>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          Thank you for attending <strong>{eventTitle}</strong>!
        </p>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
          Your evaluation has been submitted and your attendance has been recorded. You may close this window.
        </p>
        {error && (
          <p style={{ color: '#D97706', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
