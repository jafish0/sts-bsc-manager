import { useState } from 'react'
import { supabase } from '../utils/supabase'
import {
  PROQOL_COPYRIGHT,
  PROQOL_INFO,
  RESPONSE_OPTIONS,
  PROQOL_ITEMS,
  TIMEFRAME_NOTE,
  INSTRUCTIONS,
  HELPER_NOTE
} from '../config/proqol'
import '../styles/ProQOL.css'

function ProQOL({ teamCodeData, assessmentResponseId, onComplete }) {
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  const handleResponseChange = (itemId, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: parseInt(value)
    }))
  }

  const calculateScores = () => {
    // Handle reverse scoring for items 1, 4, 15, 17, 29
    const getScore = (itemId) => {
      const item = PROQOL_ITEMS.find(i => i.id === itemId)
      const rawScore = responses[itemId] || 0
      
      if (item.reverseScored) {
        // Reverse scoring: 1=5, 2=4, 3=3, 4=2, 5=1
        return rawScore === 0 ? 0 : 6 - rawScore
      }
      return rawScore
    }

    // Calculate subscale scores
    const compassionItems = PROQOL_ITEMS.filter(item => item.subscale === 'compassion_satisfaction')
    const burnoutItems = PROQOL_ITEMS.filter(item => item.subscale === 'burnout')
    const traumaItems = PROQOL_ITEMS.filter(item => item.subscale === 'secondary_trauma')

    const compassionScore = compassionItems.reduce((sum, item) => sum + getScore(item.id), 0)
    const burnoutScore = burnoutItems.reduce((sum, item) => sum + getScore(item.id), 0)
    const traumaScore = traumaItems.reduce((sum, item) => sum + getScore(item.id), 0)

    return {
      compassion_satisfaction_score: compassionScore,
      burnout_score: burnoutScore,
      secondary_trauma_score: traumaScore
    }
  }

  const allQuestionsAnswered = () => {
    return PROQOL_ITEMS.every(item => responses[item.id] !== undefined)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const scores = calculateScores()

      // Prepare data for database - match the database schema with individual item columns
      const proqolData = {
        assessment_response_id: assessmentResponseId,
        item_1: responses[1],
        item_2: responses[2],
        item_3: responses[3],
        item_4: responses[4],
        item_5: responses[5],
        item_6: responses[6],
        item_7: responses[7],
        item_8: responses[8],
        item_9: responses[9],
        item_10: responses[10],
        item_11: responses[11],
        item_12: responses[12],
        item_13: responses[13],
        item_14: responses[14],
        item_15: responses[15],
        item_16: responses[16],
        item_17: responses[17],
        item_18: responses[18],
        item_19: responses[19],
        item_20: responses[20],
        item_21: responses[21],
        item_22: responses[22],
        item_23: responses[23],
        item_24: responses[24],
        item_25: responses[25],
        item_26: responses[26],
        item_27: responses[27],
        item_28: responses[28],
        item_29: responses[29],
        item_30: responses[30],
        ...scores
      }

      // Insert into database
      const { error: insertError } = await supabase
        .from('proqol_responses')
        .insert(proqolData)

      if (insertError) throw insertError

      // Update assessment_responses to mark ProQOL as complete
      const { error: updateError } = await supabase
        .from('assessment_responses')
        .update({ proqol_complete: true })
        .eq('id', assessmentResponseId)

      if (updateError) throw updateError

      // Move to next assessment
      onComplete()

    } catch (err) {
      console.error('Error saving ProQOL:', err)
      setError('An error occurred saving your responses. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="proqol-container">
      <div className="proqol-card">
        <div className="progress-bar">
          <div className="progress-step complete">Demographics</div>
          <div className="progress-step complete">STSS</div>
          <div className="progress-step active">ProQOL</div>
          <div className="progress-step">STSI-OA</div>
        </div>

        <div className="proqol-header">
          <h2>Professional Quality of Life Scale (ProQOL 5)</h2>
          <button
            type="button"
            className="info-toggle"
            onClick={() => setShowInfo(!showInfo)}
          >
            {showInfo ? '▼ Hide Information' : '▶ About This Assessment'}
          </button>
        </div>

        {showInfo && (
          <div className="proqol-info-panel">
            <h3>{PROQOL_INFO.title}</h3>
            <p>{PROQOL_INFO.description}</p>
            <p>{PROQOL_INFO.purpose}</p>
            
            <h4>{PROQOL_INFO.scoring}</h4>
            <ul className="subscales-list">
              {PROQOL_INFO.subscales.map((subscale, index) => (
                <li key={index}>
                  <strong>{subscale.name}:</strong> {subscale.description}
                  <br />
                  <em>{subscale.range}</em>
                  <br />
                  {subscale.interpretation}
                </li>
              ))}
            </ul>
            
            <p className="confidentiality-note">{PROQOL_INFO.confidentiality}</p>
            <p className="helper-note">{PROQOL_INFO.note}</p>
          </div>
        )}

        <div className="copyright-notice">
          <p>{PROQOL_COPYRIGHT.text}</p>
          <p className="citation">{PROQOL_COPYRIGHT.citation}</p>
          <p className="website">Visit: {PROQOL_COPYRIGHT.website}</p>
        </div>

        <div className="instructions">
          <p className="main-instruction">{INSTRUCTIONS}</p>
          <p className="helper-note">{HELPER_NOTE}</p>
          <p className="timeframe-note">{TIMEFRAME_NOTE}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="response-scale">
            <div className="scale-labels">
              {RESPONSE_OPTIONS.map(option => (
                <div key={option.value} className="scale-label">
                  <strong>{option.value}</strong> = {option.label}
                </div>
              ))}
            </div>
          </div>

          <div className="items-container">
            {PROQOL_ITEMS.map((item, index) => (
              <div key={item.id} className="proqol-item">
                <div className="item-text">
                  <span className="item-number">{index + 1}.</span>
                  <span className="item-content">{item.text}</span>
                </div>
                <div className="response-options">
                  {RESPONSE_OPTIONS.map(option => (
                    <label key={option.value} className="radio-option">
                      <input
                        type="radio"
                        name={`item-${item.id}`}
                        value={option.value}
                        checked={responses[item.id] === option.value}
                        onChange={(e) => handleResponseChange(item.id, e.target.value)}
                        required
                      />
                      <span className="radio-label">{option.value}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-actions">
            <div className="completion-status">
              {allQuestionsAnswered() ? (
                <span className="status-complete">✓ All questions answered</span>
              ) : (
                <span className="status-incomplete">
                  {Object.keys(responses).length} of {PROQOL_ITEMS.length} questions answered
                </span>
              )}
            </div>
            <button type="submit" disabled={loading || !allQuestionsAnswered()}>
              {loading ? 'Saving...' : 'Continue to STSI-OA Assessment →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProQOL