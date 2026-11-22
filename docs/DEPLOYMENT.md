# Deployment (staging & production)

Deployment is **not** set up yet; this documents what a staging and production environment will need. Nothing here runs without explicit approval.

## Shape
One Node.js web process (`next start`) per environment plus a managed PostgreSQL database. The app is stateless; all state lives in PostgreSQL. Any host that runs Node 22+ works (Render, Railway, Fly.io, a VPS with systemd, or a container platform).

## Checklist

### HTTPS and domain
- Terminate TLS at the platform load balancer or a reverse proxy (Caddy/nginx). The app must only be reachable over HTTPS.
- Set `BETTER_AUTH_URL` to the public `https://` origin. Auth cookies are `Secure` + `HttpOnly` + `SameSite=Lax` when the base URL is HTTPS.
- Use separate hostnames for staging and production (e.g. `staging.<domain>` and `app.<domain>`).

### Managed PostgreSQL
- One database per environment; never point staging at production data.
- Require TLS to the database (`?sslmode=require` in `DATABASE_URL`).
- Size: the smallest managed tier is fine for the first company; connection pool is capped at 10 per app instance (`src/db/client.ts`).
- Enable automated daily backups with point-in-time recovery where the provider offers it; keep at least 14 days. Test a restore into staging quarterly.

### Secrets
Set these as platform secrets, never in files or the repo:
| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Managed Postgres connection string with TLS |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`; rotate by setting a new value (sessions are invalidated) |
| `BETTER_AUTH_URL` | Public HTTPS origin |
| `ALLOW_SIGNUP` | Leave unset/`false`; users are created by an owner (invitation flow is future work) |
| `NODE_ENV` | `production` |

`SEED_DEMO_PASSWORD` and `LOCAL_DB_*` are local-only and must not be set in staging/production. Do not run `npm run db:seed` against production.

### Build and run
```
npm ci
npm run build
npm run start   # listens on $PORT (default 3000)
```
Health check: `GET /sign-in` returns 200.

### Migrations
- Migrations are plain SQL in `drizzle/`, applied in order with `npm run db:migrate` (tracked in the `drizzle.__drizzle_migrations` table).
- Run migrations as a release step **before** the new app version receives traffic (platform "release command" / pre-deploy hook). Migrations are forward-only; a failed migration stops the deploy.
- Never edit a migration that has been applied anywhere; add a new one (`npm run db:generate`).

### Observability
- Ship stdout/stderr to the platform log drain. Server errors are logged with stack traces; client-safe messages go to the browser.
- Add uptime monitoring on the health check and a database-connection alert.

### Suggested promotion flow
1. PR → CI (lint, typecheck, tests, build) must pass.
2. Merge to `main` → auto-deploy to **staging**, run migrations, smoke test the walkthrough in `README.md`.
3. Manual promote the same build to **production** after approval.

## Not yet in place
- Invitation / user onboarding (users are currently created by seed or directly in the database).
- Rate limiting on the sign-in endpoint (add at the proxy or via Better Auth's rate limiter before public exposure).
- Postgres row-level security as a second layer behind application scoping.
- Audit log retention policy.
