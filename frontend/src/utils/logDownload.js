import { supabase } from './supabase'

// Fire-and-forget download telemetry for the Resource Utilization Heatmap.
// Never blocks or fails the actual download — errors are swallowed.
// Pass exactly one of resourceId / documentId; userId is optional (anon
// training-hub visitors log with NULL).
export function logDownload({ resourceId = null, documentId = null, userId = null }) {
  if (!resourceId && !documentId) return
  supabase
    .from('resource_downloads')
    .insert({ resource_id: resourceId, document_id: documentId, user_id: userId })
    .then(({ error }) => {
      if (error) console.warn('Download logging failed (download itself unaffected):', error.message)
    })
}
