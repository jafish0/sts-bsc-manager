import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { SELF_RATING_INFO, SELF_RATING_WELCOME, COMPETENCIES, SELF_RATING_RESOURCES } from '../config/supervisorSelfRating'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { exportSelfRatingPdf } from '../utils/exportSupervisorSelfRating'

const COMP_COLORS = ['#0E1F56', '#00A79D', '#D97706', '#059669']

export default function SupervisorSelfRating() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('welcome')
  const [loading, setLoading] = useState(true)

  // Current in-progress or selected rating
  const [currentRating, setCurrentRating] = useState(null)
  const [responses, setResponses] = useState({})
  const [completedRatings, setCompletedRatings] = useState([])
  const [selectedResultId, setSelectedResultId] = useState(null)
  const [resultResponses, setResultResponses] = useState({})

  // Accordion states
  const [expandedComp, setExpandedComp] = useState(1)
  const [expandedGuidance, setExpandedGuidance] = useState({})
  const [expandedNotes, setExpandedNotes] = useState({})

  // Save debounce
  const saveTimer = useRef(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    try {
      // Load any in-progress rating
      const { data: inProgress } = await supabase
        .from('supervisor_self_ratings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)

      // Load completed ratings
      const { data: completed } = await supabase
        .from('supervisor_self_ratings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      setCompletedRatings(completed || [])

      if (inProgress && inProgress.length > 0) {
        setCurrentRating(inProgress[0])
        await loadResponses(inProgress[0].id)
      }

      if (completed && completed.length > 0) {
        setSelectedResultId(completed[0].id)
        await loadResultResponses(completed[0].id)
      }
    } catch (err) {
      console.error('Error loading self-rating data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadResponses = async (ratingId) => {
    const { data } = await supabase
      .from('supervisor_self_rating_responses')
      .select('*')
      .eq('rating_id', ratingId)

    const map = {}
    ;(data || []).forEach(r => { map[r.item_key] = r })
    setResponses(map)
  }

  const loadResultResponses = async (ratingId) => {
    const { data } = await supabase
      .from('supervisor_self_rating_responses')
      .select('*')
      .eq('rating_id', ratingId)

    const map = {}
    ;(data || []).forEach(r => { map[r.item_key] = r })
    setResultResponses(map)
  }

  const startOrResumeRating = async () => {
    if (currentRating) {
      setTab('self-rating')
      return
    }

    const { data, error } = await supabase
      .from('supervisor_self_ratings')
      .insert({
        user_id: user.id,
        collaborative_id: profile?.collaborative_id || null,
        team_id: profile?.team_id || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating rating:', error)
      alert('Error starting assessment: ' + error.message)
      return
    }

    setCurrentRating(data)
    setResponses({})
    setTab('self-rating')
  }

  const saveResponse = useCallback((itemKey, competency, rating, notes) => {
    if (!currentRating) return

    // Optimistic update
    setResponses(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], item_key: itemKey, competency, rating, reflection_notes: notes }
    }))

    // Debounced save
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const payload = {
        rating_id: currentRating.id,
        item_key: itemKey,
        competency,
        rating: rating || null,
        reflection_notes: notes || null
      }

      const { error } = await supabase
        .from('supervisor_self_rating_responses')
        .upsert(payload, { onConflict: 'rating_id,item_key' })

      if (error) console.error('Error saving response:', error)
    }, 300)
  }, [currentRating])

  const getAllRatedItems = () => {
    return COMPETENCIES.flatMap(c => c.items.filter(i => i.type === 'rated'))
  }

  const ratedItemCount = getAllRatedItems().length
  const answeredCount = getAllRatedItems().filter(i => responses[i.key]?.rating).length
  const canComplete = answeredCount === ratedItemCount

  const handleComplete = async () => {
    if (!canComplete || !currentRating) return

    // Compute scores
    const scores = { 1: 0, 2: 0, 3: 0, 4: 0 }
    COMPETENCIES.forEach(c => {
      c.items.forEach(item => {
        if (item.type === 'rated' && responses[item.key]?.rating) {
          scores[c.number] += responses[item.key].rating
        }
      })
    })
    const total = scores[1] + scores[2] + scores[3] + scores[4]

    const { error } = await supabase
      .from('supervisor_self_ratings')
      .update({
        status: 'completed',
        competency_1_score: scores[1],
        competency_2_score: scores[2],
        competency_3_score: scores[3],
        competency_4_score: scores[4],
        total_score: total,
        completed_at: new Date().toISOString()
      })
      .eq('id', currentRating.id)

    if (error) {
      console.error('Error completing rating:', error)
      alert('Error completing: ' + error.message)
      return
    }

    const updatedRating = {
      ...currentRating,
      status: 'completed',
      competency_1_score: scores[1],
      competency_2_score: scores[2],
      competency_3_score: scores[3],
      competency_4_score: scores[4],
      total_score: total,
      completed_at: new Date().toISOString()
    }

    setCompletedRatings(prev => [updatedRating, ...prev])
    setSelectedResultId(updatedRating.id)
    setResultResponses({ ...responses })
    setCurrentRating(null)
    setResponses({})
    setTab('results')
  }

  const handleSelectResult = async (id) => {
    setSelectedResultId(id)
    await loadResultResponses(id)
  }

  const selectedResult = completedRatings.find(r => r.id === selectedResultId)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading...</div>
      </div>
    )
  }

  const tabs = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'self-rating', label: 'Self-Rating' },
    { key: 'results', label: 'My Results' },
    { key: 'resources', label: 'Resources' }
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1.5rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.5rem', padding: 0 }}
          >
            &larr; Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{SELF_RATING_INFO.title}</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>{SELF_RATING_INFO.subtitle}</p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(255,255,255,0.1)', borderRadius: '0.375rem',
            padding: '0.35rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem'
          }}>
            <span>&#128274;</span> Your results are private — only you can see them.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light, #e5e7eb)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? `3px solid ${COLORS.teal}` : '3px solid transparent',
                color: tab === t.key ? COLORS.teal : 'var(--text-muted, #6b7280)',
                fontWeight: tab === t.key ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {tab === 'welcome' && <WelcomeTab
          completedRatings={completedRatings}
          currentRating={currentRating}
          onStart={startOrResumeRating}
          onViewResults={() => setTab('results')}
        />}
        {tab === 'self-rating' && <SelfRatingTab
          currentRating={currentRating}
          responses={responses}
          saveResponse={saveResponse}
          expandedComp={expandedComp}
          setExpandedComp={setExpandedComp}
          expandedGuidance={expandedGuidance}
          setExpandedGuidance={setExpandedGuidance}
          expandedNotes={expandedNotes}
          setExpandedNotes={setExpandedNotes}
          answeredCount={answeredCount}
          ratedItemCount={ratedItemCount}
          canComplete={canComplete}
          onComplete={handleComplete}
          onStart={startOrResumeRating}
        />}
        {tab === 'results' && <ResultsTab
          completedRatings={completedRatings}
          selectedResult={selectedResult}
          selectedResultId={selectedResultId}
          onSelectResult={handleSelectResult}
          resultResponses={resultResponses}
        />}
        {tab === 'resources' && <ResourcesTab />}
      </div>
    </div>
  )
}

/* ===================== WELCOME TAB ===================== */
function WelcomeTab({ completedRatings, currentRating, onStart, onViewResults }) {
  const w = SELF_RATING_WELCOME

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
        {w.intro}
      </p>

      {/* Key Points */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ color: COLORS.navy, margin: '0 0 0.75rem', fontSize: '1.1rem' }}>What to Expect</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {w.keyPoints.map((p, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>{p}</li>
          ))}
        </ul>
      </div>

      {/* Signs of STS */}
      <div style={{
        ...cardStyle,
        borderLeft: `4px solid ${COLORS.navy}`,
        background: 'var(--bg-card)',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ color: COLORS.navy, margin: '0 0 0.5rem', fontSize: '1rem' }}>{w.signsOfSts.title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{w.signsOfSts.intro}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {w.signsOfSts.signs.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: '600', color: COLORS.navy, minWidth: '180px' }}>{s.category}:</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s.examples}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formal Supports */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ color: COLORS.navy, margin: '0 0 0.5rem', fontSize: '1rem' }}>{w.formalSupports.title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{w.formalSupports.intro}</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {w.formalSupports.supports.map((s, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{s}</li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.75rem', marginBottom: 0 }}>
          {w.formalSupports.informalNote}
        </p>
      </div>

      {/* Privacy Notice */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: '0.5rem',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '1.25rem' }}>&#128274;</span>
        <div>
          <div style={{ fontWeight: '600', color: COLORS.navy, marginBottom: '0.25rem', fontSize: '0.9rem' }}>Privacy Guarantee</div>
          <p style={{ margin: 0, color: '#1E40AF', fontSize: '0.85rem', lineHeight: '1.5' }}>
            {SELF_RATING_INFO.privacyNote}
          </p>
        </div>
      </div>

      {/* Previous completions */}
      {completedRatings.length > 0 && (
        <div style={{
          ...cardStyle,
          borderLeft: `4px solid ${COLORS.teal}`,
          marginBottom: '1.5rem'
        }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            You last completed this on{' '}
            <strong>{new Date(completedRatings[0].completed_at).toLocaleDateString()}</strong>.
            You have completed it <strong>{completedRatings.length}</strong> time{completedRatings.length !== 1 ? 's' : ''}.{' '}
            <button onClick={onViewResults} style={{ background: 'none', border: 'none', color: COLORS.teal, cursor: 'pointer', fontWeight: '600', textDecoration: 'underline', padding: 0, fontSize: '0.9rem' }}>
              View your results
            </button>
          </p>
        </div>
      )}

      {/* Begin Button */}
      <button
        onClick={onStart}
        style={{
          display: 'block',
          width: '100%',
          padding: '1rem',
          background: COLORS.teal,
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          fontSize: '1.1rem',
          fontWeight: '600',
          cursor: 'pointer',
          marginBottom: '2rem'
        }}
      >
        {currentRating ? 'Continue Self-Rating' : 'Begin Self-Rating'}
      </button>
    </div>
  )
}

/* ===================== SELF-RATING TAB ===================== */
function SelfRatingTab({
  currentRating, responses, saveResponse,
  expandedComp, setExpandedComp,
  expandedGuidance, setExpandedGuidance,
  expandedNotes, setExpandedNotes,
  answeredCount, ratedItemCount, canComplete, onComplete, onStart
}) {
  if (!currentRating) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1rem' }}>
          You haven't started a self-rating yet.
        </p>
        <button onClick={onStart} style={{ padding: '0.75rem 2rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
          Begin Self-Rating
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Overall Progress</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: COLORS.teal }}>{answeredCount} of {ratedItemCount} rated items</span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '999px',
            background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.navy})`,
            width: `${(answeredCount / ratedItemCount) * 100}%`,
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* Competency Sections */}
      {COMPETENCIES.map((comp) => {
        const isExpanded = expandedComp === comp.number
        const ratedItems = comp.items.filter(i => i.type === 'rated')
        const answeredInComp = ratedItems.filter(i => responses[i.key]?.rating).length

        return (
          <div key={comp.number} style={{ marginBottom: '1rem', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-light, #e5e7eb)' }}>
            {/* Accordion Header */}
            <button
              onClick={() => setExpandedComp(isExpanded ? null : comp.number)}
              style={{
                width: '100%', padding: '1rem 1.25rem',
                background: isExpanded ? COMP_COLORS[comp.number - 1] : 'var(--bg-card)',
                color: isExpanded ? 'white' : COLORS.navy,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                  Competency {comp.number}: {comp.shortTitle}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.15rem' }}>
                  {answeredInComp} of {ratedItems.length} rated items completed
                </div>
              </div>
              <span style={{ fontSize: '1.2rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                &#9660;
              </span>
            </button>

            {/* Accordion Body */}
            {isExpanded && (
              <div style={{ padding: '1.25rem', background: 'var(--bg-card)' }}>
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: 0, marginBottom: '1.25rem' }}>
                  {comp.description}
                </p>

                {comp.items.map(item => (
                  <RatingItem
                    key={item.key}
                    item={item}
                    response={responses[item.key]}
                    competency={comp.number}
                    saveResponse={saveResponse}
                    expandedGuidance={expandedGuidance}
                    setExpandedGuidance={setExpandedGuidance}
                    expandedNotes={expandedNotes}
                    setExpandedNotes={setExpandedNotes}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Complete Button */}
      <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
        <button
          onClick={onComplete}
          disabled={!canComplete}
          style={{
            width: '100%', padding: '1rem',
            background: canComplete ? COLORS.teal : '#d1d5db',
            color: canComplete ? 'white' : '#9ca3af',
            border: 'none', borderRadius: '0.5rem',
            fontSize: '1.1rem', fontWeight: '600',
            cursor: canComplete ? 'pointer' : 'not-allowed'
          }}
        >
          {canComplete ? 'Complete Self-Rating' : `Complete Self-Rating (${answeredCount}/${ratedItemCount} rated)`}
        </button>
      </div>
    </div>
  )
}

/* ===================== RATING ITEM COMPONENT ===================== */
function RatingItem({ item, response, competency, saveResponse, expandedGuidance, setExpandedGuidance, expandedNotes, setExpandedNotes }) {
  const isDiscussion = item.type === 'discussion'
  const isGuidanceExpanded = expandedGuidance[item.key]
  const isNotesExpanded = expandedNotes[item.key] || isDiscussion

  const handleRating = (val) => {
    saveResponse(item.key, competency, val, response?.reflection_notes || null)
  }

  const handleNotes = (text) => {
    saveResponse(item.key, competency, response?.rating || null, text)
  }

  return (
    <div style={{
      marginBottom: '1rem',
      padding: '1rem',
      borderRadius: '0.5rem',
      border: '1px solid var(--border-light, #e5e7eb)',
      background: isDiscussion ? 'var(--bg-page, #f8f9fa)' : 'var(--bg-card)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {isDiscussion && (
          <span style={{
            fontSize: '0.7rem', fontWeight: '600',
            background: '#EDE9FE', color: '#7C3AED',
            padding: '0.15rem 0.5rem', borderRadius: '0.25rem',
            alignSelf: 'flex-start', whiteSpace: 'nowrap'
          }}>
            Reflection Prompt (not scored)
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5', fontWeight: '500' }}>
        {item.text}
      </p>

      {/* Learn More / Guidance Toggle */}
      <button
        onClick={() => setExpandedGuidance(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
        style={{
          background: 'none', border: 'none', color: COLORS.teal,
          cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
          padding: '0.25rem 0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
        }}
      >
        {isDiscussion ? 'Explore this topic' : 'Learn more'}
        <span style={{ fontSize: '0.7rem', transform: isGuidanceExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>&#9660;</span>
      </button>

      {/* Expanded Guidance */}
      {isGuidanceExpanded && (
        <div style={{
          background: '#F8FAFC', borderRadius: '0.375rem',
          padding: '0.75rem 1rem', marginBottom: '0.75rem',
          borderLeft: `3px solid ${COLORS.teal}`, fontSize: '0.8rem'
        }}>
          {item.guidance.benchmark && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
              Benchmark: {item.guidance.benchmark}
            </p>
          )}
          {item.guidance.reflectionQuestions && item.guidance.reflectionQuestions.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: '600', color: COLORS.navy, marginBottom: '0.25rem' }}>Reflection Questions:</div>
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {item.guidance.reflectionQuestions.map((q, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.25rem' }}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {item.guidance.strategies && item.guidance.strategies.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: '600', color: COLORS.navy, marginBottom: '0.25rem' }}>Strategies:</div>
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {item.guidance.strategies.map((s, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {item.guidance.resources && item.guidance.resources.length > 0 && (
            <div>
              <div style={{ fontWeight: '600', color: COLORS.navy, marginBottom: '0.25rem' }}>Resources:</div>
              {item.guidance.resources.map((r, i) => (
                r.url ? (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', color: COLORS.teal, marginBottom: '0.15rem', textDecoration: 'underline' }}>
                    {r.text}
                  </a>
                ) : (
                  <span key={i} style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{r.text}</span>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rating Options (for rated items only) */}
      {!isDiscussion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
          {SELF_RATING_INFO.scale.map(opt => {
            const isSelected = response?.rating === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleRating(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: `2px solid ${isSelected ? opt.color : 'var(--border-light, #e5e7eb)'}`,
                  background: isSelected ? opt.bgColor : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  border: `2px solid ${isSelected ? opt.color : '#d1d5db'}`,
                  background: isSelected ? opt.color : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
                  )}
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '600' : '400', color: isSelected ? opt.color : 'var(--text-primary)' }}>
                    {opt.label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Notes */}
      {!isDiscussion && !isNotesExpanded && (
        <button
          onClick={() => setExpandedNotes(prev => ({ ...prev, [item.key]: true }))}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.8rem', padding: '0.25rem 0'
          }}
        >
          + Add personal notes
        </button>
      )}
      {isNotesExpanded && (
        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            {isDiscussion ? 'Your reflections (optional)' : 'Personal notes (optional)'}
          </label>
          <textarea
            value={response?.reflection_notes || ''}
            onChange={(e) => handleNotes(e.target.value)}
            placeholder={isDiscussion ? 'Write your reflections here...' : 'Add any personal notes...'}
            rows={3}
            style={{
              width: '100%', marginTop: '0.25rem',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-light, #e5e7eb)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}
    </div>
  )
}

/* ===================== RESULTS TAB ===================== */
function ResultsTab({ completedRatings, selectedResult, selectedResultId, onSelectResult, resultResponses }) {
  if (completedRatings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
          You haven't completed a self-rating yet. Complete the assessment to see your results here.
        </p>
      </div>
    )
  }

  const r = selectedResult
  if (!r) return null

  const maxScores = { 1: 15, 2: 9, 3: 21, 4: 15 }
  const radarData = COMPETENCIES.map(c => ({
    competency: c.shortTitle,
    score: Math.round(((r[`competency_${c.number}_score`] || 0) / maxScores[c.number]) * 100),
    fullMark: 100
  }))

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Selector */}
      {completedRatings.length > 1 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>View results from:</label>
          <select
            value={selectedResultId}
            onChange={(e) => onSelectResult(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem', borderRadius: '0.375rem',
              border: '1px solid var(--border-light, #e5e7eb)',
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            {completedRatings.map(cr => (
              <option key={cr.id} value={cr.id}>
                {new Date(cr.completed_at).toLocaleDateString()} — Score: {cr.total_score}/60
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary Card */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.navy, margin: '0 0 0.25rem' }}>
          Overall Score: {r.total_score} / 60 ({Math.round((r.total_score / 60) * 100)}%)
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem', fontSize: '0.85rem' }}>
          Completed: {new Date(r.completed_at).toLocaleDateString()}
        </p>

        {/* Radar Chart */}
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="competency" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar dataKey="score" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Export */}
        <button
          onClick={() => exportSelfRatingPdf(r, resultResponses)}
          style={{
            padding: '0.5rem 1.5rem', background: COLORS.navy, color: 'white',
            border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
            fontWeight: '500', fontSize: '0.85rem', marginTop: '0.5rem'
          }}
        >
          Export PDF
        </button>
      </div>

      {/* Competency Breakdown */}
      {COMPETENCIES.map((comp, idx) => {
        const score = r[`competency_${comp.number}_score`] || 0
        const max = maxScores[comp.number]
        const pct = Math.round((score / max) * 100)

        return (
          <div key={comp.number} style={{ ...cardStyle, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: COMP_COLORS[idx], fontSize: '1rem' }}>
                Competency {comp.number}: {comp.shortTitle}
              </h3>
              <span style={{ fontWeight: '600', color: COMP_COLORS[idx], fontSize: '0.9rem' }}>
                {score} / {max} ({pct}%)
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '10px', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                background: COMP_COLORS[idx],
                width: `${pct}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {comp.items.filter(i => i.type === 'rated').map(item => {
                const resp = resultResponses[item.key]
                const rating = resp?.rating
                const scaleItem = SELF_RATING_INFO.scale.find(s => s.value === rating)
                const icon = rating === 3 ? '\u2705' : rating === 2 ? '\uD83D\uDFE1' : rating === 1 ? '\uD83D\uDD34' : '\u2796'
                const label = rating === 3 ? 'Confident' : rating === 2 ? 'Needs training' : rating === 1 ? 'Growth area' : 'Not rated'

                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.35rem 0', fontSize: '0.85rem' }}>
                    <span>{icon}</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{item.text}</span>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: '600',
                      color: scaleItem?.color || '#6b7280',
                      whiteSpace: 'nowrap'
                    }}>
                      ({label})
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Growth Opportunities */}
            {comp.items.filter(i => i.type === 'rated' && resultResponses[i.key]?.rating === 1).length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FEF2F2', borderRadius: '0.375rem', borderLeft: '3px solid #DC2626' }}>
                <div style={{ fontWeight: '600', color: '#DC2626', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Growth Opportunities</div>
                {comp.items.filter(i => i.type === 'rated' && resultResponses[i.key]?.rating === 1).map(item => (
                  <div key={item.key} style={{ fontSize: '0.8rem', color: '#991B1B', marginBottom: '0.25rem' }}>
                    &bull; {item.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Growth Over Time */}
      {completedRatings.length > 1 && (
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ color: COLORS.navy, margin: '0 0 1rem', fontSize: '1.1rem' }}>Your Growth Over Time</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={completedRatings.slice().reverse().map(cr => ({
                date: new Date(cr.completed_at).toLocaleDateString(),
                'STS Knowledge': Math.round((cr.competency_1_score / 15) * 100),
                'Self-Assessment': Math.round((cr.competency_2_score / 9) * 100),
                'Emotional Safety': Math.round((cr.competency_3_score / 21) * 100),
                'Resilience': Math.round((cr.competency_4_score / 15) * 100),
                'Total': Math.round((cr.total_score / 60) * 100)
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="STS Knowledge" stroke={COMP_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Self-Assessment" stroke={COMP_COLORS[1]} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Emotional Safety" stroke={COMP_COLORS[2]} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Resilience" stroke={COMP_COLORS[3]} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Total" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Reflection Notes */}
      {Object.values(resultResponses).some(r => r.reflection_notes) && (
        <div style={{ ...cardStyle, marginBottom: '2rem' }}>
          <h3 style={{ color: COLORS.navy, margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Your Reflection Notes</h3>
          {COMPETENCIES.map(comp => {
            const notesForComp = comp.items.filter(i => resultResponses[i.key]?.reflection_notes)
            if (notesForComp.length === 0) return null
            return (
              <div key={comp.number} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: '600', color: COMP_COLORS[comp.number - 1], fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  {comp.shortTitle}
                </div>
                {notesForComp.map(item => (
                  <div key={item.key} style={{ marginLeft: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.text}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                      {resultResponses[item.key].reflection_notes}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ===================== RESOURCES TAB ===================== */
function ResourcesTab() {
  const res = SELF_RATING_RESOURCES

  const sectionStyle = { marginBottom: '1.5rem' }
  const sectionTitleStyle = { color: COLORS.navy, margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: '600' }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Companion PDFs */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Companion Documents</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {res.companionPdfs.map((pdf, i) => (
            <div key={i} style={{ ...cardStyle, display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem' }}>&#128196;</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: COLORS.navy, fontSize: '0.9rem' }}>{pdf.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{pdf.description}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.5rem' }}>
          Contact your BSC coordinator if you need access to these documents.
        </p>
      </div>

      {/* Websites */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Websites & Online Resources</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {res.websites.map((w, i) => (
            <a key={i} href={w.url} target="_blank" rel="noopener noreferrer"
              style={{ color: COLORS.teal, fontSize: '0.9rem', textDecoration: 'underline' }}>
              {w.name}
            </a>
          ))}
        </div>
      </div>

      {/* Assessments */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Assessment Tools</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {res.assessments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              style={{ color: COLORS.teal, fontSize: '0.9rem', textDecoration: 'underline' }}>
              {a.name}
            </a>
          ))}
        </div>
      </div>

      {/* Fact Sheets */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Fact Sheets</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {res.factSheets.map((f, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{f}</li>
          ))}
        </ul>
      </div>

      {/* Articles */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Articles & Publications</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {res.articles.map((a, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{a}</li>
          ))}
        </ul>
      </div>

      {/* Trainings */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Trainings</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {res.trainings.map((t, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{t}</li>
          ))}
        </ul>
      </div>

      {/* Source Citation */}
      <div style={{
        marginTop: '2rem', marginBottom: '2rem', padding: '0.75rem 1rem',
        background: '#f9fafb', borderRadius: '0.375rem',
        fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic'
      }}>
        Source: {SELF_RATING_INFO.source}. Adapted by {SELF_RATING_INFO.adaptedBy}.
      </div>
    </div>
  )
}
