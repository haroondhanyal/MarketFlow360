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
| 8 | Automation builder | MVP implemented with lead filters, delayed execution and retries |
| 9 | Integrations | MVP implemented: workspace webhook lead capture; provider OAuth remains future adapters |
| 10 | AI assistant | MVP implemented: suggested-question chat with workspace-data answers |
| 11 | SaaS plans, billing and platform admin | MVP implemented: plan catalog/status, optional billing portal link and allowlisted admin overview |
| 12 | Reporting, security and reliability | MVP implemented: date-filtered reports, write audit events, shared sign-in throttle, readiness endpoint and security headers; production hardening remains |
| 13 | Automated test suite and CI | MVP implemented: API integration suite and GitHub Actions verify migrations, types and builds |
| 14 | Local setup and deployment | Local database setup, demo seed, runbook and health checks documented; production deployment is out of this local scope |

## Delivered in phases 1–4

- Registration with optional international phone and profile photo, email verification, login/logout, password reset and signed-in password changes, editable profile/photo, hashed revocable sessions, workspace creation/switching, roles, invitations, agency-client grants and server-side workspace checks.
- Optional Resend delivery for verification, reset and invitation email (`RESEND_API_KEY`, `EMAIL_FROM`). Without credentials the API keeps the local demo-link behavior. Sign-in failures are throttled per email/IP in PostgreSQL across API instances.
- PostgreSQL/Prisma migrations, demo seed data, validated REST APIs and tenant-scoped CRUD for leads, customers, deals and tasks.
- Lead board/table, add/rename/reorder/remove per-workspace pipeline stages (keep the NEW entry stage; leads in a removed stage move to the first stage), activity, archive, duplicate warning, follow-ups, conversion, workspace-member ownership, CSV export/import, and multi-select stage updates (500-row request limit, duplicate email rows skipped).
- Customers, deals, task dates/status/priority/comments, a monthly task calendar, 30-minute-before due reminders, overview counts and role-based team screens.
- Upload/download/delete attachments on lead, customer and task records. Files up to 3 MB are stored in PostgreSQL and downloaded as attachments after signature checks for common file types.

## Delivered in phases 5–8

- **Phase 5:** campaign create/list/update/delete, channel, status, planned budget, dates and goal. Overview shows active campaign count and planned budget.
- **Phase 6:** content drafts, channel, schedule date, optional campaign link, and review/publish status tracking.
- **Phase 7:** workspace landing page drafts/publishing, configurable optional text questions on the public enquiry form, and capture directly into the owning workspace's lead list.
- **Phase 8:** new-lead trigger with source/stage conditions, create-follow-up-task or update-lead-stage actions, manual run, delay (up to seven days), run history and three-attempt retry tracking. A local worker polls scheduled runs every 15 seconds.
- **Workspace reports:** totals by lead stage/source, deal stage/value, task state, campaign plan and content state, daily/weekly lead trend chart, date filters and matching CSV export.

## Delivered in phases 9–12

- **Phase 9:** webhook integration connections expose a unique inbound lead URL; valid submissions create a workspace-scoped lead and audit event. Disconnecting disables that route. Social/ad OAuth, message sending, spend sync and provider API calls need provider-specific credentials and adapters, and are not represented as connected here.
- **Phase 10:** suggested-question chat answers follow-up, overdue-task, lead-source, deal-pipeline and campaign questions from the selected workspace's records. Responses are deterministic, workspace-scoped and do not send CRM data to a third-party generative AI service.
- **Phase 11:** Starter/Growth/Agency catalog, persisted workspace plan/status, optional externally configured billing portal URL, and platform-wide counts guarded by `PLATFORM_ADMIN_EMAILS`. No checkout, payment collection or self-serve plan mutation is enabled until a billing provider adapter is configured.
- **Phase 12:** report date filters, daily/weekly lead trends and export, workspace audit events for successful write requests and webhook lead capture, database readiness check at `/api/v1/health/ready`, baseline security response headers, and PostgreSQL-backed sign-in, landing-form and webhook request throttles shared across API instances. The liveness route remains `/api/v1/health`.
- Added separate Integrations, Assistant, Plans & Billing, Audit Log and restricted Platform Administration routes; migrations `20261003000000_phases_9_12`, `20261003120000_custom_pipeline_stages`, `20261003130000_landing_form_fields`, `20261003140000_automation_conditions`, and `20261003150000_user_profile` add phase 9–12 records, shared throttles, dynamic lead stages, custom landing-page questions, automation filters/delays/retry state, and user phone/profile-photo fields.
- Account settings include editable profile details/photo/password, browser-persisted appearance themes and font choices; registration accepts an optional country-coded mobile number/profile image. The browser tab uses the MarketFlow360 favicon.

## Remaining gaps before a production launch

- Attachments are stored in PostgreSQL, limited to 3 MB, and lack virus scanning and external object storage. Deployments with large files should use a private object-storage provider.
- Task reminders are persisted and polled by an API worker; they require Resend credentials to send. They retry failed delivery every five minutes. Run one API instance for reminder processing or move the worker/lease to a dedicated job service before horizontal scaling.
- Campaigns do not publish to ad/social channels or ingest spend, impressions or conversions. Content status changes are internal workflow only; publishing and media storage require Phase 9 provider adapters.
- Landing pages have a simple fixed layout and optional text questions; there is no drag-and-drop page builder, custom domains or configurable consent/legal templates.
- Automations support one condition and one action per workflow. Scheduled execution uses an in-process polling worker and persisted retry state; use one API instance until job claiming is moved to shared worker infrastructure. Branching and workflow versioning remain future work.
- Date-filtered reports group records by creation date and include a daily/weekly lead trend; scheduled reports and broader drill-downs remain planned. Audit entries record route and record identifiers, not submitted form contents. Platform billing has no payment processor, plan enforcement, invoices or webhook reconciliation; external provider and generative AI credentials/adapters are also not configured. Production deployment and observability remain planned.
- Public forms/webhooks and login have database-backed limits, but there is no CAPTCHA or broader edge/WAF protection. Use HTTPS, configure a strict production `WEB_ORIGIN`, rotate webhook URLs if disclosed, and review retention/backup policies before production use.

## Effort estimate

The original full production-minded estimate remains **110–170 person-days** across 14 phases. Phases 1–12 MVP delivery is estimated at roughly **90–135 person-days** in total. For seven developers, allow about **4–6 calendar weeks** for parallel development plus review and integration, depending on provider access and test/release requirements. These are planning ranges, not a delivery guarantee.

## Verification in this checkout

- API and web TypeScript checks and production builds pass for the delivered local MVP features.
- All ten local Prisma migrations have been applied to the development and isolated test databases; fictional demo data is seeded in the development database. Third-party provider delivery must be verified only if later configured.
- API integration tests pass against the isolated local `marketflow_test` database, including custom lead stages, public form questions, reporting, and scheduled automation creation. GitHub Actions workflow at `.github/workflows/ci.yml` provisions PostgreSQL, applies migrations, type-checks and builds both apps, and runs the integration suite.
- The local development database migrations were applied and fictional demo data was seeded in this checkout. Production deployment/observability are not part of the requested local completion.
