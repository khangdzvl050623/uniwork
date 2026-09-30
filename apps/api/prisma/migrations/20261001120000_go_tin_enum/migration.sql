-- Thêm `TIN_BI_GO` vào `NotificationType`. File RIÊNG, chỉ có đúng dòng này —
-- migration sau dùng tới giá trị mới, và `ALTER TYPE ADD VALUE` không được
-- chung transaction với câu lệnh dùng nó (P3009 không kèm giải thích).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TIN_BI_GO';
