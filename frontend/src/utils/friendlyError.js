// Turn a Supabase/Postgres write failure into something a non-developer can
// act on. Tracy's report of "new row violates row-level security policy for
// table bsc_event_documents" (2026-09-09) is the reason this exists: RLS
// refusals are a permissions message for the USER, not a stack trace, and the
// raw string reads like their file broke something.
//
// Usage: setError(friendlyWriteError(err, 'change materials on this training'))
// The raw error always goes to console.error so it is still diagnosable.
const CONTACT = 'If you think you should be able to, contact the CTAC team.'

export function isPermissionError(err) {
  if (!err) return false
  const code = String(err.code || err.statusCode || err.status || '')
  const msg = String(err.message || err.error || '')
  return code === '42501'
    || code === '403'
    || /row-level security/i.test(msg)
    || /permission denied/i.test(msg)
    || /not authorized|unauthorized/i.test(msg)
}

export function friendlyWriteError(err, what = 'make this change') {
  console.error(`Write failed (${what}):`, err)
  if (isPermissionError(err)) {
    return `You don't have permission to ${what}. ${CONTACT}`
  }
  const msg = String(err?.message || err || '')
  if (/payload too large|exceeded the maximum allowed size|413/i.test(msg)) {
    return 'That file is too large to upload.'
  }
  if (/failed to fetch|network/i.test(msg)) {
    return 'The connection dropped before the change was saved. Check your network and try again.'
  }
  return `Something went wrong and the change was not saved. ${CONTACT}`
}

// For "0 rows came back and no error" — the RLS-filtered no-op that
// CLAUDE.md warns about. Same wording as a refused write, because it is one.
export function noRowsMessage(what = 'make this change') {
  return `You don't have permission to ${what}. ${CONTACT}`
}
