-- Chống trùng hội thoại tuyển dụng: neo vào NGHIỆP VỤ, không vào `state`.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO BẢN TRƯỚC SAI
-- ---------------------------------------------------------------------------
-- `chat_mot_handoff_moi_ntd` dùng `WHERE state IN ('WAITING_EMPLOYER',
-- 'HUMAN_ACTIVE')`. Nhưng sinh viên bấm "quay lại hỏi trợ lý" thì state về
-- `AI_ACTIVE` trong khi `handoffEmployerProfileId` VẪN GIỮ NGUYÊN — hội thoại
-- chỉ tạm dừng, chưa kết thúc.
--
-- Lúc đó chỉ mục hết phủ hàng đó, và sinh viên mở được hội thoại THỨ HAI với
-- đúng nhà tuyển dụng ấy. Hai luồng song song tới cùng một người, mỗi luồng
-- một nửa ngữ cảnh.
--
-- `state` mô tả "đang nói với ai lúc này". Câu hỏi chống trùng lại là "đã gắn
-- với nhà tuyển dụng nào và còn sống không" — hai chuyện khác nhau. Điều kiện
-- đúng là: ĐÃ có người nhận, và CHƯA đóng.
DROP INDEX "chat_mot_handoff_moi_ntd";

CREATE UNIQUE INDEX "chat_mot_handoff_moi_ntd"
  ON "chat_sessions" ("ownerUserId", "handoffEmployerProfileId")
  WHERE "handoffEmployerProfileId" IS NOT NULL AND state <> 'CLOSED';
