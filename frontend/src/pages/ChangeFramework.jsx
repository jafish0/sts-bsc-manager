import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, DOMAIN_OPTIONS } from '../utils/constants'
import ctacLogo from '../assets/CTAC_white.png'

const DOMAIN_LABELS = {
  resilience: 'Promotion of Resilience Building Activities',
  safety: 'Sense of Safety',
  policies: 'Organizational Policies',
  leadership: 'Practices of Leaders',
  routine: 'Routine Organizational Practices',
  evaluation: 'Evaluation and Monitoring'
}

export default function ChangeFramework() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDomain, setActiveDomain] = useState('resilience')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText] = useState('')

  useEffect(() => { fetchDrivers() }, [])

  const fetchDrivers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('change_framework_drivers')
      .select('*')
      .order('sort_order')
    if (error) console.error('Error fetching drivers:', error)
    setDrivers(data || [])
    setLoading(false)
  }

  const filteredDrivers = drivers.filter(d => d.framework_domain === activeDomain)

  const domainCounts = {}
  DOMAIN_OPTIONS.forEach(d => {
    domainCounts[d.value] = drivers.filter(dr => dr.framework_domain === d.value).length
  })

  const handleSaveEdit = async (id) => {
    if (!editText.trim()) return
    const { error } = await supabase
      .from('change_framework_drivers')
      .update({ driver_text: editText.trim() })
      .eq('id', id)
    if (error) { alert('Error saving: ' + error.message); return }
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, driver_text: editText.trim() } : d))
    setEditingId(null)
    setEditText('')
  }

  const handleAddDriver = async () => {
    if (!newText.trim()) return
    const maxSort = filteredDrivers.reduce((max, d) => Math.max(max, d.sort_order || 0), 0)
    const { data, error } = await supabase
      .from('change_framework_drivers')
      .insert({ framework_domain: activeDomain, driver_text: newText.trim(), sort_order: maxSort + 1 })
      .select()
      .single()
    if (error) { alert('Error adding: ' + error.message); return }
    setDrivers(prev => [...prev, data])
    setNewText('')
    setAddingNew(false)
  }

  const handleDeleteDriver = async (id) => {
    if (!window.confirm('Delete this secondary driver?')) return
    const { error } = await supabase
      .from('change_framework_drivers')
      .delete()
      .eq('id', id)
    if (error) { alert('Error deleting: ' + error.message); return }
    setDrivers(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`,
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
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700', color: 'white' }}>Collaborative Change Framework</h1>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85, color: 'white' }}>
                Primary and secondary drivers by STSI-OA domain
              </p>
            </div>
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
          {DOMAIN_OPTIONS.map(d => (
            <button
              key={d.value}
              onClick={() => { setActiveDomain(d.value); setEditingId(null); setAddingNew(false) }}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: activeDomain === d.value ? `2px solid ${COLORS.teal}` : '2px solid #e5e7eb',
                background: activeDomain === d.value ? `${COLORS.teal}15` : 'white',
                color: activeDomain === d.value ? COLORS.teal : '#6b7280',
                fontWeight: activeDomain === d.value ? '700' : '500',
                cursor: 'pointer',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {d.label}
              <span style={{
                marginLeft: '0.4rem',
                fontSize: '0.7rem',
                background: activeDomain === d.value ? COLORS.teal : '#e5e7eb',
                color: activeDomain === d.value ? 'white' : '#6b7280',
                padding: '0.1rem 0.4rem',
                borderRadius: '10px'
              }}>{domainCounts[d.value] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading framework...</div>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* Domain Header */}
            <div style={{ marginBottom: '1.25rem', borderBottom: `3px solid ${COLORS.teal}`, paddingBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: '600' }}>
                Primary Driver
              </div>
              <h2 style={{ margin: '0.25rem 0 0', color: COLORS.navy, fontSize: '1.25rem' }}>
                {DOMAIN_LABELS[activeDomain]}
              </h2>
            </div>

            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.75rem' }}>
              Secondary Drivers
            </div>

            {/* Driver List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredDrivers.map((driver, idx) => (
                <div key={driver.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: idx % 2 === 0 ? '#f9fafb' : 'white',
                  borderRadius: '0.5rem',
                  border: '1px solid #f3f4f6'
                }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: `${COLORS.teal}15`, color: COLORS.teal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: '700', flexShrink: 0
                  }}>
                    {idx + 1}
                  </div>
                  {editingId === driver.id ? (
                    <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{
                          flex: 1, padding: '0.4rem 0.6rem', border: `2px solid ${COLORS.teal}`,
                          borderRadius: '4px', fontSize: '0.9rem'
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(driver.id); if (e.key === 'Escape') setEditingId(null) }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(driver.id)} style={{
                        background: COLORS.teal, color: 'white', border: 'none',
                        borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                      }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{
                        background: '#e5e7eb', color: 'var(--text-secondary)', border: 'none',
                        borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem'
                      }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                        {driver.driver_text}
                      </span>
                      {isSuperAdmin && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => { setEditingId(driver.id); setEditText(driver.driver_text) }} style={{
                            background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem'
                          }}>Edit</button>
                          <button onClick={() => handleDeleteDriver(driver.id)} style={{
                            background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem'
                          }}>Delete</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {filteredDrivers.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-faint)' }}>
                  No secondary drivers for this domain yet.
                </div>
              )}
            </div>

            {/* Add New Driver (Super Admin) */}
            {isSuperAdmin && (
              <div style={{ marginTop: '1rem' }}>
                {addingNew ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="New secondary driver text..."
                      style={{
                        flex: 1, padding: '0.5rem 0.75rem', border: `2px solid ${COLORS.teal}`,
                        borderRadius: '6px', fontSize: '0.9rem'
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddDriver(); if (e.key === 'Escape') { setAddingNew(false); setNewText('') } }}
                      autoFocus
                    />
                    <button onClick={handleAddDriver} style={{
                      background: COLORS.teal, color: 'white', border: 'none',
                      borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                    }}>Add</button>
                    <button onClick={() => { setAddingNew(false); setNewText('') }} style={{
                      background: '#e5e7eb', color: 'var(--text-secondary)', border: 'none',
                      borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem'
                    }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingNew(true)} style={{
                    background: 'none', border: `1px dashed ${COLORS.teal}`, color: COLORS.teal,
                    borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem',
                    fontWeight: '600', width: '100%'
                  }}>+ Add Secondary Driver</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
