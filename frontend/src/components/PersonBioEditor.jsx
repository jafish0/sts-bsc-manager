import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import PersonAvatar from './PersonAvatar'
import { PHOTO_ACCEPT_ATTR, replacePersonPhoto, removePersonPhoto, savePersonBio } from '../utils/trainerPhoto'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// One bio + photo editor for every surface (Trainer Dashboard card, the
// standalone-training Trainer tab for super_admins, the Staff Directory's
// edit modal). All writes go through set_person_bio(); the RPC — not this
// component — decides who may edit (self or super_admin), so `canEdit` is
// only about what to render.
//
// target: { userId } for an account, { staffId } for a directory row (a
//         linked directory row updates the account server-side).
// bio / photoPath are controlled by the parent; onChange({ bio, photoPath })
// reports what was saved so the parent can update its own state.
export default function PersonBioEditor({ target, name, bio, photoPath, canEdit, compact = false, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(bio || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const report = (patch) => onChange && onChange({ bio, photoPath, ...patch })

  const saveBio = async () => {
    setBusy(true); setError(null)
    try {
      const next = draft.trim() || null
      await savePersonBio(next, target)
      report({ bio: next })
      setEditing(false)
    } catch (e) {
      setError('Could not save the bio: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const pickPhoto = () => fileRef.current?.click()

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setError(null)
    try {
      const path = await replacePersonPhoto(file, target)
      report({ photoPath: path })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const clearPhoto = async () => {
    if (!window.confirm('Remove this photo?')) return
    setBusy(true); setError(null)
    try {
      await removePersonPhoto(target)
      report({ photoPath: null })
    } catch (err) {
      setError('Could not remove the photo: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const btn = (extra = {}) => ({
    background: 'transparent', color: NAVY, border: `1px solid ${NAVY}`,
    padding: compact ? '0.25rem 0.6rem' : '0.4rem 0.85rem', borderRadius: '6px',
    cursor: busy ? 'wait' : 'pointer', fontSize: compact ? '0.75rem' : '0.82rem', fontWeight: 600, ...extra,
  })

  return (
    <div style={{ display: 'flex', gap: compact ? '0.75rem' : '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <PersonAvatar name={name} photoPath={photoPath} size={compact ? 56 : 96} />
        {canEdit && (
          <>
            <input ref={fileRef} type="file" accept={PHOTO_ACCEPT_ATTR} onChange={onFile} style={{ display: 'none' }} />
            <button onClick={pickPhoto} disabled={busy} style={btn()}>{photoPath ? 'Replace photo' : 'Add photo'}</button>
            {photoPath && (
              <button onClick={clearPhoto} disabled={busy} style={btn({ color: '#991b1b', border: '1px solid #fca5a5' })}>Remove</button>
            )}
          </>
        )}
      </div>

      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={compact ? 5 : 8}
              placeholder={'A short bio shown to participants. Basic markdown works: **bold**, *italics*, bullet lists.'}
              style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.3rem 0 0.5rem' }}>
              Accepts basic markdown. Shown on public training and participant hub pages.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={saveBio} disabled={busy} style={btn({ background: TEAL, color: 'white', border: 'none' })}>{busy ? 'Saving…' : 'Save bio'}</button>
              <button onClick={() => { setEditing(false); setDraft(bio || '') }} disabled={busy} style={btn({ color: '#374151', border: '1px solid #d1d5db' })}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            {bio ? (
              <div style={{ color: '#374151', fontSize: compact ? '0.85rem' : '0.95rem', lineHeight: 1.55 }} className="hub-markdown">
                <ReactMarkdown>{bio}</ReactMarkdown>
              </div>
            ) : (
              <em style={{ color: '#9ca3af', fontSize: compact ? '0.85rem' : '0.95rem' }}>
                {canEdit ? 'No bio yet — it appears under the name on public hub pages.' : 'No bio yet.'}
              </em>
            )}
            {canEdit && (
              <div style={{ marginTop: '0.6rem' }}>
                <button onClick={() => { setDraft(bio || ''); setEditing(true) }} disabled={busy} style={btn()}>{bio ? 'Edit bio' : 'Add bio'}</button>
              </div>
            )}
          </div>
        )}
        {canEdit && !compact && (
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', lineHeight: 1.45 }}>
            Photos are published on public pages (the training hub and participant hub), so anyone with a
            hub link can see them. JPEG, PNG or WebP up to 2 MB; images are resized to about 512px.
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', marginTop: '0.6rem' }}>{error}</div>
        )}
      </div>
    </div>
  )
}
