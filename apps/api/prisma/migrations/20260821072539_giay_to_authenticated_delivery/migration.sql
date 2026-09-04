-- T57: giay to NTD chuyen sang Cloudinary "authenticated" delivery (rieng tu),
-- khac CV (T56) van public. Bang employer_documents chua co hang nao that
-- (T57 chua tung deploy truoc gio) nen NOT NULL khong can gia tri mac dinh.

-- AlterTable
ALTER TABLE "employer_documents"
  ADD COLUMN "cloudinaryPublicId" TEXT NOT NULL,
  ADD COLUMN "fileFormat" TEXT NOT NULL,
  DROP COLUMN "fileUrl";

-- CreateIndex
CREATE UNIQUE INDEX "employer_documents_employerProfileId_type_key" ON "employer_documents"("employerProfileId", "type");
