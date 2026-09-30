-- Admin GỠ một tin đang hiển thị.
--
-- ===========================================================================
-- VÌ SAO CẦN, DÙ ĐÃ CÓ `CLOSED`
-- ===========================================================================
-- Trước migration này, `reviewJob` chỉ xử được tin `PENDING`. Tin đã `OPEN`
-- thì admin KHÔNG có đường nào gỡ — nên duyệt một báo cáo thành "đã xử lý" là
-- một kết luận không có hành động nào đứng sau nó. Người báo cáo nhận thông
-- báo "đã xử lý" trong khi tin lừa đảo vẫn nằm nguyên trên trang chủ.
--
-- `CLOSED` đã là trạng thái CUỐI (không hàm nào mở lại được, cả phía nhà tuyển
-- dụng lẫn phía admin), nên gỡ tin không cần trạng thái mới. Thứ còn thiếu là
-- phần "vì sao": không có nó thì nhà tuyển dụng mở bảng tin lên thấy "Đã đóng"
-- y hệt một tin họ tự đóng tuần trước.
ALTER TABLE "jobs" ADD COLUMN "goBoiAdminId" TEXT;
ALTER TABLE "jobs" ADD COLUMN "lyDoGo" TEXT;

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_goBoiAdminId_fkey"
  FOREIGN KEY ("goBoiAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Gỡ thì PHẢI có lý do, và tin phải thật sự đã đóng.
--
-- Nhà tuyển dụng đọc nguyên văn `lyDoGo` trong thông báo; một lần gỡ không lời
-- giải thích là thứ họ không cãi lại được và cũng không sửa được. Ép ở database
-- chứ không chỉ ở Zod: một script vá tay hay một endpoint viết vội ở sprint sau
-- đều đi vòng qua Zod được.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_go_du_ly_do" CHECK (
  ("goBoiAdminId" IS NULL AND "lyDoGo" IS NULL)
  OR ("goBoiAdminId" IS NOT NULL AND "lyDoGo" IS NOT NULL AND length(btrim("lyDoGo")) > 0
      AND status = 'CLOSED')
);
