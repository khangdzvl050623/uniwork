# UniWork — Nền tảng tìm việc bán thời gian cho sinh viên

Web app kết nối sinh viên tìm việc part-time với các nhà tuyển dụng nhỏ (quán cà phê, trung tâm gia sư, đơn vị tổ chức sự kiện).

Khác biệt chính so với các trang tuyển dụng hiện có: **ghép việc theo lịch rảnh thực tế của sinh viên**, không chỉ theo từ khoá và địa điểm. Sinh viên khai khung giờ rảnh theo thứ, tin tuyển dụng khai ca làm việc, hệ thống chỉ hiện những tin có lịch giao nhau.

## Vấn đề

Sinh viên hiện tìm việc chủ yếu qua group Facebook: không lọc được theo lịch học, tin trùng lặp và nhiều tin lừa đảo, ứng tuyển xong rơi vào inbox không biết trạng thái. Nhà tuyển dụng nhỏ cũng không có kênh tiếp cận đúng sinh viên vừa hợp kỹ năng vừa rảnh đúng giờ.

## Chức năng

**Sinh viên** — tạo hồ sơ, khai kỹ năng và lịch rảnh, upload CV, tìm và lọc tin (kỹ năng, khu vực, mức lương, lịch rảnh), ứng tuyển, theo dõi trạng thái đơn.

**Nhà tuyển dụng** — đăng ký doanh nghiệp, đăng tin kèm ca làm và kỹ năng yêu cầu, xem danh sách ứng viên có điểm phù hợp, đổi trạng thái đơn (đã xem → shortlist → nhận/từ chối).

**Quản trị viên** — duyệt nhà tuyển dụng và tin đăng, quản lý danh mục kỹ năng, xử lý báo cáo tin lừa đảo, xem thống kê.

## Công nghệ

Toàn bộ chạy trên gói miễn phí, không phát sinh chi phí.

| Thành phần | Lựa chọn |
|---|---|
| Ngôn ngữ | TypeScript cho cả frontend và backend |
| Frontend | React + Vite, Tailwind CSS — deploy trên Vercel |
| Backend | Node.js + Express, REST API — deploy trên Render |
| Database | PostgreSQL (Neon) qua Prisma ORM |
| Xác thực | JWT tự triển khai, access + refresh token, phân quyền theo vai trò |
| Khác | Cloudinary lưu CV và ảnh, Brevo gửi email, GitHub Actions chạy CI |
| Repo | Monorepo pnpm workspaces, type dùng chung giữa frontend và backend |

Cân nhắc và quyết định không dùng: **Next.js** (làm mờ ranh giới client/server, trong khi cần thể hiện rõ kiến trúc tách API riêng) và **Supabase Auth** (làm hộ gần hết phần xác thực, mất phần đáng trình bày nhất).

## Trạng thái

Đã xong phân tích bài toán, kiến trúc, mô hình dữ liệu, repo và quy trình Git. Phần code chưa bắt đầu.

Lộ trình ~11 tuần, 6 sprint: dựng khung và CI → xác thực và hồ sơ → đăng tin và kỹ năng → tìm kiếm và lọc theo lịch → ứng tuyển và thông báo → trang quản trị và hoàn thiện.
