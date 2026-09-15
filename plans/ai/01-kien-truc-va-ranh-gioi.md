# 01 — Kiến trúc, ranh giới module/service, cách deploy

**Trả lời đầu ra 3 và 8.** Đọc [00-khao-sat.md](00-khao-sat.md) trước.

---

## 1. Hình tổng thể

```
                          ┌──────────────────────────────────────────┐
                          │  apps/api  (Render Web Service, free)    │
   trình duyệt            │                                          │
   ┌──────────┐  HTTP     │  modules/  auth jobs applications        │
   │ apps/web │ ────────► │            profile skills notifications  │
   │ React 19 │           │            ── mới ──                     │
   │          │  SSE      │            ai/        ← điều phối model  │
   │          │ ◄──────── │            chat/      ← hội thoại+handoff│
   │          │           │            documents/ ← API scan CV      │
   │          │  WS       │  realtime/ ← Socket.IO gateway           │
   │          │ ◄───────► │  messaging/← publisher + outbox relay    │
   └──────────┘           └───────┬──────────────────┬───────────────┘
                                  │                  │
                    ┌─────────────▼──────┐    ┌──────▼──────────────┐
                    │  Postgres (Neon)   │    │  RabbitMQ           │
                    │  + outbox_messages │    │  local: Docker      │
                    └─────────────┬──────┘    │  sau: CloudAMQP     │
                                  │           └──────┬──────────────┘
                                  │                  │
                          ┌───────▼──────────────────▼───────────────┐
                          │  apps/worker  (Document Worker)          │
                          │  consume cv.scan.q → Gemini → ghi kết quả│
                          └──────────────────┬───────────────────────┘
                                             │
                                     ┌───────▼────────┐   ┌────────────┐
                                     │ Gemini API     │   │ Cloudinary │
                                     └────────────────┘   └────────────┘

                 ┌──────────────────────────────────────┐
                 │  packages/contracts  ← MỚI           │
                 │  message + socket event, có version  │
                 │  api và worker CHỈ gặp nhau ở đây    │
                 └──────────────────────────────────────┘
```

---

## 2. Bốn module mới trong monolith, và ranh giới của chúng

Giữ đúng luật đã ghi ở README §2: *"module này không gọi thẳng vào bảng của module
kia, muốn dùng thì gọi qua service"*. Plan này thêm **một luật nữa** cho tầng AI.

### 2.1 — `modules/ai/` — điều phối model, không biết gì về nghiệp vụ

```
apps/api/src/modules/ai/
  ai.provider.ts        tạo model instance, HAS_REAL_KEY, cấu hình từ env
  ai.runner.ts          chạy một lượt: reserve quota → streamText → settle
  ai.quota.ts           giữ / dùng / hoàn lượt (xem plan 05)
  ai.circuit.ts         circuit breaker khi Google trả 429/5xx
  ai.telemetry.ts       ghi AiTurn / AiRequestLog, KHÔNG ghi nội dung
  prompts/
    he-thong-sinh-vien.ts     system prompt vai STUDENT   (có version)
    he-thong-ntd.ts           system prompt vai EMPLOYER  (có version)
    trich-xuat-cv.ts          prompt cho scan CV          (có version)
  noi-dung/
    huong-dan.ts        nội dung hướng dẫn sử dụng — nguồn duy nhất cho loại 3
```

**Module này không import `modules/jobs`, `modules/applications`, `modules/profile`.**
Nó nhận danh sách tool đã dựng sẵn từ bên ngoài. Nhờ vậy `ai.runner` test được mà
không cần Prisma.

### 2.2 — `modules/chat/` — hội thoại, tool, handoff

```
apps/api/src/modules/chat/
  chat.routes.ts
  chat.controller.ts
  chat.service.ts          phiên, tin nhắn, seq, chống trùng
  chat.handoff.ts          máy trạng thái AI_ACTIVE→…→CLOSED
  chat.access.ts           ai được vào phòng nào, đọc từ seq nào
  tools/
    tools.sinh-vien.ts     dựng tool set cho STUDENT, đóng gói ctx
    tools.ntd.ts           dựng tool set cho EMPLOYER
    tools.chung.ts         huongDanSuDung
  chat.test.ts  chat.handoff.test.ts  tools.test.ts
```

`tools/*` **là chỗ duy nhất** trong module này được import service của module khác.
Và chúng chỉ được gọi **hàm service đã export**, không gọi `prisma` — lý do ở
[00](00-khao-sat.md) mục A.3.

### 2.3 — `modules/documents/` — API của scan CV (không phải chỗ xử lý)

```
apps/api/src/modules/documents/
  documents.routes.ts
  documents.controller.ts
  documents.service.ts     nhận file, hash, upload, tạo job, ghi outbox
  documents.review.ts      đối chiếu bản nháp với hồ sơ, transaction xác nhận
  documents.mapping.ts     ánh xạ kỹ năng CV → danh mục Skill (dùng unaccent)
```

Module này **không gọi Gemini**. Nó tạo việc và đọc kết quả. Toàn bộ phần gọi model
nằm ở `apps/worker`.

### 2.4 — `realtime/` ở `apps/api`; `messaging/` đã chuyển ra package (xem mục 3)

> **Sửa 2026-09-13.** Bản đầu đặt cả `realtime/` lẫn `messaging/` trong
> `apps/api/src/`. Sau khi chốt R09 ([mục 3](#3-bốn-package-mới-và-ai-sở-hữu-bảng-nào-sửa-r09)),
> `messaging/` **chuyển thành `packages/messaging`** — vì `apps/worker` cần gọi cùng
> connection/topology/outbox mà không được import `apps/api`. `realtime/` (Socket.IO)
> thì **ở lại** `apps/api`, vì nó chỉ phục vụ client trình duyệt, không có bên nào
> khác cần dùng chung.

```
apps/api/src/realtime/    ← Ở LẠI trong apps/api
  io.ts               tạo Server, gắn vào httpServer, chọn adapter
  io.auth.ts          xác thực handshake, gắn user vào socket.data
  io.rooms.ts         quy ước tên phòng + kiểm quyền vào phòng (dùng quyenTruyCapPhien)
  io.handlers.ts      đăng ký sự kiện

packages/messaging/src/   ← ĐÃ CHUYỂN, xem mục 3 để biết vì sao
  connection.ts  topology.ts  publisher.ts  outbox.ts  consumer.ts
```

`apps/api` dùng `packages/messaging` qua import bình thường (`@uniwork/messaging`),
đúng như `apps/worker` — không có gì đặc biệt ở phía API, chỉ là **nguồn của module
nằm ngoài `apps/api/src`** từ giờ trở đi.

---

## 3. Bốn package mới, và ai sở hữu bảng nào (sửa R09)

Bản trước chỉ có `packages/contracts`, và **thiết kế đó không chạy được**: worker bị
ESLint cấm import `apps/api`, nhưng quota ledger, circuit, provider Gemini, prompt và
toàn bộ tầng messaging đều nằm dưới `apps/api/src`. Worker không có đường hợp lệ tới
những thứ nó bắt buộc phải dùng.

Sửa bằng cách **chuyển phần runtime thật sự dùng chung ra khỏi `apps/api`**:

```
packages/
  config/        (đã có)
  shared/        (đã có)  type + zod schema + luật nghiệp vụ thuần
  contracts/     MỚI  chỉ ĐỊNH DẠNG TRAO ĐỔI — envelope, message, socket event
  messaging/     MỚI  amqp connection, topology, publisher, outbox, consumer
  ai-runtime/    MỚI  provider, quota ledger, circuit, rate limiter, prompt, telemetry
apps/
  api/           monolith: auth jobs applications profile skills notifications
                          chat documents realtime
  worker/        MỚI  Document Worker
  web/
```

```
packages/contracts/src/     ← KHÔNG có logic, KHÔNG chạm database
  envelope.ts               khung chung của mọi message
  cv-scan.ts                cv.scan.requested / completed / failed   (v1)
  cv-extraction.ts          schema kết quả trích xuất                (v1)
  chat.ts                   chat.message.created / handoff.*         (v1)
  realtime.ts               realtime.emit + tên/payload sự kiện Socket.IO
  versions.ts               PIPELINE_VERSION, CV_SCHEMA_VERSION, PROMPT_VERSION

packages/messaging/src/     ← nhận PrismaClient tiêm vào, không tự tạo
  connection.ts  topology.ts  publisher.ts  outbox.ts  consumer.ts

packages/ai-runtime/src/    ← nhận PrismaClient tiêm vào
  provider.ts    tạo model, HAS_REAL_KEY
  quota.ts       giữ/chốt/hoàn lượt, ngân sách project, rate limiter RPM/TPM
  circuit.ts     circuit breaker THEO TỪNG MODEL
  telemetry.ts   AiTurn / AiRequestLog
  config.ts      đọc env của riêng nó — KHÔNG import apps/api/config
  prompts/       he-thong-sinh-vien.ts · he-thong-ntd.ts · trich-xuat-cv.ts
```

### 3.0 — Bảng nào của ai, và ai được ghi

R09 hỏi thẳng câu này. Đây là bảng chuẩn; lệch với nó là lỗi thiết kế, không phải
lựa chọn phong cách.

| Bảng | Chủ sở hữu | API ghi | Worker ghi | Ghi qua đâu |
| --- | --- | --- | --- | --- |
| `cv_extractions` | `documents` | tạo, xác nhận | kết quả, lease, retry | Prisma trực tiếp, hai bên |
| `ai_usage_days`, `ai_turns`, `ai_request_logs`, `ai_project_budget_days`, `ai_provider_windows`, `ai_circuits` | **`@uniwork/ai-runtime`** | ✓ | ✓ | **Chỉ qua hàm của package**, không ai gọi Prisma thẳng vào các bảng này |
| `outbox_messages`, `processed_messages`, `parked_messages` | **`@uniwork/messaging`** | ✓ | ✓ | Chỉ qua hàm của package |
| `chat_sessions`, `chat_messages`, `user_presence` | `chat` (api) | ✓ | **✗** | — |
| `student_profiles`, `student_skills`, `skills` | `profile` / `skills` (api) | ✓ | **✗** | — |
| `notifications` | `notifications` (api) | ✓ | **✗** | Worker muốn tạo thông báo thì phát message, API tạo |

**Hệ quả quan trọng: worker KHÔNG ánh xạ kỹ năng.** Bản trước để
`documents.mapping.ts` chạy trong worker — nhưng nó đọc bảng `skills` của module khác.
Chuyển việc đó sang API, chạy lúc **dựng màn hình đối chiếu**
(`GET /api/toi/quet-cv/:id`). Worker chỉ trả về nhãn kỹ năng thô trong `result`.

Điều này vừa đúng ranh giới vừa tốt hơn về nghiệp vụ: danh mục `Skill` có thể được
admin sửa giữa lúc quét và lúc người dùng mở màn hình duyệt, và ánh xạ lúc đọc luôn
cho kết quả mới nhất.

**Prisma client:** worker `import { PrismaClient } from '@prisma/client'` — gói sinh ra
nằm ở `node_modules`, không phải mã nguồn của `apps/api`, nên không vi phạm ranh giới.
Schema vẫn ở `apps/api/prisma/schema.prisma` cho tới nấc 2 của [mục 4.3](#43--lộ-trình-thành-document-service-sở-hữu-dữ-liệu-riêng); ghi nhận đây là
điểm phụ thuộc còn lại, và nó là **build-time**, không phải runtime.

### 3.1 — Khung message chung

```ts
// packages/contracts/src/envelope.ts
import { z } from 'zod'

/**
 * Khung ngoài của MỌI message. Cố định, không đổi theo từng loại.
 *
 * Vì sao tách `v` (đời của `data`) khỏi `specversion` (đời của khung này):
 * hai thứ đổi với nhịp khác nhau. Nội dung `cv.scan.requested` sẽ đổi vài lần
 * trong năm; khung ngoài thì gần như không bao giờ. Gộp một số thì mỗi lần thêm
 * một trường vào payload lại phải nâng đời cho toàn bộ hệ thống.
 */
export const envelopeSchema = z.object({
  specversion: z.literal('1.0'),
  /** Định danh duy nhất của message. Consumer dùng cột này để chống xử lý trùng. */
  id: z.string().min(1),
  /** Ví dụ 'cv.scan.requested'. Trùng với routing key. */
  type: z.string().min(1),
  /** Đời của `data`. Consumer từ chối major khác — xem mục 3.3. */
  v: z.number().int().positive(),
  time: z.string().datetime(),
  /** Lần thử thứ mấy. Bắt đầu từ 1. Publisher đặt, consumer tăng khi retry. */
  attempt: z.number().int().min(1),
  /** Xâu chuỗi log giữa api và worker. Không phải id người dùng. */
  correlationId: z.string().min(1),
  data: z.unknown(),
})

export type Envelope<T> = Omit<z.infer<typeof envelopeSchema>, 'data'> & { data: T }
```

### 3.2 — Ba luật của contract

1. **Không có kiểu Prisma nào trong `packages/contracts`.** Nếu contract cần biết
   `StudentProfile` trông thế nào thì nó không còn là contract, nó là chia sẻ
   database. Chỉ dùng kiểu nguyên thuỷ và Zod schema tự khai.
2. **Chỉ thêm trường tuỳ chọn ở cùng một `v`.** Thêm trường bắt buộc = nâng `v`.
3. **`apps/worker` chỉ được import `@uniwork/contracts` và `@prisma/client`.**
   Cưỡng chế bằng ESLint, xem mục 3.4.

### 3.3 — Consumer gặp version lạ thì làm gì

Không crash, không nuốt. Ba nhánh:

| Tình huống | Hành động |
| --- | --- |
| `v` bằng đời đang hỗ trợ | Xử lý bình thường |
| `v` **thấp hơn** và có hàm nâng cấp | Nâng lên rồi xử lý |
| `v` **cao hơn** đời đang hỗ trợ | **Ghi `parked_messages` trong một transaction, RỒI mới `ack`** — xem [02](02-messaging-rabbitmq.md) mục 6.2b. Không đảo thứ tự: ack trước rồi ghi là mất message nếu process chết giữa hai bước (R06). Và **không** `nack(requeue=true)` — worker cũ sẽ quay vòng nóng với message nó vĩnh viễn không hiểu, ăn hết CPU và nghẽn cả queue. |

Nhánh ba là ca hay xảy ra thật khi deploy: API lên bản mới trước worker vài phút.

### 3.4 — Cưỡng chế ranh giới bằng ESLint

Thêm vào `packages/config` một override cho `apps/worker`:

```js
// packages/config/eslint/worker.js — ĐỀ XUẤT
{
  files: ['apps/worker/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/apps/api/**', '@uniwork/api', '../../api/**'],
          message:
            'Document Worker không được import code của apps/api. ' +
            'Dùng chung runtime thì qua @uniwork/ai-runtime hoặc @uniwork/messaging; ' +
            'trao đổi thì qua @uniwork/contracts; ' +
            'dữ liệu nó sở hữu là bảng cv_extractions.',
        },
      ],
    }],
  },
}
```

**Đây là dòng code quan trọng nhất của cả plan về mặt học microservices.** Không có
nó, seam sẽ rò trong tuần đầu và không ai nhận ra cho tới lúc muốn tách thật.

**Và luật này chỉ đứng vững nếu bốn package ở [mục 3](#3-bốn-package-mới-và-ai-sở-hữu-bảng-nào-sửa-r09) tồn tại
trước.** Bật rule mà chưa tách package thì worker không có đường hợp lệ tới quota và
provider, và người thi công sẽ tắt rule thay vì sửa kiến trúc — đúng thứ R09 chỉ ra.
Thứ tự bắt buộc: tách package (ngày 1–2) → bật rule.

**Danh sách trắng của `apps/worker`:** `@uniwork/contracts`, `@uniwork/ai-runtime`,
`@uniwork/messaging`, `@uniwork/shared`, `@prisma/client`. Không có gì khác thuộc
monorepo.

---

## 4. Hai service nghiệp vụ ≠ hai máy chủ

Đề bài hỏi thẳng chỗ này. Trả lời tách làm ba tầng, vì chúng độc lập nhau:

| Tầng | Câu hỏi | Trạng thái sau plan này |
| --- | --- | --- |
| **Ranh giới code** | Worker có import được code của API không? | **Không** — ESLint chặn |
| **Ranh giới dữ liệu** | Worker có đọc/ghi bảng của module khác không? | **Không** — chỉ `cv_extractions`, cộng các bảng của `@uniwork/messaging` và `@uniwork/ai-runtime` **qua hàm của hai package đó**. Bảng đầy đủ ở [mục 3.0](#30--bảng-nào-của-ai-và-ai-được-ghi) |
| **Ranh giới tiến trình/máy** | Chạy ở đâu? | **Tuỳ môi trường** — cùng process trên Render free, khác process ở local |

Hai tầng đầu làm được ngay và không tốn gì. Tầng ba là chuyện tiền thuê máy.

### 4.1 — Ba chế độ chạy, một codebase

**Hai file, không một** — và đây là chỗ bản trước có một lỗi chỉ nổ trên Windows.

```ts
// apps/worker/src/worker.ts — CHỈ export, KHÔNG tự chạy gì
export async function startDocumentWorker(deps: WorkerDeps): Promise<StopFn> { … }
```

```ts
// apps/worker/src/main.ts — entrypoint, tồn tại chỉ để khởi động
import { startDocumentWorker } from './worker.js'

const stop = await startDocumentWorker(dependenciesTuEnv())
process.on('SIGTERM', () => void stop())
```

`package.json` của worker trỏ `"start": "tsx src/main.ts"`. API thì
`import { startDocumentWorker } from '@uniwork/worker'` — nhập `worker.ts`, không bao
giờ chạm `main.ts`.

**Vì sao KHÔNG dùng mẫu `import.meta.url === \`file://${process.argv[1]}\`.**

Máy dev của dự án chạy **Windows**. Ở đó `process.argv[1]` là `D:\javabtap\...\main.ts`,
còn `import.meta.url` là `file:///D:/javabtap/.../main.ts`. Hai chuỗi **không bao giờ
bằng nhau**: thiếu một dấu `/`, dấu phân cách ngược chiều, và mọi ký tự cần encode
(khoảng trắng, dấu tiếng Việt trong đường dẫn) lệch tiếp.

Hậu quả: chạy `node main.ts` thì điều kiện sai, `startDocumentWorker` **không được
gọi**, process khởi động rồi thoát ngay — **không đăng ký consumer nào**. Không có lỗi
nào bắn ra. Triệu chứng duy nhất là "message nằm im trong queue", và người ta sẽ đi tìm
lỗi ở RabbitMQ.

Nếu vì lý do nào đó vẫn muốn một file, thì phải so bằng
[`pathToFileURL`](https://nodejs.org/api/url.html#urlpathtofileurlpath-options):

```ts
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { … }
```

**Đề xuất tách hai file**, vì nó không cần ai nhớ luật này.

**Nghiệm thu:** trên Windows, `pnpm --filter @uniwork/worker start` đăng ký **đúng một**
consumer (nhìn tab Connections của Management UI). API import `@uniwork/worker` với
`WORKER_INLINE=false` **không** đăng ký thêm consumer nào. Kiểm lại trên bản build Linux.

```ts
// apps/api/src/index.ts — thêm vào cuối
if (env.WORKER_INLINE) {
  const { startDocumentWorker } = await import('@uniwork/worker')
  stopWorker = await startDocumentWorker(dependenciesTuEnv())
  logger.warn('Document Worker chạy TRONG process API (WORKER_INLINE=true)', {
    lyDo: 'Render free không có Background Worker',
  })
}
```

`logger.warn` chứ không `info`: chế độ này là nhượng bộ hạ tầng, phải nhìn thấy
trong log production để không ai quên.

| Môi trường | `WORKER_INLINE` | RabbitMQ | Vì sao |
| --- | --- | --- | --- |
| Máy dev | `false` | Docker local | Giống production nhất. Giết worker để kiểm redelivery thật. |
| CI | `false`, worker không chạy | không có | Test dùng consumer giả. Không dựng broker trong CI. |
| Render free | `true` | CloudAMQP Little Lemur | Không có Background Worker free, và không đủ 750 giờ cho service thứ hai |
| Render trả phí | `false` | CloudAMQP trả phí | Đổi một biến, không sửa code |

### 4.2 — Vì sao không dùng Render Web Service thứ hai làm worker

Cách lách được: dựng worker thành một Web Service free có `/health` giả. Nhưng:

- Render free **ngủ sau 15 phút không có HTTP traffic**. Worker ngủ = consumer đóng
  = message nằm lại queue. Muốn nó thức thì phải ping, mà ping = tiêu giờ.
- README §3 đã đo: một service thức 07:00–23:59 giờ VN = **527 giờ/tháng**. Hai
  service = **1054 giờ** > **750 giờ** hạn mức tài khoản. Ngày 25/08/2026 đã treo
  service một lần vì chạm trần.
- Muốn cả hai vừa 750 giờ thì mỗi cái chỉ được thức ~12 giờ/ngày — và người dùng
  quét CV lúc 21h sẽ chờ tới sáng.

Nên: `WORKER_INLINE=true` là lựa chọn **đúng** cho gói free, không phải lựa chọn tệ.

### 4.3 — Lộ trình thành Document Service sở hữu dữ liệu riêng

Ba nấc, mỗi nấc dùng được và có thể dừng lại ở đó:

| Nấc | Dữ liệu | Cách API lấy kết quả | Công |
| --- | --- | --- | --- |
| **1** (plan này) | Cùng database Neon. Worker chỉ chạm `cv_extractions*`. | Đọc thẳng bảng + nhận event `cv.scan.completed` | 0 thêm |
| **2** | Bảng scan chuyển sang **Postgres schema riêng** `documents`, user database riêng chỉ có quyền trên schema đó | API **không** đọc bảng nữa; dữ liệu tới qua message | ~2 ngày |
| **3** | Database riêng hẳn | Như nấc 2, thêm API nội bộ để đọc lại bản nháp | ~3 ngày |

**Thứ phải làm ngay ở nấc 1 để nấc 2 rẻ** — nếu không sẽ phải viết lại:

1. **Không đặt khoá ngoại từ `cv_extractions` sang `student_profiles`.** Lưu
   `ownerUserId String` trần. (Ngoại lệ duy nhất: FK sang `users` với
   `onDelete: Cascade`, để xoá tài khoản không để lại rác. Đây là **cái seam duy
   nhất phải cắt** ở nấc 2, và ghi rõ trong comment của schema.)
2. **API không `include` / `join` từ bảng scan sang bảng hồ sơ.** Cần cả hai thì
   đọc hai lần rồi ghép trong TypeScript.
3. **Kết quả đi kèm event, không chỉ nằm trong bảng.** `cv.scan.completed` mang
   theo đủ dữ liệu tóm tắt để API cập nhật trạng thái và bắn Socket.IO mà không
   cần đọc bảng của worker.

Điểm 3 là chỗ dễ làm sai nhất: rất tiện để event chỉ mang `extractionId` rồi API tự
đi đọc. Tiện, và khoá chặt hai bên vào cùng một database vĩnh viễn.

---

### 4.4 — Render hay VPS (bổ sung 2026-09-12)

Đúng, Render **kém hơn một VPS** cho đúng hình dạng hệ thống này. Và điều đáng chú ý
là: ở mức trả phí, VPS còn **rẻ hơn**.

> **Ràng buộc ngân sách đã chốt:** RabbitMQ dùng **CloudAMQP Little Lemur Free —
> 0 USD/tháng** ở mọi cột dưới đây. Bảng này so **chi phí compute**, không phải broker,
> và cột "Render trả phí" / "VPS" là **kịch bản tương lai**, chưa phải khoản đang trả.

| | Render free (đang dùng) | Render trả phí | VPS nhỏ |
| --- | --- | --- | --- |
| Compute/tháng | **0 USD** | ~14 USD (7 × 2 service) | 4–6 USD **cho tất cả** |
| Broker/tháng | **0 USD** (Little Lemur) | **0 USD** | **0 USD** |
| Ngủ / cold start | 15 phút → ~50 s | Không | Không |
| Giờ chạy | **750 h/tài khoản** — đã chạm 767/750 ngày 25/08/2026, service bị treo | Không giới hạn | Không giới hạn |
| Background Worker | **Không có** | Có | Chạy gì cũng được |
| RabbitMQ | Phải thuê ngoài | Phải thuê ngoài | `docker compose up` |
| Đĩa | Ephemeral | Có disk | Có |
| RAM | 512 MB | theo gói | 2–4 GB |

Một VPS chạy được **API + worker + RabbitMQ + Redis** trong một `docker-compose.yml`
— đúng file đã có ở repo. `WORKER_INLINE=false` thành khả thi, tức là ranh giới
process ở [mục 4.1](#41--ba-chế-độ-chạy-một-codebase) trở thành thật ở production chứ
không chỉ ở máy dev.

**Cái Render làm hộ mà VPS bắt tự làm** — nói cho công bằng, vì đây mới là giá thật:

- TLS/HTTPS (Caddy hoặc Traefik lo được, nhưng phải dựng)
- Deploy tự động khi merge (phải viết GitHub Actions → ssh → `docker compose up -d`)
- Cập nhật OS, tường lửa, fail2ban
- Khởi động lại sau khi máy reboot
- Giám sát, và **sao lưu**
- Máy chết lúc 2 giờ sáng thì người sửa là mình

**Đề xuất:**

1. **Bây giờ giữ Render free.** Nó đang chạy, có `render.yaml` trong repo, và với đồ
   án thì "deploy bằng blueprint" là câu chuyện gọn hơn "ssh vào máy".
2. **Chuyển sang VPS ngay khi cần một trong ba thứ:** worker chạy độc lập thật,
   RabbitMQ tự host, hoặc hết chịu nổi cold start. Lúc đó VPS là lựa chọn **đúng**,
   không phải lựa chọn tiết kiệm.
3. **Đường giữa, và đây là thứ tôi khuyên khi chuyển:** một VPS nhỏ chạy API + worker
   + RabbitMQ, **nhưng giữ Postgres ở Neon**. Phần rủi ro nhất là dữ liệu; để Neon lo
   sao lưu và point-in-time recovery. Tự host Postgres trên VPS là nhận thêm đúng
   trách nhiệm mà mình ít muốn nhất.

Không có gì trong plan này phải sửa khi chuyển: đổi `RABBITMQ_URL`, `WORKER_INLINE`,
và cách deploy. Đó chính là lý do ba thứ đó là biến môi trường.

---

## 5. Vòng đời tiến trình — phải sửa `index.ts`

Hiện `shutdown()` đóng HTTP server và Prisma
([index.ts:38-70](../../apps/api/src/index.ts#L38-L70)). Thêm bốn việc, **đúng thứ tự**:

```
SIGTERM
  1. io.close()                    ngừng nhận kết nối WS mới, báo client reconnect
  2. dừng nhận message mới          channel.cancel(consumerTag) — message đang xử
                                    lý vẫn chạy nốt, message chưa nhận nằm lại queue
  3. huỷ mọi lượt AI đang chạy      abortController.abort() cho từng AiTurn RESERVED,
                                    rồi settle chúng thành FAILED + hoàn lượt
  4. server.close()                 chờ request HTTP đang dở
  5. channel.close() → conn.close() đóng RabbitMQ SAU khi đã ack hết
  6. prisma.$disconnect()
```

Bước 3 là bước dễ quên nhất và hậu quả rõ nhất: deploy giữa lúc ai đó đang hỏi AI
⇒ hàng `AiTurn` kẹt ở `RESERVED` vĩnh viễn ⇒ chỉ mục unique một phần "một yêu cầu
đang xử lý mỗi tài khoản" **khoá tài khoản đó lại mãi mãi**. Xem
[05](05-quota-dung-chung.md) mục 4 cho cả cơ chế quét dọn dự phòng.

Trần 10 giây hiện có
([index.ts:66](../../apps/api/src/index.ts#L66)) vẫn giữ. Render cho khoảng 30 giây
trước khi `SIGKILL`, nên 10 giây là an toàn.

---

## 6. Biến môi trường mới

Thêm vào [config/env.ts](../../apps/api/src/config/env.ts), theo đúng nếp đã có ở
đó: **bí mật thì không có mặc định** (chết lúc khởi động), **tính năng thêm thì có
mặc định rỗng** (thiếu thì chỉ tắt tính năng).

```ts
/* ------------------------------------------------------------------ AI --- */

/*
 * Khoá Gemini. CÓ mặc định rỗng, cùng nhóm với GOOGLE_CLIENT_ID chứ không cùng
 * nhóm với JWT_ACCESS_SECRET.
 *
 * Lý do: trợ lý AI và scan CV là tính năng THÊM. Thiếu khoá thì hai nút đó biến
 * mất, còn đăng nhập / tìm việc / ứng tuyển vẫn chạy nguyên vẹn. Bắt buộc phải
 * có sẽ khiến cả nhóm không chạy được dự án chỉ vì chưa ai tạo API key.
 *
 * Tên biến theo đúng mặc định của @ai-sdk/google để không phải cấu hình thêm.
 */
GOOGLE_GENERATIVE_AI_API_KEY: z.string().default(''),

/* Model dùng cho chat. Đổi được mà không sửa code — xem plan 08 mục "paid/scale". */
AI_CHAT_MODEL: z.string().default('gemini-2.5-flash-lite'),
/* Model dùng cho đọc CV. Tách khỏi chat vì hai việc cần năng lực khác nhau. */
AI_SCAN_MODEL: z.string().default('gemini-2.5-flash'),

AI_CHAT_TURNS_PER_DAY:   z.coerce.number().int().min(0).default(5),
AI_SCAN_JOBS_PER_DAY:    z.coerce.number().int().min(0).default(3),
/* Trần chung theo project/ngày. ĐẶT THẤP HƠN số đo được ở AI Studio, không bằng. */
AI_PROJECT_REQUESTS_PER_DAY: z.coerce.number().int().min(0).default(400),
/* Phần dành riêng cho chat trong trần chung, để scan không nuốt hết. 0..1 */
AI_CHAT_BUDGET_SHARE:    z.coerce.number().min(0).max(1).default(0.7),

AI_MAX_OUTPUT_TOKENS:    z.coerce.number().int().positive().default(1024),
AI_REQUEST_TIMEOUT_MS:   z.coerce.number().int().positive().default(30_000),
AI_MAX_TOOL_ROUNDS:      z.coerce.number().int().positive().default(4),
AI_HISTORY_MESSAGES:     z.coerce.number().int().positive().default(12),

/* ------------------------------------------------------- hàng đợi & worker */

/*
 * Chuỗi kết nối RabbitMQ. Mặc định trỏ container local — an toàn vì nó chỉ là
 * localhost, khác hẳn DATABASE_URL (mặc định localhost sẽ khiến production im
 * lặng chạy sai). Thiếu broker thì scan CV không chạy, phần còn lại vẫn chạy.
 */
RABBITMQ_URL: z.string().default('amqp://uniwork:uniwork_dev@localhost:5672'),

/* true = worker chạy trong process API. Xem plan 01 mục 4.1. */
WORKER_INLINE: z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true'),

/* Số message xử lý cùng lúc. 1 vì free tier Gemini có RPM rất thấp. */
WORKER_PREFETCH: z.coerce.number().int().positive().default(1),

/* --------------------------------------------------------------- realtime */

/*
 * '' = một instance, dùng adapter mặc định trong bộ nhớ.
 * 'postgres' = @socket.io/postgres-adapter. Xem plan 04 mục 6.
 */
SOCKET_ADAPTER: z.enum(['', 'postgres']).default(''),
```

**Cần thêm vào `apps/api/vitest.config.ts`** — cùng lý do đã ghi ở đó cho sáu biến
Sprint 1: test nạp `env.ts` thật. Để `GOOGLE_GENERATIVE_AI_API_KEY: ''` để nhánh
"chưa cấu hình" được đi qua thật, đúng như nếp đang có với Google OAuth.

---

## 7. Vì sao chọn như vậy — bốn quyết định và cái bị loại

### 7.1 — Monolith + một worker tách, KHÔNG tách thành 3–4 service

| Phương án | Bị loại vì |
| --- | --- |
| Tách `chat-service`, `ai-service`, `document-service` riêng | README §2 đã đo: mỗi Render free service ngủ riêng, 4 service = 4 lần cold start 50 giây chồng lên nhau. Và 750 giờ chia bốn. |
| Giữ hoàn toàn monolith, không worker | Một lần trích xuất CV mất 20–40 giây. Giữ nó trong request handler nghĩa là giữ một kết nối HTTP mở suốt thời gian đó trên instance 512 MB, và **mất trắng nếu Render ngủ giữa chừng** |
| **Monolith + 1 worker, tách bằng contract** ✅ | Việc nặng chạy ngoài vòng đời request; sống sót qua lúc service ngủ; retry có backoff cho một nhà cung cấp bên ngoài; và API với worker deploy độc lập được khi cần. Chi phí vận hành gần bằng 0 |

### 7.2 — RabbitMQ thay BullMQ — và cái giá thật của nó

RabbitMQ đã chốt. Ghi lại bảng so sánh để lúc gặp khó không ai tưởng bên kia không
có đường, và để biết chính xác phần nào phải tự dựng:

| | BullMQ + Redis | RabbitMQ |
| --- | --- | --- |
| Retry có backoff | một dòng cấu hình | tự dựng — ở đây làm bằng **outbox có lịch**, [02 §1.5](02-messaging-rabbitmq.md) |
| Job có trạng thái tra cứu được | có sẵn | **không có** — phải tự lưu bảng `cv_extractions` (và ta cần bảng đó cho màn hình duyệt, nên không phải chi phí thuần) |
| Delayed job | có sẵn | cùng cơ chế outbox ở trên |
| Dashboard | Bull Board | Management UI có sẵn ở bản Docker |
| Hạ tầng thêm | Redis (Render free **có** Key Value) | RabbitMQ (Render free **không có** — chạy ngoài, [02 §9.1](02-messaging-rabbitmq.md)) |
| Routing nhiều consumer trên một sự kiện | phải tự dựng | exchange + binding, có sẵn — **cần cho tầng realtime fanout** ở [02 §1.3](02-messaging-rabbitmq.md) |

Dòng cuối là chỗ RabbitMQ thật sự hơn: hệ thống này có **hai kiểu tiêu thụ khác nhau
trên cùng một sự kiện** — nghiệp vụ chạy đúng một lần, realtime chạy một lần mỗi
instance. Với BullMQ thì đó là hai hàng đợi tự quản; với exchange thì là hai binding.

Cột phải đắt hơn khoảng **1,5–2 ngày công**, phần lớn nằm ở retry và ack thủ công.
Con số đó nằm trong ước lượng ở [07](07-lo-trinh-14-ngay.md) mục 1, không phải chi phí
ẩn.

**Và không thêm Kafka song song.** Hai broker cùng lúc là hai thứ phải dựng, phải
theo dõi, phải nhớ cái nào giữ việc gì — cho một hệ thống hiện có **một** producer,
**một** consumer và vài chục message mỗi ngày. Kafka giải bài toán mà RabbitMQ không
giải: **giữ lại dòng sự kiện và phát lại được** (log có thể tua lại, nhiều nhóm tiêu
thụ độc lập trên cùng một dòng). Ở đây chưa có nhu cầu đó — message scan CV bị tiêu
thụ một lần rồi hết vòng đời, và bằng chứng lịch sử nằm ở bảng `cv_extractions`,
không nằm ở broker.

Điều kiện để **đánh giá lại** Kafka, ghi rõ để sau này không tranh luận lại từ đầu:
có nhu cầu **phát lại** một khoảng sự kiện (dựng lại một bảng tổng hợp từ đầu), hoặc
có **từ ba nhóm tiêu thụ trở lên** đọc cùng một dòng sự kiện với tốc độ khác nhau.
Chưa có cái nào trong hai cái đó thì Kafka chỉ là RabbitMQ đắt hơn.

### 7.3 — Không thêm RAG / vector database

Đề bài đã định hướng vậy, và khảo sát xác nhận là đúng:

- Dữ liệu cần tra cứu **đã có API có cấu trúc** và **đã có phân quyền** — xem
  [00](00-khao-sat.md) A.3. Nhét chúng vào vector store là **vứt bỏ tầng phân
  quyền**: embedding không biết đơn nào đang `SHORTLISTED`.
- Nội dung hướng dẫn sử dụng chỉ vài nghìn từ — nhét thẳng vào system prompt hoặc
  trả qua tool `huongDanSuDung(chuDe)` rẻ hơn và **kiểm chứng được**.
- Chỉ đáng cân nhắc lại khi nội dung hướng dẫn vượt ~20 nghìn từ, hoặc khi cần tìm
  ngữ nghĩa trong `Job.description` tự do. Chưa đến.

### 7.4 — SSE cho stream AI, Socket.IO cho chat người thật

Hai kênh, hai giao thức. Nhìn qua tưởng thừa.

| | SSE (`/api/tro-ly/hoi`) | Socket.IO |
| --- | --- | --- |
| Chiều | một chiều, server → client | hai chiều |
| Vòng đời | sống đúng một câu trả lời | sống suốt phiên |
| Hợp với | token AI chảy ra | tin nhắn, trạng thái, "đang gõ", presence |
| Nếu gộp vào Socket.IO | phải tự dựng lại backpressure, huỷ giữa chừng, và cơ chế thử lại cho stream | |
| Nếu gộp vào SSE | không gửi ngược lên được, phải POST riêng, mất ACK | |

Đề bài đã nói "Giữ streaming AI trực tiếp; Socket.IO đảm nhiệm giao tiếp realtime
với frontend" — thiết kế này khớp đúng.

**Ràng buộc kèm theo:** khi hội thoại chuyển sang `HUMAN_ACTIVE`, endpoint SSE trả
`409 AI_BUSY`… không, trả **`409 CONFLICT` với thông điệp "hội thoại đang do người
thật phụ trách"**. Máy trạng thái là nguồn sự thật duy nhất cho việc AI có được nói
hay không, và nó nằm trong database chứ không nằm trong bộ nhớ của instance nào.

---

## 8. Ghi chú "test miễn phí hiện tại → paid/scale sau này"

**Trả lời đầu ra 8.** Đây là bảng để đọc lại lúc bật trả phí, không phải lúc thi công.

### 8.1 — Giữ nguyên, không phải sửa dòng nào

| Phần | Vì sao bền |
| --- | --- |
| Toàn bộ schema Prisma của chat và scan | Không có gì phụ thuộc nhà cung cấp |
| Máy trạng thái handoff | Nghiệp vụ thuần |
| Tool contract | Gọi service nội bộ, không gọi Gemini |
| Topology RabbitMQ (exchange, routing key, DLQ) | Giống nhau ở local và CloudAMQP |
| Outbox + bảng `processed_messages` | Mẫu chuẩn, không phụ thuộc broker |
| `packages/contracts` | Đây chính là lý do nó tồn tại |
| Cách đo token/latency (`AiTurn`, `AiRequestLog`) | Sang paid thì cùng bảng đó tính ra tiền |

### 8.2 — Đổi bằng biến môi trường, không sửa code

| Đổi gì | Từ | Sang | Biến |
| --- | --- | --- | --- |
| Model chat | `gemini-2.5-flash-lite` | model mạnh hơn | `AI_CHAT_MODEL` |
| Model scan | `gemini-2.5-flash` | model mạnh hơn | `AI_SCAN_MODEL` |
| Lượt/ngày | 5 chat, 3 scan | tuỳ gói | `AI_CHAT_TURNS_PER_DAY`, `AI_SCAN_JOBS_PER_DAY` |
| Trần project | 400 req/ngày | theo ngân sách tiền | `AI_PROJECT_REQUESTS_PER_DAY` |
| Song song worker | 1 | 4–8 khi RPM cho phép | `WORKER_PREFETCH` |
| Chỗ chạy worker | trong API | process riêng | `WORKER_INLINE=false` |
| Broker | Docker local | CloudAMQP | `RABBITMQ_URL` |
| Adapter Socket.IO | bộ nhớ | Postgres/Redis | `SOCKET_ADAPTER` |

### 8.3 — Phải sửa code thật

| Việc | Công | Kích hoạt khi nào |
| --- | --- | --- |
| **Bật billing Gemini + màn hình đồng ý dữ liệu** | 0,5 ngày | **Trước khi nhận CV thật.** Không phải khi scale — khi có người dùng thật đầu tiên. Xem [00](00-khao-sat.md) C.3. |
| Adapter Socket.IO + sticky session ở tầng proxy | 1 ngày | Khi lên 2+ instance |
| Bỏ `unique(userId) where state='RESERVED'`, đổi sang bộ đếm N slot | 0,5 ngày | Khi cho phép nhiều lượt AI song song mỗi tài khoản |
| Chuyển bảng scan sang schema `documents` riêng | 2 ngày | Nấc 2 của mục 4.3 |
| Đổi lưu file scan sang S3/R2 | 1 ngày | Khi Cloudinary 25 GB gần đầy |
| Rời `cvUrl` công khai sang authenticated + migration URL | 1 ngày | Việc riêng, xem [00](00-khao-sat.md) B.3 |

### 8.4 — Chi phí: hiện tại, và kịch bản trả phí (sửa R16)

**Tách hai bảng, vì trộn chúng chính là lỗi ở bản trước.**

#### A. Chi phí THẬT của môi trường test đang chạy

| Khoản | Gói | Tiền |
| --- | --- | --- |
| Gemini API | Free tier | **0 USD** |
| RabbitMQ | **CloudAMQP Little Lemur Free** | **0 USD** |
| Render | Free Web Service | 0 USD |
| Neon, Cloudinary, Brevo, Vercel | Free | 0 USD |
| **Cộng** | | **0 USD/tháng** |

Không có khoản broker trả phí và không có VPS trong dự toán này. Giới hạn Little Lemur
là thứ để **thiết kế và theo dõi**, không phải thứ để trả tiền — xem
[02](02-messaging-rabbitmq.md) mục 9.1.

#### B. Kịch bản Gemini trả phí trong tương lai — GIẢ ĐỊNH, chưa phải khoản phải trả

Đơn giá công bố 2026-09-11: Flash-Lite 0,10 USD input / 0,40 output mỗi triệu token;
2.5 Flash 0,30 / 2,50.

**Token phải tính cả vòng tool.** Bản trước lấy 4.000 in cho "2 vòng tool" — sai, vì
mỗi vòng **gửi lại toàn bộ ngữ cảnh**. Một lượt 3 vòng là ~2k + ~3k + ~4k = **~9k input**,
không phải 4k.

| Việc | Token (đã gồm vòng tool + retry) | Giá mỗi lần |
| --- | --- | --- |
| 1 lượt chat, 3 vòng tool (Flash-Lite) | ~9.000 in / ~800 out | 9.000×0,10/10⁶ + 800×0,40/10⁶ = **0,00122 USD** |
| 1 lần scan CV 3 trang, 1 request (Flash) | ~1.500 in / ~1.500 out | **0,00420 USD** |
| 1 lần scan CV, **phương án B hai request** ([06](06-scan-cv.md) §3.4) | ~3.000 in / ~2.500 out | **0,00715 USD** |

Kịch bản 100 sinh viên hoạt động:

```
Chat:  100 người × 5 lượt/ngày × 30 ngày × 0,00122 = 18,3 USD/tháng
Scan:  100 người × 1 lần/tháng × 0,00715 (phương án B) = 0,72 USD/tháng
                                                   Cộng ≈ 19 USD/tháng
```

**Bản trước ghi 0,9 USD/tháng cho chat. Sai số học** — ngay với con số 0,0006/lượt của
chính bản đó thì `100 × 5 × 30 × 0,0006 = 9 USD`, không phải 0,9. Cộng thêm phần token
vòng tool bị bỏ sót thì con số đúng là **~18 USD**, tức là bản trước thấp hơn **20 lần**.

Ghi lại vì nó đổi kết luận: chi phí model **không** còn là "tiếng ồn". Ở 100 người
dùng thật, nó là khoản lớn nhất trong hoá đơn, và nó **tỉ lệ thuận với số vòng tool** —
`AI_MAX_TOOL_ROUNDS` là nút điều chỉnh chi phí trực tiếp, không chỉ là một giới hạn
an toàn.

#### C. Kịch bản hosting trả phí — chỉ lập khi có yêu cầu rõ ràng

Không nằm trong ngân sách hiện tại. Render trả phí ~7 USD/service; VPS 4–6 USD cho
tất cả — xem [mục 4.4](#44--render-hay-vps-bổ-sung-2026-09-12). Broker vẫn giữ
**0 USD** trong mọi kịch bản cho tới khi vượt giới hạn Little Lemur.

**Câu kết vẫn đúng, chỉ đổi thủ phạm:** "API có free tier" không có nghĩa "tổng chi phí
bằng 0". Nhưng ở quy mô 100 người dùng thật thì khoản lớn nhất là **model**, không phải
hosting — ngược với điều bản trước kết luận.
