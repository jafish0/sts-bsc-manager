import { useNavigate } from 'react-router-dom'
import { COLORS } from '../utils/constants'
import { getProgramBranding } from '../config/programConfig'

/**
 * "Needs development" placeholder for sections that currently render
 * STS-BSC-specific content (Change Framework, Strategy Ideas, data-driven
 * Recommendations) when opened in a tic_lc / tipe_lc context. The entry
 * points (dashboard cards/tiles) stay visible; this replaces the page body
 * so testers see a clean, intentional state instead of STS carryover.
 *
 * STS-BSC (and FourC) never render this — callers gate on program_type.
 */
export default function ProgramPlaceholder({ programType, title, backTo = '/admin' }) {
  const navigate = useNavigate()
  const label = getProgramBranding(programType)?.name || 'this program'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`,
        color: 'white', padding: '1.5rem 2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700, color: 'white' }}>{title}</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.85, color: 'white' }}>{label}</p>
        </div>
      </div>

      <div style={{ maxWidth: '760px', margin: '2.5rem auto', padding: '0 1.5rem' }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: '0.75rem', padding: '2.5rem',
          textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px dashed var(--border)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚧</div>
          <h2 style={{ color: COLORS.navy, margin: '0 0 0.75rem', fontSize: '1.25rem' }}>
            This section is being developed for {label}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 auto', maxWidth: '560px' }}>
            The guidance shown in STS-BSC collaboratives is specific to secondary traumatic stress.
            Program-appropriate content for {label} will replace this.
          </p>
          <button
            onClick={() => navigate(backTo)}
            style={{
              marginTop: '1.5rem', background: COLORS.teal, color: 'white', border: 'none',
              padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
            }}
          >← Back</button>
        </div>
      </div>
    </div>
  )
}
