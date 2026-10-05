-- Mỗi tài khoản một lượt AI đang chạy CHO MỖI TÍNH NĂNG, không phải một lượt
-- cho tất cả.
--
-- ===========================================================================
-- VÌ SAO
-- ===========================================================================
-- Chỉ mục cũ là `(userId) WHERE state = 'RESERVED'` — không có `feature`. Hệ
-- quả: một lượt CHAT treo chặn luôn quét CV, và ngược lại. Hai tính năng có
-- hạn mức tách riêng (`ai_usage_days` khoá theo `userId, day, feature`), chạy
-- bằng hai đường riêng, nhưng lại dùng chung một ổ khoá.
--
-- Trước đây điều đó biến một lượt mồ côi thành khoá VĨNH VIỄN trên CẢ HAI tính
-- năng, vì không có gì dọn lượt treo. Nay đã có sweeper theo tuổi
-- (`donLuotMoCoi`), nên khoá tự hết sau vài phút — nhưng phạm vi khoá vẫn nên
-- khớp với phạm vi hạn mức.
--
-- Vẫn MỘT lượt đang chạy cho mỗi tính năng: đó là thứ chặn một người bấm năm
-- lần liên tiếp và đốt năm request song song trước khi lượt đầu kịp chốt.
DROP INDEX "ai_turns_mot_luot_dang_chay";

CREATE UNIQUE INDEX "ai_turns_mot_luot_dang_chay"
  ON "ai_turns" ("userId", feature)
  WHERE state = 'RESERVED';
