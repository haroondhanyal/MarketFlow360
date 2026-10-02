-- CreateTable
CREATE TABLE "public"."AgencyClientAccess" (
    "id" TEXT NOT NULL,
    "agencyWorkspaceId" TEXT NOT NULL,
    "clientWorkspaceId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "accessRole" "public"."WorkspaceRole" NOT NULL DEFAULT 'CLIENT_VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyClientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyClientAccess_clientWorkspaceId_idx" ON "public"."AgencyClientAccess"("clientWorkspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyClientAccess_agencyWorkspaceId_clientWorkspaceId_key" ON "public"."AgencyClientAccess"("agencyWorkspaceId", "clientWorkspaceId");

-- AddForeignKey
ALTER TABLE "public"."AgencyClientAccess" ADD CONSTRAINT "AgencyClientAccess_agencyWorkspaceId_fkey" FOREIGN KEY ("agencyWorkspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgencyClientAccess" ADD CONSTRAINT "AgencyClientAccess_clientWorkspaceId_fkey" FOREIGN KEY ("clientWorkspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgencyClientAccess" ADD CONSTRAINT "AgencyClientAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
