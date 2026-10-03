# Local Demo Data

`corepack pnpm --filter @marketflow/api db:seed` creates an idempotent local demo dataset with five login accounts, 20 company workspaces and two team members in every workspace. Re-running the seed updates the seeded workspace names, membership roles and profile image paths without creating duplicate users or memberships.

The seed refuses to run when `NODE_ENV=production` or when `DATABASE_URL` points to a non-local host. All names, companies, contact details and portraits below are fictional. The shared password is intended for local development only: `MarketFlow2026!`.

## Login accounts

| Name | Email | Profile portrait |
|---|---|---|
| Haroon Jamal | `owner@nexora.example` | [`haroon-jamal.jpg`](../apps/web/public/demo-avatars/haroon-jamal.jpg) |
| Amina Shah | `owner@urbanretail.example` | [`amina-shah.jpg`](../apps/web/public/demo-avatars/amina-shah.jpg) |
| Adil Agency | `owner@brightagency.example` | [`adil-agency.jpg`](../apps/web/public/demo-avatars/adil-agency.jpg) |
| Sana Qureshi | `sana@northstar.example` | [`sana-qureshi.jpg`](../apps/web/public/demo-avatars/sana-qureshi.jpg) |
| Bilal Ahmed | `bilal@pixelcraft.example` | [`bilal-ahmed.jpg`](../apps/web/public/demo-avatars/bilal-ahmed.jpg) |

The five JPEG portraits were AI-generated for this fictional demo dataset. They are stored in `apps/web/public/demo-avatars/` and referenced by each user's `profileImage` field as a same-origin `/demo-avatars/...` path.

## Company workspaces and people

Each row shows the workspace owner and one teammate with a `MARKETING_MANAGER` membership. The same five demo people are reused across companies so each login can demonstrate more than one workspace.

| Company workspace | Type | Owner | Teammate |
|---|---|---|---|
| Nexora Academy | Business | Haroon Jamal | Amina Shah |
| Urban Retail | Business | Amina Shah | Bilal Ahmed |
| Bright Digital Agency | Agency | Adil Agency | Sana Qureshi |
| Northstar Analytics | Business | Sana Qureshi | Haroon Jamal |
| PixelCraft Studio | Agency | Bilal Ahmed | Adil Agency |
| Cedar & Stone Interiors | Business | Haroon Jamal | Sana Qureshi |
| BluePeak Logistics | Business | Amina Shah | Adil Agency |
| Bloom & Bean Cafe | Business | Adil Agency | Bilal Ahmed |
| Harbor Health Clinic | Business | Sana Qureshi | Amina Shah |
| Sunline Solar | Business | Bilal Ahmed | Haroon Jamal |
| Juniper & Co. Retail | Business | Haroon Jamal | Adil Agency |
| Redwood Legal Partners | Business | Amina Shah | Sana Qureshi |
| CloudNine Travel | Business | Adil Agency | Haroon Jamal |
| Copperfield Manufacturing | Business | Sana Qureshi | Bilal Ahmed |
| Atlas Fitness Club | Business | Bilal Ahmed | Amina Shah |
| Meadowbrook Foods | Business | Haroon Jamal | Bilal Ahmed |
| Silverline Realty | Business | Amina Shah | Haroon Jamal |
| Prism Learning Hub | Business | Adil Agency | Amina Shah |
| Everwell Wellness | Business | Sana Qureshi | Adil Agency |
| Orchid Events | Business | Bilal Ahmed | Sana Qureshi |

The existing agency access from Bright Digital Agency to Urban Retail remains seeded as well. CRM leads, customers, tasks and campaign examples for the original demo workspaces continue to be created by the same seed script.

## Reset and seed

After configuring `apps/api/.env`, apply the Prisma migrations and seed the local database:

```sh
corepack pnpm --filter @marketflow/api db:generate
corepack pnpm --filter @marketflow/api db:migrate
corepack pnpm --filter @marketflow/api db:seed
```

The seed adds or updates these demo records; it does not delete unrelated users, workspaces or CRM records.
