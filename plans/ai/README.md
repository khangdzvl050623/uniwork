# Trợ lý AI và Scan CV — bộ tài liệu

## Bắt đầu ở đâu

| Bạn đang | Mở |
| --- | --- |
| **Xây** | **[thiet-ke.md](thiet-ke.md)** — sơ đồ, bảng, hợp đồng, 17 luật. Không lý lẽ. |
| **Debug** | [thiet-ke.md §12](thiet-ke.md) — bảng triệu chứng → chỗ tra |
| **Muốn đổi một quyết định** | `00`–`09` bên dưới. Mỗi file có lý do và các phương án đã loại |
| **Chạy thử trước khi code** | `node plans/ai/spike/thu-workers-ai.mjs <cv-that>` |

Khảo sát tại commit `720242b`, nhánh `dev`. Cập nhật 2026-09-13 sau hai vòng review
ngoài (R01–R16, #1–#15) và quyết định ba đường trích xuất CV.

---

## Bốn sự thật quyết định thiết kế

**1. Scan CV chạy trên Cloudflare Workers AI, chat chạy trên Gemini.**
Điều khoản Gemini free tier: *"Do not submit sensitive, confidential, or personal
information to the Unpaid Services"* + *"Human reviewers may read"*. CV là 100 % thông
tin cá nhân. Cloudflare: *"Unless otherwise agreed, Cloudflare does not use any Customer
Content to train generative AI tools."* → [00 C.3, C.6b](00-khao-sat.md) · [06 §12](06-scan-cv.md)

**2. Render gói free không có Background Worker** (chỉ Web Service, Static Site,
Postgres, Key Value), và hạn mức **750 giờ/tháng tính theo tài khoản** — đã chạm
767/750 ngày 25/08/2026 và bị treo service. Nên Document Worker là **một codebase, hai
chế độ chạy**: process riêng ở local, `WORKER_INLINE=true` trên Render.
→ [01 §4](01-kien-truc-va-ranh-gioi.md)

**3. `packages/shared` KHÔNG kiểm kiểu thân request.** `apiFetch<T>` chỉ kiểu hoá
response; mọi chỗ gọi đều `JSON.stringify(...)`. `UpdateSkillsInput` được dùng **0 lần**
trong `apps/web`, và bản khai cục bộ ở `useProfile.ts:35` đã lệch 3 trường so với shared
mà không ai phát hiện. Nên cơ chế cưỡng chế là **Zod fail-closed + `apiSend<TReq,TRes>`**,
không phải trình biên dịch. → [06 §9.4](06-scan-cv.md) · [09 §8](09-phan-bien.md)

**4. Chi phí hiện tại 0 USD/tháng.** Gemini free + Workers AI free (10.000 Neuron/ngày)
+ CloudAMQP Little Lemur free + Render free + Neon free. Kịch bản Gemini trả phí ở quy
mô 100 người dùng: **~18 USD/tháng cho chat** — khoản lớn nhất là model, không phải
hosting. → [01 §8.4](01-kien-truc-va-ranh-gioi.md)

---

## Ba chỗ README gốc của repo đang ghi sai

Sửa cùng lúc với việc thi công, không để sau.

| README nói | Thực tế |
| --- | --- |
| "Xử lý bất đồng bộ làm bằng bảng hàng đợi Postgres, bảng `EmailQueue`" | **Không có bảng đó.** Email gửi thẳng trong request — `applications.service.ts:236` |
| "Kafka / RabbitMQ — không có tầng free tier thực dụng" | CloudAMQP Little Lemur free có tồn tại |
| "type dùng chung qua `packages/shared` nên đổi backend là FE báo lỗi compile ngay" | Đúng với **response**, sai với **request body** — xem sự thật 3 |

---

## Tiến độ: 14 ngày không đủ

Ước lượng backend **~39 ngày-người** (khoảng 33–46); 14 ngày lịch với một dev cho
~13,5. Tức **~290 %** năng lực.

Đây là **ước lượng có giả định**, không phải số đo — repo không có time log. Giả định
và khoảng dao động ở [07 §0](07-lo-trinh-14-ngay.md).

**Oxa đã chốt: 2 tuần là mốc mềm, kéo dài được nếu không kham nổi.** Nên con số trên
là thông tin để **xếp thứ tự**, không phải cảnh báo trượt hạn. Thứ tự xây ở
[thiet-ke.md §9](thiet-ke.md).

Cách xếp: 14 ngày đầu đưa **cả hai feature đi hết một vòng dọc**, chấp nhận bề mặt hẹp
hơn. **37/42 yêu cầu** nằm trong 14 ngày; phần còn lại là **đề xuất dời, chờ quyết**.
Bảng từng yêu cầu → ngày → ai → nghiệm thu: [07 §3b](07-lo-trinh-14-ngay.md).

---

## Danh sách file

| # | File | Nội dung |
| --- | --- | --- |
| — | **[thiet-ke.md](thiet-ke.md)** | **Bản để xây.** Sơ đồ, data model, API, 17 luật, thứ tự thi công |
| 00 | [khao-sat.md](00-khao-sat.md) | Tái sử dụng được gì trong repo · sự thật đã kiểm từ tài liệu chính thức |
| 01 | [kien-truc-va-ranh-gioi.md](01-kien-truc-va-ranh-gioi.md) | Package, ranh giới dữ liệu, deploy, chi phí, free→paid |
| 02 | [messaging-rabbitmq.md](02-messaging-rabbitmq.md) | Topology, outbox, retry, DLQ, contract có version |
| 03 | [chatbot-va-tool.md](03-chatbot-va-tool.md) | Luồng chat, tool contract, DTO lược PII, phân loại câu hỏi |
| 04 | [handoff-realtime.md](04-handoff-realtime.md) | Máy trạng thái, Socket.IO, cursor, đối soát |
| 05 | [quota-dung-chung.md](05-quota-dung-chung.md) | Hai provider, hai tầng quota, circuit, chống spam |
| 06 | [scan-cv.md](06-scan-cv.md) | Pipeline, schema trích xuất, ánh xạ, transaction xác nhận |
| 07 | [lo-trinh-14-ngay.md](07-lo-trinh-14-ngay.md) | Ước lượng, 42 yêu cầu, lịch, 4 cổng quyết định |
| 08 | [kiem-thu.md](08-kiem-thu.md) | Ca nghiệm thu, đột biến, dữ liệu test |
| 09 | [phan-bien.md](09-phan-bien.md) | Rủi ro, cái gì phải đo, hai bảng đối chiếu review |
| — | [spike/thu-workers-ai.mjs](spike/thu-workers-ai.mjs) | Thử Workers AI với CV thật, không cần cài gì |

`00`–`09` **dài có chủ ý** — chúng giữ lý do và các phương án đã loại, để lúc debug
hoặc lúc muốn đổi hướng không phải suy lại từ đầu. Lúc xây thì chỉ cần `thiet-ke.md`.

---

## Điều kiện trước khi bắt đầu

**Ngày 1, trước khi viết dòng code nào** — hai việc này đổi con số mặc định và đổi cả
pipeline PDF:

1. Đo hạn mức thật ở https://aistudio.google.com/rate-limit → ghi
   `docs/gemini-quota-<ngày>.md` kèm ảnh chụp.
2. `node plans/ai/spike/thu-workers-ai.mjs <cv-that>` → chốt đường trích xuất PDF.

**Máy dev.** Plan thêm một container RabbitMQ (~150 MB) và một process Node. Sự cố
2026-09-12: RAM available còn 319 MB, Docker Desktop sập kéo Postgres chết theo. Chạy
chẩn đoán trong [docs/moi-truong-may-dev.md](../../docs/moi-truong-may-dev.md) trước;
dưới 2 GB thì dọn trước khi bắt đầu.
