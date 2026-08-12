# Sprint 0 — Nền móng

**Thời lượng:** 6 ngày · **Nhóm:** 3 người

| Ký hiệu | Vai trò | Tên |
|---|---|---|
| **DEV1** | Backend, hạ tầng, database, deploy API | *(điền)* |
| **DEV2** | Frontend, CI, deploy web | *(điền)* |
| **BA** | Phân tích nghiệp vụ, viết tài liệu, wireframe | *(điền)* |

## Danh sách công việc

| Mã | Ngày | Người | Công việc | Kết quả cần đạt |
|---|---|---|---|---|
| T01 | 1 | DEV1 | Dựng monorepo: pnpm workspaces, Turborepo, `packages/config` (tsconfig, ESLint, Prettier) | `pnpm dev` chạy được từ gốc |
| T02 | 1 | DEV1 | Khởi tạo `apps/api` — Express + TypeScript | API chạy ở `:4000` |
| T03 | 1 | DEV2 | Khởi tạo `apps/web` — Vite + React + TypeScript | Web chạy ở `:5173` |
| T04 | 1 | DEV2 | Tạo `packages/shared`, export type mẫu | Import xuyên workspace hoạt động |
| T05 | 1–2 | BA | Bảng so sánh 4–5 nền tảng trên Google Sheets: TopCV, VietnamWorks, Việc Làm Tốt, 1–2 group Facebook | Đủ cột: bước đăng ký · trường khi đăng tin · cách tìm và lọc · **có lọc theo lịch làm không** · đánh giá hai chiều |
| T06 | 1–2 | BA | Đọc 20–30 bài và bình luận gần nhất trong group Facebook việc làm sinh viên | 3–5 lời than phiền lặp lại nhiều nhất, kèm ảnh chụp màn hình |
| T07 | 1–2 | BA | Viết tóm tắt insight | Đoạn 5–7 dòng nêu phát hiện quan trọng nhất |
| T08 | 2 | DEV1 | Cấu trúc API: `routes / controllers / services / middlewares / lib`, middleware lỗi tập trung, đọc env qua Zod | Response lỗi chuẩn `{ code, message, details }`; thiếu env thì app dừng ngay lúc khởi động |
| T09 | 2 | DEV1 | Endpoint `GET /api/health` — không truy vấn database | Trả `{ status: 'ok' }` |
| T10 | 2 | DEV2 | React Router, layout khung, TanStack Query provider | Điều hướng giữa 2 trang mẫu |
| T11 | 2 | DEV2 | Cài Tailwind CSS + shadcn/ui | Render được 1 component shadcn |
| T12 | 2 | DEV2 | Web gọi `/api/health` và hiển thị kết quả | Màn hình hiện trạng thái lấy từ backend thật |
| T13 | 3 | DEV1 | Tạo project Neon, `prisma init`, schema tối thiểu: `User`, `StudentProfile`, `EmployerProfile`, `Skill` | Migration đầu tiên chạy lên Neon thành công |
| T14 | 3 | DEV1 | Viết `seed.ts` | 3 tài khoản demo (SV / NTD / admin) + 10 kỹ năng mẫu |
| T15 | 3 | DEV1 | Endpoint `GET /api/skills` đọc dữ liệu thật | Trả danh sách kỹ năng từ Neon |
| T16 | 3 | DEV2 | Viết `.env.example` cho cả 2 app, cập nhật README mục 8 | Người mới clone về cài được theo tài liệu |
| T17 | 3–4 | BA | BRD module **Auth** | 1 trang: trường dữ liệu · luồng chính · lỗi và ngoại lệ |
| T18 | 3–4 | BA | BRD module **Đăng tin** | 1 trang, có mục giấy tờ nhà tuyển dụng cần nộp để xác minh |
| T19 | 3–4 | BA | BRD module **Tìm kiếm việc** | 1 trang: trường dữ liệu · luồng chính · lỗi và ngoại lệ |
| T20 | 4 | DEV1 | Cài Vitest cho API, viết test mẫu | Test chạy xanh |
| T21 | 4 | DEV2 | Cài Vitest cho web, viết test mẫu | Test chạy xanh |
| T22 | 4 | DEV2 | Viết `.github/workflows/ci.yml`: install → lint → typecheck → test → build | CI chạy tự động trên mọi PR |
| T23 | 4 | DEV2 | Mở PR nháp cho CI chạy 1 lần, bật required status checks cho `dev` và `main` | PR có test đỏ thì không merge được |
| T24 | 5 | DEV1 | Deploy `apps/api` lên Render: root directory, build/start command, biến môi trường, CORS trỏ domain Vercel | API chạy trên domain `.onrender.com` |
| T25 | 5 | DEV1 | Cấu hình cron-job.org ping `/api/health` mỗi 5 phút, đặt repository variable `API_URL` | Workflow `keep-alive.yml` hoạt động |
| T26 | 5 | DEV1 | Đo cold start: để API ngủ 20 phút rồi gọi lại | Ghi lại số giây vào tài liệu |
| T27 | 5 | DEV2 | Deploy `apps/web` lên Vercel: root `apps/web`, biến `VITE_API_URL` | Mở link trên điện thoại dùng 4G thấy dữ liệu từ Neon |
| T28 | 5–6 | BA | Vẽ 6 frame wireframe trên Figma | Link share được, 6 frame đặt tên theo thứ tự bên dưới |
| T29 | 6 | DEV1 | Viết schema Prisma đầy đủ theo BRD, chạy migration thứ hai | Schema khớp với tài liệu BA bàn giao |
| T30 | 6 | DEV1 | Mở rộng seed: tin tuyển dụng mẫu có ca làm và kỹ năng | Sprint 1 có sẵn dữ liệu để phát triển |
| T31 | 6 | DEV2 | Dựng khung route rỗng cho 6 màn hình theo wireframe | Điều hướng đủ 6 trang, chưa cần giao diện |
| T32 | 6 | DEV1 | Mời DEV2 và BA vào repo với quyền `write` | Cả nhóm clone và chạy được dự án |

## Sáu frame wireframe (T28)

| Thứ tự | Tên frame |
|---|---|
| 01 | Đăng ký / Đăng nhập (2 vai trò: SV / NTD) |
| 02 | Danh sách việc làm (lọc: khu vực, lương, giờ làm) |
| 03 | Chi tiết tin tuyển dụng + nút Ứng tuyển |
| 04 | NTD đăng tin (form nhập liệu) |
| 05 | NTD xem danh sách ứng viên |
| 06 | SV khai báo lịch rảnh (lưới 7 ngày × khung giờ) |

## Sản phẩm bàn giao

| Sản phẩm | Người | Hạn |
|---|---|---|
| Google Sheets so sánh đối thủ + tóm tắt insight | BA | Hết ngày 2 |
| Google Docs BRD 3 module | BA | **Hết ngày 4** |
| Link Figma 6 frame | BA | Hết ngày 6 |
| Repo chạy được: `pnpm install && pnpm dev` | DEV1 + DEV2 | Hết ngày 3 |
| CI chặn merge khi đỏ | DEV2 | Hết ngày 4 |
| Web trên Vercel + API trên Render + DB Neon chạy thông | DEV1 + DEV2 | Hết ngày 5 |
| Schema Prisma đầy đủ + seed | DEV1 | Hết ngày 6 |

## Phụ thuộc

| Việc | Chờ | Ghi chú |
|---|---|---|
| T03, T04 | T01 | DEV1 push `pnpm-workspace.yaml` ngay sáng ngày 1 để DEV2 làm song song |
| T12 | T09 | Web gọi được health sau khi API có endpoint |
| T29 | T17, T18, T19 | BRD trễ thì schema phải dựng theo phỏng đoán, Sprint 1 làm lại |
| T31 | T28 | Khung route dựng theo wireframe |
