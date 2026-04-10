import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { SESSION_EVALUATION_CONFIG } from '../config/evaluationQuestions'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function EvaluationReport({ eventId, eventTitle, onClose }) {
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvaluations()
  }, [eventId])

  const loadEvaluations = async () => {
    const { data } = await supabase
      .from('session_evaluations')
      .select('*')
      .eq('bsc_event_id', eventId)
    setEvaluations(data || [])
    setLoading(false)
  }

  const config = SESSION_EVALUATION_CONFIG
  const n = evaluations.length

  const calcMean = (key) => {
    const vals = evaluations.map(e => e[key]).filter(v => v != null)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—'
  }

  const calcSD = (key) => {
    const vals = evaluations.map(e => e[key]).filter(v => v != null)
    if (vals.length < 2) return '—'
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (vals.length - 1)
    return Math.sqrt(variance).toFixed(2)
  }

  const getDistribution = (key) => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    evaluations.forEach(e => { if (e[key]) counts[e[key]]++ })
    return config.likertScale.map(s => ({ label: s.label, value: s.value, count: counts[s.value] }))
  }

  // NPS calculation
  const npsScores = evaluations.map(e => e.recommend_score).filter(v => v != null)
  const promoters = npsScores.filter(s => s >= 9).length
  const detractors = npsScores.filter(s => s <= 6).length
  const npsTotal = npsScores.length
  const npsScore = npsTotal > 0 ? Math.round(((promoters - detractors) / npsTotal) * 100) : null

  // Overall mean across all rating items
  const overallMean = (() => {
    const allVals = config.ratingItems.flatMap(item =>
      evaluations.map(e => e[item.key]).filter(v => v != null)
    )
    return allVals.length ? (allVals.reduce((a, b) => a + b, 0) / allVals.length).toFixed(2) : '—'
  })()

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading evaluations...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: NAVY, fontSize: '1.1rem' }}>
          Evaluation Report: {eventTitle}
        </h3>
        {onClose && <button onClick={onClose} style={{ padding: '0.35rem 0.75rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#EFF6FF', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
          <strong style={{ color: '#1E40AF' }}>{n}</strong> <span style={{ color: '#6b7280' }}>responses</span>
        </div>
        <div style={{ background: '#F0FDF4', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
          Overall Mean: <strong style={{ color: '#166534' }}>{overallMean}</strong> / 5
        </div>
        {npsScore !== null && (
          <div style={{
            background: npsScore >= 50 ? '#F0FDF4' : npsScore >= 0 ? '#FEF3C7' : '#FEF2F2',
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem'
          }}>
            NPS: <strong style={{ color: npsScore >= 50 ? '#166534' : npsScore >= 0 ? '#92400E' : '#991B1B' }}>{npsScore}</strong>
          </div>
        )}
      </div>

      {n === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No evaluations submitted yet.</p>
      ) : (
        <>
          {/* Likert Ratings */}
          {config.ratingItems.map(item => {
            const dist = getDistribution(item.key)
            return (
              <div key={item.key} style={{ marginBottom: '1.5rem', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600', color: NAVY, fontSize: '0.85rem', flex: 1 }}>{item.text}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    Mean: <strong>{calcMean(item.key)}</strong> | SD: {calcSD(item.key)}
                  </span>
                </div>
                <div style={{ width: '100%', height: 80 }}>
                  <ResponsiveContainer>
                    <BarChart data={dist} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="value" tick={{ fontSize: 10 }} width={20} />
                      <Tooltip formatter={(v) => [`${v} responses`, 'Count']} />
                      <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}

          {/* NPS Distribution */}
          {npsScores.length > 0 && (
            <div style={{ marginBottom: '1.5rem', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', color: NAVY, fontSize: '0.9rem' }}>Net Promoter Score Distribution</h4>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {Array.from({ length: 11 }, (_, i) => {
                  const count = npsScores.filter(s => s === i).length
                  const bg = i <= 6 ? '#FEE2E2' : i <= 8 ? '#FEF3C7' : '#D1FAE5'
                  const color = i <= 6 ? '#991B1B' : i <= 8 ? '#92400E' : '#166534'
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ background: bg, color, padding: '0.25rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '600' }}>
                        {count}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>{i}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#6b7280' }}>
                <span>Detractors (0-6): {detractors}</span>
                <span>Passives (7-8): {npsTotal - promoters - detractors}</span>
                <span>Promoters (9-10): {promoters}</span>
              </div>
            </div>
          )}

          {/* Open Text Responses */}
          {config.openTextQuestions.map(q => {
            const responses = evaluations.map(e => e[q.key]).filter(Boolean)
            if (responses.length === 0) return null
            return (
              <div key={q.key} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: NAVY, fontSize: '0.9rem', margin: '0 0 0.5rem' }}>{q.text}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {responses.map((r, i) => (
                    <div key={i} style={{
                      background: '#f9fafb', padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem', borderLeft: `3px solid ${TEAL}`,
                      fontSize: '0.85rem', color: '#374151'
                    }}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
