-- CreateEnum
CREATE TYPE "JobReportReason" AS ENUM ('LUA_DAO', 'SAI_SU_THAT', 'KHONG_PHU_HOP', 'TRUNG_LAP', 'KHAC');

-- CreateEnum
CREATE TYPE "JobReportStatus" AS ENUM ('CHO_XU_LY', 'DANG_XEM', 'DA_XU_LY', 'BAC_BO');

-- CreateTable
CREATE TABLE "job_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "clientReportId" TEXT NOT NULL,
    "reason" "JobReportReason" NOT NULL,
    "moTa" TEXT NOT NULL,
    "anhChupTin" JSONB NOT NULL,
    "status" "JobReportStatus" NOT NULL DEFAULT 'CHO_XU_LY',
    "handledByUserId" TEXT,
    "handledAt" TIMESTAMP(3),
    "ketLuan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentProfileId" TEXT,

    CONSTRAINT "job_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_reports_status_createdAt_idx" ON "job_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "job_reports_jobId_status_idx" ON "job_reports"("jobId", "status");

-- CreateIndex
CREATE INDEX "job_reports_reporterUserId_createdAt_idx" ON "job_reports"("reporterUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_reports_reporterUserId_clientReportId_key" ON "job_reports"("reporterUserId", "clientReportId");

-- AddForeignKey
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Một người chỉ có MỘT báo cáo đang mở cho MỘT tin.
--
-- Không có nó thì một tài khoản bấm báo cáo 50 lần là hàng đợi admin có 50
-- dòng cho cùng một tin, và con số "tin này bị báo bao nhiêu lượt" thành vô
-- nghĩa — mà đó chính là số admin nhìn vào để xếp ưu tiên.
--
-- MỘT PHẦN: báo cáo đã xử lý xong KHÔNG chặn lần sau. Tin bị bác bỏ rồi sửa
-- thành lừa đảo thật thì phải báo lại được.
--
-- Prisma không khai được chỉ mục một phần — `prisma db push` sẽ bỏ qua nó.
CREATE UNIQUE INDEX "job_reports_mot_bao_cao_mo"
  ON "job_reports" ("reporterUserId", "jobId")
  WHERE status IN ('CHO_XU_LY', 'DANG_XEM');
