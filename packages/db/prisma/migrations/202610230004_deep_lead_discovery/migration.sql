-- Preserve the meaning of already saved searches; new searches use deeper discovery.
ALTER TABLE "lead_search" ADD COLUMN "depth" TEXT NOT NULL DEFAULT 'quick';
ALTER TABLE "lead_search" ALTER COLUMN "depth" SET DEFAULT 'deep';
ALTER TABLE "lead_search" ADD COLUMN "roleMatch" TEXT NOT NULL DEFAULT 'exact';
ALTER TABLE "lead_search" ALTER COLUMN "roleMatch" SET DEFAULT 'function';
ALTER TABLE "lead_search" ADD COLUMN "phase" TEXT;
ALTER TABLE "lead_search" ADD COLUMN "progress" JSONB;
ALTER TABLE "lead_search" ADD COLUMN "diagnostics" JSONB;
ALTER TABLE "lead_search" ADD COLUMN "companySnapshots" JSONB;
ALTER TABLE "lead_source" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'tavily';
ALTER TABLE "lead_source" ADD COLUMN "sourceKind" TEXT NOT NULL DEFAULT 'search';
ALTER TABLE "lead_search" ADD CONSTRAINT "lead_search_depth_check" CHECK ("depth" IN ('quick', 'deep'));
ALTER TABLE "lead_search" ADD CONSTRAINT "lead_search_role_match_check" CHECK ("roleMatch" IN ('exact', 'function'));
