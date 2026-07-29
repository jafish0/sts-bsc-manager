import { supabase } from './supabase'

// Shared delete path for registration links, used by both the central
// Registrations admin table and the per-collaborative Registrations panel.
//
// Why this is guarded rather than a plain delete: BOTH child tables cascade
// (`event_registration_link_events` and `event_registrations` each have
// ON DELETE CASCADE on registration_link_id), so removing a link with
// registrants silently destroys their registration records — names, emails,
// check-ins, the lot — with no undo. Closing a link (`is_active = false`) is
// the reversible operation for that case, so the UI only ever offers delete
// for links nobody has registered through.

// Total registrations for a link, counted server-side. `status` is ignored on
// purpose: a cancelled registration is still a record of a real person having
// signed up, and cascading it away loses that history.
export async function countRegistrationsForLink(linkId) {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('registration_link_id', linkId)
  if (error) return { count: null, error }
  return { count: count || 0, error: null }
}

export function deleteBlockedReason(total) {
  if (!total) return null
  return `${total} ${total === 1 ? 'person has' : 'people have'} registered through this link. `
    + 'Deleting it would erase their registrations, so use Edit → uncheck "Registration is open" '
    + 'to close the link instead. It stays in the table and keeps its roster.'
}

// Returns one of:
//   { deleted: true }
//   { cancelled: true }                 — admin dismissed the confirm dialog
//   { blocked: true, count, message }   — someone registered between render and click
//   { error: string }
export async function deleteRegistrationLink(link) {
  // Re-count at click time rather than trusting the row the table rendered
  // from. The list can be minutes old, and the whole point of the guard is
  // that a registration arriving in that window must still block the delete.
  const { count, error: countErr } = await countRegistrationsForLink(link.id)
  if (countErr) {
    return { error: `Could not check registrations before deleting: ${countErr.message}` }
  }
  if (count > 0) {
    return { blocked: true, count, message: deleteBlockedReason(count) }
  }

  const ok = window.confirm(
    `Delete the registration link "${link.title}"?\n\n`
    + 'Nobody has registered through it, so nothing is lost. '
    + 'The public link will stop working immediately.'
  )
  if (!ok) return { cancelled: true }

  // .select() so we can tell "RLS refused this" apart from "it worked".
  // A delete the policy rejects comes back with no error and zero rows, which
  // would otherwise look like success until the table refreshed unchanged.
  const { data, error } = await supabase
    .from('event_registration_links')
    .delete()
    .eq('id', link.id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'The link was not deleted — you may not have admin access to this collaborative.' }
  }
  return { deleted: true }
}
