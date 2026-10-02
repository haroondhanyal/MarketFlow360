# Architecture

## Shape

This is one pnpm repository with a web app, an API app, and local service configuration. It deliberately stays as a modular monolith while the product is small: feature pages and REST controllers are separated by business area, and the database is shared through one Prisma service.

```text
Browser
  └── Next.js screens (auth, overview, CRM, campaigns, content, landing pages, automations)
        └── REST /api/v1 (NestJS)
              ├── Auth + workspace access guard
              ├── Feature controllers (CRM, campaigns, content, pages, automations)
              └── Prisma → PostgreSQL
```

Redis is provisioned but not yet used by the application. Automations currently run synchronously inside the API request that creates a lead.

## Multi-tenancy and access

- CRM records store a `workspaceId`; list/detail/edit queries use the server-verified workspace on the request.
- The browser sends `x-workspace-id` as a selection hint. The API checks the authenticated user’s direct membership before any workspace CRM route uses it.
- Agency-to-client access is explicit in `AgencyClientAccess`. Agency and client workspace owners/admins authorize the grant. Users can see a granted client only if they are also a member of that agency. A read-only agency role stays read-only when switching into a client workspace.
- A deal’s linked lead/customer and a task’s linked lead/customer are checked against the same workspace.
- The UI hides team management for read-only and granted-client users; backend checks remain authoritative.

## Sessions and demo delivery

- Passwords use Node’s `scrypt` with an individual random salt.
- Session tokens are random values stored as SHA-256 hashes; cookies are `HttpOnly`, `SameSite=Strict`, expire after seven days, and are revoked on logout/reset.
- Email verification, password reset and invitations use expiring, one-use token hashes. A Resend adapter sends mail when `RESEND_API_KEY` is configured; otherwise endpoints return a demo URL.
- Login throttling is held in process memory (eight failures per email/IP in a 15-minute window). Use shared Redis storage before running multiple API instances.
- `NODE_ENV=production` enables the cookie `Secure` flag. A production deployment also needs TLS, configured mail, public-form abuse protection and operational monitoring.

## Data and API

- Money uses integer minor units plus an explicit currency code. Campaign budgets are planned amounts; external spend/conversion metrics are unavailable until integrations exist.
- PostgreSQL schema/migrations and seed fixtures live under `apps/api/prisma`.
- DTOs use `class-validator`; a global `ValidationPipe` transforms input, strips unknown fields and rejects non-whitelisted properties.
- REST routes are prefixed `/api/v1`; the API covers authentication, workspaces, leads, customers, deals, tasks, campaigns, content, landing pages, automations and a database-derived overview.
- Public landing forms create workspace-scoped website leads. They do not yet have configurable consent fields, CAPTCHA/rate limits or custom-domain support.
- Campaign/content state is internal; social publishing, media storage, durable reminder jobs and delayed/branched automation execution require later adapters/workers.

## Environment

Node.js 24, Corepack/pnpm 10, Docker Compose, PostgreSQL and Redis are the local baseline. `apps/api/.env.example` documents connection values. The local API defaults to port 4000 and the web app to port 3000. See the root README for fresh setup commands.
