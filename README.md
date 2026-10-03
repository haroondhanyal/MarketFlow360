<p align="center">
  <img src="apps/web/public/marketflow360-logo.svg" alt="MarketFlow360" width="560" />
</p>

<h1 align="center">Marketing, CRM & Business Digitalization</h1>

<p align="center">
  A multi-workspace CRM and marketing toolkit for small businesses, academies, retailers, service teams and agencies.
</p>

<p align="center">
  <a href="#product-screens">Screenshots</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="docs/PHASES.md">Delivery phases</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a>
</p>

---

## Product overview

MarketFlow360 brings enquiries, sales follow-ups and marketing work into one workspace. Teams can capture a lead, move it through a configurable pipeline, convert it to a customer and deal, and keep the next action visible as a task. Campaign, content, landing-page and reporting screens use the same workspace data.

The repository is a **local-ready MVP** built as a small-team modular monolith. It is not a production SaaS deployment: payment processing, third-party social publishing, provider OAuth and production operations need further integrations and deployment work.

## Product screens

These current screenshots were captured from the local application with its fictional demo data.

| Workspace overview | Lead pipeline |
|---|---|
| <img src="docs/screenshots/overview.png" alt="MarketFlow360 workspace overview" width="680" /> | <img src="docs/screenshots/leads-pipeline.png" alt="MarketFlow360 lead pipeline" width="680" /> |

| Campaign management | Workspace assistant |
|---|---|
| <img src="docs/screenshots/campaigns.png" alt="MarketFlow360 campaign management" width="680" /> | <img src="docs/screenshots/assistant.png" alt="MarketFlow360 workspace assistant with suggested questions" width="680" /> |

| Account profile and appearance settings |
|---|
| <img src="docs/screenshots/account-appearance.png" alt="MarketFlow360 account profile and appearance settings" width="680" /> |

Screenshots live in [`docs/screenshots`](docs/screenshots). Refresh them after a major UI change and keep them based on fictional/local data.

## What is implemented

### CRM and workspace operations

- Multiple workspaces per account, workspace creation/switching, agency-to-client grants and server-validated tenant access.
- Leads board/table, custom stages, assignment, activity, duplicate checks, CSV import/export, bulk stage updates and lead conversion.
- Customer and deal records, team tasks, comments, calendar, due reminders and record attachments.
- Team invitations, workspace roles and access controls.
- Personal profile with editable name, phone, profile photo and password. Sign-in/sign-up password visibility controls and country calling code at registration.

### Marketing and automation

- Campaign planning with channel, status, budget, dates and goals. Budgets are planned values; ad-platform spend and performance are not synced.
- Content calendar with drafts, review and publish-state tracking. Status changes do not publish externally.
- Public enquiry pages with configurable text questions and lead capture into the owning workspace.
- Lead-triggered automations with a source or stage condition, one action, optional delay up to seven days, run history and up to three attempts. Delayed work is polled by an API worker.
- Inbound webhook integration for creating workspace leads.

### Insights and settings

- Workspace overview, date-filtered reports, lead trends, CSV export, audit events and database health endpoints.
- Workspace assistant with suggested questions and responses grounded in the selected workspace's leads, tasks, deals, sources and campaigns. It uses local rules and database records; no external generative AI service is connected.
- Plan catalog, optional external billing-portal link and an allowlisted platform-admin overview. There is no checkout or payment collection.
- Appearance settings with light, dark and high-contrast themes and selectable UI font stacks. Preferences are saved in the browser.
- MarketFlow360 favicon for the browser tab.

## Technology and layout

| Area | Implementation |
|---|---|
| Web | Next.js App Router, React, TypeScript and responsive CSS |
| API | NestJS REST API, DTO validation and workspace guards |
| Data | PostgreSQL, Prisma schema, migrations and demo seed |
| Repository | pnpm workspace with separate `apps/web` and `apps/api` packages |
| Local services | Docker Compose PostgreSQL and Redis; Redis is provisioned but not currently used by the app |
| CI | GitHub Actions for migrations, TypeScript checks, production builds and API integration tests |

```text
Browser → Next.js web app → NestJS /api/v1 → Prisma → PostgreSQL
                                      ├── CRM and workspace APIs
                                      ├── Campaign, content and landing-page APIs
                                      ├── Reports and workspace assistant
                                      └── Automation/reminder polling workers
```

## Get started

### Requirements

- Node.js 24
- Corepack with pnpm 10.17.1
- Docker Compose **or** a local PostgreSQL 17 server

### Docker Compose setup

From the repository root:

```sh
docker compose -f infra/docker-compose.yml up -d
corepack pnpm install
cp apps/api/.env.example apps/api/.env
```

Then initialize the database and start the apps:

```sh
corepack pnpm --filter @marketflow/api db:generate
corepack pnpm --filter @marketflow/api db:migrate
corepack pnpm --filter @marketflow/api db:seed
corepack pnpm dev
```

Open the web app at <http://localhost:3000>. The API is at <http://localhost:4000/api/v1>; database readiness is <http://localhost:4000/api/v1/health/ready>.

### Existing local PostgreSQL

Create a local database named `marketflow`, copy `apps/api/.env.example` to `apps/api/.env`, and set `DATABASE_URL` to:

```text
postgresql://YOUR_LOCAL_POSTGRES_USER@localhost:5432/marketflow?schema=public
```

Run the database-generation, migration and seed commands above. `apps/api/.env` is ignored by Git and must not be committed.

### Demo accounts

The seed includes fictional local accounts:

| Workspace | Email | Password |
|---|---|---|
| Nexora Academy | `owner@nexora.example` | `MarketFlow2026!` |
| Urban Retail | `owner@urbanretail.example` | `MarketFlow2026!` |
| Bright Digital Agency | `owner@brightagency.example` | `MarketFlow2026!` |

The agency demo has explicit access to Urban Retail. These credentials are only for the local demo. The seed command refuses to run when `NODE_ENV=production`.

## Configuration

API variables are documented in [`apps/api/.env.example`](apps/api/.env.example).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `WEB_ORIGIN` | Web origin for CORS and generated verification/reset links |
| `SESSION_SECRET` | Local session/security secret; replace the example before any shared deployment |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional delivery for verification, reset, invitation and task reminder email |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated allowlist for platform-admin access |
| `BILLING_PORTAL_URL` | Optional link to an externally hosted billing portal |
| `PORT` | API port; defaults to `4000` |

The web app uses `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:4000/api/v1`.

Without Resend credentials, authentication routes return demo links for local use and reminder emails cannot be delivered. A billing URL is only a link: it does not configure payments or change subscription plans.

## Useful commands

```sh
corepack pnpm dev                         # Run web and API in watch mode
corepack pnpm typecheck                   # Type-check all packages
corepack pnpm build                       # Production builds
corepack pnpm test                        # API integration suite; requires marketflow_test
corepack pnpm --filter @marketflow/api db:generate
corepack pnpm --filter @marketflow/api db:migrate
corepack pnpm --filter @marketflow/api db:deploy
corepack pnpm --filter @marketflow/api db:seed
```

### Integration tests

Use a separate database named `marketflow_test`; the test script refuses any other database name:

```sh
createdb marketflow_test
DATABASE_URL='postgresql://YOUR_LOCAL_POSTGRES_USER@localhost:5432/marketflow_test?schema=public' corepack pnpm --filter @marketflow/api db:deploy
DATABASE_URL='postgresql://YOUR_LOCAL_POSTGRES_USER@localhost:5432/marketflow_test?schema=public' corepack pnpm test
```

The API integration suite covers authentication, tenant isolation, dynamic pipeline stages, landing-page form questions, scheduled automations, webhook capture, reports, audit events and shared rate limits. It removes its test workspace and user when it finishes.

## Repository map

```text
apps/
  api/                 NestJS modules, Prisma schema, migrations, seed and API integration suite
  web/                 Next.js routes, feature screens, styles, logo and favicon
docs/
  ARCHITECTURE.md      Runtime shape, tenancy and security notes
  PHASES.md            Delivery scope, phase status, limitations and effort estimate
  screenshots/         Current local product screenshots used in this README
infra/                 Local PostgreSQL and Redis Compose configuration
.github/workflows/     CI pipeline
```

## Seven-developer work split

The feature boundaries support parallel work without splitting the application into microservices.

| Developer | Primary area | Main files |
|---|---|---|
| 1 | App shell, navigation and shared visual system | `apps/web/app/workspace-shell.tsx`, `apps/web/app/screens.css` |
| 2 | Authentication, account profile and team access | `apps/web/app/login`, `apps/web/app/register`, `apps/web/app/profile`, `apps/api/src/auth.ts` |
| 3 | Lead CRM and pipeline | `apps/web/app/screens/leads-screen.tsx`, `apps/api/src/features/leads.controller.ts` |
| 4 | Customers and deals | `apps/web/app/screens/customers-screen.tsx`, `apps/web/app/screens/deals-screen.tsx`, API feature controllers |
| 5 | Tasks and reminders | `apps/web/app/screens/tasks-screen.tsx`, `apps/api/src/features/tasks.controller.ts` |
| 6 | Database, migrations and API foundation | `apps/api/prisma`, `apps/api/src/prisma.service.ts` |
| 7 | Marketing, reports, integration and release docs | `apps/web/app/screens/marketing-screen.tsx`, `apps/api/src/features`, `docs/`, `.github/` |

Coordinate Prisma schema changes before editing `schema.prisma`; add a migration and regenerate Prisma Client after changes.

## Known limitations

- Social/ad OAuth, message sending, ad metrics and content publishing need provider-specific integrations.
- Automations support one condition and one action. The delayed-run worker is in-process; run one API instance until worker claiming moves to shared queue infrastructure.
- The assistant uses deterministic rules over the selected workspace data. Connect a model provider to add natural-language generation.
- Attachments are stored in PostgreSQL, capped at 3 MB, and do not have malware scanning or external object storage.
- Billing is informational. There is no payment collection, invoice handling or plan enforcement.
- Public forms and webhook endpoints have database-backed rate limits, but no CAPTCHA or edge/WAF integration.
- Backups, monitoring, deployment automation and production hosting are outside the local MVP scope.

See [the phased checklist](docs/PHASES.md) for implementation status and remaining work, and [the architecture notes](docs/ARCHITECTURE.md) for tenancy, security and runtime details.
