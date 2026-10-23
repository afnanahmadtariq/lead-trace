-- AlterTable
ALTER TABLE "prospect" ADD COLUMN     "emailKey" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "lifecycle" TEXT NOT NULL DEFAULT 'lead',
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "crm_deal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expectedCloseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedTokens" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_meeting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "inviteContact" BOOLEAN NOT NULL DEFAULT false,
    "attendeeEmail" TEXT,
    "googleEventId" TEXT NOT NULL,
    "htmlLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_deal_organizationId_stage_updatedAt_idx" ON "crm_deal"("organizationId", "stage", "updatedAt");

-- CreateIndex
CREATE INDEX "crm_deal_prospectId_organizationId_idx" ON "crm_deal"("prospectId", "organizationId");

-- CreateIndex
CREATE INDEX "crm_deal_ownerId_idx" ON "crm_deal"("ownerId");

-- CreateIndex
CREATE INDEX "crm_note_prospectId_organizationId_createdAt_idx" ON "crm_note"("prospectId", "organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_note_organizationId_idx" ON "crm_note"("organizationId");

-- CreateIndex
CREATE INDEX "crm_note_authorId_idx" ON "crm_note"("authorId");

-- CreateIndex
CREATE INDEX "crm_task_organizationId_completedAt_dueAt_idx" ON "crm_task"("organizationId", "completedAt", "dueAt");

-- CreateIndex
CREATE INDEX "crm_task_prospectId_organizationId_idx" ON "crm_task"("prospectId", "organizationId");

-- CreateIndex
CREATE INDEX "crm_task_ownerId_idx" ON "crm_task"("ownerId");

-- CreateIndex
CREATE INDEX "calendar_connection_userId_idx" ON "calendar_connection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connection_organizationId_userId_key" ON "calendar_connection"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "calendar_meeting_prospectId_organizationId_startsAt_idx" ON "calendar_meeting"("prospectId", "organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "calendar_meeting_organizationId_organizerId_idx" ON "calendar_meeting"("organizationId", "organizerId");

-- CreateIndex
CREATE INDEX "prospect_ownerId_idx" ON "prospect"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_organizationId_emailKey_key" ON "prospect"("organizationId", "emailKey");

-- AddForeignKey
ALTER TABLE "prospect" ADD CONSTRAINT "prospect_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal" ADD CONSTRAINT "crm_deal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal" ADD CONSTRAINT "crm_deal_prospectId_organizationId_fkey" FOREIGN KEY ("prospectId", "organizationId") REFERENCES "prospect"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal" ADD CONSTRAINT "crm_deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_note" ADD CONSTRAINT "crm_note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_note" ADD CONSTRAINT "crm_note_prospectId_organizationId_fkey" FOREIGN KEY ("prospectId", "organizationId") REFERENCES "prospect"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_note" ADD CONSTRAINT "crm_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_prospectId_organizationId_fkey" FOREIGN KEY ("prospectId", "organizationId") REFERENCES "prospect"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_meeting" ADD CONSTRAINT "calendar_meeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_meeting" ADD CONSTRAINT "calendar_meeting_prospectId_organizationId_fkey" FOREIGN KEY ("prospectId", "organizationId") REFERENCES "prospect"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Assign one canonical email identity per workspace without deleting or merging
-- historical research prospects. Duplicate historical contacts keep their IDs.
WITH ranked AS (
  SELECT id, lower(trim(email)) AS key,
    row_number() OVER (PARTITION BY "organizationId", lower(trim(email)) ORDER BY "createdAt", id) AS position
  FROM prospect WHERE email IS NOT NULL AND trim(email) <> ''
)
UPDATE prospect SET "emailKey" = ranked.key FROM ranked
WHERE prospect.id = ranked.id AND ranked.position = 1;

UPDATE prospect SET "ownerId" = "createdById"
WHERE "createdById" IS NOT NULL AND EXISTS (
  SELECT 1 FROM member WHERE member."organizationId" = prospect."organizationId" AND member."userId" = prospect."createdById"
);

ALTER TABLE crm_deal ADD CONSTRAINT crm_deal_stage_check CHECK (stage IN ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'));
ALTER TABLE crm_deal ADD CONSTRAINT crm_deal_value_check CHECK (value >= 0);
ALTER TABLE crm_deal ADD CONSTRAINT crm_deal_currency_check CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE prospect ADD CONSTRAINT prospect_lifecycle_check CHECK (lifecycle IN ('lead', 'qualified', 'customer', 'inactive'));
ALTER TABLE calendar_meeting ADD CONSTRAINT calendar_meeting_time_check CHECK ("endsAt" > "startsAt");
ALTER TABLE calendar_meeting ADD CONSTRAINT calendar_meeting_status_check CHECK (status IN ('pending', 'synced'));

-- Credentials cannot outlive the member's workspace access.
ALTER TABLE calendar_connection ADD CONSTRAINT calendar_connection_membership_fkey FOREIGN KEY ("organizationId", "userId") REFERENCES member("organizationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
