# Supabase Edge Functions

**The repo is the source of truth.** Edit the `index.ts` here, then deploy. Never
edit a function in the Supabase dashboard — a dashboard edit silently desyncs
git, and the next deploy from the repo overwrites it without warning.

```bash
supabase functions deploy <slug> --project-ref jhnquklmwoubpbbmnrjf --no-verify-jwt
```

**The intended state is `--no-verify-jwt` on every function here**, so the gateway
does *not* check the JWT. Each function does its own authorization instead:

> ⚠️ Deploying through the Supabase **MCP tool**: pass **`verify_jwt: false`**.
> The tool has a required `verify_jwt` parameter that **defaults to `true`**, so
> omitting it flips the flag on. (An earlier version of this note claimed the tool
> had no such parameter — wrong, and that mistake is why some deploys flipped it.)
> Check `list_edge_functions` afterwards regardless.

- **Public / token-credentialed** (`mint-registration`, `cancel-registration`,
  `lookup-registration`) — the token in the request body *is* the credential.
  Callers arrive from an email link and have no session.
- **Caller-verified** (`invite-team-leader`, `send-event-email`) — read the
  `Authorization` header, resolve the user with the service-role client, then
  check role / trainer assignment before doing anything.
- **Service-role / cron** (`send-event-reminder`, `send-trainer-digest`) — called
  by `pg_cron` via `pg_net` with the service-role key.

If you add a function, give it internal auth. With the gateway check off, an
endpoint that doesn't authorize its own callers is world-callable.

The committed sources are **byte-exact snapshots of what is deployed** (as of
2026-07-29), with no added header comments, so a repo-vs-deployed diff shows
only real drift. Per-function detail — versions at snapshot, what each one does,
and which are retired — lives in [`INFRASTRUCTURE.md`](../../INFRASTRUCTURE.md).
