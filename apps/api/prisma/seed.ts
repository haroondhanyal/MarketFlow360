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
  const password = await passwordHash("MarketFlow2026!");
  const owner = await prisma.user.upsert({ where: { email: "owner@nexora.example" }, update: {}, create: { name: "Haroon Jamal", email: "owner@nexora.example", passwordHash: password, verifiedAt: new Date() } });
  const academy = await prisma.workspace.upsert({ where: { id: "demo-nexora-academy" }, update: {}, create: { id: "demo-nexora-academy", name: "Nexora Academy", type: "BUSINESS" } });
  await prisma.membership.upsert({ where: { userId_workspaceId: { userId: owner.id, workspaceId: academy.id } }, update: { role: "OWNER" }, create: { userId: owner.id, workspaceId: academy.id, role: "OWNER" } });

  const retailOwner = await prisma.user.upsert({ where: { email: "owner@urbanretail.example" }, update: {}, create: { name: "Amina Shah", email: "owner@urbanretail.example", passwordHash: password, verifiedAt: new Date() } });
  const retail = await prisma.workspace.upsert({ where: { id: "demo-urban-retail" }, update: {}, create: { id: "demo-urban-retail", name: "Urban Retail", type: "BUSINESS" } });
  await prisma.membership.upsert({ where: { userId_workspaceId: { userId: retailOwner.id, workspaceId: retail.id } }, update: { role: "OWNER" }, create: { userId: retailOwner.id, workspaceId: retail.id, role: "OWNER" } });

  const agencyOwner = await prisma.user.upsert({ where: { email: "owner@brightagency.example" }, update: {}, create: { name: "Adil Agency", email: "owner@brightagency.example", passwordHash: password, verifiedAt: new Date() } });
  const agency = await prisma.workspace.upsert({ where: { id: "demo-bright-agency" }, update: {}, create: { id: "demo-bright-agency", name: "Bright Digital Agency", type: "AGENCY" } });
  await prisma.membership.upsert({ where: { userId_workspaceId: { userId: agencyOwner.id, workspaceId: agency.id } }, update: { role: "OWNER" }, create: { userId: agencyOwner.id, workspaceId: agency.id, role: "OWNER" } });
  await prisma.agencyClientAccess.upsert({ where: { agencyWorkspaceId_clientWorkspaceId: { agencyWorkspaceId: agency.id, clientWorkspaceId: retail.id } }, update: { accessRole: "SALES_AGENT" }, create: { agencyWorkspaceId: agency.id, clientWorkspaceId: retail.id, grantedById: agencyOwner.id, accessRole: "SALES_AGENT" } });

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
  console.log("Demo workspaces and CRM records are ready.");
  console.log("Academy login: owner@nexora.example / MarketFlow2026!");
  console.log("Retail login: owner@urbanretail.example / MarketFlow2026!");
  console.log("Agency login: owner@brightagency.example / MarketFlow2026!");
}

main().finally(() => prisma.$disconnect());
