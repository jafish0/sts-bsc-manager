import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle, DOMAIN_OPTIONS } from '../utils/constants'

const DOMAIN_TABS = [
  { value: 'resilience', label: 'Resilience Building' },
  { value: 'safety', label: 'Sense of Safety' },
  { value: 'policies', label: 'Organizational Policies' },
  { value: 'leadership', label: 'Practices of Leaders' },
  { value: 'routine', label: 'Routine Practices' },
  { value: 'evaluation', label: 'Evaluation & Monitoring' }
]

export default function Strategies() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDomain, setActiveDomain] = useState('resilience')
  const [userProfile, setUserProfile] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newStrategy, setNewStrategy] = useState('')
  const [newSource, setNewSource] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadStrategies()
    if (user) {
      supabase.from('user_profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setUserProfile(data))
    }
  }, [user])

  const loadStrategies = async () => {
    const { data, error } = await supabase
      .from('pdsa_strategies')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) console.error('Error loading strategies:', error)
    setStrategies(data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!newStrategy.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('pdsa_strategies')
      .insert({
        stsioa_domain: activeDomain,
        strategy_text: newStrategy.trim(),
        source: newSource.trim() || null
      })
    if (!error) {
      await loadStrategies()
      setNewStrategy('')
      setNewSource('')
      setShowAdd(false)
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this strategy?')) return
    const { error } = await supabase.from('pdsa_strategies').delete().eq('id', id)
    if (!error) await loadStrategies()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isSuperAdmin = userProfile?.role === 'super_admin'
  const filtered = strategies.filter(s => s.stsioa_domain === activeDomain)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading strategies...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Strategy Ideas</h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                Improvement strategies from previous collaboratives
              </p>
            </div>
          </div>
          <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Intro */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.teal}` }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            These strategies have been used by previous BSC teams. Browse by domain for inspiration when planning your PDSA cycles.
          </p>
        </div>

        {/* Domain tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {DOMAIN_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setActiveDomain(tab.value); setShowAdd(false) }}
              style={{
                padding: '0.5rem 1rem',
                background: activeDomain === tab.value ? COLORS.navy : 'var(--bg-card)',
                color: activeDomain === tab.value ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${activeDomain === tab.value ? COLORS.navy : 'var(--border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
              <span style={{
                marginLeft: '0.4rem',
                fontSize: '0.7rem',
                opacity: 0.7
              }}>
                ({strategies.filter(s => s.stsioa_domain === tab.value).length})
              </span>
            </button>
          ))}
        </div>

        {/* Strategies list */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1.1rem' }}>
              {DOMAIN_TABS.find(d => d.value === activeDomain)?.label}
            </h3>
            {isSuperAdmin && (
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: COLORS.teal,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                + Add Strategy
              </button>
            )}
          </div>

          {/* Add form */}
          {showAdd && isSuperAdmin && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'var(--bg-card-alt)',
              borderRadius: '8px',
              border: `1px solid ${COLORS.teal}40`
            }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: COLORS.navy, marginBottom: '0.25rem' }}>Strategy *</label>
                <textarea
                  value={newStrategy}
                  onChange={(e) => setNewStrategy(e.target.value)}
                  placeholder="Describe the strategy..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    minHeight: '60px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: COLORS.navy, marginBottom: '0.25rem' }}>Source</label>
                <input
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="e.g., Previous BSC collaboratives"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  style={{ padding: '0.4rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                >
                  {saving ? 'Saving...' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setNewStrategy(''); setNewSource('') }}
                  style={{ padding: '0.4rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
              No strategies yet for this domain.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filtered.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '0.75rem',
                    background: 'var(--bg-card-alt)',
                    borderRadius: '6px',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                      {s.strategy_text}
                    </p>
                    {s.source && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                        Source: {s.source}
                      </span>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-faint)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        padding: '0.2rem 0.4rem'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
