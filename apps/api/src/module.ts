import { Controller, Get, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthController, AuthGuard, InvitationAcceptanceController, WorkspaceController, WorkspaceGuard } from "./auth";
import { CustomersController, DealsController, LeadsController, TasksController } from "./crm";
import { PrismaService } from "./prisma.service";
import { DashboardController } from "./dashboard";
import { AutomationsController, CampaignsController, ContentController, LandingPagesController, PublicLandingController } from "./features/marketing.controller";
import { AttachmentsController, PipelineController } from "./features/workspace-tools.controller";
import { TaskReminderWorker } from "./task-reminder.worker";
import { AutomationWorker } from "./automation.worker";
import { ReportsController } from "./features/reports.controller";
import { AssistantController, AuditController, IntegrationsController, PlatformAdminController, PlansController, WebhookController } from "./features/phases-9-12.controller";
import { AuditInterceptor } from "./audit.interceptor";

@Global()
@Module({ providers: [PrismaService, AuthGuard, WorkspaceGuard], exports: [PrismaService, AuthGuard, WorkspaceGuard] })
class DatabaseModule {}

@Controller("health")
class HealthController {
  @Get() health() { return { status: "ok", service: "marketflow-api", timestamp: new Date().toISOString() }; }
  constructor(private db: PrismaService) {}
  @Get("ready") async ready() { await this.db.$queryRaw`SELECT 1`; return { status: "ready", database: "ok" }; }
}

@Module({ imports: [DatabaseModule], controllers: [HealthController, AuthController, WorkspaceController, InvitationAcceptanceController, LeadsController, CustomersController, DealsController, TasksController, DashboardController, CampaignsController, ContentController, LandingPagesController, AutomationsController, PublicLandingController, PipelineController, AttachmentsController, ReportsController, IntegrationsController, WebhookController, AssistantController, PlansController, AuditController, PlatformAdminController], providers: [TaskReminderWorker, AutomationWorker, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }] })
export class AppModule {}
