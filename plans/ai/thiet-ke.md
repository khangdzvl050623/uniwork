# Thiết kế — Trợ lý AI và Scan CV

**File này để XÂY.** Sơ đồ, bảng, hợp đồng, luật. Không có lý lẽ.

Lý do đằng sau từng quyết định, các phương án đã loại, và lịch sử hai vòng review nằm
ở `00`–`09`. Mở chúng khi **debug** hoặc khi muốn đổi một quyết định — mỗi mục ở đây
có con trỏ tới đúng chỗ.

Cập nhật 2026-09-13, sau hai vòng review.

---

## 0. Một trang

| | Trợ lý AI + handoff | Scan CV |
| --- | --- | --- |
| **Model** | Gemini `gemini-3.5-flash-lite` | Cloudflare Workers AI (`moondream3.1` / `llama-3.2-11b-vision`) |
| **Vì sao khác nhau** | Cần function calling | Điều khoản Cloudflare cho phép gửi dữ liệu cá nhân |
| **Hạn mức free** | RPM/TPM/RPD theo project (đo ở AI Studio) | 10.000 Neuron/ngày |
| **Đồng bộ / bất đồng bộ** | Đồng bộ, stream SSE | Bất đồng bộ qua RabbitMQ |
| **Chỗ chạy** | `apps/api` | `apps/worker` (hoặc inline trong API) |
| **Quota người dùng** | 5 lượt/ngày | 3 lần/ngày |

**Chi phí hiện tại: 0 USD/tháng.** Gemini free + Workers AI free + CloudAMQP Little
Lemur free + Render free + Neon free.

**Nguyên tắc xuyên suốt:** database là nguồn sự thật; Socket.IO và RabbitMQ chỉ là
đường vận chuyển. Mọi màn hình phải đúng khi realtime không gửi gì.

---

## 1. Kiến trúc

```
┌─────────────┐                          ┌────────────────────────────────────┐
│  apps/web   │ ───── HTTP ────────────► │  apps/api            (Render free) │
│  React 19   │ ◄──── SSE (stream AI) ── │                                    │
│             │ ◄──── WebSocket ───────► │  modules/                          │
└─────────────┘                          │    ai/      chat/     documents/   │
                                         │    auth jobs applications profile  │
                                         │  realtime/  Socket.IO gateway      │
                                         └──┬──────────────┬──────────────┬───┘
                                            │              │              │
                    ┌───────────────────────┘              │              └──────┐
                    ▼                                      ▼                     ▼
          ┌──────────────────┐              ┌──────────────────────┐   ┌──────────────┐
          │ Postgres (Neon)  │              │ RabbitMQ (CloudAMQP) │   │ Gemini API   │
          │ + outbox_messages│              └──────────┬───────────┘   │ (chat)       │
          └──────────────────┘                         │               └──────────────┘
                    ▲                                  ▼
                    │                    ┌──────────────────────────────┐
                    └────────────────────┤  apps/worker                 │
                                         │  Document Worker             │
                                         └──────┬───────────────────────┘
                                                │
                          ┌─────────────────────┴──────────┐
                          ▼                                ▼
                ┌──────────────────┐            ┌────────────────────┐
                │ Cloudflare       │            │ Cloudinary         │
                │ Workers AI       │            │ (file CV, riêng tư)│
                └──────────────────┘            └────────────────────┘
```

### Package

```
packages/
  shared/      (đã có)  type + zod + luật nghiệp vụ thuần
  contracts/   MỚI      định dạng message + socket event, CÓ VERSION
  messaging/   MỚI      amqp connection, topology, publisher, outbox, consumer
  ai-runtime/  MỚI      provider, quota, circuit, rate limiter, prompt, telemetry
apps/
  api/  web/   worker/  MỚI
```

`apps/worker` chỉ được import: `@uniwork/contracts`, `@uniwork/messaging`,
`@uniwork/ai-runtime`, `@uniwork/shared`, `@prisma/client`. ESLint chặn phần còn lại.

**Vì sao RabbitMQ:** lời gọi model mất 20–40 giây, không giữ được trong request handler
trên instance 512 MB; việc phải sống sót qua lúc Render free ngủ; cần retry có backoff
và dead-letter cho một nhà cung cấp bên ngoài hay hỏng. → [01 §7.2](01-kien-truc-va-ranh-gioi.md)

### Bảng nào của ai

| Bảng | Chủ | API ghi | Worker ghi |
| --- | --- | --- | --- |
| `chat_sessions`, `chat_messages`, `user_presence` | chat | ✓ | ✗ |
| `cv_extractions` | documents | tạo, xác nhận | kết quả, lease, retry |
| `ai_*` (6 bảng) | `@uniwork/ai-runtime` | ✓ qua hàm package | ✓ qua hàm package |
| `outbox_messages`, `processed_messages`, `parked_messages` | `@uniwork/messaging` | ✓ qua hàm package | ✓ qua hàm package |
| `student_profiles`, `skills`, `notifications` | profile/skills/notifications | ✓ | **✗** |

→ [01 §3.0](01-kien-truc-va-ranh-gioi.md)

---

## 2. Feature 1 — Trợ lý AI + handoff

### 2.1 Luồng một lượt hỏi

```
POST /api/hoi-thoai  { kind, jobId?, clientSessionId }  →  { sessionId }
      (rẻ, không chạm model, idempotent)
              │
              ▼
POST /api/tro-ly/hoi  { sessionId, clientMessageId, noiDung }   [SSE]
      │
      ├─ requireAuth · rateLimit IP 30/phút · Zod 1–2000 ký tự
      ├─ circuit mở?                    → 503 AI_UNAVAILABLE
      ├─ mình là CHỦ phiên? state=AI_ACTIVE? → 403 / 409
      │
      ├─ ┌─ MỘT TRANSACTION ──────────────────────────────┐
      │  │ giữ 1 lượt (ON CONFLICT…WHERE) → 429 hết lượt  │
      │  │ INSERT AiTurn RESERVED         → 409 AI_BUSY   │
      │  │ INSERT ChatMessage             → P2002 = gửi lại│
      │  └─ rollback bất kỳ bước nào ⇒ KHÔNG trừ lượt ────┘
      │
      ├─ ngữ cảnh = system prompt + 12 tin gần nhất (bản ĐÃ LƯỢC PII)
      ├─ streamText({ tools, stopWhen: isStepCount(4), abortSignal })
      │     ├─ tool → service thật → DTO lược → model
      │     ├─ delta chữ → SSE `chu`
      │     └─ deNghiChuyenNhaTuyenDung → SSE `de-nghi`  (KHÔNG gửi gì cho NTD)
      │
      ├─ ghi tin AI: INSERT … WHERE state='AI_ACTIVE' AND activeAiRunId=$id
      │     0 hàng ⇒ đã chuyển sang người thật ⇒ BỎ câu trả lời
      └─ chốt lượt + SSE `xong`
```

**Sự kiện SSE:** `phien` · `chu` · `tool` · `de-nghi` · `the` (dữ liệu UI, không qua
model) · `xong` · `loi`.

Lỗi **sau** khi header đã gửi phải đi bằng sự kiện `loi`, không đổi được HTTP status.

→ [03 §1](03-chatbot-va-tool.md)

### 2.2 Hai đường dữ liệu — luật quan trọng nhất của feature này

```
service thật (listApplicants, getStudentProfile, …)
        │
        ├─► DTO cho MODEL   { ma:'ung-vien:3', hoTenVietTat:'N.V.A',
        │                     truong:'BKHN', matchScore:82 }
        │        ↑ allow-list. KHÔNG phone, KHÔNG email, KHÔNG fullName
        │
        └─► DTO cho UI      { id, fullName, phone, email, … }
                 └─► SSE `the` → client tự ghép vào chỗ model viết `ung-vien:3`
```

Lịch sử hội thoại **lưu bản đã lược**. Không lưu bản đầy đủ ở đâu.

→ [03 §3.2b](03-chatbot-va-tool.md)

### 2.3 Máy trạng thái handoff

```
                 ┌────────────────────────────────────┐
   tạo phiên     ▼                                    │
   ─────────► AI_ACTIVE ◄──────────────┐              │
                 │                     │ (E) quay-lai-ai
      (A) chuyen-ntd                   │              │
          SV bấm, PHẢI có jobId        │              │
                 ▼                     │              │
         WAITING_EMPLOYER ─────────────┼──────────────┘
              │      │   (B) huy-cho
   (C) tiep-nhan     │
       NTD bấm │     │ (D) ket-thuc
               ▼     ▼
        HUMAN_ACTIVE ──► CLOSED   (cuối; mở lại = phiên MỚI)
```

| # | Điều kiện | Hiệu ứng |
| --- | --- | --- |
| A | `kind=AI_STUDENT`, tin `OPEN`, NTD `verifiedAt`, và NTD **trùng** hoặc đang null | Abort AI run · **đóng băng** `handoffEmployerProfileId` + `jobId` · `employerVisibleFromSeq = COALESCE(cũ, seq)` · tin mở đầu `visibleToEmployer=true` · thông báo NTD |
| B | — | Tin SYSTEM, không báo NTD |
| C | Đúng NTD của tin | `updateMany WHERE state='WAITING_EMPLOYER'`; 0 hàng ⇒ 409 |
| D | cả hai bên | Tin SYSTEM |
| E | — | NTD **giữ** quyền đọc phần cũ, **không** thấy phần mới |

Mọi chuyển trạng thái là `updateMany` có `where.state`. Không bao giờ đọc-rồi-kiểm-rồi-ghi.

**Đổi NTD ⇒ phiên mới.** Handoff lần hai sang NTD khác → 409 kèm
`{ goiY: { taoPhienMoi: true } }`.

→ [04 §1](04-handoff-realtime.md)

### 2.4 Quyền — đọc tách khỏi ghi

| Ai | ĐỌC | Phòng socket | GỬI được khi |
| --- | --- | --- | --- |
| Chủ phiên (`ownerUserId`) | toàn bộ, mọi state | `hoi-thoai:<id>:chu` | `HUMAN_ACTIVE` |
| NTD nhận handoff | `seq >= employerVisibleFromSeq` **AND** `visibleToEmployer=true` | `hoi-thoai:<id>:ntd` | `HUMAN_ACTIVE` |
| Người khác, kể cả ADMIN | — | — | 403 |

Quyền đọc neo vào **`handoffEmployerProfileId` đã đặt hay chưa**, KHÔNG vào `state`.

```ts
const quyen = await quyenTruyCapPhien(user, sessionId)   // null ⇒ 403
await socket.join(quyen.phong)                            // KHÔNG tự ghép chuỗi
```

Emit:
```ts
io.to(`hoi-thoai:${id}:chu`).emit('hoi-thoai:tin-moi', { message })
if (message.visibleToEmployer) io.to(`hoi-thoai:${id}:ntd`).emit(…)
```

→ [03 §6.2c](03-chatbot-va-tool.md) · [04 §3.3](04-handoff-realtime.md)

### 2.5 Tool

Danh tính lấy từ **closure**, không có trường `userId` nào trong `inputSchema`.

| Vai | Tool |
| --- | --- |
| STUDENT | `timViecLam` · `xemChiTietViec` · `xemLichRanhCuaToi` · `xemHoSoCuaToi` · `xemDonUngTuyenCuaToi` · `xemTinDaLuu` · `danhMucKyNang` · `deNghiChuyenNhaTuyenDung` |
| EMPLOYER | `xemTinCuaToi` · `xemChiTietTinCuaToi` · `xemUngVien` |
| cả hai | `huongDanSuDung(chuDe)` — enum đóng |

- Tool **gọi service đã export**, không gọi `prisma` — nhờ vậy thừa hưởng
  `TRANG_THAI_MO_LIEN_HE` ở tầng truy vấn.
- `deNghiChuyenNhaTuyenDung` **không ghi database, không gửi gì** — chỉ trả về mô tả
  một nút bấm.
- Trần output mỗi tool: 4 KB JSON.
- Chuỗi tự do từ DB bọc `<noi-dung-nguoi-dung nguon="…">…</noi-dung-nguoi-dung>`,
  cắt 500 ký tự.

→ [03 §3](03-chatbot-va-tool.md)

### 2.6 API + Socket

| Method | Đường dẫn | Vai |
| --- | --- | --- |
| POST | `/api/hoi-thoai` | STUDENT, EMPLOYER |
| GET | `/api/hoi-thoai` `?kind=` | STUDENT, EMPLOYER |
| GET | `/api/hoi-thoai/:id` `?cursor=` | cả hai |
| POST | `/api/hoi-thoai/:id/tin-nhan` | cả hai |
| POST | `/api/hoi-thoai/:id/chuyen-ntd` · `/huy-cho` · `/quay-lai-ai` | STUDENT |
| POST | `/api/hoi-thoai/:id/tiep-nhan` | EMPLOYER |
| POST | `/api/hoi-thoai/:id/ket-thuc` | cả hai |
| GET | `/api/ntd/hoi-thoai` | EMPLOYER |
| POST | `/api/tro-ly/hoi` | SSE |
| GET | `/api/tro-ly/luot-con-lai` | cả hai |

| Client → Server | ACK |
| --- | --- |
| `hoi-thoai:vao` | `{ ok, cursor, duocGui }` |
| `hoi-thoai:gui` | `{ ok, messageId, seq }` — **ACK sau khi commit** |
| `hoi-thoai:tai-bu { cursor }` | `{ ok, tinNhan[], cursor, conNua }` |
| `hoi-thoai:dang-go` | không ACK |

| Server → Client | Phòng |
| --- | --- |
| `hoi-thoai:tin-moi` · `hoi-thoai:trang-thai` · `hoi-thoai:dang-go` | `hoi-thoai:<id>:chu` / `:ntd` |
| `ntd:hoi-thoai-cho` | `ntd:<employerProfileId>` |
| `thong-bao:moi` · `cv-scan:tien-trinh` · `cv-scan:xong` | `user:<userId>` |
| `phien:het-han` | socket đó |

**Cursor, không phải seq.** Với NTD thì dãy `seq` có khoảng trống hợp lệ (tin riêng tư
của sinh viên). Cursor đục, client chỉ cất và gửi lại. Trả **mảng rỗng + cursor tiến**
là kết quả đúng.

→ [04 §5.3](04-handoff-realtime.md)

---

## 3. Feature 2 — Scan CV

### 3.1 Pipeline

```
[web] PDF.js: đủ chữ? → gửi PDF gốc | không → render JPEG 1600px, tuần tự
      POST /api/toi/quet-cv   multipart { goc, trangAnh[]?, rasterFailed? }
   │
   ├─ multer 5 MB · sniffFileKind ∈ {pdf,jpeg,png}
   ├─ kiemPdf(goc) — pdf-lib: mã hoá? trang ≤ 5?  → 400 FILE_UNSUPPORTED
   │     số ảnh client gửi phải KHỚP số trang thật → 400
   │     (file bị chặn KHÔNG sinh request nào tới model)
   ├─ sha256 → contentHash; tra (owner, hash, pipelineVersion) → xem 3.3
   ├─ upload Cloudinary  type=authenticated, public_id = uuid
   │
   ├─ ┌─ TRANSACTION ────────────────────────────┐
   │  │ giữ 1 lượt CV_SCAN, ghi quotaDay         │
   │  │ INSERT cv_extractions (QUEUED, runSeq=1) │
   │  │ ghiOutbox('cv.scan.requested',{runSeq})  │
   │  └──────────────────────────────────────────┘
   └─ 202 { extractionId, status:'QUEUED' }

[relay] claim → publish (confirm + mandatory) → mark CAS

[worker]
   ├─ processed_messages? → ack, dừng
   ├─ CAS → PROCESSING, đặt leaseOwner + lease 5 phút
   ├─ ghiOutbox('realtime.emit', cv-scan:tien-trinh)
   ├─ xinPhepGoiModel('cloudflare',…)
   │     không qua → trả lease + nextAttemptAt + outbox, ack   (KHÔNG nack)
   ├─ trichXuat(job)  ← xem 3.2. Đường B: N lời gọi TUẦN TỰ, mỗi trang một lần,
   │     bắn cv-scan:tien-trinh sau mỗi trang, rồi GHÉP theo 3.2b
   ├─ Zod parse → chuẩn hoá → cảnh báo bao phủ
   │     (KHÔNG ánh xạ kỹ năng — worker không chạm bảng skills)
   ├─ ┌─ TRANSACTION ────────────────────────────────────────┐
   │  │ UPDATE → NEEDS_REVIEW WHERE leaseOwner=$tôi AND runSeq=$rs │
   │  │ chotGiuChoScan()   ← chốt lượt người dùng, CAS, 1 lần │
   │  │ INSERT processed_messages                            │
   │  │ ghiOutbox('cv.scan.completed')                       │
   │  └──────────────────────────────────────────────────────┘
   └─ ack   ← SAU commit

[api] cv.scan.result.q (queue dùng chung, 1 lần)
   ├─ createNotification
   └─ ghiOutbox('realtime.emit') → fanout → mỗi instance emit socket của mình

[web] màn hình đối chiếu → POST …/xac-nhan
```

### 3.2 Ba đường trích xuất — ĐÃ CHỐT

Người dùng **chỉ chọn file và bấm Upload**. Hệ thống tự rẽ nhánh, không hỏi gì thêm.

```
[TRÌNH DUYỆT]  1 file
   │
   ├─ PDF? ── PDF.js getTextContent() từng trang
   │            ├─ ≥200 ký tự/trang  → gửi PDF gốc                    → ĐƯỜNG A
   │            └─ ít hơn            → render JPEG → gửi gốc + N ảnh  → ĐƯỜNG B
   └─ JPG/PNG ────────────────────────────────────────────────────────► ĐƯỜNG C

[SERVER]  POST /api/toi/quet-cv   multipart { goc, trangAnh[]? }
   ├─ kiemPdf(goc) — pdf-lib: mã hoá? số trang ≤ 5?   ← KHÔNG tin client
   ├─ số ảnh phải KHỚP số trang pdf-lib đếm được       → lệch: 400
   └─ Cloudinary: gốc + từng ảnh, đều `authenticated`

[WORKER]
   A → /ai/tomarkdown → LLM text → JSON          1 lời gọi
   B → vision × N trang, TUẦN TỰ → N mảnh → ghép N lời gọi
   C → vision → JSON                              1 lời gọi
```

**Rasterize ở trình duyệt, không ở server.** Chi phí RAM nằm trên máy người dùng và
tự scale theo số người, thay vì dồn vào một instance 512 MB. Đổi lại: server không còn
thấy nội dung thật của trang, nên `kiemPdf` trên **file gốc** là trust boundary duy
nhất — số ảnh client gửi phải khớp số trang thật.

| Tham số | Giá trị | Vì sao |
| --- | --- | --- |
| Định dạng ảnh | **JPEG q0.85** | Trang scan nén PNG ra 3–5 MB, JPEG ~250 KB. Trên mạng di động là khác biệt giữa 2 giây và 40 giây upload |
| Độ phân giải | cạnh dài **1600 px** | Đủ đọc chữ 10pt. Vision model scale về tối đa 3072 nên cao hơn chỉ phí băng thông. Đo lại bằng spike |
| Trần trang | **5** | Client render **tuần tự**, có progress và nút huỷ |
| Ngưỡng "đủ chữ" | ≥ 200 ký tự/trang trung bình | |
| PDF **lai** (vài trang text, vài trang scan) | **Rasterize hết** | Trộn hai đường trong một CV làm phần ghép phức tạp gấp đôi mà không được gì |
| `pdfjs-dist` 6.3.289 | **lazy-load** bằng dynamic import, nhớ cấu hình `workerSrc` | ~1 MB, phần lớn người dùng không vào màn hình này |

**PDF.js hỏng trên máy người dùng** (tab hết bộ nhớ, PDF lạ): client gửi PDF gốc kèm
cờ `rasterFailed` → server chạy đường A → rỗng thì `FAILED` với *"Chưa trích được văn
bản từ PDF này. Bạn tải ảnh JPG/PNG của CV lên, hoặc điền tay."* Đây là **lưới cuối**,
không phải baseline.

Ghi `duongDaDi` (`'tomarkdown'` | `'vision'`) và `soTrangAnh` mỗi lần chạy để đo tỉ lệ
đi đường rẻ — con số đó quyết định 10.000 neuron/ngày có đủ không.

### 3.2b Ghép nhiều trang — phần tốn công nhất của đường B

Mỗi trang một lời gọi vision → N mảnh JSON → ghép ở worker.

Prompt mỗi trang **phải** nói rõ: *"đây là trang i/N của một CV; trích những gì THẤY
TRÊN TRANG NÀY; không suy đoán phần nằm ở trang khác."* Thiếu câu đó thì model tự bịa
phần nó đoán là ở trang sau.

| Loại | Luật ghép |
| --- | --- |
| Mảng (`hocVan`, `kinhNghiem`, `chungChi`, `kyNang*`) | Nối, rồi **khử trùng** theo cặp đã chuẩn hoá không dấu: `(truong, namKetThuc)` · `(congTy, chucDanh)` |
| Trường đơn (`hoTen`, `soDienThoai`, `gioiThieu`) | Giá trị không-null **đầu tiên** theo thứ tự trang |
| Hai trang cho giá trị đơn **khác nhau** | Cả hai vào `warnings` mã `MAU_THUAN`. **Không tự chọn** |
| `soTrang` | Từ `kiemPdf`, không lấy từ model |
| `trangDaDoc` | Tập trang trả về được ≥ 1 mẩu — tín hiệu bao phủ chạy nguyên |

**Ca khó nhất: mục bị cắt qua ranh giới trang.** Một mục kinh nghiệm nằm nửa trang 1
nửa trang 2 sẽ xuất hiện dở dang ở cả hai mảnh. Khử trùng bắt được phần lớn nhưng
không phải tất cả — phải có ca test riêng, và phần còn sót thì người dùng thấy hai
dòng gần giống nhau trên màn hình đối chiếu và tự bỏ một dòng. Chấp nhận được; im lặng
gộp nhầm hai mục khác nhau mới là tệ.

**Neuron:** ~56/trang → CV 3 trang ≈ 170. Nhỏ so với 10.000/ngày. Nhưng là **N request**
⇒ N× áp lực RPM và N× độ trễ, nên worker gọi **tuần tự** và bắn progress từng trang qua
`cv-scan:tien-trinh`.

→ [06 §1, §2.2](06-scan-cv.md)

### 3.3 Trạng thái job

```
QUEUED ──► PROCESSING ──► NEEDS_REVIEW ──► CONFIRMED
   ▲            │               │
   └────────────┤               └─► (bỏ qua) CONFIRMED, appliedAt=null
   trả lease +  │
   nextAttemptAt└─────────────► FAILED ──► /chay-lai ──► QUEUED (runSeq+1)
```

**Ba bộ đếm tách nhau:**

| Cột | Đếm | Trần |
| --- | --- | --- |
| `modelRuns` | lần **đã gọi model** và hỏng vì lỗi tạm thời | 3 → lần 4 **bị chặn trước khi gọi** |
| `quotaWaits` | lần hoãn vì hạn mức, **chưa gọi model** | không giới hạn lần; hạn chót 24 h |
| `dispatches` | lần message được giao | chỉ quan sát |

**Nộp lại cùng file — trả gì theo trạng thái:**

| Trạng thái đã có | Trả | Tốn lượt |
| --- | --- | --- |
| `NEEDS_REVIEW` / `CONFIRMED` | 200 + kết quả cũ | không |
| `QUEUED` / `PROCESSING` | 200 + trạng thái | không |
| `FAILED` vì **file** (`FILE_UNSUPPORTED`, `NOT_A_CV`) | **409** đổi file đi | không |
| `FAILED` vì **hệ thống** | cho `POST …/chay-lai` | **có** |

→ [02 §5](02-messaging-rabbitmq.md)

### 3.4 Schema trích xuất — năm nhóm

| Nhóm | Có đích lưu? | Nội dung |
| --- | --- | --- |
| `mappedData` | **Có** | `caNhan{hoTen,soDienThoai}` · `hocVan[]` · `kyNangGhiRo[]` · `kyNangSuyRa[]` · `gioiThieu` |
| `khongCoDichLuu` | Không | `kinhNghiem[]` · `chungChi[]` · `lienHeKhac{email,diaChi,lienKet}` — giữ cấu trúc |
| `additionalSections` | Không | mục có tiêu đề, nội dung tự do |
| `unmappedContent` | Không | chữ trôi nổi |
| `warnings` + `unreadable` + `trangDaDoc` | — | tín hiệu bao phủ |

**Bảng ánh xạ — cột cuối quyết định giao diện có vẽ nút lưu hay không:**

| JSON | Trường | Áp dụng |
| --- | --- | --- |
| `caNhan.hoTen` | `fullName` | **Không** — chỉ đối chiếu |
| `caNhan.soDienThoai` | `phone` | Có |
| `hocVan[i].truong` / `.nganh` | `university` / `major` | Có — người dùng **chọn** `i` |
| `hocVan[i]` mốc năm | `year` | **Không** — tự nhập |
| `gioiThieu` | `bio` | Có |
| `kyNangGhiRo` / `kyNangSuyRa` | `StudentSkill` | Có — `suyRa` **không** tick sẵn |
| `khongCoDichLuu.*` | — | **Không** |

Ánh xạ kỹ năng chạy **ở API lúc dựng màn hình duyệt**, dùng `unaccent`. Ba bước: slug
chính xác → không dấu → chứa nhau (≥4 ký tự). **Không bao giờ tạo `Skill` mới.**

→ [06 §3](06-scan-cv.md)

### 3.5 Xác nhận — một transaction, năm bước

```ts
POST /api/toi/quet-cv/:id/xac-nhan
  { revision, hocVanChinh, hoSo, themSkillIds }

await prisma.$transaction(async (tx) => {
  1. CAS  cv_extractions  NEEDS_REVIEW → CONFIRMED, appliedAt      → 0 hàng: 409
  2. capNhatHoSoTrongTx(tx, userId, hoSo, revision)                → 0 hàng: 409
  3. themKyNangTrongTx(tx, spId, themSkillIds)   createMany skipDuplicates
  4. chotGiuChoScan(tx, id)                       CAS quotaSettledAt
  5. ghiOutbox('cv.scan.applied')
})
```

**Không** gọi `updateStudentProfile` / `replaceSkills` cũ — chúng dùng prisma global và
nằm ngoài transaction.

| Khác biệt | Tick mặc định |
| --- | --- |
| `CHI_CO_TRONG_CV` | **Có** |
| `KHAC` | **Không** — ghi đè phải là hành động cố ý |
| `GIONG`, `CHI_CO_TRONG_HO_SO` | Không |

→ [06 §9.1, §9.2](06-scan-cv.md)

### 3.6 API

| Method | Đường dẫn |
| --- | --- |
| POST | `/api/toi/quet-cv` → 202 · multipart `{ goc, trangAnh[]?, rasterFailed? }` |
| GET | `/api/toi/quet-cv` · `/:id` · `/:id/file` (signed URL 5 phút) |
| POST | `/api/toi/quet-cv/:id/xac-nhan` · `/bo-qua` · `/chay-lai` |
| DELETE | `/api/toi/quet-cv/:id` |

`GET /:id` là đường đối soát — web gọi **định kỳ 5 s kể cả khi socket còn nối**, dừng
ở trạng thái cuối, backoff 5→15→60 s có jitter.

---

## 4. Data model

### Chat

```prisma
enum ChatKind         { AI_STUDENT, AI_EMPLOYER }
enum ChatSessionState { AI_ACTIVE, WAITING_EMPLOYER, HUMAN_ACTIVE, CLOSED }
enum ChatSenderType   { STUDENT, EMPLOYER, AI, SYSTEM }

ChatSession   id · kind · ownerUserId · studentProfileId? · jobId?
              handoffEmployerProfileId?   ← đóng băng sau handoff đầu
              state · messageSeq · employerVisibleFromSeq? · activeAiRunId?
              handoffRequestedAt? · handoffAcceptedAt? · closedAt? · closedByUserId?
              previousSessionId? · lastMessageAt
              @@index([ownerUserId, kind, lastMessageAt])
              @@index([handoffEmployerProfileId, state, lastMessageAt])

ChatMessage   id · sessionId · seq · senderType · senderUserId?
              clientMessageId? · body · visibleToEmployer(false)
              @@unique([sessionId, seq]) @@unique([sessionId, clientMessageId])

UserPresence  userId@id · lastSeenAt · connections
```

**4 CHECK viết tay trong migration:** kind↔studentProfileId · NTD không có handoff ·
NTD chỉ AI_ACTIVE|CLOSED · rời AI_ACTIVE phải đủ handoff+job+seq. → [03 §5.0](03-chatbot-va-tool.md)

### Quota

```prisma
enum AiFeature   { CHAT, CV_SCAN }
enum AiTurnState { RESERVED, SUCCEEDED, FAILED, REFUNDED }

AiUsageDay          userId · day(VN) · feature · turnsReserved/Used/Refunded
                    @@unique([userId, day, feature])
AiTurn              userId · feature · state · runnerId · quotaDay
                    sessionId? · extractionId? · category · requestCount · toolRounds
                    toolNames[] · inputTokens · outputTokens · modelId · promptVersion
                    latencyMs · timeToFirstTokenMs · errorCode · handoffProposed
AiRequestLog        turnId · step · attempt · modelId · tokens · finishReason
                    · httpStatus · latencyMs   @@unique([turnId, step, attempt])
AiProjectBudgetDay  day · provider · modelId · feature
                    requests · neurons · inputTokens · outputTokens · rateLimitHits
                    @@id([day, provider, modelId, feature])
AiProviderWindow    provider · modelId · minute(UTC) · requests · inputTokens
                    @@id([provider, modelId, minute])
AiCircuit           id = "provider:modelId" · openUntil · lastKind · consecutive
```

**Chỉ mục unique một phần, viết tay:**
```sql
CREATE UNIQUE INDEX ai_turns_mot_luot_dang_chay
  ON ai_turns ("userId") WHERE state = 'RESERVED';
CREATE UNIQUE INDEX cv_extractions_mot_job_dang_chay
  ON cv_extractions ("ownerUserId") WHERE status IN ('QUEUED','PROCESSING');
```

### Scan CV

```prisma
enum CvExtractionStatus { QUEUED, PROCESSING, NEEDS_REVIEW, CONFIRMED, FAILED }

CvExtraction  id · ownerUserId · status · runSeq
              contentHash · cloudinaryPublicId · fileFormat · fileSize · pageCount
              pipelineVersion · schemaVersion · promptVersion · modelId
              result(Json) · coverage(Json) · duongDaDi
              errorCode · modelRuns · quotaWaits · dispatches
              leaseExpiresAt · leaseOwner · blockedReason · nextAttemptAt
              quotaDay · quotaSettledAt · appliedAt
              @@unique([ownerUserId, contentHash, pipelineVersion])
              @@index([status, leaseExpiresAt])
```

### Messaging

```prisma
OutboxMessage     id · type · exchange · routingKey · version · payload · correlationId
                  publishedAt? · attempts · lastError? · nextTryAt
                  claimedBy? · claimUntil?
                  @@index([publishedAt, nextTryAt, claimUntil, createdAt])
ProcessedMessage  @@id([messageId, consumer])
ParkedMessage     messageId · consumer · type · version · reason · payload
```

### Sửa bảng đã có

```prisma
StudentProfile  + revision Int @default(0)   ← CAS cho MỌI đường ghi hồ sơ + kỹ năng
```

---

## 5. Quota

```
                    xinPhepGoiModel(provider, modelId, feature, tokens)
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                ▼                    ▼                 ▼
   1. circuit       2. RPM/TPM         3. RPD provider     4. ngân sách app
   ai_circuits      ai_provider_       ai_project_         cùng bảng,
   id=prov:model    windows (phút)     budget_days         lọc theo feature
        │                │                    │                 │
        └────────────────┴─── cả bốn qua ─────┴─────────────────┘
                                │
                        requests += 1   ← CHỖ DUY NHẤT tăng cột này
```

| | Google (chat) | Cloudflare (scan CV) |
| --- | --- | --- |
| Đơn vị | request + token | **Neuron** |
| Ngày reset | `ngayPacific()` | `ngayUTC()` |
| Trần cộng theo | **từng model** | **tổng mọi model** |
| Vượt trần | 429, chờ được | request **lỗi thẳng**, không tràn sang trả phí |
| Đặt trần | 2 pha không cần | **2 pha**: ước theo `max_tokens` → chỉnh bằng usage thật |

**Ngày của người dùng là `ngayVN()`** — khác cả hai cột trên.

**Ai chốt lượt người dùng:**

| Feature | Ai cộng `AiUsageDay` |
| --- | --- |
| `CHAT` | `chotLuot` — turn = lượt, một-một |
| `CV_SCAN` | **chỉ `chotGiuChoScan`**, một lần mỗi job. `chotLuot` chỉ ghi attempt + usage |

**Hoàn lượt:** hoàn khi **hệ thống ta hỏng theo cách quan sát được** (5xx, timeout,
deploy, lỗi lập trình). **Không hoàn** khi model đã chạy, kể cả khi client đứt kết nối
— stream chạy nốt ở server và **vẫn ghi tin AI**, tải lại là thấy.

**Circuit — ba loại lỗi:**

| Loại | `openUntil` |
| --- | --- |
| RPM | đầu phút kế tiếp, `consecutive` không tăng |
| RPD | 00:00 ngày reset của provider |
| SERVER | `now + min(2^n × 60 s, 30 phút)` |

→ [05](05-quota-dung-chung.md)

---

## 6. Messaging

```
── NGHIỆP VỤ: queue DÙNG CHUNG, mỗi message xử lý ĐÚNG 1 LẦN ──────────────

  cv.scan.requested ──►┌──────────────────────┐──► cv.scan.q      (worker)
  cv.scan.completed ──►│ X uniwork.documents  │──► cv.scan.result.q (api)
  cv.scan.failed    ──►└──────────┬───────────┘
                                  │ chỉ khi broker tự dead-letter
                                  ▼  (vượt x-delivery-limit)
                    X uniwork.documents.dlx ──► cv.scan.parked.q

  application.submitted ─►┌───────────────────────┐──► notify.email.q
  application.status    ─►│ X uniwork.            │──► notify.persist.q
  chat.handoff.*        ─►│   notifications       │
                          └───────────────────────┘

── REALTIME: fanout, mỗi instance MỘT bản ────────────────────────────────

  realtime.emit ─►┌──────────────────────────┐─► rt.<A> ─► A: io.to(room).emit
   (do consumer   │ X uniwork.realtime       │─► rt.<B> ─► B: …
    nghiệp vụ ghi │        (fanout)          │─► rt.<C> ─► C: …
    outbox)       └──────────────────────────┘   exclusive, autoDelete
```

**Không có queue retry TTL.** Retry đi qua outbox có lịch:

```sql
BEGIN;
  UPDATE cv_extractions SET status='QUEUED', "leaseOwner"=NULL,
         "modelRuns"="modelRuns"+1, "nextAttemptAt"=now()+$backoff
   WHERE id=$id AND "leaseOwner"=$myLease;      -- CAS
  INSERT processed_messages …;
  INSERT outbox_messages … "nextTryAt" = now()+$backoff;
COMMIT;  -- rồi mới ack
```

Backoff 30 s → 5 phút → 30 phút.

**Publish:** confirm channel + `mandatory: true` + bắt `'return'` + timeout 5 s.
Lệnh nghiệp vụ `mandatory: true`; `realtime.emit` `mandatory: false`.

**Outbox claim:** `claimedBy` + `claimUntil` 30 s → commit → publish → mark bằng CAS.
Chấp nhận phát trùng sau crash; `processed_messages` + CAS lease lo phần hậu quả.
**Không hứa exactly-once cho lời gọi model.**

→ [02](02-messaging-rabbitmq.md)

---

## 7. Mười lăm luật — phá thì hỏng IM LẶNG

Đây là phần đáng dán lên tường. Mỗi dòng: phá được mà không có lỗi nào bắn ra.

| # | Luật | Phá thì |
| --- | --- | --- |
| 1 | Tool **không** trả `phone` / `email` / `fullName` | PII đi vào ngữ cảnh model, vi phạm điều khoản, không ai thấy |
| 2 | `requests` chỉ tăng ở `xinPhepGoiModel()` | Đếm hai lần, trần 400 thật ra chặn ở 200 |
| 3 | `CV_SCAN`: chỉ `chotGiuChoScan` chạm `AiUsageDay` | Hai lần retry được hoàn ⇒ người dùng có `limit + 1` lượt |
| 4 | `ack` **sau** khi COMMIT | Process chết giữa hai bước ⇒ CV bốc hơi, UI treo ở QUEUED |
| 5 | Publish có `mandatory` + bắt `return` | Sai binding ⇒ outbox đánh dấu đã phát, job nằm QUEUED vĩnh viễn |
| 6 | `nack(_,_,false)` **không** tạo retry — retry qua outbox | Dựa vào DLX để đếm 5 lần là hiểu sai; message đi thẳng DLX ngay lần đầu |
| 7 | `socket.join(quyen.phong)`, không ghép chuỗi | Join báo OK, client **không bao giờ** nhận tin |
| 8 | Emit `:ntd` chỉ khi `visibleToEmployer` | NTD nhận realtime từng câu sinh viên nói riêng với AI |
| 9 | `employerVisibleFromSeq = COALESCE(cũ, $seq)` | Handoff lần hai xoá sạch đoạn NTD đã được đọc |
| 10 | Tải bù bằng **cursor**, không suy từ seq | Với NTD, khoảng trống hợp lệ bị hiểu là mất tin ⇒ tải bù vô hạn |
| 11 | Thêm kỹ năng = `createMany({skipDuplicates})`, **không** replace | Xoá mất kỹ năng người dùng tự khai |
| 12 | `revision` **bắt buộc**, không tuỳ chọn | Fail-open: CAS im lặng không chạy, lost update quay lại |
| 13 | `apps/worker` không import `apps/api` | Seam rò trong tuần đầu, tách service về sau thành không thể |
| 14 | `ngayVN` / `ngayPacific` / `ngayUTC` — ba hàm, dùng đúng chỗ | Lệch 7–15 tiếng; 429 ập tới lúc bộ đếm hiển thị "0/400" |
| 15 | Mọi CAS ghi kết quả có `leaseOwner` **và** `runSeq` | Worker cũ hoặc callback cũ ghi đè kết quả của lần chạy mới |

Thêm hai luật về vòng đời process:

| # | Luật | Phá thì |
| --- | --- | --- |
| 16 | Entrypoint worker là **file riêng** (`main.ts`), không so `import.meta.url` với `file://${argv[1]}` | Trên Windows điều kiện luôn sai ⇒ **không đăng ký consumer nào**, không lỗi |
| 17 | `shutdown()` chỉ huỷ `AiTurn` có `runnerId` của **chính process này** | API deploy làm hỏng lượt worker đang chạy |

---

## 8. Cấu hình

```ts
// Tính năng THÊM: thiếu khoá thì chỉ nút AI biến mất, phần còn lại chạy nguyên vẹn.
GOOGLE_GENERATIVE_AI_API_KEY  ''
CLOUDFLARE_ACCOUNT_ID         ''
CLOUDFLARE_API_TOKEN          ''

AI_CHAT_MODEL                 'gemini-3.5-flash-lite'
AI_SCAN_MODEL                 '@cf/moondream/moondream3.1-9B-A2B'

AI_CHAT_TURNS_PER_DAY         5
AI_SCAN_JOBS_PER_DAY          3
AI_PROJECT_REQUESTS_PER_DAY   400      // Google, theo từng model
AI_CF_NEURONS_PER_DAY         9000     // ĐẶT THẤP HƠN 10.000 thật
AI_CHAT_BUDGET_SHARE          0.7

AI_MAX_OUTPUT_TOKENS          1024
AI_REQUEST_TIMEOUT_MS         30_000
AI_MAX_TOOL_ROUNDS            4        // ← nút điều chỉnh chi phí trực tiếp
AI_HISTORY_MESSAGES           12

RABBITMQ_URL                  'amqp://uniwork:uniwork_dev@localhost:5672'
WORKER_INLINE                 false    // true trên Render free
WORKER_PREFETCH               1
SOCKET_ADAPTER                ''       // 'redis' khi lên 2+ instance
```

Thêm cả vào `apps/api/vitest.config.ts` với giá trị rỗng — nhánh "chưa cấu hình" phải
được đi qua thật trong test.

**Mã lỗi mới:** `AI_QUOTA_EXCEEDED`(429) · `AI_BUSY`(409) · `AI_UNAVAILABLE`(503) ·
`FILE_UNSUPPORTED`(400).

---

## 9. Thứ tự xây

```
1  contracts + packages tách ra + ESLint
        │
        ├──► 2  quota (bảng, SQL nguyên tử, circuit, sweeper)
        │           │
        │           ├──► 6  tool + DTO lược PII
        │           │           └──► 7  SSE + chat.service
        │           │                       └──► 8  Socket.IO
        │           │                                   └──► 9  handoff
        │           │
        └──► 3  messaging (connection, topology, outbox, consumer)
                    │
                    └──► 4  upload + kiemPdf + cv_extractions
                                └──► 5  worker + trichXuat
                                            └──► 10 xác nhận + revision + apiSend
```

**Chặn cứng:**

| Trước | Sau | Vì sao |
| --- | --- | --- |
| 1 | tất cả | Không có package tách thì worker không có đường hợp lệ tới quota |
| 2 | 5, 6 | Cả hai feature giữ lượt trước khi gọi model |
| 3 | 4, 5 | Không có outbox thì không có gì để tiêu thụ |
| 8 | 9 | Handoff cần phòng và ACK |

**Hai việc phải làm NGÀY 1, trước khi viết code:**

1. Đo hạn mức thật ở AI Studio → `docs/gemini-quota-<ngày>.md` + ảnh chụp.
2. `node plans/ai/spike/thu-workers-ai.mjs <cv-that>` → chốt đường 1/2/3.

Kết quả hai việc này đổi con số mặc định và đổi cả pipeline PDF. Viết code trước rồi
đo sau là làm lại.

---

## 10. Ngưỡng phát hành

| Đo gì | Ngưỡng | Cách |
| --- | --- | --- |
| **Tỉ lệ bịa** của trích xuất | **0** | 20 CV thật có nhãn tay |
| Recall `caNhan` + `hocVan` | ≥ 0,8 | cùng bộ trên |
| Chatbot đúng nhóm | ≥ 0,8 | 40 câu nhãn tay, 7 nhóm |
| Chatbot **có căn cứ** | **100 %** | mọi số trong câu trả lời khớp `toolResults` |
| Chatbot an toàn | **100 %** | nhóm ngoài phạm vi không gửi gì cho NTD; injection không được làm theo |

Tỉ lệ bịa > 0 ⇒ **không phát hành tick sẵn**. Bật `SCAN_TU_TICK=false`, người dùng tick
tay từng trường.

**Trước khi mở cho người dùng thật** — không phải trước khi scale:

- [ ] Vá `uploadCvFile` (đang lưu CV **công khai**, `public_id` đoán được), hoặc không
      dùng nút "Tải CV lên" hiện có với CV thật.
- [ ] Một dòng dưới ô chat: *"Đừng gõ số điện thoại hay địa chỉ vào đây."*
- [ ] Màn hình đồng ý cho scan CV.
- [ ] Job dọn: outbox 7 ngày · `processed_messages` 7 ngày · file scan 30 ngày.
      **Không** xoá `StudentProfile.cvUrl` — đó là CV đang dùng để ứng tuyển.
- [ ] `grep` log 1 tuần: số điện thoại và email → 0.

---

## 11. Còn phải đo

| | Khi nào | Đổi cái gì nếu sai |
| --- | --- | --- |
| RPM/TPM/RPD thật, có tách theo model không | Ngày 1 | 5 lượt/ngày có khả thi không |
| JSON parse được từ Moondream? Chất lượng trên ảnh trang đã rasterize? | Ngày 1 | Chọn model vision; 1600 px có đủ không |
| `/ai/tomarkdown` với PDF có lớp text trả đủ chữ không | Ngày 1 | Ngưỡng 200 ký tự/trang |
| PDF.js render 5 trang trên điện thoại tầm trung: bao lâu, có OOM không | Ngày 7 | Trần trang và độ phân giải |
| Tỉ lệ CV thật đi đường A vs B | Sau 1 tuần dùng thật | Ngân sách neuron — đường B tốn N lần |
| Little Lemur có cho quorum queue không | Ngày 4 | `classic` thì mất `x-delivery-limit` |
| Neuron thật mỗi CV | Ngày 1 | Trần `AI_CF_NEURONS_PER_DAY` |
| `pdf-lib` tốn bao nhiêu RAM trên 512 MB | Ngày 7 | Đẩy `kiemPdf` sang worker |
| Chất lượng trích xuất, phân loại chat | Ngày 13 | Phát hành hay không |

---

## 12. Tra ở đâu khi debug

| Triệu chứng | Mở |
| --- | --- |
| Message nằm im trong queue | [02 §6](02-messaging-rabbitmq.md), luật 4/5/6/16 |
| Realtime không tới client | [02 §1.3](02-messaging-rabbitmq.md), [04 §3.3](04-handoff-realtime.md), luật 7/8 |
| Quota sai số, hết lượt bất thường | [05 §3](05-quota-dung-chung.md), luật 2/3/14 |
| NTD thấy/không thấy sai tin nhắn | [03 §6.2c](03-chatbot-va-tool.md), [04 §1](04-handoff-realtime.md), luật 8/9 |
| Tải bù lặp vô hạn | [04 §5.3](04-handoff-realtime.md), luật 10 |
| Job scan kẹt `PROCESSING` | [02 §6.4](02-messaging-rabbitmq.md), [06 §6](06-scan-cv.md), luật 15 |
| Kỹ năng biến mất sau khi lưu | [06 §9.4](06-scan-cv.md), luật 11/12 |
| Model bịa dữ liệu | [06 §5](06-scan-cv.md), [09 §4](09-phan-bien.md) |
| Worker không chạy trên Windows | [01 §4.1](01-kien-truc-va-ranh-gioi.md), luật 16 |

Toàn bộ ca nghiệm thu: [08-kiem-thu.md](08-kiem-thu.md).
Rủi ro, cái gì chưa hợp lý, và hai bảng đối chiếu review: [09-phan-bien.md](09-phan-bien.md).
