import { useState } from 'react'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { STSIOA_DOMAINS } from '../config/stsioa'
import officeFrameImg from '../assets/office-frame.jpg'

// Score → color thresholds (matches the CTAC PowerPoint color coding)
export const SCORE_COLORS = [
  { min: 4.0, max: 5.0, bg: '#00B050', text: '#000', label: 'Tested — Ready for Spread' },
  { min: 3.0, max: 3.99, bg: '#FFC000', text: '#000', label: 'Being Tested' },
  { min: 2.0, max: 2.99, bg: '#F59E0B', text: '#000', label: 'In Planning Stage' },
  { min: 1.0, max: 1.99, bg: '#EF4444', text: '#fff', label: 'Needs Attention' }
]
export const NO_DATA_COLOR = { bg: '#E5E7EB', text: '#6b7280', label: 'No Data' }

export function getScoreColor(mean) {
  if (mean === null) return NO_DATA_COLOR
  for (const c of SCORE_COLORS) {
    if (mean >= c.min && mean <= c.max) return c
  }
  return NO_DATA_COLOR
}

// Short labels matching the PowerPoint style
const SHORT_LABELS = {
  '1a': 'Basic knowledge about STS',
  '1b': 'Monitoring STS impact on professional well-being',
  '1c': 'Maintaining positive focus on org.\'s core mission',
  '1d': 'Instill Hope',
  '1e': 'Specific skills that enhance professional competency',
  '1f': 'Strong peer support among all staff',
  '1g': 'Healthy coping strategies',
  '2a': 'Strategies or techniques to reduce risk',
  '2b': 'Not sharing graphic details of trauma stories unnecessarily',
  '2c': 'Safety survey assessing psychological safety perceptions',
  '2d': 'Safety survey assessing physical safety perceptions',
  '2e': 'Manage risk & protect workers from dangerous situations',
  '2f': 'Training on managing potentially dangerous situations',
  '2g': 'Defined protocol for responding to critical incidents',
  '3a': 'Defined practices addressing psychological safety',
  '3b': 'Defined practices addressing physical safety',
  '3c': 'Defined procedures to promote resilience building',
  '3d': 'Strategic plan addresses staff resiliency',
  '3e': 'Strategic plan addresses staff safety',
  '3f': 'Risk management policy for high STS levels',
  '4a': 'Leadership actively encourages self-care',
  '4b': 'Leadership models good self-care',
  '4c': 'Staff input to leaders on STS policy improvement',
  '4d': 'Supervisors promote safety & resilience to STS',
  '4e': 'Supervisors refer those w/ high disturbance',
  '4f': 'Consistent supervision discussing effect of work',
  '4g': 'Additional supervision during high-risk times',
  '4h': 'Intentionally manage caseloads w/ trauma dose in mind',
  '4i': 'Leadership responds to STS as occupational hazard',
  '5a': 'Formal trainings on enhancing psychological safety',
  '5b': 'Formal trainings on enhancing physical safety',
  '5c': 'Formal trainings on enhancing resilience to STS',
  '5d': 'Activities (besides trainings) promoting resilience',
  '5e': 'Discuss STS during new employee orientation',
  '5f': 'Regular team & peer support opportunities',
  '5g': 'Release time for resilience/STS trainings',
  '6a': 'Assess STS level in the workplace',
  '6b': 'Monitor workforce trends signifying lack of safety',
  '6c': 'Respond to evaluation/feedback to build safety & resilience',
  '6d': 'Seek staff feedback on psychosocial trends'
}

export function computeItemMeans(responses) {
  const items = {}
  STSIOA_DOMAINS.forEach(domain => {
    domain.questions.forEach(q => {
      const key = `item_${q.id}`
      const values = responses.map(r => r[key]).filter(v => v != null && v > 0)
      items[q.id] = values.length > 0
        ? { mean: values.reduce((a, b) => a + b, 0) / values.length, count: values.length }
        : { mean: null, count: 0 }
    })
  })
  return items
}

const TIMEPOINT_DISPLAY = {
  baseline: 'Baseline',
  endline: 'Endline',
  followup_6mo: '6-Month Follow-up',
  followup_12mo: '12-Month Follow-up'
}

// Room regions: percentage-based bounding boxes for each domain overlay
// Mapped to office-frame.jpg (864x498) cropped building frame
// Left column rooms are between the left brick pillar and center wall
// Center column rooms are between the center wall and right brick pillar
// Right wing is the shelving area beyond the right brick pillar
const ROOM_REGIONS = {
  // Left column: 3 rooms stacked (D1 top, D2 middle, D3 bottom)
  domain1: { left: 7.29, top: 9.83, width: 36.11, height: 18.69 },
  domain2: { left: 7.29, top: 34.53, width: 36.11, height: 33.55 },
  domain3: { left: 7.29, top: 73.88, width: 36.11, height: 22.10 },
  // Center column: 2 rooms stacked (D5 top, D4 bottom)
  domain5: { left: 44.21, top: 9.83, width: 34.38, height: 34.15 },
  domain4: { left: 44.21, top: 49.59, width: 34.38, height: 46.40 },
  // Right wing shelves (D6)
  domain6: { left: 85.53, top: 9.83, width: 10.53, height: 86.16 },
}

export default function STSIOAOfficeVisual({ responses, teamName, timepoint, compact = false }) {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const itemMeans = computeItemMeans(responses)

  const handleMouseEnter = (e, itemId) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverPos({ x: rect.right + 8, y: rect.top })
    setHoveredItem(itemId)
  }

  // Render a single item as a colored cell block (sized by grid)
  const renderCell = (q, style = {}) => {
    const data = itemMeans[q.id]
    const color = getScoreColor(data.mean)
    const label = SHORT_LABELS[q.id] || q.text
    return (
      <div
        key={q.id}
        style={{
          background: color.bg,
          color: color.text,
          padding: '2px 3px',
          fontSize: 'clamp(0.4rem, 0.55vw, 0.6rem)',
          lineHeight: '1.2',
          border: '1px solid rgba(0,0,0,0.2)',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
          transition: 'background 600ms ease, color 600ms ease',
          ...style
        }}
        onMouseEnter={(e) => handleMouseEnter(e, q.id)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label} ({q.id.toUpperCase()})
        </span>
      </div>
    )
  }

  // Get questions by domain ID
  const getQ = (domainId) => {
    const domain = STSIOA_DOMAINS.find(d => d.id === domainId)
    return domain ? domain.questions : []
  }

  // Domain header bar — blends with the black bars in the building frame
  const domainHeader = (num, title) => (
    <div style={{
      background: 'rgba(0,0,0,0.85)', color: '#fff',
      padding: '1px 4px', fontSize: 'clamp(0.45rem, 0.6vw, 0.65rem)', fontWeight: '700',
      textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
      textOverflow: 'ellipsis', flexShrink: 0
    }}>
      {num}. {title}
    </div>
  )

  // Render a domain room as an absolute-positioned overlay
  const renderDomainRoom = (domainId, title, questions, region, cellLayout) => (
    <div style={{
      position: 'absolute',
      left: `${region.left}%`,
      top: `${region.top}%`,
      width: `${region.width}%`,
      height: `${region.height}%`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {domainHeader(domainId, title)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {cellLayout}
      </div>
    </div>
  )

  // Helper: a row of cells in a grid
  const cellRow = (questions, cols, style = {}) => (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, minHeight: 0, ...style }}>
      {questions.map(q => renderCell(q))}
    </div>
  )

  // Find hovered item info for tooltip
  const hoveredData = hoveredItem ? itemMeans[hoveredItem] : null
  const hoveredQ = hoveredItem ? STSIOA_DOMAINS.flatMap(d => d.questions).find(q => q.id === hoveredItem) : null
  const hoveredColor = hoveredData ? getScoreColor(hoveredData.mean) : null

  const d1 = getQ(1)
  const d2 = getQ(2)
  const d3 = getQ(3)
  const d4 = getQ(4)
  const d5 = getQ(5)
  const d6 = getQ(6)

  const buildingRooms = (
    <>
      {/* Domain 1: Resilience Building Activities — top-left room */}
      {renderDomainRoom(1, 'Resilience Building Activities', d1, ROOM_REGIONS.domain1, <>
        {cellRow(d1.slice(0, 4), 4)}
        {cellRow(d1.slice(4), 3)}
      </>)}

      {/* Domain 2: Staff Safety — middle-left room */}
      {renderDomainRoom(2, 'Staff Safety', d2, ROOM_REGIONS.domain2, <>
        {cellRow(d2.slice(0, 3), 3)}
        {cellRow([d2[4]], 1)}
        {cellRow([d2[3], d2[5], d2[6]], 3)}
      </>)}

      {/* Domain 3: STS-Informed Policies — bottom-left room */}
      {renderDomainRoom(3, 'STS-Informed Policies', d3, ROOM_REGIONS.domain3, <>
        {cellRow(d3.slice(0, 4), 4)}
        {cellRow(d3.slice(4), 2)}
      </>)}

      {/* Domain 5: Routine Practices — top-center room */}
      {renderDomainRoom(5, 'Routine Practices', d5, ROOM_REGIONS.domain5, <>
        {cellRow(d5.slice(0, 3), 3)}
        {cellRow(d5.slice(3, 6), 3)}
        {cellRow(d5.slice(6), 1)}
      </>)}

      {/* Domain 4: Leader Practices — bottom-center room */}
      {renderDomainRoom(4, 'Leader Practices', d4, ROOM_REGIONS.domain4, <>
        {cellRow(d4.slice(0, 2), 2)}
        {cellRow(d4.slice(2, 6), 4)}
        {cellRow(d4.slice(6, 9), 3)}
      </>)}

      {/* Domain 6: Monitoring & Outcome Evaluation — right wing shelves */}
      {renderDomainRoom(6, 'Monitoring & Outcome Evaluation', d6, ROOM_REGIONS.domain6,
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {d6.map(q => renderCell(q, { flex: 1 }))}
        </div>
      )}
    </>
  )

  // Compact mode: just the building, no card chrome, no minWidth.
  // Caller is responsible for sizing the parent (e.g. via aspectRatio + max-height).
  if (compact) {
    return (
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundImage: `url(${officeFrameImg})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#e8e8e8',
      }}>
        {buildingRooms}
      </div>
    )
  }

  return (
    <div style={{ ...cardStyle, marginBottom: '1rem', position: 'relative' }}>
      <div style={cardHeaderStyle}>STSI-OA Organizational Assessment — Office Visual</div>

      {/* Header info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>{teamName}</strong> — {TIMEPOINT_DISPLAY[timepoint] || timepoint}
          <span style={{ color: 'var(--text-faint)', marginLeft: '0.75rem', fontSize: '0.75rem' }}>
            n = {responses.length} respondent{responses.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
          © Sprang, G., & Ross, L. Contact sprang@uky.edu for permission
        </div>
      </div>

      {/* Color Legend */}
      <div style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem',
        padding: '0.5rem 0.75rem', background: 'var(--bg-card-alt)', borderRadius: '6px',
        border: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>KEY:</span>
        {SCORE_COLORS.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 14, height: 14, background: c.bg, borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{c.label} ({c.min}–{c.max})</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 14, height: 14, background: NO_DATA_COLOR.bg, borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>No Data</span>
        </div>
      </div>

      {/* Building with image background and overlaid cells */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{
          position: 'relative',
          aspectRatio: '864 / 498',
          backgroundImage: `url(${officeFrameImg})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#e8e8e8',
          minWidth: '860px',
        }}>
          {buildingRooms}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredItem && hoveredData && hoveredQ && (
        <div style={{
          position: 'fixed',
          left: Math.min(hoverPos.x, window.innerWidth - 320),
          top: hoverPos.y,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          padding: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxWidth: '300px',
          fontSize: '0.8rem',
          pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: '700', color: COLORS.navy, marginBottom: '0.3rem' }}>
            Item {hoveredItem.toUpperCase()}
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '0.5rem' }}>
            {hoveredQ.text}
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: '600' }}>M = </span>
              {hoveredData.mean !== null ? hoveredData.mean.toFixed(2) : 'N/A'}
            </div>
            <div>
              <span style={{ fontWeight: '600' }}>n = </span>
              {hoveredData.count}
            </div>
          </div>
          {hoveredColor && (
            <div style={{
              marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
            }}>
              <div style={{ width: 10, height: 10, background: hoveredColor.bg, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hoveredColor.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
