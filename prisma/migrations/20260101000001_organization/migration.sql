-- AddColumn: tags, isRecurring, recurringInterval, warrantyExpiry
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "recurringInterval" TEXT;
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "warrantyExpiry" TIMESTAMP(3);
