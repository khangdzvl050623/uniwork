# Sprint 0 — Nền móng

**Thời lượng:** 6 ngày làm việc · **Nhóm:** 2 người

Mục tiêu: khi kết thúc sprint, nhóm có **một đường ống chạy thông từ máy lập trình tới bản deploy thật**, và **một bộ yêu cầu đủ rõ để code Sprint 1 mà không phải đoán**. Chưa có tính năng nào cho người dùng, và điều đó là đúng ý đồ.

| Người | Vai trò trong sprint này |
|---|---|
| **A** *(điền tên — owner repo)* | Hạ tầng, khung dự án, CI/CD, cơ sở dữ liệu |
| **B** *(điền tên)* | Nghiên cứu thị trường, đặc tả yêu cầu, wireframe |

Hai người làm song song, gần như không chặn nhau. Chỉ có **hai mốc đồng bộ** bắt buộc, đánh dấu 🔗 bên dưới.

---

## Người A — Hạ tầng & khung dự án

### Ngày 1 — Dựng monorepo

- [ ] `pnpm init` ở gốc, cấu hình `pnpm-workspace.yaml` với `apps/*` và `packages/*`
- [ ] `apps/web` — Vite + React + TypeScript, chạy được ở `:5173`
- [ ] `apps/api` — Express + TypeScript + tsx watch, chạy được ở `:4000`
- [ ] `packages/shared` — package rỗng, export một type mẫu để kiểm tra import xuyên workspace
- [ ] `packages/config` — tsconfig base, ESLint, Prettier dùng chung
- [ ] Turborepo: `pnpm dev` chạy cả hai app cùng lúc bằng một lệnh

**Xong khi:** clone repo về máy trắng, chạy `pnpm install && pnpm dev`, hai app cùng lên.

### Ngày 2 — Khung API và khung web

- [ ] API: cấu trúc `routes / controllers / services / middlewares / lib`
- [ ] `GET /api/health` trả `{ status: 'ok' }` — **không chạm database** (xem ghi chú ở mục Rủi ro)
- [ ] Middleware xử lý lỗi tập trung, chuẩn hoá response lỗi `{ code, message, details }`
- [ ] Đọc biến môi trường qua Zod, thiếu biến thì app chết ngay lúc khởi động chứ không chạy tiếp
- [ ] Web: React Router, layout khung, TanStack Query provider, Tailwind + shadcn/ui khởi tạo
- [ ] Web gọi được `/api/health` và hiện kết quả lên màn hình

**Xong khi:** mở web thấy chữ "API: ok" lấy từ backend thật, không phải hardcode.

### Ngày 3 — Database

- [ ] Tạo project trên Neon, lấy `DATABASE_URL`
- [ ] `prisma init`, viết schema **tối thiểu**: `User`, `StudentProfile`, `EmployerProfile`, `Skill`
- [ ] Migration đầu tiên chạy được lên Neon
- [ ] `seed.ts` tạo 3 tài khoản demo (SV / NTD / admin) + ~10 kỹ năng mẫu
- [ ] Một endpoint đọc dữ liệu thật từ DB, ví dụ `GET /api/skills`
- [ ] `.env.example` cho cả hai app, ghi đủ biến, không commit `.env` thật

**Xong khi:** `pnpm --filter api prisma db seed` chạy sạch, gọi `/api/skills` trả về danh sách từ Neon.

> Chỉ dựng schema tối thiểu ở bước này. Schema đầy đủ đợi BRD của B ở ngày 6.

### Ngày 4 — CI

- [ ] Vitest cho cả hai app, mỗi app một test mẫu chạy xanh
- [ ] `.github/workflows/ci.yml`: cài deps → lint → typecheck → test → build
- [ ] Mở một PR nháp để CI chạy thật ít nhất một lần
- [ ] Sau khi CI chạy xong, bật **required status checks** cho `dev` và `main`
- [ ] Xoá PR nháp

**Xong khi:** PR nào có lỗi lint hoặc test đỏ thì không merge được nữa.

> Required status checks chỉ chọn được tên job **sau khi job đó đã chạy ít nhất một lần** — nên phải mở PR nháp trước, không bật trước được.

### Ngày 5 — Deploy toàn tuyến

- [ ] Vercel: nối repo, root directory `apps/web`, build command cho monorepo, biến `VITE_API_URL`
- [ ] Render: nối repo, root directory `apps/api`, build + start command, đủ biến môi trường
- [ ] CORS trên API trỏ đúng domain Vercel thật
- [ ] cron-job.org ping `/api/health` mỗi 5 phút
- [ ] Đặt repository variable `API_URL` để workflow `keep-alive.yml` hoạt động
- [ ] **Đo thử cold start**: để API ngủ 20 phút rồi gọi lại, ghi lại mất bao nhiêu giây

**Xong khi:** mở link Vercel trên điện thoại, dùng 4G (không phải wifi nhà), thấy dữ liệu từ Neon.

### Ngày 6 — Chốt schema & dọn dẹp 🔗

- [ ] Đọc BRD của B, đối chiếu với mô hình dữ liệu ở README mục 5
- [ ] Viết schema Prisma **đầy đủ** cho toàn bộ bảng, chạy migration thứ hai
- [ ] Mở rộng seed: vài tin tuyển dụng mẫu có ca làm và kỹ năng, để Sprint 1 có dữ liệu mà nhìn
- [ ] Mời B vào repo với quyền `write`, hướng dẫn B chạy dự án trên máy
- [ ] Cập nhật README mục 8 nếu các bước cài đặt thực tế khác với dự kiến

**Xong khi:** B clone repo về máy mình, chạy được, và schema phản ánh đúng những gì BRD mô tả.

---

## Người B — Nghiên cứu, yêu cầu, thiết kế

### Ngày 1–2 — Nghiên cứu đối thủ

- [ ] Bảng so sánh trên Google Sheets, 4–5 nền tảng
- [ ] Mỗi nền tảng ghi rõ: các bước đăng ký · các trường khi đăng tin · cách tìm kiếm và lọc · **có tính năng lịch làm không** · có đánh giá hai chiều không
- [ ] Vào 1–2 group Facebook việc làm sinh viên, đọc 20–30 bài và bình luận gần nhất
- [ ] Ghi lại **3–5 lời than phiền lặp lại nhiều nhất** của sinh viên, kèm ảnh chụp màn hình làm bằng chứng

**Nộp:** file Google Sheets + đoạn tóm tắt 5–7 dòng nêu insight quan trọng nhất.

Gợi ý chọn nền tảng: TopCV và VietnamWorks là bắt buộc. **Nên thay ITviec bằng Việc Làm Tốt (Chợ Tốt) hoặc Vieclam24h** — ITviec chuyên tuyển IT toàn thời gian, gần như không có mảng part-time sinh viên nên so sánh sẽ không rút ra được gì. Cộng thêm 1–2 group Facebook lớn.

Cột quan trọng nhất của bảng là **"có lọc theo lịch làm không"**. Nếu không nền tảng nào có, đó chính là luận điểm mở đầu cho báo cáo. Nếu có nền tảng đã làm rồi, nhóm cần biết ngay từ bây giờ chứ không phải lúc bảo vệ.

### Ngày 3–4 — Đặc tả yêu cầu (BRD) 🔗

Ba module, mỗi module một trang, cùng một format:

- [ ] **Auth** — đăng ký, đăng nhập, xác thực email, phân quyền
- [ ] **Đăng tin** — nhà tuyển dụng tạo và quản lý tin
- [ ] **Tìm kiếm việc** — sinh viên tìm, lọc, xem chi tiết

Mỗi module viết đủ bốn phần:

1. **Các trường dữ liệu cần thu thập** — tên trường, bắt buộc hay không, ràng buộc (độ dài, định dạng, giá trị hợp lệ)
2. **Luồng chính (happy path)** — từng bước: người dùng làm gì, hệ thống phản hồi gì
3. **Trường hợp lỗi và ngoại lệ** — tin hết hạn, ứng tuyển trùng, email đã tồn tại, sai mật khẩu quá 5 lần, tin bị admin gỡ giữa chừng, nhà tuyển dụng chưa được duyệt mà cố đăng tin
4. **Riêng module Đăng tin:** nhà tuyển dụng cần cung cấp giấy tờ gì để xác minh — đây là hàng rào chống tin lừa đảo, cần quyết định dứt khoát chứ không để mở

**Nộp:** file Google Docs, mỗi module một trang, dùng luôn làm phụ lục báo cáo môn học.

> 🔗 **Đây là mốc đồng bộ quan trọng nhất của sprint.** A sẽ dựng schema Prisma từ chính danh sách trường trong tài liệu này. Trường nào B quên, A sẽ không có trong database, và Sprint 1 phải migration lại. Viết xong ngày 4 thì gửi ngay, đừng đợi tới cuối sprint.

Đối chiếu sẵn với README mục 5 trước khi viết — mô hình dữ liệu đã có phác thảo, việc của B là làm nó chi tiết và bổ sung chỗ thiếu, không phải viết lại từ đầu.

### Ngày 5–6 — Wireframe Figma

Sáu màn hình, không cần đẹp, chỉ cần đủ khối và đúng luồng:

- [ ] `01 - Đăng ký / Đăng nhập` (2 vai trò: SV / NTD)
- [ ] `02 - Danh sách việc làm` (bộ lọc: khu vực, lương, giờ làm)
- [ ] `03 - Chi tiết tin tuyển dụng` + nút Ứng tuyển
- [ ] `04 - NTD đăng tin` (form nhập liệu)
- [ ] `05 - NTD xem danh sách ứng viên`
- [ ] `06 - SV khai báo lịch rảnh` (dạng lưới 7 ngày × khung giờ)

**Nộp:** một link Figma share được, 6 frame đặt tên đúng thứ tự trên.

> ⚠️ Màn hình 06 khác với danh sách ban đầu, xem giải thích ở mục dưới.

---

## Hai mốc đồng bộ

| Khi nào | Việc gì |
|---|---|
| **Hết ngày 2** | B gửi bảng so sánh cho A đọc. Nếu phát hiện tính năng quan trọng chưa có trong thiết kế, sửa README trước khi A dựng schema. |
| **Hết ngày 4** 🔗 | B gửi BRD. A dựng schema đầy đủ ở ngày 6 dựa trên đó. **Trễ mốc này là trễ cả sprint.** |

Ngoài hai mốc trên, hai người không chặn nhau. B không cần chờ code chạy được mới làm việc của mình.

---

## Sprint 0 coi là xong khi

- [ ] Link Vercel mở được trên điện thoại, hiển thị dữ liệu lấy từ Neon
- [ ] CI chạy trên mọi PR, đỏ thì chặn merge
- [ ] `pnpm install && pnpm dev` chạy được trên máy cả hai người
- [ ] Schema Prisma đầy đủ, migration và seed chạy sạch
- [ ] Bảng so sánh đối thủ + BRD 3 module + 6 wireframe đã nộp
- [ ] Đã đo và ghi lại thời gian cold start của Render

---

## Rủi ro cần canh

**Cold start của Render.** Instance free ngủ sau 15 phút, dậy mất tới ~50 giây. Ping đều là bắt buộc, và `/api/health` phải cực nhẹ — nếu endpoint đó truy vấn database, mỗi lần ping sẽ đánh thức luôn Neon và đốt compute-hour vô ích cả ngày lẫn đêm.

**Migration sau khi đã có dữ liệu.** Sprint 0 còn dễ vì database rỗng. Từ Sprint 1 trở đi, đổi schema mà không cẩn thận là mất dữ liệu seed. Quy ước: ai đổi `schema.prisma` phải báo trước trong group chat (xem README mục 9.5).

**BRD trễ hạn.** Đây là rủi ro thật sự của sprint này. Nếu ngày 4 chưa có BRD, A sẽ dựng schema theo phỏng đoán, và Sprint 1 phải làm lại. Nếu B thấy không kịp, báo sớm và cắt bớt phần nghiên cứu đối thủ chứ **đừng cắt BRD**.

**Nhóm chỉ có 2 người.** Bảng phân công nhánh ở README mục 9.6 đang liệt kê 5 module. Cần chia lại cho khớp thực tế trước khi vào Sprint 1.
