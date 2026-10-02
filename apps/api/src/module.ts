import { Controller, Get, Global, Module } from "@nestjs/common";
import { AuthController, AuthGuard, InvitationAcceptanceController, WorkspaceController, WorkspaceGuard } from "./auth";
import { CustomersController, DealsController, LeadsController, TasksController } from "./crm";
import { PrismaService } from "./prisma.service";
import { DashboardController } from "./dashboard";
import { AutomationsController, CampaignsController, ContentController, LandingPagesController, PublicLandingController } from "./features/marketing.controller";

@Global()
@Module({ providers: [PrismaService, AuthGuard, WorkspaceGuard], exports: [PrismaService, AuthGuard, WorkspaceGuard] })
class DatabaseModule {}

@Controller("health")
class HealthController {
  @Get() health() { return { status: "ok", service: "marketflow-api", timestamp: new Date().toISOString() }; }
}

@Module({ imports: [DatabaseModule], controllers: [HealthController, AuthController, WorkspaceController, InvitationAcceptanceController, LeadsController, CustomersController, DealsController, TasksController, DashboardController, CampaignsController, ContentController, LandingPagesController, AutomationsController, PublicLandingController] })
export class AppModule {}
