<p align="center">
  <img src="apps/web/public/marketflow360-logo.svg" alt="MarketFlow360" width="560" />
</p>

<h1 align="center">Marketing, CRM & Business Digitalization</h1>

<p align="center">
  One simple workspace for leads, customers, deals, follow-ups and marketing work.
</p>

---

## Product overview

**MarketFlow360** is a business-neutral SaaS platform for small businesses, academies, retailers, service teams, consultants and marketing agencies. It brings customer enquiries, sales follow-ups, campaign planning and business reporting into one workspace. A business manages its own contacts; an agency can manage separate client workspaces with explicit access grants. Each workspace has its own team, records, currency and settings.

The product is designed to replace scattered spreadsheets and disconnected tools with a clear daily workflow:

1. Capture a lead and record its source and interest.
2. Track the lead through a simple sales pipeline.
3. Convert an interested lead into a customer and deal.
4. Set a follow-up task and keep its due date visible.
5. Review activity and performance from workspace records.
6. Add campaign, content, landing-page and automation tools as the related phases are delivered.

The supplied MarketFlow360 screenshots guide the visual style: a dark navy navigation rail, clear white work surfaces, purple primary actions, calm status colors, readable cards and responsive layouts. Screens are separate routes and feature modules, so a small team can work on them independently without building a complicated frontend framework.

## What works now

- Responsive overview based on saved leads, deals and tasks.
- Registration creates a user and an Owner workspace; demo verification and password-reset links work without an email provider. Login/logout uses hashed, revocable HTTP-only sessions.
- Workspace switcher and server-checked workspace membership on record APIs.
- Owner/Admin team screen, role changes, single-use invitations and invitation acceptance. Invitations return a demo acceptance URL; no email is sent.
- Business and agency workspace types. Agency users can switch into explicitly granted client workspaces; the sample Bright Digital Agency has a seeded grant to Urban Retail.
- Separate Leads, Customers, Deals and Tasks screens with create, update, stage change and delete actions.
- Lead board and table views, a default pipeline, a basic stage-transition check and a lead activity timeline API.
- Lead assignment to workspace members, CSV import/export, and limited batch import/status endpoints.
- Lead conversion creates a customer and deal in one database transaction.
- Task follow-ups can be reviewed in list or monthly calendar view; due reminders themselves are not delivered by a background worker yet.
- Related leads/customers are checked to belong to the same workspace before creating or editing deals and tasks.
- Seeded Nexora Academy and Urban Retail demonstration workspaces.
- Campaign management with planned budget, content calendar and approval statuses, hosted enquiry pages, and lead-triggered follow-up automations.
- Optional Resend delivery for verification, reset and invite emails; demo links are returned when provider credentials are not configured.

## What is still planned

Social/ad publishing and metrics, file uploads, flexible pipeline configuration, task reminder jobs, broad reporting, provider integrations, billing and AI assistance remain future work. Content statuses are internal tracking; they do not publish to social platforms. Campaign budget is a planned amount, not actual channel spend. See [the phase checklist](docs/PHASES.md) for precise scope and remaining work.

## Run locally

Requirements: Node.js 24, Corepack, and Docker Compose.

```sh
docker compose -f infra/docker-compose.yml up -d
corepack pnpm install
cp apps/api/.env.example apps/api/.env
corepack pnpm --filter @marketflow/api db:generate
corepack pnpm --filter @marketflow/api db:migrate
corepack pnpm --filter @marketflow/api db:seed
corepack pnpm dev
```

Open the web app at <http://localhost:3000>. API health is at <http://localhost:4000/api/v1/health>. The web app expects the API at `http://localhost:4000/api/v1`; override with `NEXT_PUBLIC_API_URL` when needed. API settings are in `apps/api/.env.example`.

Set `RESEND_API_KEY` and `EMAIL_FROM` in `apps/api/.env` to send account verification, password reset and workspace invitation emails through Resend. Without these values, the API returns local demo links.

### Demo sign-in

| Workspace | Email | Password |
|---|---|---|
| Nexora Academy | `owner@nexora.example` | `MarketFlow2026!` |
| Urban Retail | `owner@urbanretail.example` | `MarketFlow2026!` |
| Bright Digital Agency | `owner@brightagency.example` | `MarketFlow2026!` |

These are fictional local demo accounts. The agency account has explicit Sales Agent access to Urban Retail. The seed command refuses to run when `NODE_ENV=production`.

## Simple team boundaries for seven developers

The code is split around product areas and a small shared foundation. This gives seven people clear files and API ownership without introducing microservices or extra frameworks.

| Developer | Main area | Main files / routes |
|---|---|---|
| 1 | Shared app shell and UI conventions | `apps/web/app/workspace-shell.tsx`, `apps/web/app/screens.css` |
| 2 | Login, workspaces and team access | `apps/web/app/login`, `apps/web/app/register`, `apps/api/src/auth.ts` |
| 3 | Leads pipeline and conversion | `apps/web/app/screens/leads-screen.tsx`, `apps/api/src/features/leads.controller.ts` |
| 4 | Customers and deals | `apps/web/app/screens/customers-screen.tsx`, `deals-screen.tsx`, matching API controller files |
| 5 | Tasks and follow-ups | `apps/web/app/screens/tasks-screen.tsx`, `apps/api/src/features/tasks.controller.ts` |
| 6 | Database, fixtures and API changes | `apps/api/prisma`, `apps/api/src/prisma.service.ts` |
| 7 | Integration, responsive review and delivery docs | `docs`, `infra`, root scripts and cross-feature review |

Keep changes within the assigned product area when possible. Coordinate schema edits before changing `schema.prisma`, then regenerate the Prisma client. Keep shared helpers small and avoid moving another developer's code without checking first.

## Repository structure

```text
apps/
  web/                 Next.js pages, styles and small screen components
  api/                 NestJS REST API, Prisma schema and seed data
infra/                 Local PostgreSQL and Redis Compose services
docs/                  Architecture and phase tracking
```

The frontend uses Next.js, TypeScript and Tailwind CSS. The API uses NestJS, class-validator and Prisma with PostgreSQL. CRM features have separate screens and controller files, with DTOs and a small workspace guard shared across them. All CRM records are queried within the authenticated workspace. Workspace IDs received in `x-workspace-id` are verified against a direct membership or an explicit agency-client grant before the API uses them.

## Useful commands

```sh
corepack pnpm dev                         # web and API in watch mode
corepack pnpm build                       # production builds
corepack pnpm typecheck                   # TypeScript checks
corepack pnpm --filter @marketflow/api db:generate
corepack pnpm --filter @marketflow/api db:migrate
corepack pnpm --filter @marketflow/api db:seed
```

## Delivery plan

See [the phased checklist and initial effort estimate](docs/PHASES.md) and [architecture notes](docs/ARCHITECTURE.md). The first four phases focus on the foundation, auth/tenancy, core database APIs, lead CRM, customers, deals and tasks; phases 5–14 add marketing execution, integrations, platform billing, hardening and deployment.
