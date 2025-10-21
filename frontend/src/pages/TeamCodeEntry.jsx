import { useState } from 'react'
import { supabase } from '../utils/supabase'
import '../styles/TeamCodeEntry.css'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

function TeamCodeEntry({ onCodeValidated }) {
  const [teamCode, setTeamCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Query the team_codes table
      const { data, error: queryError } = await supabase
        .from('team_codes')
        .select('*')
        .eq('code', teamCode.toUpperCase())
        .eq('active', true)
        .single()

      if (queryError || !data) {
        setError('Invalid team code. Please check your code and try again.')
        setLoading(false)
        return
      }

      // Valid code found
      onCodeValidated(data)

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

        <h1>STS-BSC Assessment</h1>
        <p className="subtitle">
          Secondary Traumatic Stress Breakthrough Series Collaborative
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
    </div>
  )
}

export default TeamCodeEntry