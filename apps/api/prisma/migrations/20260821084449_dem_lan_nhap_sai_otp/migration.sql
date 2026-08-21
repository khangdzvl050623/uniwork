-- Dem so lan nhap sai mot ma OTP, de huy ma khi bi do.
--
-- Mac dinh 0 nen hang cu khong can backfill: moi ma dang song coi nhu chua ai
-- nhap sai lan nao, dung voi thuc te.

-- AlterTable
ALTER TABLE "one_time_tokens" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
