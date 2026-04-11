import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import {
  TIC_OSA_INFO,
  RESPONSE_OPTIONS,
  TIC_OSA_DOMAINS,
  DOMAIN_SCORE_COLUMNS,
  INSTRUCTIONS
} from '../config/ticOsa'
import { getNextAssessmentPath, getProgressSteps, getStepIndex } from '../config/programAssessments'
import '../styles/STSIOA.css'

function TicOsa() {
  const navigate = useNavigate()
  const [assessmentResponseId, setAssessmentResponseId] = useState(null)
  const [responses, setResponses] = useState({})
  const [currentDomain, setCurrentDomain] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  const programType = localStorage.getItem('sts_programType') || 'tic_lc'
  const progressSteps = getProgressSteps(programType)
  const currentStepIdx = getStepIndex(programType, 'tic_osa')

  useEffect(() => {
    const responseId = localStorage.getItem('sts_assessmentResponseId')
    if (!responseId) {
      alert('No assessment found. Please start from the beginning.')
      navigate('/')
      return
    }
    setAssessmentResponseId(responseId)

    const saved = localStorage.getItem('sts_ticosa')
    if (saved) {
      try { setResponses(JSON.parse(saved)) } catch (e) { /* ignore */ }
    }
  }, [navigate])

  useEffect(() => {
    if (Object.keys(responses).length > 0) {
      localStorage.setItem('sts_ticosa', JSON.stringify(responses))
    }
  }, [responses])

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: parseInt(value)
    }))
  }

  const getDomainQuestions = (domainId) => {
    const domain = TIC_OSA_DOMAINS.find(d => d.id === domainId)
    return domain ? domain.sections.flatMap(s => s.questions) : []
  }

  const calculateDomainScores = () => {
    const scores = {}
    TIC_OSA_DOMAINS.forEach(domain => {
      const questions = domain.sections.flatMap(s => s.questions)
      const total = questions.reduce((sum, q) => {
        const val = responses[q.id]
        // Only count 1-4 (Likert), skip 5 (Don't Know) and 6 (N/A)
        return sum + (val && val >= 1 && val <= 4 ? val : 0)
      }, 0)
      scores[DOMAIN_SCORE_COLUMNS[domain.id]] = total
    })
    return scores
  }

  const calculateTotalScore = () => {
    return Object.values(responses).reduce((sum, val) => {
      return sum + (val && val >= 1 && val <= 4 ? val : 0)
    }, 0)
  }

  const getTotalQuestionCount = () => {
    return TIC_OSA_DOMAINS.reduce((total, domain) =>
      total + domain.sections.reduce((st, s) => st + s.questions.length, 0), 0)
  }

  const currentDomainData = TIC_OSA_DOMAINS.find(d => d.id === currentDomain)

  const currentDomainQuestionsAnswered = () => {
    const questions = getDomainQuestions(currentDomain)
    return questions.every(q => responses[q.id] !== undefined)
  }

  const allQuestionsAnswered = () => {
    return Object.keys(responses).length === getTotalQuestionCount()
  }

  const handleNext = () => {
    if (currentDomain < 5) {
      setCurrentDomain(currentDomain + 1)
      window.scrollTo(0, 0)
    }
  }

  const handlePrevious = () => {
    if (currentDomain > 1) {
      setCurrentDomain(currentDomain - 1)
      window.scrollTo(0, 0)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!assessmentResponseId) {
      setError('Assessment not initialized. Please refresh and try again.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const domainScores = calculateDomainScores()
      const totalScore = calculateTotalScore()

      // Build item columns: item_1 through item_100
      const itemResponses = {}
      TIC_OSA_DOMAINS.forEach(domain => {
        domain.sections.forEach(section => {
          section.questions.forEach(q => {
            itemResponses[`item_${q.id}`] = responses[q.id] || 0
          })
        })
      })

      const ticOsaData = {
        assessment_response_id: assessmentResponseId,
        ...itemResponses,
        ...domainScores,
        total_score: totalScore
      }

      const { error: insertError } = await supabase
        .from('tic_osa_responses')
        .insert(ticOsaData)

      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('assessment_responses')
        .update({
          tic_osa_complete: true,
          is_complete: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', assessmentResponseId)

      if (updateError) throw updateError

      const nextPath = getNextAssessmentPath(programType, 'tic_osa')
      navigate(nextPath)

    } catch (err) {
      console.error('Error saving TIC OSA:', err)
      setError('An error occurred saving your responses. Please try again.')
      setLoading(false)
    }
  }

  if (!assessmentResponseId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>&#x23F3;</div>
          <div>Loading assessment...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="stsioa-container">
      <div className="stsioa-card">
        <div className="progress-bar">
          {progressSteps.map((step, i) => (
            <div
              key={step}
              className={`progress-step ${i < currentStepIdx ? 'complete' : ''} ${i === currentStepIdx ? 'active' : ''}`}
            >
              {step}
            </div>
          ))}
        </div>

        <div className="stsioa-header">
          <h2>Trauma-Informed Organizational Self-Assessment (TIC OSA)</h2>
          <button
            type="button"
            className="info-toggle"
            onClick={() => setShowInfo(!showInfo)}
          >
            {showInfo ? '\u25BC Hide Information' : '\u25B6 About This Assessment'}
          </button>
        </div>

        {showInfo && (
          <div className="stsioa-info-panel">
            <h3>{TIC_OSA_INFO.title}</h3>
            <p>{TIC_OSA_INFO.description}</p>
            <p>{TIC_OSA_INFO.purpose}</p>

            <h4>Assessment Domains:</h4>
            <ul className="domains-list">
              {TIC_OSA_INFO.domains.map((domain, index) => (
                <li key={index}>
                  <strong>{domain.name}:</strong> {domain.description}
                </li>
              ))}
            </ul>

            <p><strong>Scoring:</strong> {TIC_OSA_INFO.scoring}</p>
            <p className="confidentiality-note">{TIC_OSA_INFO.confidentiality}</p>
          </div>
        )}

        <div className="instructions">
          <p className="main-instruction">{INSTRUCTIONS}</p>
        </div>

        <div className="domain-progress">
          <span>Domain {currentDomain} of 5</span>
          <span className="questions-progress">
            {Object.keys(responses).length} of {getTotalQuestionCount()} total questions answered
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="domain-section">
            <div className="domain-header">
              <h3>Domain {currentDomainData.id}: {currentDomainData.name}</h3>
            </div>

            {currentDomainData.sections.map((section) => (
              <div key={section.heading}>
                <div style={{ background: '#f0f4ff', padding: '0.75rem 1rem', margin: '1rem 0 0.5rem', borderRadius: '6px', fontWeight: 600, color: '#0E1F56' }}>
                  {section.heading}
                </div>
                {section.subtitle && (
                  <p style={{ fontStyle: 'italic', color: '#6b7280', margin: '0.25rem 0 0.75rem 1rem', fontSize: '0.9rem' }}>
                    {section.subtitle}
                  </p>
                )}

                <div className="domain-scale-reminder">
                  <div className="scale-labels-compact">
                    {RESPONSE_OPTIONS.map(option => (
                      <span key={option.value} className="scale-compact">
                        <strong>{option.value}</strong>={option.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="questions-container">
                  {section.questions.map((question) => (
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
                            <span className="radio-label">
                              {option.value <= 4 ? option.value : (option.value === 5 ? 'DK' : 'N/A')}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentDomain === 1}
              className="nav-button"
            >
              &larr; Previous Domain
            </button>

            <div className="completion-status">
              {currentDomain < 5 ? (
                currentDomainQuestionsAnswered() ? (
                  <span className="status-complete">&#x2713; Domain {currentDomain} complete</span>
                ) : (
                  <span className="status-incomplete">
                    Complete all questions to continue
                  </span>
                )
              ) : (
                allQuestionsAnswered() ? (
                  <span className="status-complete">&#x2713; All domains complete - ready to submit!</span>
                ) : (
                  <span className="status-incomplete">Complete all questions to submit</span>
                )
              )}
            </div>

            {currentDomain < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!currentDomainQuestionsAnswered()}
                className="nav-button"
              >
                Next Domain &rarr;
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !allQuestionsAnswered()}
              >
                {loading ? 'Saving...' : 'Complete Assessment \u2192'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default TicOsa
