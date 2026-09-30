-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "handoffAdminUserId" TEXT;

-- CreateIndex
CREATE INDEX "chat_sessions_kind_state_lastMessageAt_idx" ON "chat_sessions"("kind", "state", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_handoffAdminUserId_fkey" FOREIGN KEY ("handoffAdminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- BA CHECK PHẢI VIẾT LẠI CHO KÊNH HỖ TRỢ
-- ===========================================================================
-- Prisma không khai được CHECK, nên chúng nằm ở đây. `prisma db push` sẽ dựng
-- database KHÔNG có ràng buộc nào và không báo gì — luôn dùng `prisma migrate`.
--
-- Bốn CHECK cũ viết khi chỉ có hai kênh, và cả bốn đều dùng lối viết
-- "kind = 'AI_STUDENT' OR …". Thêm AI_SUPPORT vào là vế đó im lặng cho kênh
-- mới đi qua mọi ràng buộc. Nên phải liệt kê TỪNG kind, không dùng phủ định.

-- 1. Hồ sơ sinh viên theo kind. AI_SUPPORT mở được bởi cả hai vai nên không ép.
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_kind_student_profile";
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_kind_student_profile" CHECK (
  kind = 'AI_SUPPORT'
  OR (kind = 'AI_STUDENT'  AND "studentProfileId" IS NOT NULL)
  OR (kind = 'AI_EMPLOYER' AND "studentProfileId" IS NULL)
);

-- 2. Chỉ AI_SUPPORT mới có admin nhận. Cặp với `chat_employer_khong_handoff`
--    đã có — hai cột người nhận, mỗi cột đúng một kênh, không bao giờ cả hai.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_admin_chi_ho_tro" CHECK (
  kind = 'AI_SUPPORT' OR "handoffAdminUserId" IS NULL
);

-- 3. Trạng thái hợp lệ theo từng kênh. Liệt kê tường minh cả ba.
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_employer_trang_thai";
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_trang_thai_theo_kenh" CHECK (
     (kind = 'AI_STUDENT'  AND state IN ('AI_ACTIVE', 'WAITING_EMPLOYER', 'HUMAN_ACTIVE', 'CLOSED'))
  OR (kind = 'AI_EMPLOYER' AND state IN ('AI_ACTIVE', 'CLOSED'))
  OR (kind = 'AI_SUPPORT'  AND state IN ('AI_ACTIVE', 'WAITING_ADMIN', 'HUMAN_ACTIVE', 'CLOSED'))
);

-- 4. Rời AI_ACTIVE thì phải đủ thông tin — nhưng "đủ" khác nhau theo kênh.
--
--    AI_STUDENT: cần người nhận + tin + mốc đọc (giữ nguyên luật cũ).
--    AI_SUPPORT: KHÔNG có tin, KHÔNG có mốc đọc — admin đọc từ đầu, vì hội
--                thoại hỗ trợ CHÍNH LÀ cái ticket và người dùng chủ động leo
--                thang. `handoffAdminUserId` chỉ bắt buộc khi đã HUMAN_ACTIVE;
--                lúc WAITING_ADMIN thì chưa ai nhận.
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_handoff_du_thong_tin";
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_handoff_du_thong_tin" CHECK (
     state IN ('AI_ACTIVE', 'CLOSED')
  OR (kind = 'AI_STUDENT' AND state IN ('WAITING_EMPLOYER', 'HUMAN_ACTIVE')
      AND "handoffEmployerProfileId" IS NOT NULL
      AND "jobId"                    IS NOT NULL
      AND "employerVisibleFromSeq"   IS NOT NULL)
  OR (kind = 'AI_SUPPORT' AND state = 'WAITING_ADMIN')
  OR (kind = 'AI_SUPPORT' AND state = 'HUMAN_ACTIVE' AND "handoffAdminUserId" IS NOT NULL)
);

-- 5. Hỗ trợ cũng chỉ MỘT hàng đang mở mỗi người, cùng lý do với
--    `chat_mot_handoff_moi_ntd`: không có nó thì một tài khoản đổ được vô hạn
--    ticket vào hàng đợi admin.
CREATE UNIQUE INDEX "chat_mot_ho_tro_dang_mo"
  ON "chat_sessions" ("ownerUserId")
  WHERE kind = 'AI_SUPPORT' AND state IN ('WAITING_ADMIN', 'HUMAN_ACTIVE');
