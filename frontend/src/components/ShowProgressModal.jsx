import { useState, useEffect, useRef, useMemo } from 'react'
import STSIOAOfficeVisual, { computeItemMeans } from './STSIOAOfficeVisual'
import { TIMEPOINT_ORDER, K_ANONYMITY_THRESHOLD } from '../utils/constants'

const TIMEPOINT_TITLE = {
  baseline: 'Baseline',
  endline: 'Endline',
  followup_6mo: '6-Month Follow-up',
  followup_12mo: '12-Month Follow-up',
}

const TIMEPOINT_SHORT = {
  baseline: 'Baseline',
  endline: 'Endline',
  followup_6mo: '6-Month',
  followup_12mo: '12-Month',
}

// Match the STSIOAOfficeVisual color thresholds: 4-5 green, 3-4 yellow, 2-3 orange, 1-2 red, null/0 gray
const BAND_RANK = { gray: 0, red: 1, orange: 2, yellow: 3, green: 4 }
function bandFor(mean) {
  if (mean === null || mean === undefined) return 'gray'
  if (mean >= 4) return 'green'
  if (mean >= 3) return 'yellow'
  if (mean >= 2) return 'orange'
  if (mean >= 1) return 'red'
  return 'gray'
}

function computeBands(responses) {
  const means = computeItemMeans(responses || [])
  const bands = {}
  for (const id in means) bands[id] = bandFor(means[id].mean)
  return bands
}

// Compare two band maps. Improvements / declines counted only when both sides have real data
// (not gray). Null→non-null transitions are ignored as data-quality artifacts.
function compareDelta(prevBands, currBands) {
  let improved = 0
  let declined = 0
  for (const id in currBands) {
    const c = currBands[id]
    const p = prevBands[id]
    if (!p || p === 'gray' || c === 'gray') continue
    if (BAND_RANK[c] > BAND_RANK[p]) improved++
    else if (BAND_RANK[c] < BAND_RANK[p]) declined++
  }
  return { improved, declined }
}

const AUTO_ADVANCE_MS = 3000

/**
 * Slideshow modal that animates the STSI-OA Office Visual across timepoints.
 *
 * Props:
 *   open              — whether the modal is mounted/visible
 *   onClose           — callback when user closes
 *   dataByTimepoint   — { baseline: [rows], endline: [rows], ... } — raw stsioa_responses arrays
 *   teamName          — string for header display inside the office visual
 *
 * A timepoint is "showable" when it has at least K_ANONYMITY_THRESHOLD responses.
 * Non-showable timepoints are skipped entirely.
 */
export default function ShowProgressModal({ open, onClose, dataByTimepoint, teamName }) {
  const showable = useMemo(
    () => TIMEPOINT_ORDER.filter(tp => (dataByTimepoint?.[tp]?.length || 0) >= K_ANONYMITY_THRESHOLD),
    [dataByTimepoint]
  )

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const intervalRef = useRef(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setIndex(0)
      setPlaying(true)
    }
  }, [open])

  // Auto-advance
  useEffect(() => {
    if (!open || !playing || showable.length < 2) return
    intervalRef.current = setInterval(() => {
      setIndex(i => (i + 1) % showable.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(intervalRef.current)
  }, [open, playing, showable.length])

  // Pre-compute deltas for each transition (current vs previous showable timepoint)
  const deltas = useMemo(() => {
    const out = {}
    for (let i = 1; i < showable.length; i++) {
      const prev = computeBands(dataByTimepoint[showable[i - 1]])
      const curr = computeBands(dataByTimepoint[showable[i]])
      out[showable[i]] = compareDelta(prev, curr)
    }
    return out
  }, [showable, dataByTimepoint])

  const goNext = () => { setPlaying(false); setIndex(i => (i + 1) % showable.length) }
  const goPrev = () => { setPlaying(false); setIndex(i => (i - 1 + showable.length) % showable.length) }
  const togglePlay = () => setPlaying(p => !p)

  // Keyboard handlers
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowRight') {
        goNext()
      } else if (e.key === 'ArrowLeft') {
        goPrev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, showable.length, onClose])

  if (!open) return null
  if (showable.length < 2) return null

  const currentTp = showable[index]
  const responses = dataByTimepoint[currentTp] || []
  const delta = deltas[currentTp] // undefined for first showable timepoint

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        padding: '0.5rem 1rem 0.5rem',
        overflow: 'hidden',
      }}
    >
      {/* Close X */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '1rem',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff',
          fontSize: '1.4rem',
          width: '2.25rem',
          height: '2.25rem',
          borderRadius: '50%',
          cursor: 'pointer',
          lineHeight: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        ×
      </button>

      {/* Top: title + n */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0, textAlign: 'center', color: '#fff', padding: '0.25rem 0' }}
      >
        <div style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)', fontWeight: '700', lineHeight: 1.1 }}>
          {TIMEPOINT_TITLE[currentTp]}
        </div>
        <div style={{ fontSize: '0.95rem', opacity: 0.85, marginTop: '0.15rem' }}>
          n = {responses.length} respondents
        </div>
      </div>

      {/* Middle: building scales to fit */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          margin: '0.5rem 0',
        }}
      >
        <div style={{
          width: 'min(92vw, calc((100vh - 240px) * 864 / 498))',
          aspectRatio: '864 / 498',
          maxHeight: 'calc(100vh - 240px)',
        }}>
          <STSIOAOfficeVisual
            responses={responses}
            teamName={teamName}
            timepoint={currentTp}
            compact
          />
        </div>
      </div>

      {/* Bottom: caption + controls + dots + hint */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {delta && (
          <div style={{ color: '#fff', fontSize: '0.95rem', textAlign: 'center' }}>
            <span style={{ color: '#86efac', fontWeight: 600 }}>
              {delta.improved} room{delta.improved === 1 ? '' : 's'} improved
            </span>
            <span style={{ opacity: 0.6, margin: '0 0.5rem' }}>·</span>
            <span style={{ color: '#fca5a5', fontWeight: 600 }}>
              {delta.declined} room{delta.declined === 1 ? '' : 's'} declined
            </span>
            <span style={{ opacity: 0.7 }}> this period</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={goPrev} style={controlBtn} aria-label="Previous timepoint">‹ Prev</button>
          <button onClick={togglePlay} style={controlBtn} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={goNext} style={controlBtn} aria-label="Next timepoint">Next ›</button>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {showable.map((tp, i) => (
            <button
              key={tp}
              onClick={() => { setPlaying(false); setIndex(i) }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: i === index ? '#fff' : 'rgba(255,255,255,0.25)',
                  border: '2px solid rgba(255,255,255,0.7)',
                  transition: 'all 250ms',
                }}
              />
              {TIMEPOINT_SHORT[tp]}
            </button>
          ))}
        </div>

        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
          Space = play/pause · ← → = prev/next · Esc = close
        </div>
      </div>
    </div>
  )
}

const controlBtn = {
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: '6px',
  padding: '0.55rem 1.1rem',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: '500',
}
