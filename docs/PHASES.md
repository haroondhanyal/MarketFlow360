# MarketFlow360 implementation checklist

The scope is delivered in small, reviewable slices for a seven-developer team. Phases 1–8 now have working MVP workflows. “MVP” means the application stores and validates the workflow data; it does not claim that an external social network, ad account or payment provider has been connected.

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, authentication and tenancy | MVP implemented; email provider adapter and basic sign-in throttle added |
| 2 | Database and API foundation | Implemented for current product models |
| 3 | Lead CRM and sales pipeline | MVP implemented; ownership and CSV import/export added |
| 4 | Customers, deals and team tasks | MVP implemented |
| 5 | Dashboard and campaign management | MVP implemented |
| 6 | Content calendar and approvals | MVP implemented |
| 7 | Landing pages and lead capture | MVP implemented |
| 8 | Automation builder | MVP implemented for new-lead trigger and two actions |
| 9 | Integrations | Pending |
| 10 | AI assistant | Pending |
| 11 | SaaS plans, billing and platform admin | Pending |
| 12 | Reporting, security and reliability | Partial; production hardening remains |
| 13 | Automated test suite and CI | Pending |
| 14 | Local setup and deployment | Local setup documented; production deployment pending |

## Delivered in phases 1–4

- Registration, email verification, login/logout, password reset, hashed revocable sessions, workspace creation/switching, roles, invitations, agency-client grants and server-side workspace checks.
- Optional Resend delivery for verification, reset and invitation email (`RESEND_API_KEY`, `EMAIL_FROM`). Without credentials the API keeps the local demo-link behavior. Sign-in failures are throttled per email/IP in process memory.
- PostgreSQL/Prisma migrations, demo seed data, validated REST APIs and tenant-scoped CRUD for leads, customers, deals and tasks.
- Lead board/table, editable names/order for the six standard pipeline stages, activity, archive, duplicate warning, follow-ups, conversion, workspace-member ownership, CSV export/import, and multi-select stage updates (500-row request limit, duplicate email rows skipped).
- Customers, deals, task dates/status/priority/comments, a monthly task calendar, 30-minute-before due reminders, overview counts and role-based team screens.
- Upload/download/delete attachments on lead, customer and task records. Files up to 3 MB are stored in PostgreSQL and downloaded as attachments after signature checks for common file types.

## Delivered in phases 5–8

- **Phase 5:** campaign create/list/update/delete, channel, status, planned budget, dates and goal. Overview shows active campaign count and planned budget.
- **Phase 6:** content drafts, channel, schedule date, optional campaign link, and review/publish status tracking.
- **Phase 7:** workspace landing page drafts and publishing, a public enquiry form, and capture directly into the owning workspace's lead list.
- **Phase 8:** new-lead trigger with create-follow-up-task or update-lead-stage action, manual run, and stored run history. New lead records created in the CRM or by a published landing page execute enabled workflows.
- **Workspace reports:** current totals by lead stage/source, deal stage/value, task state, campaign plan and content state, with CSV export.

## Remaining gaps before a production launch

- Pipeline labels and order can be edited, while stage keys remain the six standard stages; creating/removing arbitrary stages is not supported.
- Attachments are stored in PostgreSQL, limited to 3 MB, and lack virus scanning and external object storage. Deployments with large files should use a private object-storage provider.
- Task reminders are persisted and polled by an API worker; they require Resend credentials to send. They retry failed delivery every five minutes. Run one API instance for reminder processing or move the worker/lease to a dedicated job service before horizontal scaling. Sign-in throttling is in-memory and must move to shared storage such as Redis before scaling multiple API instances.
- Campaigns do not publish to ad/social channels or ingest spend, impressions or conversions. Content status changes are internal workflow only; publishing and media storage require Phase 9 provider adapters.
- Landing pages have a simple fixed form layout and do not yet provide a drag-and-drop page builder, configurable fields, custom domains or consent/legal templates.
- Automations execute synchronously on lead creation. There is no general event bus, delayed action, branching, retry/dead-letter queue or workflow versioning.
- Reports currently show all-time totals with CSV export; date filters, charts, scheduled reports and broad drill-downs remain planned. Automated application tests/CI, billing, AI, and production deployment/observability are also still planned.

## Effort estimate

The original full production-minded estimate remains **110–170 person-days** across 14 phases. Phases 1–8 MVP delivery is estimated at roughly **68–102 person-days** in total. For seven developers, allow about **3–5 calendar weeks** for parallel development plus review and integration, depending on provider access and test/release requirements. These are planning ranges, not a delivery guarantee.

## Verification in this checkout

- API TypeScript check and Nest production build passed.
- Web TypeScript check and Next production build passed.
- A prior checkout verified the original Prisma migrations/seed and core CRM/auth flows against a temporary local PostgreSQL database. The Phase 5–8 and workspace-tools migrations validate against the Prisma schema but have not been applied to a database in this turn.
- PostgreSQL was not listening locally, so Compose/database migration and third-party provider delivery were not verified here. No automated test suite or CI workflow is present.
