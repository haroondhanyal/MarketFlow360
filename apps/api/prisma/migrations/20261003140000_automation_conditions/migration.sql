ALTER TABLE "Automation" ADD COLUMN "conditionField" TEXT,
ADD COLUMN "conditionValue" TEXT,
ADD COLUMN "delayMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AutomationRun" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DONE',
ADD COLUMN "scheduledAt" TIMESTAMP(3),
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastError" TEXT;
CREATE INDEX "AutomationRun_status_scheduledAt_claimedAt_idx" ON "AutomationRun"("status", "scheduledAt", "claimedAt");
