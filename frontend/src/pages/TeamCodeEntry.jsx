import { useState } from 'react'
import { supabase } from '../utils/supabase'
import '../styles/TeamCodeEntry.css'

function TeamCodeEntry({ onCodeValidated }) {
  const [teamCode, setTeamCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateTeamCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Query the team_codes table to validate the code
      const { data, error: supabaseError } = await supabase
        .from('team_codes')
        .select('id, code, timepoint, team_id, active, expires_at')
        .eq('code', teamCode.trim().toUpperCase())
        .eq('active', true)
        .single()

      if (supabaseError || !data) {
        setError('Invalid team code. Please check and try again.')
        setLoading(false)
        return
      }

      // Check if code is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This team code has expired. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Code is valid! Pass the data to parent component
      onCodeValidated(data)
      
    } catch (err) {
      console.error('Error validating code:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="team-code-container">
      <div className="team-code-card">
        <div className="header">
          <h1>STS Assessment Portal</h1>
          <p className="subtitle">Secondary Traumatic Stress Breakthrough Series Collaborative</p>
        </div>

        <div className="content">
          <h2>Welcome!</h2>
          <p>
            Thank you for participating in this assessment. Your responses are completely 
            <strong> anonymous</strong> and will help your organization understand and address 
            secondary traumatic stress.
          </p>

          <form onSubmit={validateTeamCode}>
            <div className="form-group">
              <label htmlFor="teamCode">Enter Your Team Code</label>
              <input
                type="text"
                id="teamCode"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="e.g., ABC-AGENCY-2025"
                disabled={loading}
                required
              />
              <small>Your team leader should have provided this code</small>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !teamCode.trim()}>
              {loading ? 'Validating...' : 'Begin Assessment'}
            </button>
          </form>

          <div className="info-box">
            <h3>What to expect:</h3>
            <ul>
              <li>The assessment takes approximately 15-20 minutes</li>
              <li>Your responses are completely anonymous</li>
              <li>You can complete it in one session</li>
              <li>All questions are required</li>
            </ul>
          </div>
        </div>

        <div className="footer">
          <p>University of Kentucky - Center on Trauma & Children</p>
        </div>
      </div>
    </div>
  )
}

export default TeamCodeEntry