-- CreateTable
CREATE TABLE "lead_search" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "keywords" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "queries" JSONB,
    "failedQueries" INTEGER NOT NULL DEFAULT 0,
    "rejectedCandidates" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "attemptToken" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "lead_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_source" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "queries" TEXT[],
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_candidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "quote" TEXT NOT NULL,
    "matchedCriteria" TEXT[],
    "missingCriteria" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "prospectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_search_organizationId_createdAt_idx" ON "lead_search"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_search_createdById_idx" ON "lead_search"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "lead_search_id_organizationId_key" ON "lead_search"("id", "organizationId");

-- CreateIndex
CREATE INDEX "lead_source_organizationId_idx" ON "lead_source"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_id_searchId_organizationId_key" ON "lead_source"("id", "searchId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_searchId_organizationId_url_key" ON "lead_source"("searchId", "organizationId", "url");

-- CreateIndex
CREATE INDEX "lead_candidate_organizationId_status_createdAt_idx" ON "lead_candidate"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "lead_candidate_sourceId_searchId_organizationId_idx" ON "lead_candidate"("sourceId", "searchId", "organizationId");

-- CreateIndex
CREATE INDEX "lead_candidate_prospectId_organizationId_idx" ON "lead_candidate"("prospectId", "organizationId");

-- CreateIndex
CREATE INDEX "lead_candidate_reviewedById_idx" ON "lead_candidate"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "lead_candidate_id_organizationId_key" ON "lead_candidate"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_candidate_searchId_identityKey_key" ON "lead_candidate"("searchId", "identityKey");

-- AddForeignKey
ALTER TABLE "lead_search" ADD CONSTRAINT "lead_search_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_search" ADD CONSTRAINT "lead_search_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_source" ADD CONSTRAINT "lead_source_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_source" ADD CONSTRAINT "lead_source_searchId_organizationId_fkey" FOREIGN KEY ("searchId", "organizationId") REFERENCES "lead_search"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_candidate" ADD CONSTRAINT "lead_candidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_candidate" ADD CONSTRAINT "lead_candidate_searchId_organizationId_fkey" FOREIGN KEY ("searchId", "organizationId") REFERENCES "lead_search"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_candidate" ADD CONSTRAINT "lead_candidate_sourceId_searchId_organizationId_fkey" FOREIGN KEY ("sourceId", "searchId", "organizationId") REFERENCES "lead_source"("id", "searchId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_candidate" ADD CONSTRAINT "lead_candidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_candidate" ADD CONSTRAINT "lead_candidate_prospectId_organizationId_fkey" FOREIGN KEY ("prospectId", "organizationId") REFERENCES "prospect"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE lead_search ADD CONSTRAINT lead_search_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'));
ALTER TABLE lead_candidate ADD CONSTRAINT lead_candidate_status_check CHECK (status IN ('new', 'qualified', 'dismissed', 'converted'));
ALTER TABLE lead_candidate ADD CONSTRAINT lead_candidate_conversion_check CHECK ((status = 'converted') = ("prospectId" IS NOT NULL));
