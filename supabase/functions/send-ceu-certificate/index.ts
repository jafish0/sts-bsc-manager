// TOMBSTONE (2026-06-10): in-app CEU certificate emailing was removed in the
// CEU course-correction (WORKING_NOTES draft at ddb75e6). Certificates are
// now issued by the desktop Training Manager tool from the app's exported
// roster. The MCP toolset can't delete functions, so this stub returns 410;
// delete the function entirely from the Supabase dashboard when convenient.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: 'send-ceu-certificate has been retired. Certificates are issued via the desktop Training Manager tool from the exported CEU roster.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  )
)
