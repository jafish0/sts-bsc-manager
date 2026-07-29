import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { getProgramBranding } from '../config/programConfig'
import '../styles/TeamCodeEntry.css'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

function TeamCodeEntry() {
  const navigate = useNavigate()
  const [teamCode, setTeamCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate through a SECURITY DEFINER RPC rather than reading
      // team_codes directly. A direct read required anon SELECT on the table,
      // which allowed ENUMERATING every active code — and a code is the only
      // credential needed to submit an assessment. The RPC returns just this
      // one code's details, and enforces active + not-expired server-side.
      const { data, error: queryError } = await supabase
        .rpc('validate_team_code', { p_code: teamCode.toUpperCase() })

      const row = Array.isArray(data) ? data[0] : data
      if (queryError || !row) {
        setError('Invalid team code. Please check your code and try again.')
        setLoading(false)
        return
      }

      // Valid code found - store in localStorage and navigate to demographics
      localStorage.setItem('sts_teamCodeId', row.team_code_id)
      localStorage.setItem('sts_teamCode', row.code)
      localStorage.setItem('sts_programType', row.program_type || 'sts_bsc')
      localStorage.setItem('sts_timepoint', row.timepoint)
      navigate('/demographics')

    } catch (err) {
      console.error('Error validating team code:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="team-code-container">
      <div className="team-code-card">
        <div className="logo-top">
          <img src={ctacLogo} alt="Center on Trauma and Children" />
        </div>

        <h1>Agency Assessment</h1>
        <p className="subtitle">
          Center on Trauma and Children
        </p>

        <p className="instructions">
          Welcome! Please enter your team code to begin the assessment.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="teamCode">Team Code</label>
            <input
              type="text"
              id="teamCode"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              placeholder="Enter your team code"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <button type="submit" disabled={loading || !teamCode}>
            {loading ? 'Validating...' : 'Begin Assessment →'}
          </button>
        </form>

        <div className="info-box">
          <p>
            <strong>Note:</strong> This assessment will take approximately 20-25 minutes to complete.
            Please ensure you have enough time to finish in one sitting.
          </p>
        </div>

        <div className="logo-bottom">
          <img src={ukLogo} alt="University of Kentucky" />
        </div>
      </div>

      {/* Staff/team-leader entry point. Muted + below the card so it doesn't
          distract assessment respondents, but gives testers/real users who
          land on the bare domain a path to the login. */}
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            background: 'none', border: 'none', color: '#6b7280',
            fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline',
            padding: '0.25rem',
          }}
        >
          CTAC staff or team leader? Log in here
        </button>
      </div>
    </div>
  )
}

export default TeamCodeEntry