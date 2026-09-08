-- Giá trị KHỞI TẠO cho `skills.featured` trên database đã có sẵn dữ liệu.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO VIỆC NÀY NẰM Ở MIGRATION CHỨ KHÔNG NẰM Ở SEED
-- ---------------------------------------------------------------------------
-- `seedSkills()` chạy ở MỌI môi trường và ở MỌI lần deploy (lệnh build của
-- Render gọi `prisma db seed`). Nó cố ý chỉ đặt `featured` ở nhánh `create`:
-- nếu đặt cả ở `update` thì mỗi lần đẩy code sẽ xoá sạch lựa chọn admin vừa
-- tick và đặt lại về danh sách ghi cứng trong seed.
--
-- Nhưng vì thế, database ĐÃ CÓ sẵn 14 kỹ năng (mọi máy trong nhóm, và Neon)
-- sẽ không bao giờ nhận giá trị khởi tạo — trang chủ trống chip cho tới khi có
-- người vào tick tay.
--
-- Migration là đúng công cụ cho việc "chạy đúng MỘT lần": Prisma ghi nhận nó
-- vào `_prisma_migrations` nên lần deploy sau không chạy lại, và lựa chọn của
-- admin an toàn.
--
-- Tra theo `slug` chứ không theo `name`: admin đổi tên hiển thị được (xem
-- `updateSkill`), còn slug thì không đổi.
UPDATE "skills"
SET "featured" = true
WHERE "slug" IN (
  'gia-su',
  'pha-che',
  'phuc-vu-ban',
  'thu-ngan',
  'ban-hang',
  'cham-soc-khach-hang'
);
