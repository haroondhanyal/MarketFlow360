# MarketFlow360 implementation checklist

Status: simplified MVP slices for phases 1–4 are implemented. The 13 supplied images are UI references across product modules; they do not each need their own implementation phase.

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, authentication & tenancy | MVP complete |
| 2 | Database & API foundation | MVP complete |
| 3 | Lead CRM & sales pipeline | MVP complete |
| 4 | Customers, deals & team tasks | MVP complete |
| 5 | Dashboard & campaign management | Pending |
| 6 | Content calendar & approvals | Pending |
| 7 | Landing pages & lead capture | Pending |
| 8 | Automation builder | Pending |
| 9 | Integrations | Pending |
| 10 | AI assistant | Pending |
| 11 | SaaS plans, billing & platform admin | Pending |
| 12 | Reporting, security & reliability | Pending |
| 13 | Testing & CI | Pending |
| 14 | Local running & deployment | In progress |

## Phase 1–4 MVP scope delivered

- **Phase 1:** registration with demo verification link, login/logout, hashed revocable sessions, password reset with demo link, workspace creation/switching, membership roles, invitations, read-only role enforcement, and explicit agency-client grants.
- **Phase 2:** PostgreSQL/Prisma migrations and seed data for academy, retail and agency workspaces; REST API, validation and tenant-scoped access checks for the Phase 1–4 records.
- **Phase 3:** lead board/table, create/edit/stage change/archive, source and interest, notes/activity history, duplicate warning, follow-up creation and customer/deal conversion.
- **Phase 4:** customer profiles with related deals/tasks, deal value and stage, task due dates/status/priority, comments, and database-derived workspace overview metrics.

This is the simplified first delivery requested for seven developers. Advanced items from the full brief remain: email delivery via a configured provider, login rate limiting, custom pipelines, owner assignment, lead CSV import/export and bulk operations, file attachments, task calendar/reminder jobs, broad reporting, and a full automated test/CI suite. Do not treat the phase labels as claiming those advanced items are done.

## Estimate

Rough engineering effort for the entire production-minded scope in the project brief:

| Phase | Estimate (person-days) |
|---|---:|
| 1. Foundation/auth/tenancy | 8–12 |
| 2. Data model/API foundation | 8–12 |
| 3. Leads and pipeline | 10–15 |
| 4. Customers, deals, tasks | 8–12 |
| 5. Dashboard and campaigns | 8–12 |
| 6. Content and approvals | 8–12 |
| 7. Landing pages/forms | 8–12 |
| 8. Automations | 10–15 |
| 9. Integration adapters | 8–15 |
| 10. AI assistant | 4–7 |
| 11. Plans, billing, admin | 8–12 |
| 12. Reporting/security/reliability | 8–12 |
| 13. Automated test suite and CI | 10–15 |
| 14. Local setup/deployment docs | 4–7 |
| **Total** | **110–170 person-days** |

The first four phases account for about **34–51 person-days** at full scope. With seven developers working in parallel, reserve around **2–3 calendar weeks** for their integration and review. The entire product is roughly **6–10 calendar weeks** for seven developers, subject to provider access, review turnaround and operational/deployment requirements. These are planning estimates, not a fixed delivery commitment.

## Local verification completed

- `corepack pnpm build` — API and web production builds passed.
- `corepack pnpm typecheck` — API and web checks passed.
- PostgreSQL 16 temporary local database — Prisma migrations applied and seed command passed.
- API smoke checks passed for sign-in, verification/reset flows, role invitations, workspace isolation, agency grants, duplicate warnings, lead conversion/activity, dashboard counts, lead archiving and task comments.

Docker Compose could not be started because the Docker daemon was unavailable; verification used a temporary local PostgreSQL cluster instead. No Playwright suite or CI pipeline exists yet.
