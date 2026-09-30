-- Thêm `NTD` vào `ChatKind`. Một file RIÊNG, chỉ có đúng dòng này.
--
-- Postgres cho phép `ALTER TYPE ... ADD VALUE` trong transaction (PG 12+) MIỄN
-- LÀ không câu lệnh nào trong cùng transaction dùng tới giá trị mới. Migration
-- tiếp theo có `UPDATE ... SET kind = 'NTD'` và CHECK tham chiếu 'NTD', nên gộp
-- vào đây là `P3009` không kèm một lời giải thích nào.
--
-- Đã dính đúng bẫy này một lần ở migration kênh hỗ trợ.
ALTER TYPE "ChatKind" ADD VALUE IF NOT EXISTS 'NTD';
