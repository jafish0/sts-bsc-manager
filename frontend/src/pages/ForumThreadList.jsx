import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, timeAgo } from '../utils/constants'
import ctacLogo from '../assets/CTAC_white.png'

const PAGE_SIZE = 20

function InitialsAvatar({ name, size = 32 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: COLORS.teal, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: '700', flexShrink: 0
    }}>{initials}</div>
  )
}

export default function ForumThreadList() {
  const navigate = useNavigate()
  const { user, profile, isSuperAdmin } = useAuth()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewThread, setShowNewThread] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  // Collaborative state
  const [collaborativeId, setCollaborativeId] = useState(null)
  const [collaborativeName, setCollaborativeName] = useState('')
  const [collaboratives, setCollaboratives] = useState([])

  useEffect(() => {
    if (!profile) return
    if (isSuperAdmin) {
      loadCollaboratives()
    } else if (profile.team_id) {
      resolveCollaborative()
    } else {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    if (collaborativeId) fetchThreads()
  }, [collaborativeId, search])

  const loadCollaboratives = async () => {
    const { data } = await supabase
      .from('collaboratives')
      .select('id, name')
      .order('name')
    setCollaboratives(data || [])
    if (data?.length > 0) {
      setCollaborativeId(data[0].id)
      setCollaborativeName(data[0].name)
    }
    setLoading(false)
  }

  const resolveCollaborative = async () => {
    const { data: team } = await supabase
      .from('teams')
      .select('collaborative_id, collaboratives(name)')
      .eq('id', profile.team_id)
      .single()
    if (team) {
      setCollaborativeId(team.collaborative_id)
      setCollaborativeName(team.collaboratives?.name || '')
    }
    setLoading(false)
  }

  const fetchThreads = async (loadMore = false) => {
    if (!collaborativeId) return
    const from = loadMore ? threads.length : 0
    let query = supabase
      .from('forum_threads')
      .select(`
        id, title, body, created_by, created_at, last_reply_at,
        reply_count, is_pinned,
        author:user_profiles!created_by(full_name, team_id),
        author_team:user_profiles!created_by(teams(agency_name))
      `)
      .eq('collaborative_id', collaborativeId)
      .order('is_pinned', { ascending: false })
      .order('last_reply_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      console.error('Error fetching threads:', fetchError)
      return
    }
    if (loadMore) {
      setThreads(prev => [...prev, ...(data || [])])
    } else {
      setThreads(data || [])
    }
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
  }

  const handleNewThread = async (e) => {
    e.preventDefault()
    setError('')
    if (!newTitle.trim() || newTitle.trim().length < 3) {
      setError('Title must be at least 3 characters')
      return
    }
    if (!newBody.trim()) {
      setError('Post body is required')
      return
    }

    setPosting(true)
    const { error: insertError } = await supabase.from('forum_threads').insert({
      collaborative_id: collaborativeId,
      title: newTitle.trim(),
      body: newBody.trim(),
      created_by: user.id
    })
    if (insertError) {
      setError(insertError.message)
      setPosting(false)
      return
    }
    setNewTitle('')
    setNewBody('')
    setShowNewThread(false)
    setPosting(false)
    fetchThreads()
  }

  const handleDelete = async (thread) => {
    if (!window.confirm(`Delete "${thread.title}"? This will also delete all replies.`)) return
    const { error } = await supabase.from('forum_threads').delete().eq('id', thread.id)
    if (error) { alert('Error deleting thread'); return }
    setThreads(prev => prev.filter(t => t.id !== thread.id))
  }

  const handlePin = async (thread) => {
    const { error } = await supabase
      .from('forum_threads')
      .update({ is_pinned: !thread.is_pinned })
      .eq('id', thread.id)
    if (error) { alert('Error updating pin status'); return }
    fetchThreads()
  }

  const handleCollaborativeChange = (id) => {
    const collab = collaboratives.find(c => c.id === id)
    setCollaborativeId(id)
    setCollaborativeName(collab?.name || '')
    setThreads([])
    setLoading(true)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const inputStyle = {
    width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb',
    borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box',
    transition: 'border-color 0.2s', fontFamily: 'inherit'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
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
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700' }}>Community Forum</h1>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
                {collaborativeName || 'Select a collaborative'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={handleSignOut} style={{
              background: 'rgba(255,255,255,0.15)', color: 'white',
              padding: '0.5rem 1rem', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500'
            }}>Sign Out</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        {/* Back + Collaborative selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={() => navigate('/admin')} style={{
            background: 'white', color: '#6b7280', padding: '0.5rem 1rem',
            borderRadius: '8px', border: '1px solid #e5e7eb', fontWeight: '600',
            cursor: 'pointer', fontSize: '0.9rem'
          }}>&#8592; Back to Dashboard</button>

          {isSuperAdmin && collaboratives.length > 1 && (
            <select
              value={collaborativeId || ''}
              onChange={(e) => handleCollaborativeChange(e.target.value)}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px', border: '2px solid #e5e7eb',
                fontSize: '0.9rem', fontWeight: '600', color: COLORS.navy, background: 'white'
              }}
            >
              {collaboratives.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Search + New Thread button */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads..."
            style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
            onFocus={(e) => e.target.style.borderColor = COLORS.teal}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          <button
            onClick={() => setShowNewThread(!showNewThread)}
            style={{
              background: showNewThread ? '#e5e7eb' : `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 100%)`,
              color: showNewThread ? '#374151' : 'white',
              padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none',
              fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem',
              boxShadow: showNewThread ? 'none' : '0 4px 12px rgba(0,167,157,0.3)',
              whiteSpace: 'nowrap'
            }}
          >
            {showNewThread ? 'Cancel' : '+ New Thread'}
          </button>
        </div>

        {/* New Thread Form */}
        {showNewThread && (
          <form onSubmit={handleNewThread} style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem',
            border: `2px solid ${COLORS.teal}`, marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(0,167,157,0.1)'
          }}>
            <h3 style={{ color: COLORS.navy, margin: '0 0 1rem', fontSize: '1.1rem' }}>Start a New Thread</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Thread title..."
              maxLength={200}
              style={{ ...inputStyle, marginBottom: '0.75rem' }}
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="What would you like to discuss?"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: '0.75rem' }}
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            {error && (
              <div style={{
                background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b',
                padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.85rem'
              }}>{error}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={posting} style={{
                background: posting ? '#9ca3af' : COLORS.teal,
                color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px',
                border: 'none', fontWeight: '600', cursor: posting ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem'
              }}>{posting ? 'Posting...' : 'Post Thread'}</button>
            </div>
          </form>
        )}

        {/* Thread List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading threads...</div>
        ) : !collaborativeId ? (
          <div style={{
            textAlign: 'center', padding: '3rem', color: '#6b7280',
            background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb'
          }}>
            <p style={{ fontWeight: '600' }}>No collaborative assigned</p>
            <p style={{ fontSize: '0.9rem' }}>Contact CTAC for assistance.</p>
          </div>
        ) : threads.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem', color: '#6b7280',
            background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.3 }}>&#128172;</div>
            <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {search ? 'No threads match your search' : 'No threads yet'}
            </p>
            <p style={{ fontSize: '0.9rem' }}>Be the first to start a discussion!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {threads.map(thread => {
              const authorName = thread.author?.full_name || 'Unknown'
              const teamName = thread.author_team?.teams?.agency_name || ''
              const preview = thread.body.length > 150 ? thread.body.slice(0, 150) + '...' : thread.body
              const canDelete = isSuperAdmin || thread.created_by === user?.id

              return (
                <div key={thread.id} style={{
                  background: 'white', borderRadius: '12px', padding: '1.25rem',
                  border: thread.is_pinned ? `2px solid ${COLORS.teal}` : '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer', transition: 'box-shadow 0.15s'
                }}
                  onClick={() => navigate(`/admin/forum/${thread.id}`)}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <InitialsAvatar name={authorName} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        {thread.is_pinned && (
                          <span style={{
                            background: COLORS.teal, color: 'white', padding: '0.1rem 0.4rem',
                            borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700'
                          }}>PINNED</span>
                        )}
                        <h3 style={{ color: COLORS.navy, fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>
                          {thread.title}
                        </h3>
                      </div>
                      <p style={{
                        color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0.5rem',
                        lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                      }}>{preview}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: '#9ca3af', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', color: '#6b7280' }}>{authorName}</span>
                        {teamName && <span>{teamName}</span>}
                        <span>{timeAgo(thread.last_reply_at)}</span>
                        <span style={{
                          background: '#f3f4f6', padding: '0.1rem 0.5rem',
                          borderRadius: '10px', fontWeight: '600', color: '#6b7280'
                        }}>
                          {thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
                        </span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}>
                      {isSuperAdmin && (
                        <button onClick={() => handlePin(thread)} title={thread.is_pinned ? 'Unpin' : 'Pin'} style={{
                          background: thread.is_pinned ? COLORS.teal : '#f3f4f6',
                          color: thread.is_pinned ? 'white' : '#6b7280',
                          border: 'none', padding: '0.3rem 0.5rem', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem'
                        }}>&#128204;</button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(thread)} title="Delete" style={{
                          background: '#fee2e2', color: '#991b1b', border: 'none',
                          padding: '0.3rem 0.5rem', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.85rem'
                        }}>&#10005;</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {hasMore && (
              <button onClick={() => fetchThreads(true)} style={{
                background: 'white', color: COLORS.navy, padding: '0.75rem',
                borderRadius: '8px', border: '2px solid #e5e7eb', fontWeight: '600',
                cursor: 'pointer', fontSize: '0.9rem', textAlign: 'center'
              }}>Load More</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
