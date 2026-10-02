ALTER TABLE "Task" ADD COLUMN "assignedToId" TEXT;
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PipelineStage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" "LeadStatus" NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PipelineStage_workspaceId_key_key" ON "PipelineStage"("workspaceId", "key");
CREATE INDEX "PipelineStage_workspaceId_position_idx" ON "PipelineStage"("workspaceId", "position");
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaskReminder" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "remindAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskReminder_taskId_key" ON "TaskReminder"("taskId");
CREATE INDEX "TaskReminder_sentAt_remindAt_idx" ON "TaskReminder"("sentAt", "remindAt");
ALTER TABLE "TaskReminder" ADD CONSTRAINT "TaskReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskReminder" ADD CONSTRAINT "TaskReminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Attachment_workspaceId_recordType_recordId_createdAt_idx" ON "Attachment"("workspaceId", "recordType", "recordId", "createdAt");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
