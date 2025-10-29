import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'
import '../styles/TeamCodeEntry.css'

function AssessmentComplete() {
  const navigate = useNavigate()

  useEffect(() => {
    // Clear session storage on mount
    sessionStorage.removeItem('teamCodeId')
    sessionStorage.removeItem('teamCode')
    sessionStorage.removeItem('assessmentResponseId')
  }, [])

  return (
    <div className="team-code-container">
      <div className="team-code-card">
        <div className="logo-top">
          <img src={ctacLogo} alt="Center on Trauma and Children" />
        </div>

        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{ fontSize: '4rem', color: '#00A79D', marginBottom: '1rem' }}>
            ✓
          </div>
          <h1 style={{ color: '#0E1F56', marginBottom: '1rem' }}>
            Assessment Complete!
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#374151', marginBottom: '2rem', lineHeight: '1.6' }}>
            Thank you for completing the STS-BSC Assessment. Your responses have been recorded successfully.
          </p>

          <div className="info-box" style={{ marginBottom: '2rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>What happens next?</strong>
            </p>
            <p>
              Your responses will be aggregated with those of your agency to provide valuable insights
              into secondary traumatic stress levels and organizational support within your agency or organization.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            style={{
              background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white',
              padding: '0.75rem 2rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 167, 157, 0.3)'
            }}
          >
            Return to Home
          </button>
        </div>

        <div className="logo-bottom">
          <img src={ukLogo} alt="University of Kentucky" />
        </div>
      </div>
    </div>
  )
}

export default AssessmentComplete