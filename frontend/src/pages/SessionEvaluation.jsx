import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { SESSION_EVALUATION_CONFIG } from '../config/evaluationQuestions'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function SessionEvaluation() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [eventInfo, setEventInfo] = useState(null)
  const [error, setError] = useState(null)

  // Form state
  const [ratings, setRatings] = useState({})
  const [openText, setOpenText] = useState({})
  const [npsScore, setNpsScore] = useState(null)

  useEffect(() => {
    validate()
  }, [token])

  const validate = async () => {
    const { data: link } = await supabase
      .from('session_links')
      .select('*, bsc_events(id, title, event_date, collaborative_id)')
      .eq('token', token)
      .single()

    if (!link || !link.bsc_events) {
      setError('This evaluation link is invalid or the session no longer exists.')
      setLoading(false)
      return
    }

    setEventInfo(link.bsc_events)
    setLoading(false)
  }

  const config = SESSION_EVALUATION_CONFIG

  const allRatingsComplete = config.ratingItems.every(item => ratings[item.key])
  const requiredTextComplete = config.openTextQuestions
    .filter(q => q.required)
    .every(q => openText[q.key]?.trim())
  const canSubmit = allRatingsComplete && requiredTextComplete

  const handleSubmit = async () => {
    if (!canSubmit || !eventInfo) return
    setSubmitting(true)

    try {
      const payload = {
        bsc_event_id: eventInfo.id,
        collaborative_id: eventInfo.collaborative_id,
        recommend_score: npsScore
      }

      // Add ratings
      config.ratingItems.forEach(item => {
        payload[item.key] = ratings[item.key]
      })

      // Add open text
      config.openTextQuestions.forEach(q => {
        payload[q.key] = openText[q.key]?.trim() || null
      })

      const { error: insertErr } = await supabase
        .from('session_evaluations')
        .insert(payload)

      if (insertErr) throw insertErr

      // Sign out if attendance was recorded in this browser
      const attendanceId = sessionStorage.getItem(`attendance_${token}`)
      if (attendanceId) {
        await supabase
          .from('session_attendance')
          .update({
            signed_out_at: new Date().toISOString(),
            sign_out_method: 'evaluation'
          })
          .eq('id', attendanceId)
        sessionStorage.removeItem(`attendance_${token}`)
      }

      navigate(`/session/${token}/signout`)
    } catch (err) {
      console.error('Evaluation submit error:', err)
      alert('Error submitting evaluation: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ color: NAVY, fontSize: '1.1rem' }}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2.5rem', maxWidth: '500px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: NAVY }}>Evaluation Unavailable</h2>
          <p style={{ color: '#6b7280' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: NAVY, color: 'white', padding: '1.25rem', borderRadius: '0.5rem 0.5rem 0 0', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Session Evaluation</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>{eventInfo?.title}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '0 0 0.5rem 0.5rem', padding: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {/* Intro */}
          <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: '1.6', marginTop: 0 }}>
            {config.introText}
          </p>

          {/* Anonymity Notice */}
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '0.5rem',
            padding: '0.75rem 1rem', marginBottom: '1.5rem',
            display: 'flex', gap: '0.5rem', alignItems: 'center'
          }}>
            <span style={{ fontSize: '1.1rem' }}>&#128274;</span>
            <span style={{ color: '#1E40AF', fontSize: '0.85rem', fontWeight: '500' }}>{config.anonymityNotice}</span>
          </div>

          {/* Likert Ratings */}
          <h3 style={{ color: NAVY, fontSize: '1rem', marginBottom: '1rem' }}>Please rate each statement:</h3>

          {config.ratingItems.map(item => (
            <div key={item.key} style={{ marginBottom: '1.25rem' }}>
              <p style={{ color: '#374151', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                {item.text} <span style={{ color: '#DC2626' }}>*</span>
              </p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {config.likertScale.map(opt => {
                  const isSelected = ratings[item.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setRatings(prev => ({ ...prev, [item.key]: opt.value }))}
                      style={{
                        flex: '1 1 0',
                        minWidth: '80px',
                        padding: '0.5rem 0.25rem',
                        border: `2px solid ${isSelected ? TEAL : '#e5e7eb'}`,
                        borderRadius: '0.375rem',
                        background: isSelected ? `${TEAL}15` : 'white',
                        color: isSelected ? TEAL : '#6b7280',
                        fontWeight: isSelected ? '600' : '400',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontSize: '1rem', marginBottom: '0.15rem' }}>{opt.value}</div>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

          {/* Open Text Questions */}
          {config.openTextQuestions.map(q => (
            <div key={q.key} style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                {q.text} {q.required && <span style={{ color: '#DC2626' }}>*</span>}
              </label>
              <textarea
                value={openText[q.key] || ''}
                onChange={(e) => setOpenText(prev => ({ ...prev, [q.key]: e.target.value }))}
                rows={3}
                placeholder={q.required ? 'Required' : 'Optional'}
                style={{
                  width: '100%', padding: '0.65rem',
                  border: '1px solid #d1d5db', borderRadius: '0.375rem',
                  fontSize: '0.9rem', resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          ))}

          {/* NPS */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              {config.nps.text}
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setNpsScore(i)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0',
                    border: `2px solid ${npsScore === i ? NAVY : '#e5e7eb'}`,
                    borderRadius: '0.375rem',
                    background: npsScore === i ? NAVY : 'white',
                    color: npsScore === i ? 'white' : '#6b7280',
                    fontWeight: npsScore === i ? '700' : '400',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{config.nps.minLabel}</span>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{config.nps.maxLabel}</span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{
              width: '100%', padding: '0.85rem',
              background: canSubmit && !submitting ? TEAL : '#d1d5db',
              color: canSubmit && !submitting ? 'white' : '#9ca3af',
              border: 'none', borderRadius: '0.5rem',
              fontSize: '1rem', fontWeight: '600',
              cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed'
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Evaluation & Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
