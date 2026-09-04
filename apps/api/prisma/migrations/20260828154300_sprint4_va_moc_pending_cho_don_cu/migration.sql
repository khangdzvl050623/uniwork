-- Vá dữ liệu: mọi đơn đã tồn tại trước Sprint 4 đều thiếu mốc lịch sử đầu tiên.
--
-- Từ Sprint 4, bất biến của hệ thống là "mỗi đơn có ít nhất một hàng
-- ApplicationEvent" — hàng PENDING ghi cùng transaction lúc nộp. Những đơn có
-- từ trước ra đời khi bảng này chưa tồn tại, nên timeline của chúng sẽ rỗng và
-- giao diện "Đơn của tôi" sẽ vẽ ra một đơn không có bước nào.
--
-- Tách khỏi migration đổi cấu trúc ở trên vì đây là việc khác loại: một bên đổi
-- hình dạng bảng, một bên sửa dữ liệu. Gộp lại thì lúc cần lùi một trong hai
-- không tách ra được.
--
-- Lấy `createdAt` của chính đơn làm mốc, KHÔNG lấy `now()`: mốc "đã nộp" là
-- thời điểm nộp thật, không phải thời điểm chạy migration. Dùng `now()` sẽ
-- khiến mọi đơn cũ trông như vừa nộp hôm nay.
--
-- `actorUserId` để NULL: không suy ra được ai đã bấm, và bịa ra một id là tệ
-- hơn hẳn việc thừa nhận không biết.
--
-- `WHERE NOT EXISTS` để chạy lại nhiều lần không sinh hàng trùng.
INSERT INTO "application_events" ("id", "applicationId", "status", "actorUserId", "note", "createdAt")
SELECT
  'evt_backfill_' || a."id",
  a."id",
  'PENDING',
  NULL,
  NULL,
  a."createdAt"
FROM "applications" a
WHERE NOT EXISTS (
  SELECT 1 FROM "application_events" e WHERE e."applicationId" = a."id"
);
