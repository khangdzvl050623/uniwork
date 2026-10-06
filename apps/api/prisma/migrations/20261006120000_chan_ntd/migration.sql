-- Sinh viên chặn nhà tuyển dụng — chỉ phần nhắn tin. Xem `EmployerBlock`.
--
-- Một hàng cho mỗi cặp (sinh viên, nhà tuyển dụng); bỏ chặn là xoá hàng.
-- Chỉ mục UNIQUE vừa chặn trùng, vừa là thứ `chanNhaTuyenDung` dựa vào để bấm
-- chặn hai lần không lỗi.
CREATE TABLE "employer_blocks" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "employerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employer_blocks_employerProfileId_idx" ON "employer_blocks"("employerProfileId");

CREATE UNIQUE INDEX "employer_blocks_studentUserId_employerProfileId_key" ON "employer_blocks"("studentUserId", "employerProfileId");

ALTER TABLE "employer_blocks" ADD CONSTRAINT "employer_blocks_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employer_blocks" ADD CONSTRAINT "employer_blocks_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "employer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
