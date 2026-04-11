import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import ctacLogo from '../assets/CTAC_white.png'

const NAVY = COLORS.navy
const TEAL = COLORS.teal

// The 5 TIC OSA domains for the Resource Mapping Tool
const TIC_DOMAINS = [
  { key: 'staff_development', label: 'Supporting Staff Development', description: 'Training, supervision, support and self-care' },
  { key: 'safe_environment', label: 'Creating a Safe & Supportive Environment', description: 'Physical safety, supportive environment, cultural competence, privacy' },
  { key: 'assessing_planning', label: 'Assessing and Planning Services', description: 'Intake assessments, goal development, trauma-specific interventions' },
  { key: 'involving_consumers', label: 'Involving Consumers', description: 'Current and former consumer participation and feedback' },
  { key: 'adapting_policies', label: 'Adapting Policies', description: 'Written policies and regular policy review' },
]

export default function ResourceMapping() {
  const navigate = useNavigate()
  const { user, profile, isSuperAdmin } = useAuth()
  const [team, setTeam] = useState(null)
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)

  useEffect(() => {
    loadData()
  }, [profile])

  const loadData = async () => {
    if (!profile?.team_id) return

    try {
      // Fetch team info
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, team_name, agency_name, collaborative_id, collaboratives (name, program_type)')
        .eq('id', profile.team_id)
        .single()

      setTeam(teamData)

      // Fetch existing mappings
      const { data: mappingData } = await supabase
        .from('resource_mappings')
        .select('*')
        .eq('team_id', profile.team_id)

      // Build mappings lookup by domain_key
      const map = {}
      TIC_DOMAINS.forEach(d => {
        const existing = (mappingData || []).find(m => m.domain_key === d.key)
        map[d.key] = {
          id: existing?.id || null,
          resources_in_place: existing?.resources_in_place || '',
          resources_needed: existing?.resources_needed || '',
        }
      })
      setMappings(map)
    } catch (err) {
      console.error('Error loading resource mappings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (domainKey) => {
    if (!profile?.team_id) return
    setSaving(domainKey)

    try {
      const domain = TIC_DOMAINS.find(d => d.key === domainKey)
      const current = mappings[domainKey]

      if (current.id) {
        // Update existing
        const { error } = await supabase
          .from('resource_mappings')
          .update({
            resources_in_place: current.resources_in_place,
            resources_needed: current.resources_needed,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', current.id)

        if (error) throw error
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('resource_mappings')
          .insert({
            team_id: profile.team_id,
            domain_key: domainKey,
            domain_label: domain.label,
            resources_in_place: current.resources_in_place,
            resources_needed: current.resources_needed,
            updated_by: user.id,
          })
          .select()
          .single()

        if (error) throw error

        setMappings(prev => ({
          ...prev,
          [domainKey]: { ...prev[domainKey], id: data.id }
        }))
      }

      setLastSaved(domainKey)
      setTimeout(() => setLastSaved(null), 2000)
    } catch (err) {
      console.error('Error saving resource mapping:', err)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const handleFieldChange = (domainKey, field, value) => {
    setMappings(prev => ({
      ...prev,
      [domainKey]: { ...prev[domainKey], [field]: value }
    }))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isReadOnly = profile?.role === 'team_member'

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>&#x23F3;</div>
          <div>Loading resource mapping...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, ${TEAL} 100%)`,
        color: 'white', padding: '1.5rem 2rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer' }}
            onClick={() => navigate('/admin')}>
            <img src={ctacLogo} alt="CTAC" style={{ height: '45px' }} />
            <div>
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700', color: 'white' }}>Resource Mapping Tool</h1>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85, color: 'white' }}>
                {team?.team_name} — Map resources across TIC OSA domains
              </p>
            </div>
          </div>
          <button onClick={handleSignOut} style={{
            background: 'rgba(255,255,255,0.15)', color: 'white',
            padding: '0.5rem 1rem', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500'
          }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        <button onClick={() => navigate('/admin')} style={{
          background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '0.5rem 1rem',
          borderRadius: '8px', border: '1px solid var(--border)', fontWeight: '600',
          cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem'
        }}>&larr; Back to Dashboard</button>

        <div style={{ background: '#e0f7f5', border: `1px solid ${TEAL}`, borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, color: NAVY, fontSize: '0.9rem' }}>
            <strong>Instructions:</strong> For each TIC OSA domain, document the resources your organization currently has in place and the resources you still need.
            This mapping helps identify gaps and plan next steps for strengthening trauma-informed care.
          </p>
        </div>

        {TIC_DOMAINS.map((domain, index) => (
          <div key={domain.key} style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <div style={{
              ...cardHeaderStyle,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>Domain {index + 1}: {domain.label}</span>
              {lastSaved === domain.key && (
                <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: '500' }}>
                  &#x2713; Saved
                </span>
              )}
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 0, marginBottom: '1rem' }}>
                {domain.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#16a34a', marginBottom: '0.35rem' }}>
                    Resources In Place
                  </label>
                  <textarea
                    value={mappings[domain.key]?.resources_in_place || ''}
                    onChange={(e) => handleFieldChange(domain.key, 'resources_in_place', e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="List resources, programs, policies, or practices currently in place..."
                    style={{
                      width: '100%', minHeight: '120px', padding: '0.75rem',
                      border: '2px solid #e5e7eb', borderRadius: '8px',
                      fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical',
                      boxSizing: 'border-box', background: isReadOnly ? '#f9fafb' : 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#dc2626', marginBottom: '0.35rem' }}>
                    Resources Needed
                  </label>
                  <textarea
                    value={mappings[domain.key]?.resources_needed || ''}
                    onChange={(e) => handleFieldChange(domain.key, 'resources_needed', e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="Identify gaps — what resources, training, or support is needed..."
                    style={{
                      width: '100%', minHeight: '120px', padding: '0.75rem',
                      border: '2px solid #e5e7eb', borderRadius: '8px',
                      fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical',
                      boxSizing: 'border-box', background: isReadOnly ? '#f9fafb' : 'white'
                    }}
                  />
                </div>
              </div>

              {!isReadOnly && (
                <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleSave(domain.key)}
                    disabled={saving === domain.key}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: saving === domain.key ? '#9ca3af' : TEAL,
                      color: 'white', border: 'none', borderRadius: '6px',
                      cursor: saving === domain.key ? 'not-allowed' : 'pointer',
                      fontWeight: '600', fontSize: '0.85rem'
                    }}
                  >
                    {saving === domain.key ? 'Saving...' : 'Save Domain'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
