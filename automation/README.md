# MarketFlow360 Automation

MarketFlow360 has **750 separately reported automation cases**: 600 Playwright cases across four projects and 150 read-only k6 performance cases.

| Project | Cases | Coverage |
|---|---:|---|
| UI | 260 | 130 screen smoke checks, 65 negative form checks and 65 responsive/navigation/appearance regression checks |
| API | 140 | 28 request/contract scenarios against each of five workspace tenants |
| BDD | 100 | 20 Gherkin scenario outlines, each exercised against five workspaces |
| Database | 100 | 20 SQL integrity/tenancy checks against each of five workspaces |
| k6 Performance | 150 | 30 authenticated GET request profiles against each of five workspaces |
| **Total** | **750** | Every case has its own result entry and detailed execution evidence in Allure |

## Architecture

```text
automation/
├── playwright.config.ts       # four Playwright projects, 5 workers, evidence + Allure
├── global-setup.ts             # verifies safe DB, logs in, creates five workspaces
├── config/                     # URLs and credentials
├── pages/                      # one page object for each application screen
├── locators/                   # screen-specific locator modules
├── tests/
│   ├── ui/                     # smoke, negative and regression cases
│   ├── api/                    # REST contract and authorization cases
│   └── database/               # parameterized PostgreSQL integrity cases
├── bdd/features/               # Gherkin specifications
├── bdd/steps/                  # executable Playwright BDD steps
├── support/                    # hooks and five-workspace fixtures
├── performance/
│   ├── tests/                   # 150 read-only load/performance cases
│   ├── results/                 # raw k6 JSON summary (ignored)
│   ├── reports/                 # standalone native k6 HTML report (ignored)
│   └── generate-report.mjs      # native report generator
├── utils/                      # Faker data builders
├── allure/                     # category definitions
└── scripts/                    # DB prep, k6 adapter and branded Allure report
```

The five test tenants are created idempotently as `MarketFlow360 Automation 1` through `MarketFlow360 Automation 5` by global setup. They are created in a dedicated test database and are not added to the regular demo database. Workspace 5 is an agency workspace; the others are business workspaces.

## Install and run

From the repository root:

```sh
corepack pnpm install
cp automation/.env.example automation/.env
corepack pnpm --filter @marketflow/automation db:prepare
corepack pnpm --filter @marketflow/automation exec playwright install chromium
corepack pnpm test:e2e
```

Database preparation creates `marketflow_automation` if it does not exist, deploys Prisma migrations and loads the fictional demo owner used by the test runner. PostgreSQL must be running and the configured user must be allowed to create the isolated test database. Alternatively, create it manually and run the `db:generate`, `db:deploy` and `db:seed` commands with the automation `.env` loaded.

The suite starts API and web servers on isolated ports `4100` and `3100` by default. It refuses a `DATABASE_URL` whose database name does not include `automation`, `e2e` or `test`. Do not set `AUTOMATION_ALLOW_NON_TEST_DATABASE=true` unless you have confirmed the target is disposable and isolated.

## k6 performance suite

The k6 suite sends **read-only GET requests** to 30 API request profiles, once across each of the five isolated workspaces, for 150 separately named cases. A default run uses 10 virtual users and 300 total iterations (about two requests per case on average), with a 3 minute maximum duration. It checks HTTP status, response content, per-request latency, and aggregate p95/p99 and failed-request thresholds. This is a conservative local baseline; it is not a production capacity claim.

Install [Grafana k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and ensure the API is running. Run Playwright once first to provision `.state/workspaces.json` and `.state/owner.json`, or rerun it after recreating the automation database. Then:

```sh
corepack pnpm dev                 # run this in a separate terminal and leave it running
```

Then, in another terminal after the Playwright setup has run:

```sh
corepack pnpm test:e2e:performance # run 150 k6 cases; creates the native and Allure results
corepack pnpm test:e2e:report     # regenerate/open the combined Allure report
```

Adjust the local workload with `PERF_VUS`, `PERF_ITERATIONS`, `PERF_MAX_DURATION`, `PERF_P95_MS`, `PERF_P99_MS`, `PERF_REQUEST_TIMEOUT` and `PERF_SLEEP_SECONDS`. The default values are 10 VUs, 300 iterations, 3 minutes, p95 800 ms and p99 1500 ms. k6 writes `automation/performance/results/k6-summary.json` and two standalone reports: the detailed `automation/performance/reports/k6-advanced-report.html` and the native summary view `automation/performance/reports/k6-native-report.html`. The runner also adds 150 individual Allure cases with workspace, endpoint, request count, pass/fail, latency percentiles, threshold checks, before/after steps and JSON evidence attachments. Allure's header links to both reports, which are bundled in `automation/allure-report/k6-performance/`; individual cases remain available in Allure Suites and Categories → Performance / Load. The k6 checks are API-only so they attach request/latency evidence rather than browser screenshots or videos.

Latest local run (2026-10-03): **150/150 cases passed**, 300 requests, p95 31.9 ms and p99 40.4 ms; no case was skipped or exceeded its configured latency threshold.

Regenerate both standalone reports from the most recent raw k6 result:

```sh
corepack pnpm test:e2e:performance:report
```

## Run one project

```sh
corepack pnpm test:e2e:ui
corepack pnpm test:e2e:api
corepack pnpm test:e2e:bdd
corepack pnpm test:e2e:db
```

Useful options:

```sh
corepack pnpm --filter @marketflow/automation test:list
corepack pnpm --filter @marketflow/automation test -- --grep "lead pipeline"
corepack pnpm --filter @marketflow/automation typecheck
```

## Test data and isolation

- Configure `DATABASE_URL`, `WEB_BASE_URL`, `API_BASE_URL`, `AUTOMATION_EMAIL` and `AUTOMATION_PASSWORD` in ignored `automation/.env`.
- The runner creates five workspace fixtures using the application API and records their IDs in ignored `automation/.state/` files.
- API requests pass `x-workspace-id` and use the seeded owner session. API negative tests also create an anonymous context to verify the auth boundary.
- Faker supplies unique names, emails, phones and record values so reruns do not collide.
- Database checks use parameterized SQL and the same isolated database. They verify workspace membership, ownership, foreign references and tenant boundaries.
- The UI/API/BDD/DB projects are independently runnable. Set `AUTOMATION_WORKERS=5` to keep five local workers or lower it if the local database/browser has fewer resources.

## Evidence, hooks and Allure

The shared Playwright hooks add a named **Before hook** and execution-attempt step to each case. The **After hook** captures a full-page screenshot and WebM recording for browser cases; API and database cases record that browser evidence was skipped instead of attaching blank `about:blank` captures. Playwright allows one retry by default (`AUTOMATION_RETRIES` can change this) and retains traces on failure. k6 cases attach request and latency evidence, with named Before/Given/When/Then/After execution steps.

Allure receives suite, test, step and environment information. The MarketFlow360 Overview shows the owner/executor, clickable UI/API/BDD/Database/k6 suite links, populated run/duration/retry/category charts, BDD features by stories and category counts. Trends & Graphs plots saved per-project case counts across report runs, with a current-run fallback if there is no history yet. Categories lists all cases (including passes) and each case opens its native Allure result; failure messages, steps, hooks, execution attempts, retries, screenshots, videos and attachments are available for triage. Expanding a k6 case in Categories shows its workspace, endpoint, request counts, pass/fail checks, average/min/max latency, p95/p99 alongside configured limits, load profile, failures and a link to the raw JSON attachment. The report provides Light, Dark and High Contrast modes and remembers your selection. Real report history is retained across new test runs so the trend charts gain points without adding duplicate points when regenerating the same report. Report generation uses the current result files:

```sh
corepack pnpm --filter @marketflow/automation report:generate
```

Generated artifacts live in ignored `automation/allure-results/`, `automation/allure-report/` and `automation/test-results/` directories. Non-empty browser screenshots and videos are attached to UI/BDD cases; API/database cases keep their request and SQL evidence without blank browser media.

The README screenshots of the Allure overview, test detail and categories are under [`docs/screenshots/`](docs/screenshots/). The test-detail image illustrates the step/attachment view; the k6 metric card is rendered from each case's JSON evidence when regenerating the branded report.

## Scenario design

UI page coverage uses separate screen page objects and locator modules, with the same navigation, viewport, form and appearance checks run through each tenant context. API cases cover authentication, workspace authorization, validation, safe export, lead conflict handling, CRM entity contracts and isolation. Gherkin scenarios describe user intent and use example rows for all workspaces. Direct SQL checks focus on tenant ownership and cross-record relationships. Faker values are not used as expected outputs: generated values are checked for preservation, normalization or rejection according to the endpoint contract.
