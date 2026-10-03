import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo accounts in production.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point to a local development database before seeding demo data.");
  const databaseHost = new URL(process.env.DATABASE_URL).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
    throw new Error(`Refusing to seed demo data into non-local database host: ${databaseHost || "<empty>"}.`);
  }
  const password = await passwordHash("MarketFlow2026!");
  const owner = await prisma.user.upsert({ where: { email: "owner@nexora.example" }, update: { profileImage: "/demo-avatars/haroon-jamal.jpg" }, create: { name: "Haroon Jamal", email: "owner@nexora.example", passwordHash: password, profileImage: "/demo-avatars/haroon-jamal.jpg", verifiedAt: new Date() } });
  const academy = await prisma.workspace.upsert({ where: { id: "demo-nexora-academy" }, update: {}, create: { id: "demo-nexora-academy", name: "Nexora Academy", type: "BUSINESS" } });
  await prisma.membership.upsert({ where: { userId_workspaceId: { userId: owner.id, workspaceId: academy.id } }, update: { role: "OWNER" }, create: { userId: owner.id, workspaceId: academy.id, role: "OWNER" } });

  const retailOwner = await prisma.user.upsert({ where: { email: "owner@urbanretail.example" }, update: { profileImage: "/demo-avatars/amina-shah.jpg" }, create: { name: "Amina Shah", email: "owner@urbanretail.example", passwordHash: password, profileImage: "/demo-avatars/amina-shah.jpg", verifiedAt: new Date() } });
  const retail = await prisma.workspace.upsert({ where: { id: "demo-urban-retail" }, update: {}, create: { id: "demo-urban-retail", name: "Urban Retail", type: "BUSINESS" } });
  await prisma.membership.upsert({ where: { userId_workspaceId: { userId: retailOwner.id, workspaceId: retail.id } }, update: { role: "OWNER" }, create: { userId: retailOwner.id, workspaceId: retail.id, role: "OWNER" } });

  const agencyOwner = await prisma.user.upsert({ where: { email: "owner@brightagency.example" }, update: { profileImage: "/demo-avatars/adil-agency.jpg" }, create: { name: "Adil Agency", email: "owner@brightagency.example", passwordHash: password, profileImage: "/demo-avatars/adil-agency.jpg", verifiedAt: new Date() } });
  const agency = await prisma.workspace.upsert({ where: { id: "demo-bright-agency" }, update: {}, create: { id: "demo-bright-agency", name: "Bright Digital Agency", type: "AGENCY" } });
  await prisma.membership.upsert({ where: { userId_workspaceId: { userId: agencyOwner.id, workspaceId: agency.id } }, update: { role: "OWNER" }, create: { userId: agencyOwner.id, workspaceId: agency.id, role: "OWNER" } });
  await prisma.agencyClientAccess.upsert({ where: { agencyWorkspaceId_clientWorkspaceId: { agencyWorkspaceId: agency.id, clientWorkspaceId: retail.id } }, update: { accessRole: "SALES_AGENT" }, create: { agencyWorkspaceId: agency.id, clientWorkspaceId: retail.id, grantedById: agencyOwner.id, accessRole: "SALES_AGENT" } });

  const sanaUser = await prisma.user.upsert({ where: { email: "sana@northstar.example" }, update: { profileImage: "/demo-avatars/sana-qureshi.jpg" }, create: { name: "Sana Qureshi", email: "sana@northstar.example", passwordHash: password, profileImage: "/demo-avatars/sana-qureshi.jpg", verifiedAt: new Date() } });
  const bilalUser = await prisma.user.upsert({ where: { email: "bilal@pixelcraft.example" }, update: { profileImage: "/demo-avatars/bilal-ahmed.jpg" }, create: { name: "Bilal Ahmed", email: "bilal@pixelcraft.example", passwordHash: password, profileImage: "/demo-avatars/bilal-ahmed.jpg", verifiedAt: new Date() } });
  const demoUsers = new Map([
    [owner.email, owner],
    [retailOwner.email, retailOwner],
    [agencyOwner.email, agencyOwner],
    [sanaUser.email, sanaUser],
    [bilalUser.email, bilalUser],
  ]);
  const demoWorkspaces: Array<{ id: string; name: string; type: "BUSINESS" | "AGENCY"; ownerEmail: string; teammateEmail: string }> = [
    { id: academy.id, name: "Nexora Academy", type: "BUSINESS", ownerEmail: owner.email, teammateEmail: retailOwner.email },
    { id: retail.id, name: "Urban Retail", type: "BUSINESS", ownerEmail: retailOwner.email, teammateEmail: bilalUser.email },
    { id: agency.id, name: "Bright Digital Agency", type: "AGENCY", ownerEmail: agencyOwner.email, teammateEmail: sanaUser.email },
    { id: "demo-northstar-analytics", name: "Northstar Analytics", type: "BUSINESS", ownerEmail: sanaUser.email, teammateEmail: owner.email },
    { id: "demo-pixelcraft-studio", name: "PixelCraft Studio", type: "AGENCY", ownerEmail: bilalUser.email, teammateEmail: agencyOwner.email },
    { id: "demo-cedar-stone-interiors", name: "Cedar & Stone Interiors", type: "BUSINESS", ownerEmail: owner.email, teammateEmail: sanaUser.email },
    { id: "demo-bluepeak-logistics", name: "BluePeak Logistics", type: "BUSINESS", ownerEmail: retailOwner.email, teammateEmail: agencyOwner.email },
    { id: "demo-bloom-bean-cafe", name: "Bloom & Bean Cafe", type: "BUSINESS", ownerEmail: agencyOwner.email, teammateEmail: bilalUser.email },
    { id: "demo-harbor-health-clinic", name: "Harbor Health Clinic", type: "BUSINESS", ownerEmail: sanaUser.email, teammateEmail: retailOwner.email },
    { id: "demo-sunline-solar", name: "Sunline Solar", type: "BUSINESS", ownerEmail: bilalUser.email, teammateEmail: owner.email },
    { id: "demo-juniper-retail", name: "Juniper & Co. Retail", type: "BUSINESS", ownerEmail: owner.email, teammateEmail: agencyOwner.email },
    { id: "demo-redwood-legal", name: "Redwood Legal Partners", type: "BUSINESS", ownerEmail: retailOwner.email, teammateEmail: sanaUser.email },
    { id: "demo-cloudnine-travel", name: "CloudNine Travel", type: "BUSINESS", ownerEmail: agencyOwner.email, teammateEmail: owner.email },
    { id: "demo-copperfield-manufacturing", name: "Copperfield Manufacturing", type: "BUSINESS", ownerEmail: sanaUser.email, teammateEmail: bilalUser.email },
    { id: "demo-atlas-fitness", name: "Atlas Fitness Club", type: "BUSINESS", ownerEmail: bilalUser.email, teammateEmail: retailOwner.email },
    { id: "demo-meadowbrook-foods", name: "Meadowbrook Foods", type: "BUSINESS", ownerEmail: owner.email, teammateEmail: bilalUser.email },
    { id: "demo-silverline-realty", name: "Silverline Realty", type: "BUSINESS", ownerEmail: retailOwner.email, teammateEmail: owner.email },
    { id: "demo-prism-learning", name: "Prism Learning Hub", type: "BUSINESS", ownerEmail: agencyOwner.email, teammateEmail: retailOwner.email },
    { id: "demo-everwell-wellness", name: "Everwell Wellness", type: "BUSINESS", ownerEmail: sanaUser.email, teammateEmail: agencyOwner.email },
    { id: "demo-orchid-events", name: "Orchid Events", type: "BUSINESS", ownerEmail: bilalUser.email, teammateEmail: sanaUser.email },
  ];
  for (const company of demoWorkspaces) {
    const workspace = await prisma.workspace.upsert({ where: { id: company.id }, update: { name: company.name, type: company.type }, create: { id: company.id, name: company.name, type: company.type } });
    const primary = demoUsers.get(company.ownerEmail)!;
    const teammate = demoUsers.get(company.teammateEmail)!;
    await prisma.membership.upsert({ where: { userId_workspaceId: { userId: primary.id, workspaceId: workspace.id } }, update: { role: "OWNER" }, create: { userId: primary.id, workspaceId: workspace.id, role: "OWNER" } });
    await prisma.membership.upsert({ where: { userId_workspaceId: { userId: teammate.id, workspaceId: workspace.id } }, update: { role: "MARKETING_MANAGER" }, create: { userId: teammate.id, workspaceId: workspace.id, role: "MARKETING_MANAGER" } });
  }

  const leads = [
    { name: "Ayesha Khan", email: "ayesha@example.test", interest: "Digital Marketing", source: "WEBSITE" as const, status: "NEW" as const },
    { name: "Raza Ali", email: "raza@example.test", interest: "Graphic Design", source: "FACEBOOK" as const, status: "CONTACTED" as const },
    { name: "Sana Bilal", email: "sana@example.test", interest: "Web Development", source: "REFERRAL" as const, status: "INTERESTED" as const },
    { name: "Hassan Noor", email: "hassan@example.test", interest: "UI/UX Design", source: "INSTAGRAM" as const, status: "PROPOSAL_PENDING" as const },
  ];
  for (const lead of leads) {
    const record = await prisma.lead.upsert({ where: { id: `demo-${lead.email.split("@")[0]}` }, update: {}, create: { id: `demo-${lead.email.split("@")[0]}`, workspaceId: academy.id, ...lead } });
    await prisma.task.upsert({ where: { id: `task-${record.id}` }, update: {}, create: { id: `task-${record.id}`, workspaceId: academy.id, leadId: record.id, title: `Follow up with ${record.name}`, dueAt: new Date(Date.now() + 86400000) } });
  }
  const campaign = await prisma.campaign.upsert({ where: { id: "demo-summer-campaign" }, update: {}, create: { id: "demo-summer-campaign", workspaceId: academy.id, name: "Fall Admissions", description: "Generate course enquiries for the next intake.", channel: "FACEBOOK", status: "ACTIVE", budgetMinor: 5000000, goal: "Course admissions", startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 86400000) } });
  await prisma.contentItem.upsert({ where: { id: "demo-admissions-post" }, update: {}, create: { id: "demo-admissions-post", workspaceId: academy.id, campaignId: campaign.id, title: "Fall admissions announcement", body: "Applications are open for our upcoming courses. Talk to our team to find the right program.", channel: "FACEBOOK", status: "IN_REVIEW", publishAt: new Date(Date.now() + 2 * 86400000) } });
  await prisma.landingPage.upsert({ where: { slug: "fall-admissions" }, update: {}, create: { workspaceId: academy.id, slug: "fall-admissions", title: "Fall Admissions", headline: "Build your next skill with Nexora Academy", description: "Leave your details and our admissions team will contact you.", buttonText: "Request course details", interest: "Fall course admissions", isPublished: true } });
  await prisma.automation.upsert({ where: { id: "demo-lead-followup" }, update: {}, create: { id: "demo-lead-followup", workspaceId: academy.id, name: "New enquiry follow-up", trigger: "NEW_LEAD", action: "CREATE_TASK", actionValue: "Contact new enquiry", isActive: true } });
  const customer = await prisma.customer.upsert({ where: { id: "demo-retail-customer" }, update: {}, create: { id: "demo-retail-customer", workspaceId: retail.id, name: "Noor Home Store", company: "Noor Home", email: "hello@noorhome.example" } });
  await prisma.deal.upsert({ where: { id: "demo-retail-deal" }, update: {}, create: { id: "demo-retail-deal", workspaceId: retail.id, customerId: customer.id, title: "Seasonal campaign", amountMinor: 8500000, currency: "PKR", stage: "OPEN" } });
  console.log(`Demo data is ready: ${demoUsers.size} users, ${demoWorkspaces.length} workspaces, ${demoWorkspaces.length * 2} memberships.`);
  console.log("Local demo password for all five accounts: MarketFlow2026!");
}

main().finally(() => prisma.$disconnect());
