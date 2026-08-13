# UniWork — Timeline 8 tuần

**Nhóm:** DEV1 (backend) · DEV2 (frontend) · BA (nghiệp vụ, tài liệu, thiết kế)

BA luôn chạy trước hai dev **một sprint**: trong lúc dev làm sprint hiện tại, BA đặc tả và thiết kế cho sprint kế tiếp, đồng thời kiểm thử sprint vừa xong.

## Timeline tổng

| Tuần | Sprint | Trọng tâm | DEV1 — Backend | DEV2 — Frontend | BA | Mốc bàn giao |
|---|---|---|---|---|---|---|
| 1 | 0 | Nền móng | Monorepo, khung API, Neon + Prisma, deploy Render | Khung web, Tailwind + shadcn, CI, deploy Vercel | Nghiên cứu đối thủ, BRD 3 module, wireframe 6 màn | Pipeline chạy thông từ máy tới bản deploy; schema đầy đủ |
| 2–3 | 1 | Auth & Hồ sơ | JWT access + refresh, phân quyền, xác thực email, API hồ sơ, upload CV | Form đăng ký/đăng nhập 2 vai trò, trang hồ sơ, khai kỹ năng và lịch rảnh | BRD module Ứng tuyển và Admin; thiết kế màn hình Sprint 2; chương 1–2 báo cáo | Đăng nhập được với 3 vai trò, hồ sơ hoàn chỉnh |
| 4–5 | 2 | Tin tuyển dụng | CRUD tin, kỹ năng, ca làm, `scheduleType`, luồng duyệt tin | Form đăng tin, danh sách tin, chi tiết tin, trang quản lý tin của NTD | Kiểm thử Sprint 1; thiết kế màn hình Sprint 3–4; chương 3 báo cáo | NTD đăng được tin, SV xem được |
| 6 | 3 | Tìm kiếm & Lọc | Full-text search, lọc đa tiêu chí, thuật toán ghép lịch, điểm phù hợp | Thanh bộ lọc, trang kết quả, hiển thị điểm phù hợp, lưu tin | Viết test case, kiểm thử luồng tìm kiếm; chương 4 báo cáo | **Lọc theo lịch rảnh chạy đúng** — tính năng lõi |
| 7 | 4 | Ứng tuyển & Thông báo | Nộp đơn, `ApplicationEvent`, đổi trạng thái, che thông tin liên hệ, email Brevo | Nút ứng tuyển, timeline theo dõi đơn, NTD xem ứng viên, chuông thông báo | Kiểm thử luồng ứng tuyển hai phía; chương 5; kịch bản demo | Luồng tuyển dụng khép kín |
| 8 | 5 | Admin & Bảo vệ | API admin (duyệt NTD, duyệt tin, quản lý kỹ năng), sửa lỗi | Trang admin, responsive, E2E 2 luồng chính, sửa lỗi | Hoàn thiện báo cáo, slide, video demo, dữ liệu trình bày | Sẵn sàng bảo vệ |

## Mốc quan trọng

| Cuối tuần | Phải đạt được |
|---|---|
| 1 | Deploy thật chạy được, CI chặn merge khi đỏ |
| 3 | Ba vai trò đăng nhập và tạo hồ sơ được |
| 5 | Có dữ liệu tin tuyển dụng thật trong hệ thống |
| 6 | Tính năng khác biệt chính hoạt động |
| 7 | Đi hết được một vòng tuyển dụng từ đăng tin tới nhận việc |
| 8 | Bảo vệ |

## So với kế hoạch gốc 11 tuần

Ép xuống 8 tuần với 2 dev nên phải cắt. Những phần sau **có chủ đích để lại**:

| Cắt gì | Lý do |
|---|---|
| Dashboard thống kê cho admin | Không ảnh hưởng luồng chính, chỉ để trang trí |
| Báo cáo tin vi phạm | Giữ bảng trong schema, chưa làm giao diện |
| Đánh giá hai chiều sau khi làm việc | Vốn đã là nice-to-have |
| E2E test diện rộng | Chỉ giữ 2 luồng: đăng tin và ứng tuyển |
| Tuần riêng cho tài liệu | Gộp vào tuần 8; BA viết rải suốt 8 tuần thay vì dồn cuối |

## Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Tuần 6 và 7 mỗi sprint chỉ 1 tuần, không có đệm | Nếu trễ, cắt tiếp phần admin ở tuần 8 chứ không cắt tuần 6 |
| BA trễ đặc tả kéo dev phải đoán | BA luôn giao tài liệu trước khi sprint tương ứng bắt đầu |
| Chỉ có 2 dev, một người nghỉ là mất 50% năng lực | Không để một người độc quyền hiểu một phần; review chéo code |
