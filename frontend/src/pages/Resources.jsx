import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProgramDomains } from '../hooks/useProgramDomains'
import AddResourceModal from '../components/AddResourceModal'
import ctacLogo from '../assets/CTAC_white.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function getTypeBadge(type) {
  const badges = {
    pdf: { bg: '#fee2e2', color: '#991b1b', label: 'PDF' },
    docx: { bg: '#dbeafe', color: '#1e40af', label: 'Word' },
    doc: { bg: '#dbeafe', color: '#1e40af', label: 'Word' },
    pptx: { bg: '#fef3c7', color: '#92400e', label: 'PPT' },
    youtube: { bg: '#fee2e2', color: '#991b1b', label: 'Video' },
    link: { bg: '#e0f2fe', color: '#0369a1', label: 'Link' }
  }
  const b = badges[type] || { bg: '#f3f4f6', color: 'var(--text-muted)', label: type }
  return (
    <span style={{
      background: b.bg, color: b.color, padding: '0.15rem 0.5rem',
      borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: '0.05em'
    }}>{b.label}</span>
  )
}

export default function Resources() {
  const navigate = useNavigate()
  const { isSuperAdmin, profile } = useAuth()
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDomain, setActiveDomain] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [programType, setProgramType] = useState('sts_bsc')
  const { domains } = useProgramDomains(programType)

  // Set initial active domain once domains are loaded
  useEffect(() => {
    if (domains.length > 0 && !activeDomain) {
      setActiveDomain(domains[0].value)
    }
  }, [domains, activeDomain])

  // Fetch user's program type from their team
  useEffect(() => {
    if (profile?.team_id && !isSuperAdmin) {
      supabase.from('teams').select('collaborative_id, collaboratives (program_type)')
        .eq('id', profile.team_id).single()
        .then(({ data }) => {
          if (data?.collaboratives?.program_type) setProgramType(data.collaboratives.program_type)
        })
    }
  }, [profile, isSuperAdmin])

  useEffect(() => { fetchResources() }, [])

  const fetchResources = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching resources:', error)
    setResources(data || [])
    setLoading(false)
  }

  const filteredResources = resources.filter(r => r.domains?.includes(activeDomain))

  const domainCounts = {}
  domains.forEach(d => {
    domainCounts[d.value] = resources.filter(r => r.domains?.includes(d.value)).length
  })

  const handleDownload = async (resource) => {
    if (!resource.file_path) return
    const { data, error } = await supabase.storage
      .from('resources')
      .createSignedUrl(resource.file_path, 3600)
    if (error) { alert('Error generating download link'); return }
    window.open(data.signedUrl, '_blank')
  }

  const handleDelete = async (resource) => {
    if (!window.confirm(`Delete "${resource.title}"? This cannot be undone.`)) return
    if (resource.file_path) {
      await supabase.storage.from('resources').remove([resource.file_path])
    }
    const { error } = await supabase.from('resources').delete().eq('id', resource.id)
    if (error) { alert('Error deleting resource'); return }
    setResources(prev => prev.filter(r => r.id !== resource.id))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
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
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700', color: 'white' }}>Resource Library</h1>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85, color: 'white' }}>
                Guides, tools, and videos organized by domain
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isSuperAdmin && (
              <button onClick={() => setShowAddModal(true)} style={{
                background: 'var(--bg-card)', color: NAVY, padding: '0.6rem 1.25rem',
                borderRadius: '8px', border: 'none', fontWeight: '600',
                cursor: 'pointer', fontSize: '0.9rem'
              }}>+ Add Resource</button>
            )}
            <button onClick={handleSignOut} style={{
              background: 'rgba(255,255,255,0.15)', color: 'white',
              padding: '0.5rem 1rem', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500'
            }}>Sign Out</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        {/* Back button */}
        <button onClick={() => navigate('/admin')} style={{
          background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '0.5rem 1rem',
          borderRadius: '8px', border: '1px solid var(--border)', fontWeight: '600',
          cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem'
        }}>← Back to Dashboard</button>

        {/* Domain Tabs */}
        <div style={{
          display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
          overflowX: 'auto', paddingBottom: '0.25rem', flexWrap: 'wrap'
        }}>
          {domains.map(d => (
            <button
              key={d.value}
              onClick={() => setActiveDomain(d.value)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: activeDomain === d.value ? `2px solid ${TEAL}` : '2px solid #e5e7eb',
                background: activeDomain === d.value ? '#e0f7f5' : 'white',
                color: activeDomain === d.value ? TEAL : '#374151',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {d.label}
              <span style={{
                marginLeft: '0.4rem', background: activeDomain === d.value ? TEAL : '#e5e7eb',
                color: activeDomain === d.value ? 'white' : '#6b7280',
                padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.75rem'
              }}>{domainCounts[d.value]}</span>
            </button>
          ))}
        </div>

        {/* Domain Title */}
        <h2 style={{ color: NAVY, fontSize: '1.25rem', margin: '0 0 1rem' }}>
          {domains.find(d => d.value === activeDomain)?.label}
        </h2>

        {/* Resources */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading resources...</div>
        ) : filteredResources.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem', color: 'var(--text-muted)',
            background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.3 }}>&#128218;</div>
            <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>No resources in this domain yet</p>
            {isSuperAdmin && <p style={{ fontSize: '0.9rem' }}>Click "Add Resource" to get started.</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredResources.map(resource => (
              <div key={resource.id} style={{
                background: 'var(--bg-card)', borderRadius: '12px', padding: '1.25rem',
                border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                {/* YouTube Embed */}
                {resource.resource_type === 'youtube' && getYoutubeId(resource.youtube_url) && (
                  <div style={{
                    marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden',
                    maxWidth: '320px', aspectRatio: '16/9'
                  }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${getYoutubeId(resource.youtube_url)}`}
                      style={{
                        width: '100%', height: '100%', border: 'none'
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={resource.title}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      {getTypeBadge(resource.resource_type)}
                      <h3 style={{ color: NAVY, fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>
                        {resource.title}
                      </h3>
                    </div>
                    {resource.description && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.35rem 0 0', lineHeight: '1.5' }}>
                        {resource.description}
                      </p>
                    )}
                    {resource.domains?.length > 1 && (
                      <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {resource.domains.map(d => {
                          const opt = domains.find(o => o.value === d)
                          return opt ? (
                            <span key={d} style={{
                              background: 'var(--bg-page)', color: 'var(--text-muted)', padding: '0.1rem 0.4rem',
                              borderRadius: '4px', fontSize: '0.7rem'
                            }}>{opt.label.replace(/Domain \d — /, '')}</span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    {/* Download / Open button */}
                    {['pdf', 'docx', 'doc', 'pptx'].includes(resource.resource_type) && resource.file_path && (
                      <button onClick={() => handleDownload(resource)} style={{
                        background: TEAL, color: 'white', border: 'none',
                        padding: '0.45rem 0.9rem', borderRadius: '6px',
                        cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem'
                      }}>Download</button>
                    )}
                    {resource.resource_type === 'link' && resource.link_url && (
                      <button onClick={() => window.open(resource.link_url, '_blank')} style={{
                        background: TEAL, color: 'white', border: 'none',
                        padding: '0.45rem 0.9rem', borderRadius: '6px',
                        cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem'
                      }}>Open Link</button>
                    )}
                    {resource.resource_type === 'youtube' && resource.youtube_url && (
                      <button onClick={() => window.open(resource.youtube_url, '_blank')} style={{
                        background: '#6b7280', color: 'white', border: 'none',
                        padding: '0.45rem 0.9rem', borderRadius: '6px',
                        cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem'
                      }}>Open in YouTube</button>
                    )}

                    {/* Delete button (super admin only) */}
                    {isSuperAdmin && (
                      <button onClick={() => handleDelete(resource)} style={{
                        background: '#fee2e2', color: '#991b1b', border: 'none',
                        padding: '0.45rem 0.7rem', borderRadius: '6px',
                        cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem'
                      }}>&#10005;</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Resource Modal */}
      {showAddModal && (
        <AddResourceModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => fetchResources()}
          domains={domains}
        />
      )}
    </div>
  )
}
