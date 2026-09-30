-- Một sinh viên chỉ có MỘT hội thoại đang mở với MỘT nhà tuyển dụng.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO PHẢI LÀ CHỈ MỤC, KHÔNG PHẢI MỘT LẦN KIỂM TRONG CODE
-- ---------------------------------------------------------------------------
-- Không có nó thì một tài khoản sinh viên đổ được vô hạn yêu cầu vào hộp thư
-- một nhà tuyển dụng: mỗi `POST /api/hoi-thoai` với `clientSessionId` khác là
-- một phiên mới, và mỗi phiên chuyển đi được một lần. Handoff KHÔNG gọi model
-- nên không tốn lượt AI nào — hạn mức ngày không chặn được đường này.
--
-- Kiểm bằng `findFirst` rồi `if` thì hai request song song đều đọc thấy "chưa
-- có" và cả hai đều tạo. Chỉ mục thì Postgres cưỡng chế, không có khe hở.
--
-- MỘT PHẦN (`WHERE state IN …`) vì hội thoại đã kết thúc KHÔNG được chặn lần
-- sau: hỏi xong, đóng lại, tháng sau hỏi tiếp về tin khác của cùng nơi đó là
-- chuyện bình thường.
--
-- Prisma không khai được chỉ mục một phần, nên nó nằm ở đây và `prisma db push`
-- sẽ KHÔNG dựng nó. Luôn dùng `prisma migrate`.
CREATE UNIQUE INDEX "chat_mot_handoff_moi_ntd"
  ON "chat_sessions" ("ownerUserId", "handoffEmployerProfileId")
  WHERE state IN ('WAITING_EMPLOYER', 'HUMAN_ACTIVE');
