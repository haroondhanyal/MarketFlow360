import { BadRequestException, Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, HttpException, Injectable, NotFoundException, Param, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { WorkspaceRole } from "@prisma/client";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { PrismaService } from "./prisma.service";
import { sendOrPrepareDemoMail } from "./mail";

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const COOKIE = "mf_session";
const READ_ONLY_ROLES = ["CONTENT_CREATOR", "APPROVER", "ANALYST", "CLIENT_VIEWER"];

export class RegisterDto {
  @IsString() @MinLength(2) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @MinLength(2) workspaceName!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(1_500_000) profileImage?: string;
}
export class ProfileDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(1_500_000) profileImage?: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(10) newPassword!: string;
}
export class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
export class CreateWorkspaceDto { @IsString() @MinLength(2) name!: string; @IsOptional() @IsString() type?: "BUSINESS" | "AGENCY"; }
export class AgencyClientDto { @IsEnum(WorkspaceRole) accessRole!: WorkspaceRole; }
export class WorkspaceRoleDto { @IsEnum(WorkspaceRole) role!: WorkspaceRole; }
export class InvitationDto { @IsEmail() email!: string; @IsEnum(WorkspaceRole) role!: WorkspaceRole; }
export class AcceptInvitationDto { @IsString() @MinLength(40) token!: string; }
export class ChallengeDto { @IsString() @MinLength(40) token!: string; }
export class PasswordResetDto { @IsString() @MinLength(40) token!: string; @IsString() @MinLength(10) password!: string; }
export class ResetRequestDto { @IsEmail() email!: string; }

export interface SignedRequest extends Request { authUser?: { id: string; name: string; email: string }; workspaceId?: string; workspaceRole?: string; }

async function listUserWorkspaces(db: PrismaService, userId: string) {
  const direct = await db.membership.findMany({ where: { userId }, include: { workspace: true } });
  const grants = await db.agencyClientAccess.findMany({ where: { agencyWorkspace: { type: "AGENCY", memberships: { some: { userId } } } }, include: { clientWorkspace: true, agencyWorkspace: { select: { memberships: { where: { userId }, select: { role: true } } } } } });
  const result = new Map<string, object>();
  direct.forEach(m => result.set(m.workspaceId, { ...m.workspace, role: m.role }));
  grants.forEach(g => { if (!result.has(g.clientWorkspaceId)) { const agencyRole = g.agencyWorkspace.memberships[0]?.role; const role = agencyRole && READ_ONLY_ROLES.includes(agencyRole) ? agencyRole : g.accessRole; result.set(g.clientWorkspaceId, { ...g.clientWorkspace, role, agencyAccess: true }); } });
  return [...result.values()];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<SignedRequest>();
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException("Please sign in.");
    const session = await this.db.session.findFirst({ where: { tokenHash: hash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session) throw new UnauthorizedException("Session expired. Please sign in again.");
    req.authUser = { id: session.user.id, name: session.user.name, email: session.user.email };
    return true;
  }
}

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<SignedRequest>();
    const workspaceId = req.header("x-workspace-id");
    if (!workspaceId || !req.authUser) throw new UnauthorizedException("Select a workspace.");
    const membership = await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: req.authUser.id, workspaceId } } });
    const grant = membership ? null : await this.db.agencyClientAccess.findFirst({ where: { clientWorkspaceId: workspaceId, agencyWorkspace: { type: "AGENCY", memberships: { some: { userId: req.authUser.id } } } }, include: { agencyWorkspace: { select: { memberships: { where: { userId: req.authUser.id }, select: { role: true } } } } } });
    if (!membership && !grant) throw new UnauthorizedException("Workspace access denied.");
    const agencyRole = grant?.agencyWorkspace.memberships[0]?.role;
    req.workspaceRole = membership?.role ?? (agencyRole && READ_ONLY_ROLES.includes(agencyRole) ? agencyRole : grant?.accessRole);
    const contentRoute = req.path.includes("/content");
    const contentRoleCanWrite = contentRoute && ((req.workspaceRole === "CONTENT_CREATOR" && ["POST", "PATCH"].includes(req.method)) || (req.workspaceRole === "APPROVER" && req.method === "PATCH"));
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && ["CONTENT_CREATOR", "APPROVER", "ANALYST", "CLIENT_VIEWER"].includes(req.workspaceRole ?? "") && !contentRoleCanWrite) {
      throw new ForbiddenException("Your workspace role is read-only for this action.");
    }
    req.workspaceId = workspaceId;
    return true;
  }
}

@Controller("auth")
export class AuthController {
  constructor(private db: PrismaService) {}

  private cookie(res: Response, token: string, maxAge: number) {
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  }

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email } })) throw new UnauthorizedException("An account with this email already exists.");
    const salt = randomBytes(16).toString("hex");
    const key = await scrypt(dto.password, salt, 64);
    const token = randomBytes(32).toString("hex");
    this.validateProfileImage(dto.profileImage);
    const user = await this.db.user.create({ data: { name: dto.name.trim(), email, phone: dto.phone?.trim() || null, profileImage: dto.profileImage ?? null, passwordHash: `${salt}:${key.toString("hex")}`, memberships: { create: { role: "OWNER", workspace: { create: { name: dto.workspaceName.trim() } } } } }, include: { memberships: { include: { workspace: true } } } });
    await this.db.authChallenge.create({ data: { userId: user.id, kind: "EMAIL_VERIFY", tokenHash: hash(token), expiresAt: new Date(Date.now() + 86400_000) } });
    const mail = await sendOrPrepareDemoMail({ to: email, subject: "Verify your MarketFlow360 account", intro: "Verify your email address to finish setting up your workspace.", url: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/verify?token=${token}` });
    return { user: { id: user.id, name: user.name, email: user.email }, workspaces: user.memberships.map(m => ({ ...m.workspace, role: m.role })), verificationUrl: mail.url, delivery: mail.delivery };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.trim().toLowerCase();
    const rateKey = `${email}:${req.ip}`;
    const keyHash = hash(rateKey);
    const now = new Date();
    const existing = await this.db.loginThrottle.findUnique({ where: { keyHash } });
    if (existing && existing.resetAt > now && existing.attempts >= 8) throw new HttpException("Too many sign-in attempts. Try again in 15 minutes.", 429);
    const fail = async () => {
      const windowEnd = new Date(Date.now() + 15 * 60_000);
      const rows = await this.db.$queryRaw<{ attempts: number }[]>`
        INSERT INTO "LoginThrottle" ("id", "keyHash", "attempts", "resetAt", "updatedAt")
        VALUES (${randomBytes(16).toString("hex")}, ${keyHash}, 1, ${windowEnd}, CURRENT_TIMESTAMP)
        ON CONFLICT ("keyHash") DO UPDATE SET
          "attempts" = CASE WHEN "LoginThrottle"."resetAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "LoginThrottle"."attempts" + 1 END,
          "resetAt" = CASE WHEN "LoginThrottle"."resetAt" <= CURRENT_TIMESTAMP THEN ${windowEnd} ELSE "LoginThrottle"."resetAt" END,
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "attempts"
      `;
      if (randomBytes(1)[0] === 0) await this.db.loginThrottle.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86400_000) } } });
      return rows[0]?.attempts ?? 1;
    };
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) { await fail(); throw new UnauthorizedException("Email or password is incorrect."); }
    if (!user.verifiedAt) throw new UnauthorizedException("Verify your email address before signing in.");
    const [salt, expectedHex] = user.passwordHash.split(":");
    const actual = await scrypt(dto.password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { await fail(); throw new UnauthorizedException("Email or password is incorrect."); }
    await this.db.loginThrottle.deleteMany({ where: { keyHash } });
    const token = randomBytes(32).toString("hex");
    await this.db.session.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    this.cookie(res, token, 7 * 86400_000);
    return { user: { id: user.id, name: user.name, email: user.email }, workspaces: await listUserWorkspaces(this.db, user.id) };
  }

  @Post("verify-email")
  async verifyEmail(@Body() dto: ChallengeDto, @Res({ passthrough: true }) res: Response) {
    const challenge = await this.db.authChallenge.findFirst({ where: { tokenHash: hash(dto.token), kind: "EMAIL_VERIFY", consumedAt: null, expiresAt: { gt: new Date() } } });
    if (!challenge) throw new UnauthorizedException("Verification link expired or already used.");
    const user = await this.db.user.update({ where: { id: challenge.userId }, data: { verifiedAt: new Date() }, include: { memberships: { include: { workspace: true } } } });
    await this.db.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    const token = randomBytes(32).toString("hex");
    await this.db.session.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    this.cookie(res, token, 7 * 86400_000);
    return { user: { id: user.id, name: user.name, email: user.email }, workspaces: user.memberships.map(m => ({ ...m.workspace, role: m.role })) };
  }

  @Post("password-reset/request")
  async requestPasswordReset(@Body() dto: ResetRequestDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user) return { ok: true, message: process.env.RESEND_API_KEY ? "If the account exists, check its email for a reset link." : "If the account exists, a reset link is ready in demo mode." };
    const token = randomBytes(32).toString("hex");
    await this.db.authChallenge.create({ data: { userId: user.id, kind: "PASSWORD_RESET", tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } });
    const mail = await sendOrPrepareDemoMail({ to: user.email, subject: "Reset your MarketFlow360 password", intro: "Use this one-time link to choose a new password.", url: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/reset-password?token=${token}` });
    return { ok: true, resetUrl: mail.url, message: process.env.RESEND_API_KEY ? "If the account exists, check its email for a reset link." : "If the account exists, a reset link is ready in demo mode." };
  }

  @Post("password-reset/confirm")
  async confirmPasswordReset(@Body() dto: PasswordResetDto) {
    const challenge = await this.db.authChallenge.findFirst({ where: { tokenHash: hash(dto.token), kind: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: new Date() } } });
    if (!challenge) throw new UnauthorizedException("Reset link expired or already used.");
    const salt = randomBytes(16).toString("hex");
    const key = await scrypt(dto.password, salt, 64);
    await this.db.$transaction([
      this.db.user.update({ where: { id: challenge.userId }, data: { passwordHash: `${salt}:${key.toString("hex")}` } }),
      this.db.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
      this.db.session.updateMany({ where: { userId: challenge.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (token) await this.db.session.updateMany({ where: { tokenHash: hash(token), revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() req: SignedRequest) {
    const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.authUser!.id }, select: { id: true, name: true, email: true, phone: true, profileImage: true } });
    return { user, workspaces: await listUserWorkspaces(this.db, req.authUser!.id), platformAdmin: admins.includes(req.authUser!.email.toLowerCase()) };
  }

  @Patch("profile")
  @UseGuards(AuthGuard)
  async updateProfile(@Body() dto: ProfileDto, @Req() req: SignedRequest) {
    this.validateProfileImage(dto.profileImage);
    return this.db.user.update({ where: { id: req.authUser!.id }, data: { name: dto.name.trim(), phone: dto.phone?.trim() || null, profileImage: dto.profileImage ?? null }, select: { id: true, name: true, email: true, phone: true, profileImage: true } });
  }

  @Patch("password")
  @UseGuards(AuthGuard)
  async updatePassword(@Body() dto: ChangePasswordDto, @Req() req: SignedRequest) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.authUser!.id } });
    const [salt, expectedHex] = user.passwordHash.split(":");
    const actual = await scrypt(dto.currentPassword, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException("Current password is incorrect.");
    const nextSalt = randomBytes(16).toString("hex");
    const nextKey = await scrypt(dto.newPassword, nextSalt, 64);
    const currentToken = req.cookies?.[COOKIE] as string | undefined;
    await this.db.$transaction([
      this.db.user.update({ where: { id: user.id }, data: { passwordHash: `${nextSalt}:${nextKey.toString("hex")}` } }),
      this.db.session.updateMany({ where: { userId: user.id, revokedAt: null, ...(currentToken ? { tokenHash: { not: hash(currentToken) } } : {}) }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  private validateProfileImage(value?: string) {
    if (value && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) || value.length > 1_500_000)) throw new BadRequestException("Use a PNG, JPEG or WebP profile image under 1 MB.");
  }
}

@Controller("workspaces")
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Req() req: SignedRequest) {
    return listUserWorkspaces(this.db, req.authUser!.id);
  }
  @Post() async create(@Body() dto: CreateWorkspaceDto, @Req() req: SignedRequest) {
    return this.db.workspace.create({ data: { name: dto.name.trim(), type: dto.type ?? "BUSINESS", memberships: { create: { userId: req.authUser!.id, role: "OWNER" } } } });
  }
  @Get(":id/clients") async clientWorkspaces(@Param("id") id: string, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    const agency = await this.db.workspace.findUnique({ where: { id } });
    if (agency?.type !== "AGENCY") throw new ForbiddenException("Client grants can only be managed from an agency workspace.");
    return this.db.agencyClientAccess.findMany({ where: { agencyWorkspaceId: id }, include: { clientWorkspace: true } });
  }
  @Post(":id/clients/:clientId") async grantClient(@Param("id") id: string, @Param("clientId") clientId: string, @Body() dto: AgencyClientDto, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    if (id === clientId) throw new ForbiddenException("An agency cannot grant access to itself.");
    const agency = await this.db.workspace.findUnique({ where: { id } });
    const client = await this.db.workspace.findUnique({ where: { id: clientId } });
    const clientOwner = await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: req.authUser!.id, workspaceId: clientId } } });
    if (agency?.type !== "AGENCY" || !client || !clientOwner || !["OWNER", "ADMIN"].includes(clientOwner.role)) throw new ForbiddenException("An agency admin and a client workspace owner/admin must both authorize access.");
    return this.db.agencyClientAccess.upsert({ where: { agencyWorkspaceId_clientWorkspaceId: { agencyWorkspaceId: id, clientWorkspaceId: clientId } }, update: { accessRole: dto.accessRole, grantedById: req.authUser!.id }, create: { agencyWorkspaceId: id, clientWorkspaceId: clientId, grantedById: req.authUser!.id, accessRole: dto.accessRole } });
  }
  @Delete(":id/clients/:clientId") async revokeClient(@Param("id") id: string, @Param("clientId") clientId: string, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    const clientOwner = await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: req.authUser!.id, workspaceId: clientId } } });
    if (!clientOwner || !["OWNER", "ADMIN"].includes(clientOwner.role)) throw new ForbiddenException("A client workspace owner/admin must authorize access changes.");
    const grant = await this.db.agencyClientAccess.findUnique({ where: { agencyWorkspaceId_clientWorkspaceId: { agencyWorkspaceId: id, clientWorkspaceId: clientId } } });
    if (!grant) throw new NotFoundException("Client grant not found.");
    await this.db.agencyClientAccess.delete({ where: { id: grant.id } });
    return { ok: true };
  }
  @Get(":id/members") async members(@Param("id") id: string, @Req() req: SignedRequest) {
    const workspaceId = req.header("x-workspace-id");
    if (!workspaceId || workspaceId !== id) throw new UnauthorizedException("Select this workspace before viewing its members.");
    const isMember = await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: req.authUser!.id, workspaceId } } });
    if (!isMember) throw new UnauthorizedException("Workspace access denied.");
    return this.db.membership.findMany({ where: { workspaceId }, include: { user: { select: { id: true, name: true, email: true } } } });
  }
  @Patch(":id/members/:memberId") async updateMember(@Param("id") id: string, @Param("memberId") memberId: string, @Body() dto: WorkspaceRoleDto, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    const member = await this.db.membership.findFirst({ where: { id: memberId, workspaceId: id } });
    if (!member || member.role === "OWNER" || dto.role === "OWNER") throw new NotFoundException("Member or role not found.");
    return this.db.membership.update({ where: { id: memberId }, data: { role: dto.role } });
  }
  @Delete(":id/members/:memberId") async removeMember(@Param("id") id: string, @Param("memberId") memberId: string, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    const member = await this.db.membership.findFirst({ where: { id: memberId, workspaceId: id } });
    if (!member || member.role === "OWNER") throw new NotFoundException("Member not found.");
    await this.db.membership.delete({ where: { id: memberId } });
    return { ok: true };
  }
  @Get(":id/invitations") async invitations(@Param("id") id: string, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    return this.db.invitation.findMany({ where: { workspaceId: id, acceptedAt: null }, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  }
  @Post(":id/invitations") async invite(@Param("id") id: string, @Body() dto: InvitationDto, @Req() req: SignedRequest) {
    await this.requireManager(id, req);
    if (dto.role === "OWNER") throw new ForbiddenException("Workspace ownership cannot be assigned by invitation.");
    const email = dto.email.trim().toLowerCase();
    const alreadyMember = await this.db.membership.findFirst({ where: { workspaceId: id, user: { email } } });
    if (alreadyMember) throw new ForbiddenException("This person is already a workspace member.");
    const token = randomBytes(32).toString("hex");
    const invitation = await this.db.invitation.create({ data: { workspaceId: id, invitedById: req.authUser!.id, email, role: dto.role, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    const mail = await sendOrPrepareDemoMail({ to: email, subject: "You are invited to MarketFlow360", intro: "You have been invited to join a MarketFlow360 workspace.", url: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/invite?token=${token}` });
    return { id: invitation.id, email, role: dto.role, expiresAt: invitation.expiresAt, acceptUrl: mail.url, delivery: mail.delivery };
  }
  private async requireManager(id: string, req: SignedRequest) {
    const workspaceId = req.header("x-workspace-id");
    if (!workspaceId || workspaceId !== id) throw new UnauthorizedException("Select this workspace first.");
    const membership = await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: req.authUser!.id, workspaceId } } });
    if (!membership) throw new UnauthorizedException("Workspace access denied.");
    if (!["OWNER", "ADMIN"].includes(membership.role)) throw new ForbiddenException("Only workspace owners and admins can manage members.");
  }
}

@Controller("invitations")
@UseGuards(AuthGuard)
export class InvitationAcceptanceController {
  constructor(private db: PrismaService) {}
  @Post("accept") async accept(@Body() dto: AcceptInvitationDto, @Req() req: SignedRequest) {
    const invitation = await this.db.invitation.findFirst({ where: { tokenHash: hash(dto.token), acceptedAt: null, expiresAt: { gt: new Date() } } });
    if (!invitation) throw new NotFoundException("Invitation expired or already used.");
    if (invitation.email !== req.authUser!.email) throw new ForbiddenException("Sign in using the email address that received this invitation.");
    await this.db.$transaction([
      this.db.membership.upsert({ where: { userId_workspaceId: { userId: req.authUser!.id, workspaceId: invitation.workspaceId } }, update: { role: invitation.role }, create: { userId: req.authUser!.id, workspaceId: invitation.workspaceId, role: invitation.role } }),
      this.db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    return this.db.workspace.findUnique({ where: { id: invitation.workspaceId } });
  }
}
