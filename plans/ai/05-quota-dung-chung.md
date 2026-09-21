# 05 — Quota dùng chung, chống spam, chống xử lý trùng

**Trả lời đầu ra 5.** Đây là plan phải làm **trước** 03 và 06 — lý do ở
[README.md](README.md) mục "Thứ tự chạy".

---

## 1. Bốn thứ khác nhau hay bị gộp làm một

Đề bài đòi phân biệt rõ, và đúng là chúng khác nhau thật:

| # | Thứ | Đơn vị | Ai đặt | Ngày tính theo | Đo ở đâu |
| --- | --- | --- | --- | --- | --- |
| 1 | **Lượt người dùng** | 1 câu hỏi / 1 lần quét | Ta | **Giờ Việt Nam** | `AiUsageDay` |
| 2 | **Lần gọi HTTP tới nhà cung cấp** | 1 request, **kể cả SDK tự retry** | Suy từ số vòng tool | theo provider | `AiRequestLog` + `AiProjectBudgetDay` |
| 3 | **Token** | input + output | Nhà cung cấp trả về | theo provider | `AiRequestLog`, cộng dồn `AiTurn` |
| 4a | **Hạn mức Google** (chat) | RPM / TPM / RPD | **Google** | **Giờ Pacific** | AI Studio — [00](00-khao-sat.md) C.2 |
| 4b | **Hạn mức Cloudflare** (scan CV) | **Neuron/ngày** — 10.000 free | **Cloudflare** | **Giờ UTC** | [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |

**Từ 2026-09-13 có HAI nhà cung cấp** ([06](06-scan-cv.md) §12): chat ở Google, scan CV
ở Cloudflare. Hai hạn mức **hoàn toàn tách rời** — khác đơn vị (request/token vs
Neuron), khác mốc reset (Pacific vs UTC), khác hành vi khi chạm trần (Google trả 429
và ta chờ; Cloudflare free **không tràn sang trả phí**, request lỗi thẳng).

Đây là tin tốt cho thiết kế: **chat hết quota không thể làm chết scan, và ngược lại** —
không cần chia 70/30 giữa hai feature nữa vì chúng không còn dùng chung túi nào. Phần
chia ngân sách ở mục 4.2 vì vậy chỉ còn ý nghĩa **trong** từng provider.

**Cột "ngày tính theo" là chỗ bản trước sai (R11).** Tài liệu Gemini ghi nguyên văn:
*"Requests per day (RPD) quotas reset at midnight Pacific time"* và *"Rate limits are
applied per project, not per API key"*
([rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)).

Dùng chung một hàm `ngayVN()` cho cả bốn dòng là sai lệch **14–15 tiếng**: bộ đếm
ngân sách của ta reset lúc 00:00 giờ VN, còn Google reset lúc 14:00 hoặc 15:00 giờ VN
(tuỳ DST). Hậu quả cụ thể: sáng sớm ta tưởng còn nguyên hạn mức trong khi Google vẫn
đang đếm ngày hôm trước, và 429 ập tới đúng lúc bộ đếm của ta hiển thị "0/400".

**Hai hàm, không một:**

```ts
// packages/ai-runtime/src/config.ts
/** Ngày của NGƯỜI DÙNG. Quota 5 lượt/ngày reset lúc nửa đêm giờ VN. */
export const ngayVN = (t = new Date()) =>
  t.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })

/**
 * Ngày của NHÀ CUNG CẤP. RPD của Gemini reset lúc nửa đêm giờ Pacific.
 * `America/Los_Angeles` tự xử lý DST — đừng bù giờ bằng tay.
 */
export const ngayPacific = (t = new Date()) =>
  t.toLocaleDateString('sv-SE', { timeZone: 'America/Los_Angeles' })
```

Dùng nhầm hàm là loại lỗi chỉ lộ ra sau vài tuần vận hành thật. Đặt cả hai cạnh nhau
trong một file, kèm comment này, để lúc gõ phải chọn có ý thức.

Một lượt (1) có thể là 1 đến 5 request (2). Hạn mức (4) áp lên (2) và (3), không áp
lên (1). Nghĩa là **"5 lượt/người/ngày" không nói được gì về việc có chạm trần Google
hay không** — 20 người × 5 lượt × 3 request = 300 request/ngày, và ta không biết trần
thật là bao nhiêu cho tới khi mở AI Studio ra xem.

Đây là lý do phải có **hai** tầng quota, không phải một.

---

## 2. Data model

```prisma
enum AiFeature {
  CHAT
  CV_SCAN
}

enum AiTurnState {
  /// Đã giữ chỗ, chưa biết kết quả. CÓ ĐÚNG MỘT hàng như vậy mỗi tài khoản.
  RESERVED
  SUCCEEDED
  /// Hỏng vì phía ta (mạng, 5xx, timeout, deploy). Lượt được hoàn.
  FAILED
  /// Đã hoàn lượt. Tách khỏi FAILED để đếm được "đã hoàn bao nhiêu".
  REFUNDED
}

/// Sổ cái lượt theo NGÀY, theo TÀI KHOẢN, theo TÍNH NĂNG.
///
/// Ba cột đếm chứ không phải một, vì ba câu hỏi khác nhau:
///   turnsReserved  — đã xin bao nhiêu lượt (kể cả lượt đang chạy)
///   turnsUsed      — bao nhiêu lượt thật sự có kết quả
///   turnsRefunded  — bao nhiêu lượt trả lại vì hệ thống hỏng
///
/// Số lượt CÒN LẠI = limit - (turnsReserved - turnsRefunded).
/// Dùng `turnsReserved` chứ không `turnsUsed` trong công thức đó: lượt đang chạy
/// phải bị trừ ngay, không thì mở 5 tab bấm cùng lúc là qua mặt được hạn mức.
model AiUsageDay {
  id String @id @default(cuid())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// Ngày theo GIỜ VIỆT NAM, kiểu date thuần.
  ///
  /// KHÔNG dùng timestamp: "hôm nay" của người dùng là ngày ở Việt Nam, còn
  /// server chạy UTC. Reset lúc 00:00 UTC là reset lúc 7 giờ sáng giờ VN —
  /// người dùng hết lượt lúc 22h tối sẽ thấy nó không reset lúc nửa đêm như
  /// mọi ứng dụng khác, và không ai đoán ra vì sao.
  day DateTime @db.Date

  feature AiFeature

  turnsReserved Int @default(0)
  turnsUsed     Int @default(0)
  turnsRefunded Int @default(0)

  updatedAt DateTime @updatedAt

  @@unique([userId, day, feature])
  @@map("ai_usage_days")
}

/// Một LẦN GỌI MODEL của người dùng. Ngắn — vài giây tới 90 giây.
///
/// ---------------------------------------------------------------------------
/// KHÔNG PHẢI chỗ giữ quota cho một job scan đang xếp hàng (sửa R04)
/// ---------------------------------------------------------------------------
/// Bản trước tạo AiTurn ngay lúc upload CV và giữ nó suốt vòng đời job. Sai, vì
/// sweeper kết thúc mọi hàng RESERVED quá 2 phút — trong khi chính plan cho phép
/// job chờ circuit 5 phút rồi retry 30 phút. Sweeper sẽ hoàn lượt của một job
/// vẫn còn sống, rồi worker sau đó tiếp tục dùng cùng `aiTurnId` đã bị chốt.
///
/// Tách làm hai thứ có vòng đời khác nhau:
///
///   AiUsageDay   — GIỮ CHỖ của người dùng, gắn với JOB. Sống từ lúc upload tới
///                  lúc job vào trạng thái cuối (CONFIRMED/FAILED). Có thể vài
///                  giờ. Sweeper KHÔNG đụng tới.
///   AiTurn       — MỘT LẦN gọi model. Worker tạo ngay TRƯỚC khi gọi Gemini và
///                  chốt ngay sau. Sweeper 2 phút áp lên ĐÚNG bảng này.
///
/// Với chat thì hai thứ trùng nhau về thời gian, nên không đổi gì.
model AiTurn {
  id String @id @default(cuid())

  userId  String
  feature AiFeature
  state   AiTurnState @default(RESERVED)

  /// Process nào đang chạy lượt này. `shutdown()` chỉ được huỷ lượt của CHÍNH
  /// MÌNH — API tắt không được hoàn lượt mà worker đang sở hữu (R04).
  runnerId String

  /// Ngày VN lúc GIỮ CHỖ. Lưu lại để hoàn đúng bucket khi job qua nửa đêm:
  /// giữ lúc 23:58, hoàn lúc 00:03 mà tính theo `ngayVN(now())` là cộng
  /// turnsRefunded vào ngày HÔM SAU — người dùng tự nhiên có 6 lượt.
  quotaDay DateTime @db.Date

  /// Với CHAT. Với CV_SCAN thì null.
  sessionId    String?
  /// Với CV_SCAN. Với CHAT thì null.
  extractionId String?

  /// Suy từ `steps` sau khi chạy xong. Xem plan 03 mục 2.2.
  /// null khi lượt hỏng trước khi có kết quả.
  category String?

  requestCount Int      @default(0)
  toolRounds   Int      @default(0)
  toolNames    String[] @default([])

  inputTokens  Int @default(0)
  outputTokens Int @default(0)

  modelId       String
  promptVersion String

  latencyMs           Int?
  timeToFirstTokenMs  Int?
  errorCode           String?

  handoffProposed Boolean @default(false)

  reservedAt DateTime  @default(now())
  settledAt  DateTime?

  @@index([userId, reservedAt])
  @@index([feature, reservedAt])
  /// Chỉ mục UNIQUE MỘT PHẦN `(userId) WHERE state = 'RESERVED'` KHÔNG khai được
  /// ở đây — Prisma không hỗ trợ partial unique index. Viết tay trong migration,
  /// xem plan 05 mục 4.
  @@map("ai_turns")
}

/// Một lời gọi HTTP tới Gemini. Nhiều hàng cho mỗi AiTurn.
///
/// Tách bảng chứ không cộng dồn vào AiTurn: cần biết vòng tool thứ mấy tốn nhiều
/// token nhất, và lần retry nào bị 429. Cộng dồn thì mất sạch chi tiết đó, mà đó
/// đúng là chi tiết cần để tối ưu.
model AiRequestLog {
  id String @id @default(cuid())

  turnId  String
  turn    AiTurn @relation(fields: [turnId], references: [id], onDelete: Cascade)

  /// Vòng thứ mấy trong lượt (1-based).
  step    Int
  /// Lần thử thứ mấy của vòng đó.
  attempt Int @default(1)

  modelId      String
  inputTokens  Int @default(0)
  outputTokens Int @default(0)

  finishReason String?
  httpStatus   Int?
  latencyMs    Int

  createdAt DateTime @default(now())

  @@index([turnId, step])
  @@index([createdAt])
  @@map("ai_request_logs")
}

/// Ngân sách CHUNG theo project, theo ngày PACIFIC, theo model, theo tính năng.
///
/// Vì sao cần cả hai tầng: trần theo người bảo vệ công bằng giữa người dùng; trần
/// này bảo vệ hạn mức của Google. 5 lượt × 200 tài khoản = 1000 lượt/ngày, thừa
/// sức vượt RPD free tier mà không tài khoản nào vi phạm hạn mức riêng của họ.
///
/// `feature` NẰM TRONG KHOÁ CHÍNH là điểm sửa theo R11: nếu AI_CHAT_MODEL và
/// AI_SCAN_MODEL trỏ CÙNG một model thì khoá (day, modelId) không tách được hai
/// phần ngân sách, và một buổi nhiều người quét CV sẽ ăn hết phần của chat. Thêm
/// chiều `feature` thì việc chia 70/30 chạy đúng bất kể hai biến trỏ đâu.
model AiProjectBudgetDay {
  /// NGÀY reset của CHÍNH nhà cung cấp đó:
  ///   google     → ngayPacific()   (RPD reset nửa đêm giờ Pacific)
  ///   cloudflare → ngayUTC()       (Neuron reset theo ngày UTC)
  /// KHÔNG dùng `ngayVN()` cho bảng này. Xem mục 1.
  day      DateTime  @db.Date
  /// 'google' | 'cloudflare'. Hai nhà cung cấp, hai hạn mức hoàn toàn tách rời:
  /// Google đếm request/token, Cloudflare đếm Neuron. Gộp một cột là không diễn
  /// đạt được rằng chat hết quota KHÔNG ảnh hưởng gì tới scan CV, và ngược lại.
  provider String
  modelId  String
  feature  AiFeature

  /// Đơn vị của Cloudflare. Với Google thì để 0.
  ///
  /// Vì sao cột riêng chứ không quy đổi về token: hạn mức free của Cloudflare là
  /// 10.000 NEURON/ngày, và Neuron là hàm của cả token vào lẫn ra với hai hệ số
  /// khác nhau theo từng model. Quy đổi ngược về token là mất chính con số cần so
  /// với trần.
  neurons  Int @default(0)

  /// Số lần gọi HTTP tới Gemini. Tăng ĐÚNG MỘT LẦN, ngay trước mỗi lời gọi,
  /// KỂ CẢ lần SDK tự thử lại. Hàm settle KHÔNG được chạm cột này (R07).
  requests     Int @default(0)
  inputTokens  Int @default(0)
  outputTokens Int @default(0)

  /// Số lần Google trả 429 hôm nay. Tín hiệu để hạ trần cho ngày mai.
  rateLimitHits Int @default(0)

  @@id([day, provider, modelId, feature])
  @@map("ai_project_budget_days")
}

/// Cửa sổ PHÚT, để tuân thủ RPM và TPM — thứ mà trần theo ngày hoàn toàn mù.
///
/// Vì sao cần bảng riêng thay vì suy từ AiRequestLog: đếm bằng COUNT(*) trên một
/// bảng đang lớn dần, mỗi lần gọi model một lần, là truy vấn đắt nhất trong luồng
/// nóng. Một hàng cho mỗi (model, phút) với UPSERT nguyên tử thì rẻ và chính xác.
///
/// Bảng này DÙNG CHUNG giữa API và worker — nằm ở @uniwork/ai-runtime. Mỗi bên
/// đếm riêng trong bộ nhớ là đúng cách vượt RPM mà không ai biết.
model AiProviderWindow {
  /// 'google' | 'cloudflare'. BẮT BUỘC có mặt vì nó nằm trong khoá chính bên dưới.
  provider String
  modelId  String
  /// Mốc phút, cắt tròn: `date_trunc('minute', now())`. Theo UTC, vì RPM là cửa
  /// sổ trượt theo phút — múi giờ không liên quan ở đây, chỉ RPD mới liên quan.
  minute  DateTime

  requests    Int @default(0)
  inputTokens Int @default(0)

  @@id([provider, modelId, minute])
  /// Job dọn xoá hàng cũ hơn 1 giờ.
  @@index([minute])
  @@map("ai_provider_windows")
}

/// Circuit breaker — MỘT HÀNG MỖI MODEL, `id` chính là `modelId`.
///
/// Bản trước dùng một hàng chung id='gemini'. Sai theo R11: scan CV gặp 429 trên
/// gemini-2.5-flash sẽ chặn luôn chat đang chạy trên gemini-3.5-flash-lite, dù
/// hạn mức của hai model là hai túi riêng. Khoá theo modelId thì mỗi model tự
/// chịu lỗi của mình — và nếu hai biến trỏ cùng model thì chúng dùng chung một
/// hàng, đúng như phải thế.
model AiCircuit {
  /// = `${provider}:${modelId}`, ví dụ 'google:gemini-3.5-flash-lite' hoặc
  /// 'cloudflare:@cf/moondream/moondream3.1-9B-A2B'.
  ///
  /// Có tiền tố provider vì từ 2026-09-13 hệ thống dùng HAI nhà cung cấp: chat ở
  /// Google, scan CV ở Cloudflare. Cloudflare hết 10.000 Neuron không được phép
  /// chạm tới chat, và Google 429 không được chạm tới scan.
  id           String    @id
  openUntil    DateTime?
  lastError    String?
  /// 'RPM' | 'RPD' | 'SERVER' — ba loại lỗi, ba cách chờ khác nhau. Xem mục 4.3.
  lastKind     String?
  consecutive  Int       @default(0)
  updatedAt    DateTime  @updatedAt

  @@map("ai_circuits")
}
```

---

## 3. Giữ / dùng / hoàn — ba thao tác, và giữ phải nguyên tử

### 3.1 — Giữ lượt bằng MỘT câu SQL

Đề bài: *"Xử lý quota nguyên tử"*. Đọc-rồi-ghi trong hai bước là lỗi kinh điển: hai
tab bấm cùng lúc, cả hai đọc thấy `4 < 5`, cả hai ghi `5`. Người dùng có 6 lượt.

```sql
-- apps/api/src/modules/ai/ai.quota.ts — ĐỀ XUẤT
INSERT INTO ai_usage_days (id, "userId", day, feature, "turnsReserved", "updatedAt")
VALUES ($1, $2, $3::date, $4::"AiFeature", 1, now())
ON CONFLICT ("userId", day, feature) DO UPDATE
  SET "turnsReserved" = ai_usage_days."turnsReserved" + 1,
      "updatedAt"     = now()
  WHERE ai_usage_days."turnsReserved" - ai_usage_days."turnsRefunded" < $5
RETURNING "turnsReserved", "turnsRefunded";
```

Một câu lệnh, một khoá hàng do chính Postgres giữ. **`RETURNING` không có hàng nào =
hết lượt.** Không cần `SELECT` trước, không cần transaction bao ngoài.

Hai chỗ tinh tế:

- **Mệnh đề `WHERE` nằm trong `DO UPDATE`**, không nằm ngoài. Đây là cú pháp Postgres
  cho phép `ON CONFLICT` từ chối cập nhật có điều kiện. Viết `WHERE` ngoài là lỗi cú pháp.
- **Trừ `turnsRefunded`** trong điều kiện. Không trừ thì lượt bị hoàn vẫn chiếm chỗ,
  và người dùng gặp một lỗi mạng là mất lượt vĩnh viễn.

`$3::date` phải là ngày theo **giờ Việt Nam**:

```ts
// ĐỀ XUẤT — một hàm, dùng ở mọi chỗ tính "hôm nay"
const MUI_GIO = 'Asia/Ho_Chi_Minh'
export function ngayVN(luc: Date = new Date()): string {
  // 'sv-SE' cho ra đúng dạng YYYY-MM-DD.
  return luc.toLocaleDateString('sv-SE', { timeZone: MUI_GIO })
}
```

Hằng số này ở **một** chỗ. Hai chỗ tính "hôm nay" là hai chỗ sẽ lệch nhau đúng
7 tiếng mỗi ngày, và triệu chứng ("thỉnh thoảng buổi tối quota reset sớm") mất
nhiều giờ để lần ra.

### 3.2 — Một yêu cầu đang xử lý mỗi tài khoản

Đề bài: *"Mỗi tài khoản chỉ có một yêu cầu AI đang xử lý."*

Không dùng biến trong bộ nhớ (nhiều instance, và Render restart liên tục). Dùng
**chỉ mục unique một phần** — Prisma không khai được, viết tay trong migration:

```sql
-- migrations/…_ai_quota/migration.sql
CREATE UNIQUE INDEX "ai_turns_mot_luot_dang_chay"
  ON "ai_turns" ("userId")
  WHERE state = 'RESERVED';
```

`INSERT` lượt thứ hai khi lượt thứ nhất chưa settle ⇒ `P2002` ⇒ trả **409 `AI_BUSY`**.

Chỉ mục **một phần** chứ không phải unique thường: chỉ ràng buộc các hàng đang
`RESERVED`. Hàng đã `SUCCEEDED` thì bao nhiêu cũng được. Đây là cách diễn đạt trực
tiếp nhất của luật nghiệp vụ, do database cưỡng chế, không phụ thuộc code nào nhớ.

**Ràng buộc này chỉ kiểm được ở làn `vitest.db`** (Postgres thật). Mock Prisma không
biết gì về chỉ mục. Xem [08](08-kiem-thu.md).

**Hệ quả phải xử:** hàng kẹt ở `RESERVED` sẽ **khoá tài khoản đó vĩnh viễn**. Ba lớp
chống:

1. `shutdown()` settle **các lượt `RESERVED` có `runnerId` = chính process này** khi
   nhận SIGTERM — [01](01-kien-truc-va-ranh-gioi.md) mục 5. **Không đụng lượt của
   process khác** (R04): API tắt để deploy không được hoàn lượt mà worker đang chạy dở.
2. Job quét mỗi phút: `RESERVED` quá 2 phút (> `AI_REQUEST_TIMEOUT_MS` × 4) →
   `FAILED` + hoàn lượt. **Chỉ áp lên `ai_turns`**, tuyệt đối không áp lên
   `cv_extractions` — job scan có quyền chờ hàng giờ (R04).
3. `/api/health/chi-tiet` báo `luotKetQuaLau` — nhìn thấy được.

**Job scan chờ lâu thì ai giữ quota?** `AiUsageDay`, và nó được chốt bởi **trạng thái
cuối của job**, không bởi tuổi của một `AiTurn`:

```sql
-- Chốt giữ chỗ của job. CAS để chạy đúng MỘT lần dù sweeper và worker gặp nhau.
UPDATE cv_extractions
   SET "quotaSettledAt" = now()
 WHERE id = $id
   AND status IN ('NEEDS_REVIEW', 'CONFIRMED', 'FAILED')
   AND "quotaSettledAt" IS NULL
RETURNING "quotaDay", status;
-- 0 hàng ⇒ ai đó đã chốt rồi ⇒ KHÔNG cộng turnsUsed/turnsRefunded lần hai.
```

Rồi cộng vào `AiUsageDay` của **`quotaDay` đã lưu trên hàng job**, không phải
`ngayVN(now())` — job upload lúc 23:58 và hỏng lúc 00:03 phải hoàn về bucket hôm qua.

`FAILED` vì lỗi của ta (5xx, timeout, hết hạn chờ quota) ⇒ hoàn.
`FAILED` vì file người dùng (`FILE_UNSUPPORTED`, `NOT_A_CV`) ⇒ **không** hoàn — nhưng
những ca đó đã bị chặn ở tầng HTTP trước khi giữ lượt, nên gần như không xảy ra.

**Một job scan có thể sinh nhiều `AiTurn`** (mỗi lần retry một cái, và phương án B hai
request là hai cái). Đó là đúng: `AiUsageDay` đếm **lượt người dùng** = 1;
`AiProjectBudgetDay.requests` đếm **lần gọi HTTP** = 2 hoặc nhiều hơn. Hai con số khác
nhau và cả hai đều đúng — đây chính là chỗ đề bài đòi phân biệt.

Lớp 2 là lớp thật sự cứu. Lớp 1 chỉ chạy khi tắt máy có trật tự; `SIGKILL`, hết RAM,
Render ép dừng thì nó không chạy.

### 3.3 — Settle: dùng hay hoàn

```ts
export async function chotLuot(turnId: string, kq:
  | { ok: true;  usage: TokenUsage; steps: StepInfo[] }
  | { ok: false; errorCode: string; hoanLuot: boolean; usage?: TokenUsage },
): Promise<void>
```

### 3.3.0 — AI CHỐT LƯỢT NGƯỜI DÙNG: chat thì turn, scan thì JOB (sửa #8)

Đây là chỗ bản trước có một lỗi cộng dồn thật, và nó khuếch đại quota chứ không chỉ
sai số liệu.

**Bug:** một job scan sinh **nhiều** `AiTurn` (mỗi lần retry một cái, phương án B hai
request là hai cái). Mỗi `chotLuot` lại cộng `turnsUsed`/`turnsRefunded` vào
`AiUsageDay`. Cộng thêm `chotGiuChoScan` cũng settle. CAS theo từng turn **không** ngăn
được hai turn KHÁC NHAU cùng hoàn vào một reservation.

```
1 reservation, 2 lần timeout được hoàn:
   turnsReserved = 1
   turnsRefunded = 2
   còn lại = limit − (1 − 2) = limit + 1     ← người dùng được THÊM lượt vì hệ thống hỏng
```

**Luật, phát biểu một lần:**

| | Ai được chạm `AiUsageDay` | Ai chỉ ghi attempt + usage |
| --- | --- | --- |
| `CHAT` | `chotLuot` — turn **là** lượt, một-một | — |
| `CV_SCAN` | **chỉ `chotGiuChoScan`**, đúng một lần mỗi job | `chotLuot` mọi attempt |

```ts
// chotLuot — thêm một nhánh ở đầu
async function chotLuot(turnId, kq) {
  const turn = await casTurn(turnId)          // CAS state='RESERVED', 0 hàng ⇒ dừng
  if (!turn) return

  await ghiRequestLog(turn, kq)               // luôn ghi, mọi feature
  await congNganSachProvider(turn, kq)        // luôn cộng, mọi feature

  // CV_SCAN: DỪNG Ở ĐÂY. Lượt người dùng do vòng đời JOB chốt, không do attempt.
  if (turn.feature === 'CV_SCAN') return

  await congUsageDay(turn, kq)                // chỉ CHAT
}
```

**Chốt ở `NEEDS_REVIEW`, không đợi người dùng bấm xác nhận.** Job tới đó là đã tiêu tài
nguyên và đã tạo ra kết quả — người dùng bỏ không xem cũng không được hoàn. Bản trước
gộp chốt quota vào bước xác nhận, tức là một job xong mà chủ nhân quên mở sẽ giữ chỗ
mãi.

Trạng thái cuối và cách chốt:

| Job kết thúc ở | `turnsUsed` | `turnsRefunded` |
| --- | --- | --- |
| `NEEDS_REVIEW` (và `CONFIRMED` sau đó) | +1 | 0 |
| `FAILED` vì **lỗi hệ thống** (5xx, timeout, `QUOTA_TIMEOUT`) | +1 | **+1** |
| `FAILED` vì **file người dùng** (`FILE_UNSUPPORTED`, `NOT_A_CV`) | +1 | 0 |

Cả ba đi qua **cùng một** CAS `quotaSettledAt IS NULL` ⇒ tối đa một lần cho mỗi
reservation, dù sweeper và worker chạy đua, dù job qua nửa đêm (đã có `quotaDay`).

Định nghĩa `turnsUsed` vì vậy là **"số reservation đã kết thúc"**, không phải "số lần
thành công" — và `turnsRefunded` là tập con của nó. Công thức còn lại vẫn là
`limit − (turnsReserved − turnsRefunded)`, và giờ nó không bao giờ vượt `limit`.

### 3.3.1 — Bốn việc trong transaction settle

Một transaction làm bốn việc, và **việc thứ tư là chỗ bản trước đếm hai lần (R07)**:

1. `AiTurn` → `SUCCEEDED` / `FAILED` / `REFUNDED`, ghi token, latency, category.
   **CAS bắt buộc:** `WHERE id = $id AND state = 'RESERVED'`. 0 hàng ⇒ đã chốt rồi ⇒
   **dừng, không làm ba việc còn lại.** Đây là thứ làm cho `chotLuot` idempotent khi
   callback chạy hai lần hoặc sweeper gặp worker.
2. `AiRequestLog` cho từng vòng — `@@unique([turnId, step, attempt])` để chèn lại
   không sinh hàng trùng.
3. `AiUsageDay`: `turnsUsed += 1`, và `turnsRefunded += 1` nếu hoàn. Vào bucket
   `AiTurn.quotaDay`, **không** phải `ngayVN(now())`.
4. `AiProjectBudgetDay`: **chỉ cộng `inputTokens` / `outputTokens`.**
   **KHÔNG chạm `requests`.**

Điểm 4 là lỗi thật của bản trước: mục 4.1 đã `requests += 1` ngay trước mỗi lời gọi
HTTP, rồi settle lại `requests += n` — **một request thành công bị tính hai lần**, và
trần 400/ngày thật ra chặn ở 200.

**Luật một dòng, dán vào đầu file `quota.ts`:**

> `requests` **chỉ** được tăng ở một chỗ duy nhất: `xinPhepGoiModel()`, ngay trước khi
> gửi HTTP. Mọi hàm khác chỉ được đọc. Token thì ngược lại — chỉ `chotLuot()` ghi.

**Bảng quyết định hoàn hay không** — đề bài đòi phân biệt "lượt đã dùng" với "tài
nguyên API thực sự đã tiêu thụ", và đây là chỗ đó:

| Tình huống | Hoàn lượt? | Token đã tiêu? | Vì sao |
| --- | --- | --- | --- |
| Trả lời xong | Không | Có | Bình thường |
| Người dùng không thích câu trả lời | Không | Có | Model đã làm việc |
| **Kết nối SSE của client đóng giữa stream** — đóng tab HOẶC mất mạng, server không phân biệt được | **Không** | Có | Token đã tiêu rồi. Và hai ca này cho **cùng một tín hiệu**, nên không được có hai luật ([03](03-chatbot-va-tool.md) §7). Bù bằng cách **chạy nốt và vẫn ghi tin AI** — tải lại là thấy |
| Câu trả lời bị bỏ vì đã chuyển sang NTD | **Không** | Có | Cùng lý do. Ghi `errorCode='HANDOFF_DISCARDED'` để đếm |
| Timeout 30 giây | **Có** | Có thể một phần | Lỗi của ta |
| Gemini 5xx | **Có** | Không | Lỗi nhà cung cấp |
| Gemini 429 | **Có** | Không | Không có gì chạy cả |
| Mạng **của server** đứt trước khi gửi được request đầu tới nhà cung cấp | **Có** | Không | Khác dòng trên: đây là mạng phía ta, quan sát được, và chưa tiêu gì |
| Deploy giữa chừng | **Có** | Một phần | Lỗi của ta |
| Zod của **ta** ném khi dựng tool | **Có** | Không | Lỗi lập trình, người dùng không chịu |
| Model trả JSON hỏng cả sau retry | **Không** | Có | Model đã chạy hai lần thật |

Nguyên tắc một dòng: **hoàn khi ta hỏng, không hoàn khi model đã chạy.**

Hàng `REFUNDED` giữ nguyên `inputTokens`/`outputTokens` đã tiêu — đó chính là điểm:
`turnsRefunded` đếm lượt trả lại cho người dùng, `AiRequestLog` vẫn ghi tài nguyên đã
mất. Hai con số không bằng nhau, và cả hai đều đúng.

---

## 4. Trần chung theo project

### 4.1 — Một cổng duy nhất: `xinPhepGoiModel()` (sửa R07, R11)

Một lượt có thể là 4 request. Kiểm ở đầu lượt là kiểm sai đơn vị. Và kiểm **chỉ** theo
ngày là mù với RPM — thứ mà 20 người bấm cùng lúc lúc 21h sẽ chạm trước tiên.

Gộp cả ba phép kiểm vào **một hàm, gọi ngay trước mỗi lời gọi HTTP**, ở cả API lẫn
worker (nó nằm trong `@uniwork/ai-runtime` chính vì phải dùng chung):

```ts
// packages/ai-runtime/src/quota.ts — ĐỀ XUẤT
export type KetQuaXinPhep =
  | { ok: true }
  | { ok: false; ly: 'CIRCUIT' | 'RPM' | 'TPM' | 'RPD' | 'NGAN_SACH'; choToiLuc: Date }

/**
 * Cổng DUY NHẤT trước mọi lời gọi Gemini. Gọi cho MỖI request HTTP, kể cả lần
 * SDK tự thử lại — nếu bọc ngoài streamText thì các lần retry bên trong SDK
 * không được đếm, và ta vượt RPM mà bộ đếm vẫn xanh.
 *
 * Cách bọc đúng: truyền một `fetch` tuỳ biến vào provider, và gọi hàm này bên
 * trong `fetch` đó. Mọi đường đi tới mạng đều qua một cửa.
 */
export async function xinPhepGoiModel(
  modelId: string,
  feature: AiFeature,
  uocTinhInputTokens: number,
): Promise<KetQuaXinPhep>
```

Bốn phép kiểm, theo thứ tự rẻ trước:

| # | Kiểm | Bảng | Cửa sổ |
| --- | --- | --- | --- |
| 1 | Circuit của **model này** đang mở? | `ai_circuits` (id = modelId) | `openUntil` |
| 2 | RPM / TPM | `ai_provider_windows` | phút hiện tại, UTC |
| 3 | RPD của provider | `ai_project_budget_days` | **`ngayPacific()`** |
| 4 | Ngân sách app theo tính năng | `ai_project_budget_days` | `ngayPacific()`, cột `feature` |

Phép 3 và 4 dùng cùng bảng nhưng khác cách cộng: 3 cộng mọi `feature` của cùng
`modelId` (đó là thứ Google đếm), 4 chỉ lấy đúng `feature` (đó là thứ ta tự chia).
Bản trước gộp làm một nên không diễn đạt được sự khác biệt đó.

Chỉ khi cả bốn đều qua mới `requests += 1` — **và đó là chỗ duy nhất trong toàn hệ
thống tăng cột này.**

```sql
-- Khoá chính là (day, provider, modelId, feature) — ON CONFLICT phải liệt kê ĐỦ
-- bốn cột, không phải (day, modelId) như bản trước.
--
-- `day` KHÔNG dùng chung một hàm: gọi `ngayPacific()` khi provider='google'
-- (RPD reset nửa đêm Pacific), `ngayUTC()` khi provider='cloudflare' (Neuron
-- reset nửa đêm UTC). Nơi gọi truyền vào, hàm này không tự chọn.
INSERT INTO ai_project_budget_days
       (day, provider, "modelId", feature, requests, neurons)
VALUES ($1::date, $2, $3, $4::"AiFeature", 1, 0)
ON CONFLICT (day, provider, "modelId", feature) DO UPDATE
  SET requests = ai_project_budget_days.requests + 1
  WHERE ai_project_budget_days.requests < $5
RETURNING requests, neurons;
```

0 hàng ⇒ chạm trần. Cùng khuôn với 3.1.

**Với Cloudflare thì trần là NEURON, không phải request** — và neuron chỉ biết được
**sau** khi gọi xong. Nên hai pha, không một:

```sql
-- Pha 1, TRƯỚC khi gọi: xin phép theo neuron ƯỚC TÍNH.
--   uocTinh = tokenVaoUocTinh × heSoVao/1e6 + maxTokens × heSoRa/1e6
-- Ước bằng `max_tokens` chứ không bằng độ dài thật: đây là trần an toàn, thà
-- giữ chỗ thừa rồi trả lại còn hơn phát hiện vượt hạn mức sau khi đã tiêu.
INSERT INTO ai_project_budget_days (day, provider, "modelId", feature, requests, neurons)
VALUES ($1::date, 'cloudflare', $2, $3::"AiFeature", 1, $4)
ON CONFLICT (day, provider, "modelId", feature) DO UPDATE
  SET requests = ai_project_budget_days.requests + 1,
      neurons  = ai_project_budget_days.neurons + $4
  WHERE ai_project_budget_days.neurons + $4 <= $5   -- $5 = AI_CF_NEURONS_PER_DAY
RETURNING neurons;

-- Pha 2, SAU khi gọi: chỉnh lại bằng usage thật (có thể ÂM nếu ước thừa).
UPDATE ai_project_budget_days
   SET neurons = GREATEST(0, neurons + $chenhLech)
 WHERE day = $1::date AND provider = 'cloudflare'
   AND "modelId" = $2 AND feature = $3::"AiFeature";
```

**Trần tổng theo ngày phải cộng qua MỌI model của cùng provider**, vì 10.000 Neuron là
hạn mức của cả tài khoản Cloudflare, không phải của từng model:

```sql
SELECT COALESCE(SUM(neurons), 0) FROM ai_project_budget_days
 WHERE day = $1::date AND provider = 'cloudflare';
```

Khác hẳn Google — nơi hạn mức tách theo từng model ([00](00-khao-sat.md) C.2), nên
`AI_PROJECT_REQUESTS_PER_DAY` áp cho **từng** `modelId`. Hai provider, hai cách cộng;
`xinPhepGoiModel()` nhận `provider` và rẽ nhánh tại đó.

**Chữ ký sau khi thêm provider** — bản trước thiếu tham số này:

```ts
export async function xinPhepGoiModel(
  provider: 'google' | 'cloudflare',
  modelId: string,
  feature: AiFeature,
  uocTinhInputTokens: number,
  /** Chỉ với cloudflare: dùng để ước neuron giữ chỗ ở pha 1. */
  maxOutputTokens?: number,
): Promise<KetQuaXinPhep>
```

### 4.1b — Một API key, hai model (bổ sung 2026-09-12)

**API key: một.** Một Google Cloud project → một khoá → cả chat lẫn scan CV dùng
chung. Đúng như hình dung, và đó chính là **lý do** `AiProjectBudgetDay` tồn tại: hai
feature rút từ **cùng một túi**, nên phải có trần chung, không chỉ trần theo người.

Một chỗ dễ hiểu nhầm, nói trước để khỏi mất công: **hạn mức tính theo project, không
theo khoá.** Tạo khoá thứ hai trong cùng project **không** cho thêm quota. Hai project
riêng thì có hạn mức riêng — nhưng đó là né hạn mức, ngược điều khoản, và không làm.

**Model: hai, và không phải chỉ vì chất lượng.**

`AI_CHAT_MODEL` và `AI_SCAN_MODEL` là hai biến riêng. Chúng **có thể** trỏ cùng một
model, nhưng nên khác nhau vì hai lý do, và lý do thứ hai mới là lý do mạnh:

1. **Việc khác nhau.** Chat cần trả lời nhanh và gọi được nhiều lần trong ngày →
   Flash-Lite. Đọc CV cần thị giác tốt và structured output ổn định → Flash.
2. **Hạn mức free tier liệt kê theo TỪNG MODEL.** Bảng trong AI Studio có một dòng
   cho mỗi model. Nghĩa là dùng hai model là có **hai túi RPD riêng** — tổng dung
   lượng ngày lớn hơn, và quan trọng hơn: **một buổi nhiều người quét CV không thể
   làm chat chết**, vì chúng không tiêu chung một hạn mức của Google.

Điểm 2 phải **xác nhận bằng mắt ở cổng 1 ngày 1** ([07](07-lo-trinh-14-ngay.md)):
mở https://aistudio.google.com/rate-limit và xem bảng có tách theo model không, ghi
lại số của cả hai model. Nếu hoá ra hạn mức gộp chung thì phần chia ngân sách ở 4.2
bên dưới trở thành lớp bảo vệ **duy nhất**, và ngưỡng của nó phải đặt chặt hơn.

### 4.2 — Chia phần giữa chat và scan

Đề bài: *"giới hạn tài nguyên dùng chung với scan CV"*.

Không chia thì một buổi nhiều người quét CV sẽ ăn hết trần, và chat chết cả ngày —
mà chat là thứ người dùng gõ và chờ ngay, còn scan thì bất đồng bộ và chờ được.

```
Trần chat = floor(AI_PROJECT_REQUESTS_PER_DAY × AI_CHAT_BUDGET_SHARE)   // 400×0.7 = 280
Trần scan = AI_PROJECT_REQUESTS_PER_DAY − trần chat                     // 120
```

Hai bộ đếm riêng (`modelId` khác nhau đã tách sẵn, vì `AI_CHAT_MODEL` ≠ `AI_SCAN_MODEL`).

**Chat được mượn phần chưa dùng của scan sau 20:00 giờ VN.** Đơn giản, và khớp thực
tế: quét CV là việc làm một lần lúc dựng hồ sơ, chat là việc làm buổi tối. Chiều
ngược lại **không** cho mượn — scan chờ được tới ngày mai, chat thì không.

**Nói cho đúng chữ (R11):** "mượn quota" ở đây **chỉ là nới ngân sách của CHÍNH TA**
trong phạm vi hạn mức Google, không phải chuyển hạn mức giữa hai model. Hạn mức của
Google không di chuyển được — trần 4 nới ra thì trần 3 vẫn đứng nguyên và vẫn chặn.
Nếu `AI_CHAT_MODEL === AI_SCAN_MODEL` thì hai feature dùng chung một túi RPD của
Google, và việc "mượn" chỉ đổi cách ta tự chia túi đó.

### 4.3 — Circuit breaker

**Ba loại lỗi, ba cách chờ khác nhau (sửa R11).** Bản trước gộp mọi thứ vào một circuit
chung `id='gemini'` với một công thức backoff — nên 429 kiểu "quá nhanh trong một phút"
bị xử như 429 kiểu "hết ngày", và scan chặn luôn chat.

```
429 + header/thông điệp chỉ RPM   → lastKind='RPM'
  → openUntil = đầu phút kế tiếp (tối đa 60 giây). consecutive KHÔNG tăng.
    Đây không phải sự cố, chỉ là ta gọi quá nhanh.

429 + đã chạm RPD                  → lastKind='RPD'
  → openUntil = 00:00 giờ PACIFIC hôm sau (dùng ngayPacific)
    Chờ tới sáng mai theo giờ Google, không theo giờ ta.

5xx / timeout / lỗi mạng           → lastKind='SERVER'
  → consecutive += 1
  → openUntil = now + min(2^consecutive × 60 giây, 30 phút)

request thành công  → consecutive = 0, openUntil = null, lastKind = null
```

Phân biệt RPM và RPD từ đâu: `RetryInfo.retryDelay` trong lỗi Google, và bộ đếm
`ai_provider_windows` / `ai_project_budget_days` của chính ta. Cái nào đang sát trần
thì đó là thủ phạm. Không đoán được thì coi là `SERVER` — chờ lâu hơn cần thiết còn
hơn đâm đầu vào một hạn mức ngày.

**Circuit khoá theo `modelId`.** Scan hỏng trên `gemini-2.5-flash` không chạm chat
trên `gemini-3.5-flash-lite`. Hai biến trỏ cùng model thì chúng dùng chung một hàng —
đúng như phải thế, vì lúc đó chúng thật sự chung một hạn mức.

**Không tự chuyển sang API trả phí.** Đề bài nói rõ, và điều này phải là **cấu trúc**
chứ không phải kỷ luật: mỗi nhà cung cấp có **đúng một** khoá trong `env`
(`GOOGLE_GENERATIVE_AI_API_KEY` cho chat, `CLOUDFLARE_API_TOKEN` cho scan CV), và
**không có khoá trả phí nào tồn tại** để mà chuyển sang. Không có nhánh nào chọn
provider khác. Muốn trả phí thì bật billing cho chính khoá đó — một hành động của
con người trên Google Cloud Console, không phải một nhánh `if` trong code.

**Ảnh hưởng tới scan CV:** circuit mở ⇒ worker **không nack**, mà giữ message chưa
ack, `sleep(min(openUntil − now, 60 giây))`, rồi kiểm lại. Vì sao không nack: nack đẩy
qua retry queue và mỗi vòng đó là một lần đọc lại, còn ở đây ta biết chắc phải chờ
bao lâu. Nhưng **không giữ quá 5 phút** — quá thì trả lease và hẹn `nextAttemptAt`
([02](02-messaging-rabbitmq.md) 1.5), `quotaWaits += 1`
để không giữ kênh AMQP treo và không chạm `consumer_timeout` của RabbitMQ (mặc định
30 phút, quá là broker đóng kênh).

Trạng thái hiển thị cho người dùng: `QUEUED` + `blockedReason='QUOTA'` + `retryAfter`.
**Không** phải spinner. Đề bài: *"Queue không được vượt qua hoặc che giấu giới hạn
quota Gemini."*

---

## 5. Chống spam — ba lớp, ba mục đích

| Lớp | Cơ chế | Chặn gì | Không chặn được gì |
| --- | --- | --- | --- |
| **1. IP** | `rateLimit({ max: 30, windowMs: 60_000 })` trên `/api/tro-ly` và `/api/toi/quet-cv` | Script bắn liên tục từ một máy | Nhiều máy; và **chặn nhầm cả phòng máy trường học** |
| **2. Tài khoản/ngày** | `AiUsageDay` | Một người dùng quá phần | Người tạo nhiều tài khoản |
| **3. Đồng thời** | Chỉ mục unique một phần | Mở 5 tab bấm cùng lúc | — |

### 5.1 — Vì sao IP chỉ là lớp phụ

Đề bài nói thẳng, và khảo sát xác nhận: `app.set('trust proxy', 1)`
([app.ts:33](../../apps/api/src/app.ts#L33)) cho `req.ip` đúng sau proxy Render, nhưng
sinh viên trong một phòng thực hành dùng chung một IP NAT. Chặn theo IP là chặn cả lớp.

Nên **ngưỡng IP đặt rộng** (30/phút — đủ để chặn script, không đủ để phiền người
thật), và **quota thật nằm ở tài khoản**. Đúng như comment đã có sẵn trong
[rate-limit.ts:64-68](../../apps/api/src/middlewares/rate-limit.ts#L64-L68) về việc
"chỉ theo IP thì cả một phòng máy trong trường dùng chung một IP sẽ chặn nhầm nhau".

### 5.2 — Tài khoản rác

`AiUsageDay` theo `userId` thì tạo 10 tài khoản là có 50 lượt.

**Lớp chặn đã có sẵn và không cần thêm gì:** trợ lý AI yêu cầu `emailVerifiedAt`,
đúng như `createApplication` đang làm
([applications.service.ts:154-156](../../apps/api/src/modules/applications/applications.service.ts#L154-L156)).
Mỗi tài khoản cần một email thật nhận được OTP. Không loại bỏ được, nhưng nâng chi
phí đủ cao cho quy mô này.

**Không** thêm captcha, không thêm xác minh SĐT. Đó là hạ tầng nặng cho một nhu cầu
chưa xuất hiện — đúng ràng buộc "Không thêm hạ tầng nặng nếu chưa giải quyết nhu cầu
cụ thể".

---

## 6. Giới hạn tài nguyên mỗi lượt

Đề bài: *"Giới hạn lịch sử, output token, thời gian chờ, số vòng tool và retry."*

| Giới hạn | Giá trị | Biến | Vì sao con số đó |
| --- | --- | --- | --- |
| Lịch sử đưa vào ngữ cảnh | 12 tin gần nhất | `AI_HISTORY_MESSAGES` | ~6 lượt qua lại, đủ cho "việc này" trỏ đúng chỗ. Thêm nữa là token tăng tuyến tính mà chất lượng không tăng |
| Trần cứng ngữ cảnh | 8.000 token | — | Cắt từ tin cũ nhất **nhưng luôn giữ system prompt và tin mới nhất** |
| Output | 1.024 token | `AI_MAX_OUTPUT_TOKENS` | Prompt đã dặn ≤ 6 câu. Trần này là lưới, không phải mục tiêu |
| Timeout mỗi request | 30 giây | `AI_REQUEST_TIMEOUT_MS` | Qua `AbortSignal.timeout()` |
| Timeout cả lượt | 90 giây | — | 4 vòng × 30 giây có thể là 120 giây. Người dùng không chờ nổi |
| Vòng tool | 4 | `AI_MAX_TOOL_ROUNDS` | Mặc định AI SDK v7 là 20 — quá rộng cho free tier |
| Retry mạng | 1 lần, chỉ với lỗi mạng và 5xx | — | Không retry 429 (đã có circuit), không retry 4xx |
| Input mỗi tool | 4 KB JSON | — | Xem [03](03-chatbot-va-tool.md) mục 3.3 |

**Cắt lịch sử phải giữ cặp tool-call/tool-result cùng nhau.** Cắt giữa chúng thì
ngữ cảnh có một `toolResult` không có `toolCall` tương ứng, và Gemini từ chối request
với lỗi khó hiểu. Đây là lỗi hay gặp nhất khi tự cắt lịch sử — hàm cắt phải nhận biết
ranh giới `step`, không cắt theo số phần tử mảng.

---

## 7. API cho người dùng thấy quota

```
GET /api/tro-ly/luot-con-lai
```

```jsonc
{
  "khaDung": true,              // false khi chưa cấu hình khoá — nút AI không hiện
  "chat": { "conLai": 3, "tong": 5 },
  "scan": { "conLai": 2, "tong": 3 },
  "resetLuc": "2026-09-13T17:00:00.000Z",   // 00:00 giờ VN, trả về dạng UTC
  "dangTamNgung": false,        // circuit breaker
  "tamNgungDenLuc": null
}
```

**Web gọi endpoint này khi mở app**, không đợi tới lúc bấm gửi rồi mới nhận 429. Hết
lượt thì ô nhập chuyển sang trạng thái đã giải thích, kèm hai nút:

- "Tìm việc bằng bộ lọc" → `/viec-lam`
- "Nhắn nhà tuyển dụng" → chỉ hiện **khi đang mở một tin cụ thể**

Đề bài: *"Hết lượt: vẫn dùng tìm kiếm thông thường và chat người thật"* và *"Không
bắt buộc chuyển sang nhà tuyển dụng khi hết lượt"*. Hai nút, không nút nào bắt buộc,
và không có modal chặn màn hình.

---

## 8. Chống xử lý trùng — bảng tổng hợp

Gom về một chỗ vì nó rải khắp các plan:

| Trùng loại gì | Cơ chế | Ở đâu |
| --- | --- | --- |
| Người dùng bấm gửi tin hai lần | `@@unique([sessionId, clientMessageId])` | [03](03-chatbot-va-tool.md) 5.2 |
| Hai lượt AI song song một tài khoản | Chỉ mục unique một phần trên `ai_turns` | mục 3.2 |
| Cùng file CV nộp lại | `@@unique([ownerUserId, contentHash, pipelineVersion])` | [02](02-messaging-rabbitmq.md) 5 |
| RabbitMQ giao lại message | `processed_messages(messageId, consumer)` | [02](02-messaging-rabbitmq.md) 5 |
| Hai worker cùng nhận một job | CAS trên `status` + `leaseExpiresAt` | [02](02-messaging-rabbitmq.md) 4.4 |
| Hai relay publish cùng một hàng outbox | `FOR UPDATE SKIP LOCKED` | [02](02-messaging-rabbitmq.md) 4.3 |
| Hai NTD cùng tiếp nhận | `updateMany` với `where.state` | [04](04-handoff-realtime.md) 1.2 |
| Xác nhận hồ sơ hai lần từ một bản trích xuất | `status` CAS `NEEDS_REVIEW → CONFIRMED` | [06](06-scan-cv.md) §9.2 |

Tám cơ chế, và **bảy trong số đó là ràng buộc database chứ không phải câu `if`**. Đó
là chủ đích: câu `if` phụ thuộc vào việc mọi đường đi đều nhớ gọi nó; ràng buộc
database thì không.
