import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, timeAgo } from '../utils/constants'
import ctacLogo from '../assets/CTAC_white.png'

const POSTS_PAGE_SIZE = 50

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

export default function ForumThread() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { user, isSuperAdmin } = useAuth()

  const [thread, setThread] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMorePosts, setHasMorePosts] = useState(true)

  // Reply form
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)

  // Editing states
  const [editingThreadBody, setEditingThreadBody] = useState(null)
  const [editingPostId, setEditingPostId] = useState(null)
  const [editingPostBody, setEditingPostBody] = useState('')

  useEffect(() => {
    loadThread()
    loadPosts()
  }, [threadId])

  const loadThread = async () => {
    const { data, error } = await supabase
      .from('forum_threads')
      .select(`
        id, title, body, created_by, created_at, updated_at,
        reply_count, is_pinned, collaborative_id,
        author:user_profiles!created_by(full_name, team_id),
        author_team:user_profiles!created_by(teams(agency_name))
      `)
      .eq('id', threadId)
      .single()
    if (error) {
      console.error('Error loading thread:', error)
      setLoading(false)
      return
    }
    setThread(data)
    setLoading(false)
  }

  const loadPosts = async (loadMore = false) => {
    const from = loadMore ? posts.length : 0
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        id, body, created_by, created_at, updated_at, is_edited,
        author:user_profiles!created_by(full_name, team_id),
        author_team:user_profiles!created_by(teams(agency_name))
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range(from, from + POSTS_PAGE_SIZE - 1)
    if (error) {
      console.error('Error loading posts:', error)
      return
    }
    if (loadMore) {
      setPosts(prev => [...prev, ...(data || [])])
    } else {
      setPosts(data || [])
    }
    setHasMorePosts((data || []).length === POSTS_PAGE_SIZE)
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setReplying(true)
    const { error } = await supabase.from('forum_posts').insert({
      thread_id: threadId,
      body: replyBody.trim(),
      created_by: user.id
    })
    if (error) {
      alert('Error posting reply: ' + error.message)
      setReplying(false)
      return
    }
    setReplyBody('')
    setReplying(false)
    loadPosts()
    loadThread() // refresh reply count
  }

  const handleDeleteThread = async () => {
    if (!window.confirm(`Delete "${thread.title}"? This will also delete all replies.`)) return
    const { error } = await supabase.from('forum_threads').delete().eq('id', thread.id)
    if (error) { alert('Error deleting thread'); return }
    navigate('/admin/forum')
  }

  const handlePinThread = async () => {
    const { error } = await supabase
      .from('forum_threads')
      .update({ is_pinned: !thread.is_pinned })
      .eq('id', thread.id)
    if (error) { alert('Error updating pin'); return }
    setThread(prev => ({ ...prev, is_pinned: !prev.is_pinned }))
  }

  const handleSaveThreadEdit = async () => {
    if (!editingThreadBody?.trim()) return
    const { error } = await supabase
      .from('forum_threads')
      .update({ body: editingThreadBody.trim() })
      .eq('id', thread.id)
    if (error) { alert('Error saving edit'); return }
    setThread(prev => ({ ...prev, body: editingThreadBody.trim() }))
    setEditingThreadBody(null)
  }

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this reply?')) return
    const { error } = await supabase.from('forum_posts').delete().eq('id', postId)
    if (error) { alert('Error deleting reply'); return }
    setPosts(prev => prev.filter(p => p.id !== postId))
    loadThread() // refresh reply count
  }

  const handleSavePostEdit = async (postId) => {
    if (!editingPostBody.trim()) return
    const { error } = await supabase
      .from('forum_posts')
      .update({ body: editingPostBody.trim() })
      .eq('id', postId)
    if (error) { alert('Error saving edit'); return }
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, body: editingPostBody.trim(), is_edited: true, updated_at: new Date().toISOString() } : p
    ))
    setEditingPostId(null)
    setEditingPostBody('')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const inputStyle = {
    width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb',
    borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.2s'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '1.1rem' }}>Loading thread...</div>
      </div>
    )
  }

  if (!thread) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: COLORS.navy }}>Thread not found</h2>
          <button onClick={() => navigate('/admin/forum')} style={{
            background: COLORS.teal, color: 'white', padding: '0.6rem 1.5rem',
            borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600'
          }}>Back to Forum</button>
        </div>
      </div>
    )
  }

  const isThreadAuthor = thread.created_by === user?.id
  const threadAuthorName = thread.author?.full_name || 'Unknown'
  const threadTeamName = thread.author_team?.teams?.agency_name || ''

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
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>Thread Discussion</p>
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
        {/* Back button */}
        <button onClick={() => navigate('/admin/forum')} style={{
          background: 'white', color: '#6b7280', padding: '0.5rem 1rem',
          borderRadius: '8px', border: '1px solid #e5e7eb', fontWeight: '600',
          cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem'
        }}>&#8592; Back to Forum</button>

        {/* Thread Card */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '1.5rem',
          border: thread.is_pinned ? `2px solid ${COLORS.teal}` : '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <InitialsAvatar name={threadAuthorName} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {thread.is_pinned && (
                  <span style={{
                    background: COLORS.teal, color: 'white', padding: '0.1rem 0.4rem',
                    borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700'
                  }}>PINNED</span>
                )}
                <h2 style={{ color: COLORS.navy, fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                  {thread.title}
                </h2>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                <span style={{ fontWeight: '600', color: '#6b7280' }}>{threadAuthorName}</span>
                {threadTeamName && <span> &middot; {threadTeamName}</span>}
                <span> &middot; {timeAgo(thread.created_at)}</span>
              </div>
            </div>
            {/* Thread actions */}
            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
              {isSuperAdmin && (
                <button onClick={handlePinThread} title={thread.is_pinned ? 'Unpin' : 'Pin'} style={{
                  background: thread.is_pinned ? COLORS.teal : '#f3f4f6',
                  color: thread.is_pinned ? 'white' : '#6b7280',
                  border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem'
                }}>&#128204;</button>
              )}
              {isThreadAuthor && editingThreadBody === null && (
                <button onClick={() => setEditingThreadBody(thread.body)} title="Edit" style={{
                  background: '#f3f4f6', color: '#6b7280', border: 'none',
                  padding: '0.4rem 0.6rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem'
                }}>&#9998;</button>
              )}
              {(isThreadAuthor || isSuperAdmin) && (
                <button onClick={handleDeleteThread} title="Delete" style={{
                  background: '#fee2e2', color: '#991b1b', border: 'none',
                  padding: '0.4rem 0.6rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem'
                }}>&#10005;</button>
              )}
            </div>
          </div>

          {/* Thread body (or edit form) */}
          {editingThreadBody !== null ? (
            <div>
              <textarea
                value={editingThreadBody}
                onChange={(e) => setEditingThreadBody(e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '0.5rem' }}
                onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingThreadBody(null)} style={{
                  background: '#e5e7eb', color: '#374151', padding: '0.4rem 1rem',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                }}>Cancel</button>
                <button onClick={handleSaveThreadEdit} style={{
                  background: COLORS.teal, color: 'white', padding: '0.4rem 1rem',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                }}>Save</button>
              </div>
            </div>
          ) : (
            <p style={{
              color: '#374151', fontSize: '0.95rem', lineHeight: '1.6',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0
            }}>{thread.body}</p>
          )}
        </div>

        {/* Replies Header */}
        <h3 style={{ color: COLORS.navy, fontSize: '1rem', marginBottom: '1rem' }}>
          {thread.reply_count} {thread.reply_count === 1 ? 'Reply' : 'Replies'}
        </h3>

        {/* Replies List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {posts.map(post => {
            const postAuthorName = post.author?.full_name || 'Unknown'
            const postTeamName = post.author_team?.teams?.agency_name || ''
            const isPostAuthor = post.created_by === user?.id
            const isEditing = editingPostId === post.id

            return (
              <div key={post.id} style={{
                background: 'white', borderRadius: '10px', padding: '1rem 1.25rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <InitialsAvatar name={postAuthorName} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>{postAuthorName}</span>
                        {postTeamName && <span> &middot; {postTeamName}</span>}
                        <span> &middot; {timeAgo(post.created_at)}</span>
                        {post.is_edited && <span style={{ fontStyle: 'italic' }}> (edited)</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        {isPostAuthor && !isEditing && (
                          <button onClick={() => { setEditingPostId(post.id); setEditingPostBody(post.body) }}
                            title="Edit" style={{
                              background: 'transparent', color: '#9ca3af', border: 'none',
                              padding: '0.2rem 0.4rem', borderRadius: '4px',
                              cursor: 'pointer', fontSize: '0.8rem'
                            }}>&#9998;</button>
                        )}
                        {(isPostAuthor || isSuperAdmin) && (
                          <button onClick={() => handleDeletePost(post.id)}
                            title="Delete" style={{
                              background: 'transparent', color: '#ef4444', border: 'none',
                              padding: '0.2rem 0.4rem', borderRadius: '4px',
                              cursor: 'pointer', fontSize: '0.8rem'
                            }}>&#10005;</button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div>
                        <textarea
                          value={editingPostBody}
                          onChange={(e) => setEditingPostBody(e.target.value)}
                          rows={3}
                          style={{ ...inputStyle, resize: 'vertical', marginBottom: '0.5rem', fontSize: '0.9rem' }}
                          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingPostId(null); setEditingPostBody('') }} style={{
                            background: '#e5e7eb', color: '#374151', padding: '0.3rem 0.75rem',
                            borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem'
                          }}>Cancel</button>
                          <button onClick={() => handleSavePostEdit(post.id)} style={{
                            background: COLORS.teal, color: 'white', padding: '0.3rem 0.75rem',
                            borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem'
                          }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{
                        color: '#374151', fontSize: '0.9rem', lineHeight: '1.5',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0
                      }}>{post.body}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {hasMorePosts && posts.length > 0 && (
            <button onClick={() => loadPosts(true)} style={{
              background: 'white', color: COLORS.navy, padding: '0.6rem',
              borderRadius: '8px', border: '2px solid #e5e7eb', fontWeight: '600',
              cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center'
            }}>Load More Replies</button>
          )}
        </div>

        {/* Reply Form */}
        <form onSubmit={handleReply} style={{
          background: 'white', borderRadius: '12px', padding: '1.25rem',
          border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h4 style={{ color: COLORS.navy, margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Post a Reply</h4>
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write your reply..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: '0.75rem' }}
            onFocus={(e) => e.target.style.borderColor = COLORS.teal}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={replying || !replyBody.trim()} style={{
              background: (replying || !replyBody.trim()) ? '#9ca3af' : COLORS.teal,
              color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px',
              border: 'none', fontWeight: '600',
              cursor: (replying || !replyBody.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem'
            }}>{replying ? 'Posting...' : 'Post Reply'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
