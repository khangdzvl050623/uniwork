-- Hai gia tri enum, TACH RIENG mot migration.
--
-- ---------------------------------------------------------------------------
-- VI SAO PHAI TACH
-- ---------------------------------------------------------------------------
-- Postgres khong cho DUNG mot gia tri enum vua them trong CUNG transaction voi
-- lenh ALTER TYPE them no. Prisma chay moi file migration trong mot transaction,
-- nen de chung voi cac CHECK co nhac toi AI_SUPPORT / WAITING_ADMIN la ca file
-- rollback — bao P3009 va khong noi ro ly do.
--
-- Tach lam hai file thi file nay commit truoc, file sau dung duoc gia tri moi.
-- AlterEnum
ALTER TYPE "ChatKind" ADD VALUE 'AI_SUPPORT';

-- AlterEnum
ALTER TYPE "ChatSessionState" ADD VALUE 'WAITING_ADMIN';
