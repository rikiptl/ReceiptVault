-- AddColumn: reimbursable flag for expense reporting
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "reimbursable" BOOLEAN NOT NULL DEFAULT false;
