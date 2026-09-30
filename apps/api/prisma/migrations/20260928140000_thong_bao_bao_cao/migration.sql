-- Thêm giá trị enum, TÁCH RIÊNG một migration.
--
-- Postgres không cho dùng một giá trị enum vừa thêm trong cùng transaction với
-- lệnh ALTER TYPE thêm nó. Để chung với bất kỳ câu nào nhắc tới nó là cả file
-- rollback, báo P3009 và không nói rõ lý do. Xem migration `chat_ho_tro_enum`.
ALTER TYPE "NotificationType" ADD VALUE 'BAO_CAO_DA_XU_LY';
