import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'
import { COLORS, cardStyle, cardHeaderStyle, TIMEPOINTS } from '../utils/constants'
import { exportStsPatPdf, exportStsPatExcel } from '../utils/exportStsPat'
import { STS_PAT_INFO, STS_PAT_FAQ, STS_PAT_QUESTIONS, STS_PAT_SECTION_INTROS } from '../config/stspat'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip } from 'recharts'

const SECTIONS = [1, 2, 3, 4]

// Extracted as a proper component to avoid hooks-in-render-function violation
function QuestionCard({ q, resp, canEdit, expandedGuidance, setExpandedGuidance, saveResponse, queueAction }) {
  const [queuedSmartie, setQueuedSmartie] = useState(false)
  const [queuedPdsa, setQueuedPdsa] = useState(false)
  const isExpanded = expandedGuidance[q.number]

  return (
    <div style={{ ...cardStyle, marginBottom: '1rem', borderLeft: resp.rating ? `3px solid ${COLORS.teal}` : '3px solid var(--border-light)' }}>
      <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.5' }}>
        <span style={{ color: COLORS.teal, fontWeight: '700' }}>Q{q.number}.</span> {q.text}
      </p>

      {/* Guidance accordion */}
      <button
        onClick={() => setExpandedGuidance(prev => ({ ...prev, [q.number]: !prev[q.number] }))}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.navy, fontSize: '0.8rem', fontWeight: '500', padding: '0.25rem 0', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
      >
        <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>&#9660;</span>
        {isExpanded ? 'Hide Guidance' : 'View Guidance'}
      </button>

      {isExpanded && (
        <div style={{ background: 'var(--bg-page)', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '0.75rem', fontSize: '0.825rem', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            <strong>Suggested guidance:</strong> {q.guidance.suggested}
          </p>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            <strong>Scoring guidance:</strong> {q.guidance.scoring}
          </p>
          {q.guidance.references.length > 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <strong>References:</strong>
              {q.guidance.references.map((ref, i) => (
                <div key={i} style={{ marginLeft: '0.5rem' }}>{ref}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rating scale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '60px' }}>Not at All</span>
        {STS_PAT_INFO.scoring.scale.map(s => (
          <label key={s.value} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: canEdit ? 'pointer' : 'default' }}>
            <input
              type="radio"
              name={`q${q.number}`}
              checked={resp.rating === s.value}
              onChange={() => canEdit && saveResponse(q.number, 'rating', s.value)}
              disabled={!canEdit}
              style={{ accentColor: COLORS.teal, width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: resp.rating === s.value ? '700' : '400', color: resp.rating === s.value ? COLORS.teal : 'var(--text-primary)' }}>{s.value}</span>
          </label>
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To a Great Degree</span>
      </div>

      {/* Action item checkbox */}
      {canEdit && (
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={resp.is_action_item || false}
              onChange={e => saveResponse(q.number, 'is_action_item', e.target.checked)}
              style={{ accentColor: COLORS.amber, width: '16px', height: '16px' }}
            />
            Flag as Action Item
          </label>
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: '0.5rem' }}>
        <textarea
          value={resp.notes || ''}
          onChange={e => saveResponse(q.number, 'notes', e.target.value)}
          placeholder="Notes (optional)"
          disabled={!canEdit}
          rows={2}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.825rem', resize: 'vertical', background: 'var(--bg-card)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
        />
      </div>

      {/* Queue action buttons */}
      {canEdit && resp.is_action_item && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={async () => { await queueAction(q.number, 'smartie_goal'); setQueuedSmartie(true); setTimeout(() => setQueuedSmartie(false), 2000) }}
            disabled={queuedSmartie}
            style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1px solid ${COLORS.navy}`, color: COLORS.navy, borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {queuedSmartie ? 'SMARTIE Goal queued' : 'Create SMARTIE Goal'}
          </button>
          <button
            onClick={async () => { await queueAction(q.number, 'pdsa_cycle'); setQueuedPdsa(true); setTimeout(() => setQueuedPdsa(false), 2000) }}
            disabled={queuedPdsa}
            style={{ padding: '0.3rem 0.75rem', background: 'none', border: `1px solid ${COLORS.teal}`, color: COLORS.teal, borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {queuedPdsa ? 'PDSA Cycle queued' : 'Start PDSA Cycle'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function StsPat() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isTeamMember, isSuperAdmin } = useAuth()

  // State
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('faq') // 'faq', 'form', 'report'
  const [assessments, setAssessments] = useState([])
  const [currentAssessment, setCurrentAssessment] = useState(null)
  const [responses, setResponses] = useState({}) // { questionNumber: { rating, is_action_item, notes } }
  const [currentSection, setCurrentSection] = useState(1)
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [expandedGuidance, setExpandedGuidance] = useState({})
  const [saving, setSaving] = useState(false)
  const [queuedCounts, setQueuedCounts] = useState({ smartie_goal: 0, pdsa_cycle: 0 })
  const [viewingAssessment, setViewingAssessment] = useState(null)
  const [viewingResponses, setViewingResponses] = useState({})
  const [reportSection, setReportSection] = useState(1)
  const [orgName, setOrgName] = useState('')
  const [timepoint, setTimepoint] = useState('baseline')
  const saveTimerRef = useRef({})

  const canEdit = !isTeamMember

  // Load team and assessments
  useEffect(() => {
    loadData()
  }, [teamId])

  async function loadData() {
    setLoading(true)
    const [teamRes, assessRes] = await Promise.all([
      supabase.from('teams').select('id, name').eq('id', teamId).single(),
      supabase.from('sts_pat_assessments').select('*').eq('team_id', teamId).order('created_at', { ascending: false })
    ])
    if (teamRes.data) setTeam(teamRes.data)
    if (assessRes.data) {
      setAssessments(assessRes.data)
      const inProgress = assessRes.data.find(a => a.status === 'in_progress')
      if (inProgress) {
        setCurrentAssessment(inProgress)
        setOrgName(inProgress.organization_name || '')
        setTimepoint(inProgress.timepoint || 'baseline')
        await loadResponses(inProgress.id)
        await loadQueuedCounts(inProgress.id)
        if (canEdit) setView('form')
      }
    }
    setLoading(false)
  }

  async function loadResponses(assessmentId) {
    const { data } = await supabase
      .from('sts_pat_responses')
      .select('*')
      .eq('assessment_id', assessmentId)
    if (data) {
      const map = {}
      data.forEach(r => {
        map[r.question_number] = {
          id: r.id,
          rating: r.rating,
          is_action_item: r.is_action_item,
          notes: r.notes || ''
        }
      })
      setResponses(map)
    }
  }

  async function loadQueuedCounts(assessmentId) {
    const { data } = await supabase
      .from('sts_pat_queued_actions')
      .select('action_type')
      .eq('assessment_id', assessmentId)
      .eq('status', 'pending')
    if (data) {
      setQueuedCounts({
        smartie_goal: data.filter(d => d.action_type === 'smartie_goal').length,
        pdsa_cycle: data.filter(d => d.action_type === 'pdsa_cycle').length
      })
    }
  }

  // Begin new assessment
  async function beginAssessment() {
    const { data, error } = await supabase.from('sts_pat_assessments').insert({
      team_id: teamId,
      completed_by: user.id,
      completed_by_name: profile?.full_name || user.email,
      organization_name: orgName,
      timepoint,
      status: 'in_progress'
    }).select().single()
    if (error) { alert('Error creating assessment: ' + error.message); return }
    setCurrentAssessment(data)
    setResponses({})
    setQueuedCounts({ smartie_goal: 0, pdsa_cycle: 0 })
    setCurrentSection(1)
    setView('form')
  }

  // Auto-save response (debounced)
  const saveResponse = useCallback((questionNumber, field, value) => {
    const q = STS_PAT_QUESTIONS.find(q => q.number === questionNumber)
    setResponses(prev => {
      const existing = prev[questionNumber] || { rating: null, is_action_item: false, notes: '' }
      return { ...prev, [questionNumber]: { ...existing, [field]: value } }
    })

    // Debounce the actual save
    if (saveTimerRef.current[questionNumber]) clearTimeout(saveTimerRef.current[questionNumber])
    saveTimerRef.current[questionNumber] = setTimeout(async () => {
      if (!currentAssessment) return
      const current = { ...responses[questionNumber], [field]: value }
      const { error } = await supabase.from('sts_pat_responses').upsert({
        assessment_id: currentAssessment.id,
        question_number: questionNumber,
        section: q.section,
        rating: current.rating,
        is_action_item: current.is_action_item || false,
        notes: current.notes || ''
      }, { onConflict: 'assessment_id,question_number' })
      if (error) console.error('Save error:', error)
    }, 500)
  }, [currentAssessment, responses])

  // Queue an action
  async function queueAction(questionNumber, actionType) {
    const q = STS_PAT_QUESTIONS.find(q => q.number === questionNumber)
    const resp = responses[questionNumber] || {}
    const { error } = await supabase.from('sts_pat_queued_actions').insert({
      team_id: teamId,
      assessment_id: currentAssessment.id,
      question_number: questionNumber,
      question_text: q.text,
      rating: resp.rating,
      notes: resp.notes || '',
      action_type: actionType,
      status: 'pending'
    })
    if (error) { alert('Error queuing action: ' + error.message); return }
    setQueuedCounts(prev => ({ ...prev, [actionType]: prev[actionType] + 1 }))
  }

  // Complete assessment
  async function completeAssessment() {
    // Compute scores
    const scores = { 1: 0, 2: 0, 3: 0, 4: 0 }
    STS_PAT_QUESTIONS.forEach(q => {
      const r = responses[q.number]
      if (r?.rating) scores[q.section] += r.rating
    })
    const total = scores[1] + scores[2] + scores[3] + scores[4]

    const { error } = await supabase.from('sts_pat_assessments').update({
      status: 'completed',
      part1_score: scores[1],
      part2_score: scores[2],
      part3_score: scores[3],
      part4_score: scores[4],
      total_score: total,
      organization_name: orgName,
      timepoint,
      completed_at: new Date().toISOString()
    }).eq('id', currentAssessment.id)

    if (error) { alert('Error completing: ' + error.message); return }
    setCurrentAssessment(prev => ({ ...prev, status: 'completed', part1_score: scores[1], part2_score: scores[2], part3_score: scores[3], part4_score: scores[4], total_score: total, completed_at: new Date().toISOString() }))
    setViewingAssessment({ ...currentAssessment, status: 'completed', part1_score: scores[1], part2_score: scores[2], part3_score: scores[3], part4_score: scores[4], total_score: total })
    setViewingResponses(responses)
    setView('report')
    loadData()
  }

  // View a past assessment report
  async function viewReport(assessment) {
    setViewingAssessment(assessment)
    const { data } = await supabase.from('sts_pat_responses').select('*').eq('assessment_id', assessment.id)
    if (data) {
      const map = {}
      data.forEach(r => { map[r.question_number] = { id: r.id, rating: r.rating, is_action_item: r.is_action_item, notes: r.notes || '' } })
      setViewingResponses(map)
    }
    setReportSection(1)
    setView('report')
  }

  // Count answered questions
  const answeredCount = Object.values(responses).filter(r => r.rating).length
  const sectionQuestions = STS_PAT_QUESTIONS.filter(q => q.section === currentSection)
  const sectionAnswered = sectionQuestions.filter(q => responses[q.number]?.rating).length

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Loading...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1.5rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>STS Policy Analysis Tool</h1>
            <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>
              {team?.name}
            </p>
          </div>
          <button onClick={() => navigate('/admin')} style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {view === 'faq' && renderFaqView()}
        {view === 'form' && renderFormView()}
        {view === 'report' && renderReportView()}
      </div>
    </div>
  )

  // ===== FAQ VIEW =====
  function renderFaqView() {
    const inProgress = assessments.find(a => a.status === 'in_progress')
    const completed = assessments.filter(a => a.status === 'completed')

    return (
      <>
        {/* FAQ Header */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '0.5rem' }}>{STS_PAT_FAQ.title}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {STS_PAT_INFO.description}
          </p>

          {/* FAQ Accordions */}
          {STS_PAT_FAQ.items.map((item, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border-light)', marginBottom: '0.5rem' }}>
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                style={{ width: '100%', textAlign: 'left', padding: '0.75rem 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '500' }}
              >
                {item.question}
                <span style={{ transform: expandedFaq === i ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>&#9660;</span>
              </button>
              {expandedFaq === i && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '0 0 0.75rem 0', margin: 0, lineHeight: '1.6' }}>
                  {item.answer}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Beginner's Mindset callout */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.teal}`, background: 'var(--bg-card)' }}>
          <p style={{ color: 'var(--text-primary)', fontStyle: 'italic', margin: 0, lineHeight: '1.6', fontSize: '0.9rem' }}>
            {STS_PAT_FAQ.beginnerMindset}
          </p>
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem' }}>Start an Assessment</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Your organization name"
                  style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem', width: '250px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Timepoint</label>
                <select
                  value={timepoint}
                  onChange={e => setTimepoint(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  {TIMEPOINTS.map(tp => (
                    <option key={tp.value} value={tp.value}>{tp.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {inProgress ? (
              <button onClick={() => { setCurrentAssessment(inProgress); setView('form') }} style={{ padding: '0.75rem 1.5rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}>
                Resume Assessment
              </button>
            ) : (
              <button onClick={beginAssessment} style={{ padding: '0.75rem 1.5rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}>
                Begin New Assessment
              </button>
            )}
          </div>
        )}

        {/* Past assessments */}
        {completed.length > 0 && (
          <div style={cardStyle}>
            <h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}>Completed Assessments</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Organization</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Timepoint</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)' }}>Score</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>{new Date(a.completed_at).toLocaleDateString()}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>{a.organization_name || '—'}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>{TIMEPOINTS.find(t => t.value === a.timepoint)?.label || a.timepoint || '—'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>{a.total_score} / 150</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button onClick={() => viewReport(a)} style={{ padding: '0.25rem 0.75rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Citation */}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2rem', fontStyle: 'italic' }}>
          {STS_PAT_INFO.citation}
        </p>
      </>
    )
  }

  // ===== FORM VIEW =====
  function renderFormView() {
    return (
      <>
        {/* Sticky progress bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', padding: '0.75rem 1rem', marginBottom: '1.5rem', borderRadius: '0.5rem', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: '600' }}>{answeredCount} of 30 items completed</span>
              {(queuedCounts.smartie_goal > 0 || queuedCounts.pdsa_cycle > 0) && (
                <span style={{ color: COLORS.amber }}>
                  {queuedCounts.smartie_goal > 0 && `${queuedCounts.smartie_goal} SMARTIE Goal${queuedCounts.smartie_goal > 1 ? 's' : ''} queued`}
                  {queuedCounts.smartie_goal > 0 && queuedCounts.pdsa_cycle > 0 && ' · '}
                  {queuedCounts.pdsa_cycle > 0 && `${queuedCounts.pdsa_cycle} PDSA Cycle${queuedCounts.pdsa_cycle > 1 ? 's' : ''} queued`}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setView('faq'); setCurrentAssessment(null) }} style={{ padding: '0.3rem 0.75rem', background: 'none', border: '1px solid var(--border-light)', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Save & Exit
              </button>
            </div>
          </div>
          {/* Section stepper */}
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.75rem' }}>
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setCurrentSection(s)}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: currentSection === s ? '700' : '400',
                  background: currentSection === s ? COLORS.teal : 'var(--bg-page)',
                  color: currentSection === s ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Part {s} ({STS_PAT_INFO.scoring.sections[s].itemCount})
              </button>
            ))}
          </div>
        </div>

        {/* Organization name + timepoint for in-progress */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Organization Name</label>
            <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem', width: '250px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Timepoint</label>
            <select value={timepoint} onChange={e => setTimepoint(e.target.value)} style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              {TIMEPOINTS.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
            </select>
          </div>
        </div>

        {/* Section intro */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.navy}` }}>
          <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>{STS_PAT_SECTION_INTROS[currentSection].title}</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{STS_PAT_SECTION_INTROS[currentSection].description}</p>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {sectionAnswered} of {sectionQuestions.length} items answered in this section
          </p>
        </div>

        {/* Questions */}
        {sectionQuestions.map(q => (
          <QuestionCard
            key={q.number}
            q={q}
            resp={responses[q.number] || { rating: null, is_action_item: false, notes: '' }}
            canEdit={canEdit}
            expandedGuidance={expandedGuidance}
            setExpandedGuidance={setExpandedGuidance}
            saveResponse={saveResponse}
            queueAction={queueAction}
          />
        ))}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '1rem' }}>
          {currentSection > 1 ? (
            <button onClick={() => { setCurrentSection(currentSection - 1); window.scrollTo(0, 0) }} style={{ padding: '0.75rem 1.5rem', background: 'none', border: `2px solid ${COLORS.navy}`, color: COLORS.navy, borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
              Previous Section
            </button>
          ) : <div />}
          {currentSection < 4 ? (
            <button onClick={() => { setCurrentSection(currentSection + 1); window.scrollTo(0, 0) }} style={{ padding: '0.75rem 1.5rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
              Next Section
            </button>
          ) : (
            <button
              onClick={completeAssessment}
              disabled={answeredCount < 30}
              style={{
                padding: '0.75rem 1.5rem',
                background: answeredCount >= 30 ? COLORS.green : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: answeredCount >= 30 ? 'pointer' : 'not-allowed',
                fontWeight: '600'
              }}
            >
              Complete Assessment ({answeredCount}/30)
            </button>
          )}
        </div>
      </>
    )
  }

  // ===== REPORT VIEW =====
  function renderReportView() {
    const a = viewingAssessment
    if (!a) return null

    const sectionScores = [
      { section: 1, score: a.part1_score, max: 65 },
      { section: 2, score: a.part2_score, max: 20 },
      { section: 3, score: a.part3_score, max: 25 },
      { section: 4, score: a.part4_score, max: 40 }
    ]

    const radarData = sectionScores.map(s => ({
      section: `Part ${s.section}`,
      score: Math.round((s.score / s.max) * 100),
      fullMark: 100
    }))

    // Check for previous assessments for comparison
    const completedAssessments = assessments.filter(x => x.status === 'completed' && x.id !== a.id)

    const scoreColor = pct => pct >= 70 ? COLORS.green : pct >= 40 ? COLORS.amber : COLORS.red

    return (
      <>
        <button onClick={() => { setView('faq'); setViewingAssessment(null) }} style={{ padding: '0.4rem 0.75rem', background: 'none', border: `1px solid ${COLORS.navy}`, color: COLORS.navy, borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Back to STS-PAT
        </button>

        {/* Score summary */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            {a.total_score} / 150
            <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              ({Math.round((a.total_score / 150) * 100)}%)
            </span>
          </h2>
          <div style={{ width: '100%', background: 'var(--bg-page)', borderRadius: '999px', height: '12px', marginBottom: '0.75rem' }}>
            <div style={{ width: `${(a.total_score / 150) * 100}%`, background: scoreColor((a.total_score / 150) * 100), height: '100%', borderRadius: '999px', transition: 'width 0.5s' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            {a.organization_name && `${a.organization_name} · `}
            {TIMEPOINTS.find(t => t.value === a.timepoint)?.label || a.timepoint}
            {a.completed_at && ` · ${new Date(a.completed_at).toLocaleDateString()}`}
          </p>
          {completedAssessments.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', margin: '0.75rem 0 0 0' }}>
              If this is your first time using the tool, remember that this is your beginning score.
            </p>
          )}
        </div>

        {/* Section score cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {sectionScores.map(s => {
            const pct = Math.round((s.score / s.max) * 100)
            return (
              <div key={s.section} style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  {STS_PAT_INFO.scoring.sections[s.section].name}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: scoreColor(pct) }}>
                  {s.score} / {s.max}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{pct}%</div>
                <div style={{ width: '100%', background: 'var(--bg-page)', borderRadius: '999px', height: '6px' }}>
                  <div style={{ width: `${pct}%`, background: scoreColor(pct), height: '100%', borderRadius: '999px' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Radar chart */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', textAlign: 'center' }}>Section Score Profile</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="section" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Score %" dataKey="score" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.3} />
              <Tooltip formatter={v => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed results by section */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Detailed Results</h3>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setReportSection(s)}
                style={{ flex: 1, padding: '0.4rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: reportSection === s ? '700' : '400', background: reportSection === s ? COLORS.navy : 'var(--bg-page)', color: reportSection === s ? 'white' : 'var(--text-muted)' }}
              >
                Part {s}
              </button>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)', width: '40px' }}>Q#</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Question</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)', width: '60px' }}>Rating</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)', width: '60px' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)', width: '150px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {STS_PAT_QUESTIONS.filter(q => q.section === reportSection).map(q => {
                  const r = viewingResponses[q.number] || {}
                  const ratingColor = r.rating >= 4 ? COLORS.green : r.rating >= 3 ? COLORS.amber : r.rating ? COLORS.red : 'var(--text-muted)'
                  return (
                    <tr key={q.number} style={{ borderBottom: '1px solid var(--border-light)', background: r.is_action_item ? 'rgba(245, 158, 11, 0.08)' : 'transparent' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-primary)', fontWeight: '600' }}>{q.number}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>{q.text}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '700', color: ratingColor }}>{r.rating || '—'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{r.is_action_item ? '!' : '—'}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.notes || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action items summary */}
        {renderActionItemsSummary()}

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => exportStsPatPdf(viewingAssessment, viewingResponses, team?.name)}
            style={{ padding: '0.5rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}
          >
            Download PDF Report
          </button>
          <button
            onClick={() => exportStsPatExcel(viewingAssessment, viewingResponses, team?.name)}
            style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}
          >
            Download Excel Report
          </button>
        </div>

        {/* Citation */}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2rem', fontStyle: 'italic' }}>
          {STS_PAT_INFO.citation}
        </p>
      </>
    )
  }

  function renderActionItemsSummary() {
    const actionItems = STS_PAT_QUESTIONS.filter(q => viewingResponses[q.number]?.is_action_item)
    if (actionItems.length === 0) return null

    return (
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Action Items Summary</h3>
        {actionItems.map(q => {
          const r = viewingResponses[q.number] || {}
          return (
            <div key={q.number} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '500' }}>
                  Q{q.number}: {q.text}
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Rating: {r.rating}/5 {r.notes && `· ${r.notes}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}
