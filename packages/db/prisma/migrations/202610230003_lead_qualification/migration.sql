-- Existing candidates retain their original evidence and require review until re-searched.
ALTER TABLE "lead_candidate" ADD COLUMN "qualification" JSONB;
