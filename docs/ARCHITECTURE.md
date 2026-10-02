# Architecture

## Shape

This is one pnpm repository with a web app, an API app, and local service configuration. It deliberately stays as a modular monolith while the product is small: feature pages and REST controllers are separated by business area, and the database is shared through one Prisma service.

```text
Browser
  └── Next.js screens (auth, overview, leads, customers, deals, tasks, team)
        └── REST /api/v1 (NestJS)
              ├── Auth + workspace access guard
              ├── Feature controllers (leads, customers, deals, tasks)
              └── Prisma → PostgreSQL
```

Redis is provisioned in Docker Compose for later jobs; no background worker is implemented in phases 1–4.

## Multi-tenancy and access

- CRM records store a `workspaceId`; list/detail/edit queries use the server-verified workspace on the request.
- The browser sends `x-workspace-id` as a selection hint. The API checks the authenticated user’s direct membership before any workspace CRM route uses it.
- Agency-to-client access is explicit in `AgencyClientAccess`. Agency and client workspace owners/admins authorize the grant. Users can see a granted client only if they are also a member of that agency. A read-only agency role stays read-only when switching into a client workspace.
- A deal’s linked lead/customer and a task’s linked lead/customer are checked against the same workspace.
- The UI hides team management for read-only and granted-client users; backend checks remain authoritative.

## Sessions and demo delivery

- Passwords use Node’s `scrypt` with an individual random salt.
- Session tokens are random values stored as SHA-256 hashes; cookies are `HttpOnly`, `SameSite=Strict`, expire after seven days, and are revoked on logout/reset.
- Email verification, password reset and invitations use expiring, one-use token hashes. Since no email provider credentials are configured, local endpoints expose clearly labeled demo links; they do not send mail.
- `NODE_ENV=production` enables the cookie `Secure` flag. A production deployment also needs TLS, email delivery and rate-limiting infrastructure before accepting public signups.

## Data and API

- Money uses integer minor units plus an explicit currency code. Dashboard money metrics remain `N/A` until campaign data exists.
- PostgreSQL schema/migrations and seed fixtures live under `apps/api/prisma`.
- DTOs use `class-validator`; a global `ValidationPipe` transforms input, strips unknown fields and rejects non-whitelisted properties.
- REST routes are prefixed `/api/v1`; the API currently covers authentication, workspaces, leads, customers, deals, tasks and a database-derived overview.
- Redis is only provisioned. There are no jobs for reminders, campaign publishing or automations yet.

## Environment

Node.js 24, Corepack/pnpm 10, Docker Compose, PostgreSQL and Redis are the local baseline. `apps/api/.env.example` documents connection values. The local API defaults to port 4000 and the web app to port 3000. See the root README for fresh setup commands.
