import { useState } from 'react'
import { supabase } from '../utils/supabase'
import {
  STSS_COPYRIGHT,
  STSS_INFO,
  RESPONSE_OPTIONS,
  STSS_ITEMS,
  INSTRUCTIONS
} from '../config/stss'
import '../styles/STSS.css'

function STSS({ teamCodeData, assessmentResponseId, onComplete }) {
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
    const intrusionItems = STSS_ITEMS.filter(item => item.subscale === 'intrusion')
    const avoidanceItems = STSS_ITEMS.filter(item => item.subscale === 'avoidance')
    const arousalItems = STSS_ITEMS.filter(item => item.subscale === 'arousal')

    const intrusionScore = intrusionItems.reduce((sum, item) => sum + (responses[item.id] || 0), 0)
    const avoidanceScore = avoidanceItems.reduce((sum, item) => sum + (responses[item.id] || 0), 0)
    const arousalScore = arousalItems.reduce((sum, item) => sum + (responses[item.id] || 0), 0)
    const totalScore = intrusionScore + avoidanceScore + arousalScore

    return {
      intrusion_score: intrusionScore,
      avoidance_score: avoidanceScore,
      arousal_score: arousalScore,
      total_score: totalScore
    }
  }

  const allQuestionsAnswered = () => {
    return STSS_ITEMS.every(item => responses[item.id] !== undefined)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const scores = calculateScores()

      const stssData = {
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
        ...scores
      }

      const { error: insertError } = await supabase
        .from('stss_responses')
        .insert(stssData)

      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('assessment_responses')
        .update({ stss_complete: true })
        .eq('id', assessmentResponseId)

      if (updateError) throw updateError

      onComplete()

    } catch (err) {
      console.error('Error saving STSS:', err)
      setError('An error occurred saving your responses. Please try again.')
      setLoading(false)
    }
  }

  // Helper function to determine if we should show scale header
  const shouldShowScaleHeader = (index) => {
    return index === 0 || index === 6 || index === 12
  }

  return (
    <div className="stss-container">
      <div className="stss-card">
        <div className="progress-bar">
          <div className="progress-step complete">Demographics</div>
          <div className="progress-step active">STSS</div>
          <div className="progress-step">ProQOL</div>
          <div className="progress-step">STSI-OA</div>
        </div>

        <div className="stss-header">
          <h2>Secondary Traumatic Stress Scale (STSS)</h2>
          <button
            type="button"
            className="info-toggle"
            onClick={() => setShowInfo(!showInfo)}
          >
            {showInfo ? '▼ Hide Information' : '▶ About This Assessment'}
          </button>
        </div>

        {showInfo && (
          <div className="stss-info-panel">
            <h3>{STSS_INFO.title}</h3>
            <p>{STSS_INFO.description}</p>
            <p>{STSS_INFO.purpose}</p>
            
            <h4>The three subscales are:</h4>
            <ul className="subscales-list">
              {STSS_INFO.subscales.map((subscale, index) => (
                <li key={index}>
                  <strong>{subscale.name}:</strong> {subscale.description}
                </li>
              ))}
            </ul>
            
            <p><strong>Scoring:</strong> {STSS_INFO.scoring}</p>
            <p className="confidentiality-note">{STSS_INFO.confidentiality}</p>
          </div>
        )}

        <div className="copyright-notice">
          <p>{STSS_COPYRIGHT.text}</p>
          <p className="citation">{STSS_COPYRIGHT.citation}</p>
        </div>

        <div className="instructions">
          <p className="main-instruction">{INSTRUCTIONS}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="items-container">
            {STSS_ITEMS.map((item, index) => (
              <div key={item.id}>
                {shouldShowScaleHeader(index) && (
                  <div className="response-scale">
                    <div className="scale-labels">
                      {RESPONSE_OPTIONS.map(option => (
                        <div key={option.value} className="scale-label">
                          <strong>{option.value}</strong> = {option.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="stss-item">
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
                  {Object.keys(responses).length} of {STSS_ITEMS.length} questions answered
                </span>
              )}
            </div>
            <button type="submit" disabled={loading || !allQuestionsAnswered()}>
              {loading ? 'Saving...' : 'Continue to ProQOL Assessment →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default STSS