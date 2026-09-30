-- Danh tính hội thoại chuyển từ "lần tạo" sang "ĐỐI TƯỢNG".
--
-- ===========================================================================
-- VÌ SAO
-- ===========================================================================
-- `AI_STUDENT` đang kiêm hai vai: khởi đầu là hỏi trợ lý, rồi
-- `chuyenNhaTuyenDung` BIẾN chính hàng đó thành hội thoại với nhà tuyển dụng.
--
-- Nên muốn hỏi nơi thứ hai là phải đẻ một luồng AI mới, và lịch sử trò chuyện
-- với trợ lý bị cắt thành nhiều mảnh rời. Đo thật 2026-09-30 trên máy dev: một
-- tài khoản có TÁM luồng `AI_STUDENT`, bốn trong số đó có tin nhắn.
--
-- Sau migration này mỗi luồng có một KHOÁ TỰ NHIÊN và sống vĩnh viễn:
--
--   AI_STUDENT / AI_EMPLOYER   một luồng cho mỗi người dùng
--   AI_SUPPORT                 một luồng cho mỗi người dùng
--   NTD                        một luồng cho mỗi cặp (người dùng, nhà tuyển dụng)
--
-- ===========================================================================
-- XOÁ SẠCH DỮ LIỆU CHAT, KHÔNG CHUYỂN ĐỔI
-- ===========================================================================
-- Quyết định của chủ dự án (2026-09-30). Đây là database phát triển, toàn dữ
-- liệu thử.
--
-- Cách kia — đổi `kind` của các hàng đã handoff — có một cái bẫy: luồng cũ chứa
-- LẪN đoạn sinh viên hỏi riêng trợ lý trước lúc chuyển. Hôm nay nhà tuyển dụng
-- bị chặn đọc phần ấy bằng mốc `employerVisibleFromSeq`; trong mô hình mới thì
-- mọi tin trong luồng NTD đều thuộc về cả hai bên. Đổi thẳng là để lộ đúng
-- những câu chưa bao giờ được chia sẻ.
--
-- Tách tin về đúng luồng thì không rò, nhưng phải đánh số lại `seq` và xử va
-- chạm `clientMessageId` — nhiều SQL tinh vi cho ba hàng dữ liệu thử.
DELETE FROM "chat_messages";
DELETE FROM "chat_sessions";

-- ---------------------------------------------------------------------------
-- 1. Chỉ mục: KHOÁ TỰ NHIÊN, không neo vào `state`
-- ---------------------------------------------------------------------------
-- Hai chỉ mục cũ đều phủ theo `state IN (...)`, và cả hai đã hỏng đúng một
-- kiểu: hội thoại rời khỏi các trạng thái đó là chỉ mục nhả hàng ra, mở đường
-- cho một luồng thứ hai tới cùng một người. Đã vá hai lần (migration
-- 20260928130000 cho NTD, 20260930140000 cho hỗ trợ).
--
-- Luồng vĩnh viễn thì không còn câu hỏi "còn mở không" nữa. Khoá là ĐỐI TƯỢNG,
-- và đối tượng thì không đổi theo trạng thái. Cả lớp lỗi ấy biến mất.
DROP INDEX IF EXISTS "chat_mot_handoff_moi_ntd";
DROP INDEX IF EXISTS "chat_mot_ho_tro_dang_mo";

CREATE UNIQUE INDEX "chat_mot_luong_tro_ly"
  ON "chat_sessions" ("ownerUserId")
  WHERE kind IN ('AI_STUDENT', 'AI_EMPLOYER');

CREATE UNIQUE INDEX "chat_mot_luong_ho_tro"
  ON "chat_sessions" ("ownerUserId")
  WHERE kind = 'AI_SUPPORT';

CREATE UNIQUE INDEX "chat_mot_luong_ntd"
  ON "chat_sessions" ("ownerUserId", "handoffEmployerProfileId")
  WHERE kind = 'NTD';

-- ---------------------------------------------------------------------------
-- 2. CHECK viết lại cho bốn kênh
-- ---------------------------------------------------------------------------
-- Prisma không khai được CHECK, nên chúng chỉ sống ở đây. `prisma db push`
-- dựng ra một database KHÔNG có cái nào và không báo gì — xem docs/no-ky-thuat.
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_admin_chi_ho_tro";
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_employer_khong_handoff";
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_handoff_du_thong_tin";
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_kind_student_profile";
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_trang_thai_theo_kenh";

-- Người nhận handoff chỉ có nghĩa ở luồng NTD, và ở đó thì BẮT BUỘC —
-- nó là nửa khoá tự nhiên, không phải một cột đặt sau.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_ntd_du_doi_tuong" CHECK (
  (kind = 'NTD' AND "handoffEmployerProfileId" IS NOT NULL AND "jobId" IS NOT NULL)
  OR (kind <> 'NTD' AND "handoffEmployerProfileId" IS NULL)
);

-- Quản trị viên xử ticket chỉ có ở luồng hỗ trợ.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_admin_chi_ho_tro" CHECK (
  kind = 'AI_SUPPORT' OR "handoffAdminUserId" IS NULL
);

-- Hồ sơ sinh viên gắn với luồng trợ lý của sinh viên, và với luồng NTD (luồng
-- đó luôn do sinh viên mở). Hai kênh còn lại không có.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_kind_student_profile" CHECK (
  (kind IN ('AI_STUDENT', 'NTD') AND "studentProfileId" IS NOT NULL)
  OR (kind = 'AI_EMPLOYER' AND "studentProfileId" IS NULL)
  OR kind = 'AI_SUPPORT'
);

-- Trạng thái nào hợp lệ ở kênh nào.
--
-- Luồng trợ lý KHÔNG có trạng thái nào ngoài `AI_ACTIVE`: nó không chờ ai và
-- không đóng bao giờ. Đó chính là điều làm nó vĩnh viễn — "hôm nay hỏi tiếp
-- dựa trên nội dung hôm qua" là hệ quả của dòng này, không phải của giao diện.
--
-- Luồng NTD thì ngược lại: không bao giờ ở `AI_ACTIVE`, vì không có trợ lý nào
-- trong đó.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_trang_thai_theo_kenh" CHECK (
  (kind IN ('AI_STUDENT', 'AI_EMPLOYER') AND state = 'AI_ACTIVE')
  OR (kind = 'AI_SUPPORT' AND state IN ('AI_ACTIVE', 'WAITING_ADMIN', 'HUMAN_ACTIVE', 'CLOSED'))
  OR (kind = 'NTD' AND state IN ('WAITING_EMPLOYER', 'HUMAN_ACTIVE', 'CLOSED'))
);

-- Đang nói chuyện trực tiếp thì phải biết ĐANG NÓI VỚI AI.
--
-- Hẹp hơn `chat_handoff_du_thong_tin` cũ vì phần "đủ thông tin" của luồng NTD
-- đã chuyển sang `chat_ntd_du_doi_tuong` phía trên — ở đó nó đúng với MỌI trạng
-- thái, không riêng lúc đang mở.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_dang_noi_biet_voi_ai" CHECK (
  state <> 'HUMAN_ACTIVE'
  OR (kind = 'NTD' AND "handoffEmployerProfileId" IS NOT NULL)
  OR (kind = 'AI_SUPPORT' AND "handoffAdminUserId" IS NOT NULL)
);
