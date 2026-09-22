# Trợ lý AI và Scan CV — tiến độ và chia việc

Cập nhật **2026-09-22**, theo code trên nhánh `feature/ai-tro-ly`.

Hai service nghiệp vụ: **Trợ lý AI** chạy trong `apps/api`, dùng Gemini; **Scan CV** xử lý nền trong `apps/worker`, dùng Cloudflare Workers AI. RabbitMQ là hạ tầng chuyển việc cho worker.

## 1. Đã làm và chưa làm

### Trợ lý AI

| Phần | Đã làm | Chưa làm |
| --- | --- | --- |
| Gọi AI | `packages/ai-runtime`: provider Gemini, chạy lượt chat; đã thử trả lời bằng dữ liệu thật | Đo RPM/TPM/RPD của project; giới hạn theo provider, circuit breaker và dọn lượt bị treo |
| Quota người dùng | Bảng `ai_usage_days`, `ai_turns`; giữ, chốt, hoàn lượt; chặn lượt chạy đồng thời | Hoàn thiện cơ chế dùng chung với job Scan CV có retry |
| Tool nghiệp vụ | 9 tool sinh viên, prompt, hướng dẫn; lược dữ liệu cá nhân trước khi gửi model | 3 tool và prompt cho nhà tuyển dụng (NTD) |
| Hội thoại | Bảng phiên/tin nhắn; REST, SSE, Socket.IO; phân quyền, cursor tải bù và chống trùng tin | Chuyển phiên từ AI sang NTD (handoff), presence và thông báo khi NTD offline |
| Giao diện | Chưa có | Màn hình chat, đọc SSE, kết nối socket, tải lại lịch sử, thao tác handoff |
| Kiểm chứng | Có test backend và script `thu-gemini`, `thu-tro-ly` | Bộ 40 câu đánh giá và kiểm thử toàn luồng trên trình duyệt |

**Hiện chạy được ở backend; chưa dùng được qua giao diện web.**

### Scan CV

| Phần | Đã làm | Chưa làm |
| --- | --- | --- |
| Nền có thể dùng lại | Auth, hồ sơ, kỹ năng, upload CV hiện có; khung AI runtime | Upload riêng tư dành cho scan, kiểm PDF/ảnh và sự đồng ý của người dùng |
| Thử model | Có script `spike/thu-workers-ai.mjs` | Chưa có kết quả thử CV được ghi nhận; cần đo chất lượng, thời gian và usage |
| Hàng đợi | Có thiết kế | RabbitMQ, `packages/contracts`, `packages/messaging`, outbox, retry, chống xử lý trùng |
| Xử lý CV | Có thiết kế ba đường: PDF có text, PDF scan, ảnh | `apps/worker`, bảng `cv_extractions`, pipeline Cloudflare, quota theo job và phục hồi job lỗi |
| Kết quả và lưu hồ sơ | Có thiết kế | API trạng thái/kết quả, màn hình đối chiếu, ánh xạ kỹ năng, xác nhận bằng transaction và `revision` |

**Chưa có luồng Scan CV chạy được. Upload CV hiện có chưa phải tính năng scan.**

## 2. Việc cho hai người

**A phụ trách Trợ lý AI và chat; B phụ trách RabbitMQ và Scan CV, gồm cả giao diện scan.** Hai người làm song song trên nền hiện có. Tạo nhánh từ `dev` sau khi phần nền trên `feature/ai-tro-ly` đã được merge.

### Người A — hoàn thiện Trợ lý AI

Làm theo thứ tự A1 → A4:

| Bước | Cần làm | Xong khi |
| --- | --- | --- |
| A1 — Handoff | Thêm chuyển sang NTD, huỷ chờ, tiếp nhận, quay lại AI, kết thúc; xử lý AI đang trả lời lúc chuyển; presence và thông báo NTD offline | Chuyển đúng trạng thái; NTD chỉ thấy đoạn được phép; câu trả lời AI đến muộn không ghi vào phiên đã chuyển |
| A2 — Giao diện chat | Màn hình sinh viên/NTD; đọc SSE, nối Socket.IO, lịch sử, cursor tải bù, gửi lại theo `clientMessageId`, nút handoff | Hỏi trên web có chữ trả về; hai bên chat được; mất mạng rồi nối lại không mất hoặc nhân đôi tin |
| A3 — Trợ lý NTD | Thêm `xemTinCuaToi`, `xemChiTietTinCuaToi`, `xemUngVien` và prompt NTD | Chỉ đọc dữ liệu đúng quyền; dữ liệu gửi model không có số điện thoại, email, họ tên đầy đủ |
| A4 — Quota và đánh giá | Đo hạn mức Gemini; hoàn thiện cổng kiểm quota provider, circuit và dọn lượt chat treo; đánh giá 40 câu | Không vượt trần đã cấu hình; trả lời có căn cứ đạt 100%; các ca vượt quyền, injection và lỗi provider được kiểm thử |

Bắt đầu bằng `pnpm --filter @uniwork/api thu-tro-ly`, rồi đọc [chat.access.ts](../../apps/api/src/modules/chat/chat.access.ts). Thiết kế chi tiết: [03 — Chatbot](03-chatbot-va-tool.md), [04 — Handoff](04-handoff-realtime.md), [05 — Quota](05-quota-dung-chung.md).

### Người B — RabbitMQ và Scan CV

Làm theo thứ tự B0 → B5:

| Bước | Cần làm | Xong khi |
| --- | --- | --- |
| B0 — Thử Cloudflare | Chạy spike với PDF có text, ảnh và PDF scan; ghi model, chất lượng, thời gian, usage | Có báo cáo kiểm chứng ba đường trích xuất đã thiết kế |
| B1 — Messaging | Tạo `packages/contracts`, `packages/messaging`; RabbitMQ trong Docker profile `mq`, script `mq:up` | Gửi/nhận được message thử, consumer đăng ký đúng queue |
| B2 — Outbox | Bảng outbox, processed/parked messages; relay, publisher confirm, retry qua `nextTryAt`; consumer thông báo và bộ phát realtime qua broker | Broker tắt không mất việc; giao trùng không ghi kết quả trùng; ACK sau khi lưu thành công |
| B3 — Worker | Tạo `apps/worker`, tách `startDocumentWorker` và entrypoint; chạy riêng hoặc inline; quản lý khởi động/dừng | Worker không import API; import module không tự chạy; shutdown chỉ tác động lượt của chính process |
| B4 — Pipeline scan | Upload riêng tư, kiểm file, rasterize khi cần; `cv_extractions`, Cloudflare, quota theo job, lease/retry; API trạng thái/kết quả | API trả 202; CV đi `QUEUED → PROCESSING → NEEDS_REVIEW`; worker khởi động lại vẫn xử lý tiếp được |
| B5 — Đối chiếu và xác nhận | Giao diện upload/kết quả; ánh xạ kỹ năng ở API; lưu trường được chọn bằng transaction và `revision`; dọn file/job theo thiết kế | Chưa xác nhận thì hồ sơ không đổi; giữ kỹ năng cũ; từ chối revision cũ; đánh giá bằng bộ 20 CV có nhãn |

Bắt đầu bằng [script thử Cloudflare](spike/thu-workers-ai.mjs), với file mẫu được phép sử dụng:

```powershell
node --env-file=apps/api/.env plans/ai/spike/thu-workers-ai.mjs "duong-dan-toi-cv-mau.pdf"
```

Cần `CLOUDFLARE_ACCOUNT_ID` và `CLOUDFLARE_API_TOKEN` trong env local. Chi tiết: [01 — Ranh giới service](01-kien-truc-va-ranh-gioi.md), [02 — RabbitMQ](02-messaging-rabbitmq.md), [06 — Scan CV](06-scan-cv.md).

### Phần hai người cần phối hợp

| Phần chung | Phân công / quyết định |
| --- | --- |
| AI runtime | A làm cổng quota provider và circuit dùng chung; B bổ sung Cloudflare và quota theo job scan. Chốt interface trước A4/B4. Không dùng nguyên `chotLuot` hiện tại cho mỗi lần retry scan: quota scan phải chốt một lần mỗi job. |
| Chat và scan chạy cùng lúc | Hiện chỉ mục `ai_turns_mot_luot_dang_chay` khoá theo `userId`. Hai người chốt giữ giới hạn toàn tài khoản hay tách theo feature trước B4. |
| Thông báo/realtime | A quyết định khi nào thông báo, nội dung và người nhận; B làm đường gửi qua outbox/RabbitMQ. A1–A2 có thể làm trước bằng bộ phát hiện có; kiểm tích hợp sau B2. |
| Schema/migration | Cập nhật `dev` trước khi tạo migration; không sửa migration đã push. Dùng migration để giữ các CHECK/index viết tay, không dùng `prisma db push` thay thế. |
| Kiểu dữ liệu | Kiểu API/chat tiếp tục ở `packages/shared`; B quản lý hợp đồng message trong `packages/contracts`. |

## 3. Điều kiện hoàn thành

- **Trợ lý AI:** người dùng hỏi trên web → AI trả lời bằng dữ liệu thật → chuyển sang NTD → hai bên nhắn tin, tải lại vẫn đủ lịch sử và đúng quyền.
- **Scan CV:** chọn file → xử lý nền → xem bản trích xuất → chọn dữ liệu → xác nhận lưu hồ sơ; xử lý được lỗi model, giao trùng và worker khởi động lại.
- **Mỗi PR:** lint, typecheck, test, build; thay quota/transaction/lease/revision thì kiểm thêm trên database test. Các ca nghiệm thu ở [08 — Kiểm thử](08-kiem-thu.md).

Tra cấu trúc, API và các ràng buộc ở [thiet-ke.md](thiet-ke.md); chuẩn bị môi trường theo [README repo](../../README.md). Các file `00`–`09` giữ phần giải thích và thiết kế chi tiết; thứ tự công việc cho hai người dùng bảng trên.
