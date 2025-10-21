import { useState } from 'react'
import { supabase } from '../utils/supabase'
import {
  STSIOA_COPYRIGHT,
  STSIOA_INFO,
  RESPONSE_OPTIONS,
  STSIOA_DOMAINS,
  INSTRUCTIONS,
  DEFINITIONS
} from '../config/stsioa'
import '../styles/STSIOA.css'

function STSIOA({ teamCodeData, assessmentResponseId, onComplete }) {
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: parseInt(value)
    }))
  }

  const calculateDomainScores = () => {
    const domainScores = {}
    
    STSIOA_DOMAINS.forEach(domain => {
      const domainTotal = domain.questions.reduce((sum, question) => {
        const response = responses[question.id]
        // Only add to score if not N/A (0) and if answered
        return sum + (response && response > 0 ? response : 0)
      }, 0)
      domainScores[`domain_${domain.id}_score`] = domainTotal
    })

    return domainScores
  }

  const calculateTotalScore = () => {
    return Object.values(responses).reduce((sum, value) => {
      // Only count values > 0 (exclude N/A)
      return sum + (value > 0 ? value : 0)
    }, 0)
  }

  const getTotalQuestionCount = () => {
    return STSIOA_DOMAINS.reduce((total, domain) => total + domain.questions.length, 0)
  }

  const allQuestionsAnswered = () => {
    const totalQuestions = getTotalQuestionCount()
    return Object.keys(responses).length === totalQuestions
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const domainScores = calculateDomainScores()
      const totalScore = calculateTotalScore()

      // Prepare individual item responses
      const itemResponses = {}
      STSIOA_DOMAINS.forEach(domain => {
        domain.questions.forEach(question => {
          // Convert '1a' to 'item_1a'
          const itemKey = `item_${question.id}`
          itemResponses[itemKey] = responses[question.id] || 0
        })
      })

      // Prepare data for database
      const stsioaData = {
        assessment_response_id: assessmentResponseId,
        ...itemResponses,
        ...domainScores,
        total_score: totalScore
      }

      // Insert into database
      const { error: insertError } = await supabase
        .from('stsioa_responses')
        .insert(stsioaData)

      if (insertError) throw insertError

      // Update assessment_responses to mark STSIOA as complete and overall assessment as complete
      const { error: updateError } = await supabase
        .from('assessment_responses')
        .update({ 
          stsioa_complete: true,
          is_complete: true
        })
        .eq('id', assessmentResponseId)

      if (updateError) throw updateError

      // Move to completion screen
      onComplete()

    } catch (err) {
      console.error('Error saving STSI-OA:', err)
      setError('An error occurred saving your responses. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="stsioa-container">
      <div className="stsioa-card">
        <div className="progress-bar">
          <div className="progress-step complete">Demographics</div>
          <div className="progress-step complete">STSS</div>
          <div className="progress-step complete">ProQOL</div>
          <div className="progress-step active">STSI-OA</div>
        </div>

        <div className="stsioa-header">
          <h2>Secondary Traumatic Stress-Informed Organizational Assessment (STSI-OA)</h2>
          <button
            type="button"
            className="info-toggle"
            onClick={() => setShowInfo(!showInfo)}
          >
            {showInfo ? '▼ Hide Information' : '▶ About This Assessment'}
          </button>
        </div>

        {showInfo && (
          <div className="stsioa-info-panel">
            <h3>{STSIOA_INFO.title}</h3>
            <p>{STSIOA_INFO.description}</p>
            <p>{STSIOA_INFO.purpose}</p>
            
            <h4>Assessment Domains:</h4>
            <ul className="domains-list">
              {STSIOA_INFO.domains.map((domain, index) => (
                <li key={index}>
                  <strong>{domain.name}:</strong> {domain.description}
                </li>
              ))}
            </ul>
            
            <p><strong>Scoring:</strong> {STSIOA_INFO.scoring}</p>
            <p><strong>Total Score Range:</strong> {STSIOA_INFO.totalRange}</p>
            <p className="confidentiality-note">{STSIOA_INFO.confidentiality}</p>

            <div className="definitions-section">
              <h4>{DEFINITIONS.title}</h4>
              {DEFINITIONS.terms.map((term, index) => (
                <div key={index} className="definition-item">
                  <strong>{term.term}:</strong> {term.definition}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="copyright-notice">
          <p>{STSIOA_COPYRIGHT.text}</p>
          <p className="contact">{STSIOA_COPYRIGHT.contact}</p>
        </div>

        <div className="instructions">
          <p className="main-instruction">{INSTRUCTIONS}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="response-scale">
            <div className="scale-labels">
              {RESPONSE_OPTIONS.map(option => (
                <div key={option.value} className="scale-label">
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          {STSIOA_DOMAINS.map((domain, domainIndex) => (
            <div key={domain.id} className="domain-section">
              <div className="domain-header">
                <h3>Domain {domain.id}: {domain.name}</h3>
                <p className="domain-subtitle">{domain.fullName}</p>
              </div>

              <div className="questions-container">
                {domain.questions.map((question) => (
                  <div key={question.id} className="stsioa-item">
                    <div className="item-text">
                      <span className="item-id">{question.id}.</span>
                      <span className="item-content">{question.text}</span>
                    </div>
                    <div className="response-options">
                      {RESPONSE_OPTIONS.map(option => (
                        <label key={option.value} className="radio-option">
                          <input
                            type="radio"
                            name={`item-${question.id}`}
                            value={option.value}
                            checked={responses[question.id] === option.value}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            required
                          />
                          <span className="radio-label">{option.value === 0 ? 'N/A' : option.value}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-actions">
            <div className="completion-status">
              {allQuestionsAnswered() ? (
                <span className="status-complete">✓ All questions answered</span>
              ) : (
                <span className="status-incomplete">
                  {Object.keys(responses).length} of {getTotalQuestionCount()} questions answered
                </span>
              )}
            </div>
            <button type="submit" disabled={loading || !allQuestionsAnswered()}>
              {loading ? 'Saving...' : 'Complete Assessment →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default STSIOA