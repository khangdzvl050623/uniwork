# 02 — Messaging: RabbitMQ, outbox, retry, DLQ, contract có version

Đọc [01-kien-truc-va-ranh-gioi.md](01-kien-truc-va-ranh-gioi.md) trước — mục 3 ở đó
chốt `packages/contracts`, file này dựng phần còn lại.

Thư viện: **`amqplib` 2.0.1** (bản mới nhất 2026-05-10). Không dùng wrapper như
`amqp-connection-manager` — nó giấu đúng những thứ đang muốn học (tự nối lại,
confirm, ack thủ công).

---

> **Sửa lớn 2026-09-12 theo review R03, R06, R08, R10.** Cơ chế retry đổi từ
> DLX+TTL sang **outbox có lịch**; publish thêm `mandatory` + xử lý `return`; outbox
> có claim lease tường minh; đường realtime tách khỏi đường nghiệp vụ. Lý do từng
> thay đổi ghi tại chỗ.

## 1. Topology

Một hình, đọc từ trái sang. Đây là bản vẽ chuẩn; `topology.ts` phải khai đúng thế này
và **không chỗ nào khác được gọi `assertQueue`**.

**Hai tầng, và ranh giới giữa chúng là điểm sửa quan trọng nhất của bản này:**

- **Tầng NGHIỆP VỤ** — queue **dùng chung**, mỗi message đúng **một** consumer xử lý.
  Tạo `Notification`, gửi email, chạy Gemini. Không được làm hai lần.
- **Tầng REALTIME** — exchange **fanout**, mỗi instance API một queue riêng. Mọi
  instance đều nhận, mỗi cái emit cho socket **của chính nó**. Làm N lần là đúng.

Gộp hai tầng vào một queue chung là lỗi R10: instance A nhận message nhưng socket của
người dùng nằm ở B, và B không bao giờ biết.

```
── TẦNG NGHIỆP VỤ ────────────────────────────────────────────────────────────

  cv.scan.requested ──►┌──────────────────────────────────┐
  cv.scan.completed ──►│ X: uniwork.documents   (topic)   │
  cv.scan.failed    ──►└──┬────────────────────────┬──────┘
                          │ rk cv.scan.requested   │ rk cv.scan.{completed,failed}
                          ▼                        ▼
             ┌────────────────────────┐  ┌──────────────────────────┐
             │ Q: cv.scan.q           │  │ Q: cv.scan.result.q      │
             │  durable, prefetch=1   │  │  durable, DÙNG CHUNG     │
             │  manual ack            │  │  → tạo Notification 1 lần│
             │  x-dead-letter-        │  │  → ghi outbox realtime.* │
             │    exchange: …dlx      │  └──────────────────────────┘
             │  x-delivery-limit: 5   │     ← Document Worker nghe cv.scan.q
             └───────────┬────────────┘        API nghe cv.scan.result.q
                         │ CHỈ khi broker tự dead-letter
                         │ (vượt x-delivery-limit, hoặc nack do bug)
                         ▼
              ┌────────────────────────────┐
              │ X: uniwork.documents.dlx   │──► Q: cv.scan.parked.q
              └────────────────────────────┘    KHÔNG ttl, chờ người

  application.submitted ─►┌──────────────────────────────┐
  application.status    ─►│ X: uniwork.notifications     │
  chat.handoff.*        ─►└──┬────────────────┬──────────┘
                             │ rk notify.email│ rk notify.persist
                             ▼                ▼
                   ┌─────────────────┐ ┌──────────────────────┐
                   │ notify.email.q  │ │ notify.persist.q     │
                   │ DÙNG CHUNG      │ │ DÙNG CHUNG           │
                   │ Brevo           │ │ tạo Notification     │
                   └─────────────────┘ └──────────────────────┘

── TẦNG REALTIME ─────────────────────────────────────────────────────────────

  realtime.emit ─────────►┌──────────────────────────────┐
  (do consumer nghiệp vụ  │ X: uniwork.realtime (fanout) │
   ghi outbox rồi phát)   └──┬─────────┬─────────┬───────┘
                             ▼         ▼         ▼
                        ┌────────┐┌────────┐┌────────┐
                        │rt.<A>  ││rt.<B>  ││rt.<C>  │  exclusive, autoDelete
                        └────────┘└────────┘└────────┘  MỘT queue mỗi instance API
                          mỗi instance io.to(room).emit cho socket CỦA MÌNH
```

**KHÔNG còn `retry.1/2/3.q`.** Retry chuyển sang outbox có lịch — xem mục 1.5. DLX chỉ
còn một nhánh duy nhất là `parked`, dành cho việc broker tự dead-letter khi vượt
`x-delivery-limit` (tức là lỗi ngoài dự kiến của ta), không phải đường retry thường.

### 1.1 — Vì sao BỎ ba queue retry bằng DLX+TTL (sửa R03)

Bản trước dựng `retry.1/2/3.q` với `x-message-ttl` và cho `nack(requeue=false)` đẩy
message qua DLX. **Thiết kế đó không chạy đúng, vì hai lý do độc lập.**

**Lý do 1 — `x-dead-letter-routing-key` là hằng số của QUEUE, không phải của message.**
`cv.scan.q` khai `x-dead-letter-routing-key: cv.scan.retry.1`, nên **mọi** lần nack đều
rơi vào bậc 1. Không có cách nào để lần nack thứ hai tự đi sang `retry.2.q`. Đây là
hành vi được ghi trong [tài liệu DLX của RabbitMQ](https://www.rabbitmq.com/docs/dlx):
routing key khi dead-letter lấy từ cấu hình queue (hoặc giữ nguyên rk gốc), không phải
từ trạng thái của message. Muốn đi đúng bậc thì consumer phải **tự publish** vào đúng
queue trì hoãn — mà nếu đã tự publish thì ba queue đó không còn lý do tồn tại.

**Lý do 2 — xung đột với lease.** Lỗi tạm thời giữ hàng ở `PROCESSING` với lease 5 phút,
nhưng bản retry quay lại sau 30 giây. CAS không lấy được lease ⇒ consumer ack rồi dừng
⇒ **bản retry bị nuốt**, và việc phục hồi rơi hết vào sweeper, tức là lịch backoff đã
thiết kế không bao giờ chạy.

### 1.5 — Retry bằng outbox có lịch (thay thế)

Một cơ chế duy nhất, và nó dùng lại đúng thứ đã có: cột `nextTryAt` của outbox.

Khi gặp lỗi tạm thời, worker làm **một transaction** rồi mới `ack`:

```sql
BEGIN;
  UPDATE cv_extractions
     SET status         = 'QUEUED',
         "leaseOwner"   = NULL,          -- TRẢ LEASE ngay, hết xung đột ở lý do 2
         "leaseExpiresAt" = NULL,
         "modelRuns"    = "modelRuns" + 1,
         "nextAttemptAt"= now() + $backoff,
         "errorCode"    = $ma
   WHERE id = $id AND "leaseOwner" = $myLeaseId;   -- CAS: chỉ chủ lease được ghi
  INSERT INTO processed_messages (…);              -- messageId này đã xong
  INSERT INTO outbox_messages (…, "nextTryAt" = now() + $backoff);
COMMIT;
-- rồi mới ch.ack(msg)
```

Relay vốn đã chỉ lấy hàng `nextTryAt <= now()`, nên **độ trễ là miễn phí** — không cần
queue TTL nào cả.

| | DLX + 3 queue TTL (bỏ) | Outbox có lịch (chọn) |
| --- | --- | --- |
| Chọn đúng bậc backoff | **Không làm được** (lý do 1) | Một phép cộng trong SQL |
| Xung đột lease | Có (lý do 2) | Không — lease trả trong cùng transaction |
| Người dùng thấy giờ thử lại | Phải suy từ TTL | Đọc thẳng `nextAttemptAt` |
| Số queue phải dựng | 6 | 2 |
| Backoff | 30 s / 5 min / 30 min | **giống hệt**, đặt bằng `$backoff` |

**Cái mất khi bỏ DLX-retry:** không còn minh hoạ được mẫu "delay queue bằng TTL+DLX"
trên Management UI. Bù lại vẫn còn nguyên dead-lettering thật ở nhánh
`x-delivery-limit → parked.q`, và mẫu delay queue được ghi lại ở đây như phương án đã
cân nhắc. Đánh đổi ở đây là giữa **một mẫu quen thuộc** và **thiết kế chạy đúng**, và
chọn cái sau.

**Ba bộ đếm tách nhau** (R03 yêu cầu tách chờ quota khỏi lần model thật sự chạy):

| Cột | Đếm gì | Trần |
| --- | --- | --- |
| `modelRuns` | Số lần **đã gọi Gemini** và hỏng vì lỗi tạm thời | **3** → `FAILED` |
| `quotaWaits` | Số lần hoãn vì circuit/hạn mức, **chưa gọi Gemini** | Không có trần lần, nhưng có **hạn chót 24 giờ** kể từ `createdAt` → `FAILED` `QUOTA_TIMEOUT` |
| `dispatches` | Số lần message được giao (kể cả giao lại do crash) | Chỉ để quan sát |

Chờ quota **không** tiêu lần retry. Đó là điểm R03 nhấn, và nó đúng: hoãn vì hết hạn
mức không phải một lần thử thất bại.

### 1.2 — `quorum` chứ không `classic`

`x-queue-type: quorum` cho `cv.scan.q` và `chat.notify.q`. Lý do: quorum queue có
**đếm số lần giao lại sẵn** (`x-delivery-count`) và **`x-delivery-limit`** — chốt
chặn cuối chống vòng lặp độc (poison message) ngay cả khi logic đếm `attempt` của ta
có lỗi.

**GIẢ ĐỊNH cần kiểm:** CloudAMQP Little Lemur là instance chia sẻ, **có thể không cho
tạo quorum queue** (quorum cần cluster). Kiểm ở ngày 1 khi tạo tài khoản. Không được
thì dùng `classic` và dựa hoàn toàn vào `attempt` trong envelope — ghi lại quyết định.

### 1.3 — Tầng realtime: `uniwork.realtime` fanout + `rt.<instanceId>` (sửa R10)

Đây là **routing realtime khi có nhiều instance** mà đề bài hỏi, và bản trước làm sai
một nửa: `cv.scan.result.q` và `notify.realtime.q` là queue **dùng chung**, nên chỉ một
instance nhận được — nếu socket của người dùng nằm ở instance khác thì họ không thấy gì.

**Luật hai tầng, phát biểu một lần cho toàn hệ thống:**

> Việc **nghiệp vụ** (tạo `Notification`, gửi email, gọi Gemini) đi qua queue **dùng
> chung** và chạy **đúng một lần**.
> Việc **đẩy realtime** đi qua exchange **fanout** và chạy **một lần mỗi instance**.
> Consumer nghiệp vụ **không** tự emit Socket.IO — nó ghi một hàng outbox
> `realtime.emit`, và tầng realtime lo phần phát.

```
cv.scan.result.q  (dùng chung, 1 consumer thắng)
   └─ transaction: tạo Notification + INSERT outbox('realtime.emit', {room, event, payload})
        └─ relay → X uniwork.realtime (fanout)
             ├─ rt.<A> → A: io.to(room).emit(...)   ← A có socket → gửi thật
             ├─ rt.<B> → B: io.to(room).emit(...)   ← B không có → rơi vào hư không, vô hại
             └─ rt.<C> → …
```

Mỗi instance API lúc khởi động tạo queue `exclusive: true, autoDelete: true`, tên
`rt.<hostname>-<pid>-<random>`, bind vào `uniwork.realtime`. Instance chết → queue tự
biến mất.

**Hạn chế thật, phải biết:** cách này **không** đồng bộ `socket.rooms` giữa các
instance, nên `io.in(room).fetchSockets()` và `adapter.rooms` chỉ thấy phần cục bộ.
Ta không dùng hai thứ đó; presence đọc từ bảng — xem
[04](04-handoff-realtime.md) mục 5.

**Khi thêm Redis adapter về sau — phải TẮT fanout này, nếu không phát lặp.** Adapter
đã broadcast toàn cluster, cộng fanout N instance là **N² lần emit**. Chuyển
`SOCKET_ADAPTER=redis` phải đồng thời đổi binding: một queue **dùng chung**
`rt.single.q` thay cho N queue riêng; instance nào nhận cũng được, adapter lo phần lan
toả. Đây là một cờ, hai cấu hình topology — khai trong `topology.ts`, không rải rác.

So sánh ba phương án adapter: xem [04](04-handoff-realtime.md) mục 6.

### 1.3b — Sự kiện realtime bị lỡ khi socket vẫn đang nối (R10)

Đường fanout không bảo đảm gì: instance có thể vừa `emit` xong thì socket đứt trong
mili-giây đó, và client **không** thấy mình mất kết nối nên không chạy luồng tải bù.

Hai lưới, cả hai đều rẻ:

1. **Kiểm liên tục của `seq`.** Client nhận `hoi-thoai:tin-moi` với `seq = N`; nếu
   khác `cursor` đang giữ thì tự gọi `hoi-thoai:tai-bu { cursor }` — KHÔNG suy từ số
   nguyên, vì với NTD thì dãy seq có khoảng trống hợp lệ (plan 04 §5.3). Bắt
   được mọi tin bị lỡ, không cần biết vì sao lỡ.
2. **Đọc lại lúc mount, luôn luôn.** Màn hình đối chiếu CV gọi `GET /api/toi/quet-cv/:id`
   một lần khi mở, **bất kể** socket có đang nối hay không. Sự kiện `cv-scan:xong` chỉ
   là đường nhanh, không phải nguồn sự thật.

Luật chung: **Socket.IO là đường tăng tốc, REST là nguồn sự thật.** Mọi màn hình phải
đúng khi socket không bao giờ gửi gì.

---

### 1.4 — Luồng nộp đơn cũng nên đi qua broker (bổ sung 2026-09-12)

Đúng, và đây là chỗ **rẻ nhất** để dùng lại hạ tầng vừa dựng.

Hiện trạng: `createApplication` commit transaction rồi `await guiEmailAnToan(...)`
ngay trong request ([applications.service.ts:236-244](../../apps/api/src/modules/applications/applications.service.ts#L236-L244)).
Hai vấn đề thật: người nộp đơn **chờ Brevo trả lời** mới thấy màn hình xong, và
Brevo hỏng thì **email mất im lặng** — không retry, không log, không ai biết.

```
                        ┌──────────────────────────────────┐
  application.submitted │ X: uniwork.notifications (topic) │
  application.status    └──┬────────────────────┬──────────┘
                           │ rk notify.email    │ rk notify.realtime
                           ▼                    ▼
                   ┌───────────────┐    ┌────────────────────┐
                   │ notify.email.q│    │ notify.realtime.q  │
                   │ Brevo, retry  │    │ mỗi instance API   │
                   │ 3 bậc + DLQ   │    │ emit thong-bao:moi │
                   └───────────────┘    └────────────────────┘
```

**Ranh giới quan trọng — cái gì ở lại trong transaction:**

| Thứ | Ở đâu | Vì sao |
| --- | --- | --- |
| `Application` + `ApplicationEvent` | transaction | Nghiệp vụ lõi |
| **`Notification` (chuông trong app)** | **transaction** | Đây là trạng thái người dùng nhìn thấy. Đẩy sang queue là mở ra ca "đơn đã nộp nhưng chuông không kêu" — tệ hơn hẳn hiện tại |
| Hàng `outbox_messages` | transaction | |
| **Email** | **queue** | Hệ thống ngoài, hỏng được, retry được |
| **Đẩy realtime** | **queue** | Mất cũng chỉ là chậm; client tự tải lại |

Chỉ **email và đẩy realtime** rời khỏi request. Không phải cả cụm thông báo.

**Công: ~0,5 ngày** — outbox, relay, consumer, retry/DLQ đã có sẵn từ scan CV;
`createNotification(tx, …)` đã nhận `tx` đúng hình dạng cần.

**Nhưng làm SAU, không làm trước.** Đây là code Sprint 4 đã chạy thật và đã có test.
Sửa nó là rủi ro hồi quy trên **luồng tuyển dụng chính** — thứ đắt nhất trong sản
phẩm. Điều kiện làm: sau ngày 6 (khung consumer đã chứng minh qua scan CV), chạy
nguyên bộ `applications.test.ts` làm lưới, và **không** đổi hình dạng response.

Cùng cách cho `updateApplicationStatus` — nó có đúng vấn đề đó.

**Lợi ích phụ đáng kể:** README §2 đang mô tả một hàng đợi bất đồng bộ không tồn tại
(xem [README](README.md) mục 3). Việc này biến câu đó thành sự thật thay vì phải sửa
tài liệu xuống cho khớp code.

---

## 2. Kết nối: `connection.ts`

```ts
// apps/api/src/messaging/connection.ts — ĐỀ XUẤT (rút gọn phần thân)
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib'

/**
 * MỘT kết nối TCP cho cả process, NHIỀU kênh trên đó.
 *
 * Mở một kết nối cho mỗi lần publish là lỗi kinh điển: bắt tay AMQP tốn vài chục
 * mili-giây, và CloudAMQP gói free giới hạn 20 kết nối cho CẢ instance — vài chục
 * request đồng thời là hết sạch, kèm giới hạn 20 kết nối MỚI mỗi giây cho mỗi IP.
 *
 * Kênh publish là CONFIRM channel, kênh consume là kênh thường: hai mục đích khác
 * nhau, và một kênh bị lỗi (channel-level error) thì kênh kia vẫn sống.
 */
let conn: ChannelModel | null = null
let pubChannel: ConfirmChannel | null = null

/** Chờ bao lâu trước khi thử nối lại. Tăng dần, trần 30 giây. */
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
```

Ba điều bắt buộc:

1. **`connection.on('error')` và `.on('close')` phải có handler.** Không có thì Node
   ném `unhandledRejection` và process chết. CloudAMQP đóng kết nối nhàn rỗi định kỳ
   — chuyện bình thường, không phải sự cố.
2. **Nối lại phải `assertTopology()` lại.** Sau khi mất kết nối, mọi khai báo trên
   kênh cũ không còn. Queue trên server thì vẫn còn (durable), nhưng consumer thì mất.
3. **`heartbeat: 30`** trong URL hoặc options. Không có heartbeat thì kết nối "chết
   mà trông như sống" qua NAT, và message publish vào hư không.

---

## 3. Publisher confirms

```ts
// apps/api/src/messaging/publisher.ts — ĐỀ XUẤT
export async function publish<T>(
  exchange: string,
  routingKey: string,
  envelope: Envelope<T>,
): Promise<void> {
  const ch = await getConfirmChannel()

  await new Promise<void>((resolve, reject) => {
    ch.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      {
        // Message sống qua restart của broker. Không có nó, RabbitMQ khởi động
        // lại là mất sạch — và message ở đây là "hãy đọc CV của người này",
        // mất đi thì job treo ở QUEUED mãi mãi.
        persistent: true,
        messageId: envelope.id,
        type: envelope.type,
        timestamp: Date.now(),
        correlationId: envelope.correlationId,
        contentType: 'application/json',
      },
      (err) => (err ? reject(err) : resolve()),
    )
  })
}
```

**Vì sao phải chờ confirm:** không chờ thì `publish()` trả về ngay sau khi ghi vào
buffer socket. Broker từ chối (queue đầy, disk alarm, sai exchange) thì ta không bao
giờ biết. Với outbox relay thì hậu quả cụ thể: relay đánh dấu `publishedAt` cho một
message chưa hề tới broker, và nó **biến mất vĩnh viễn**.

### 3.1 — Confirm KHÔNG đủ: phải có `mandatory` + bắt `return` (sửa R06)

Đoạn code trên vẫn còn một lỗ. **Confirm chỉ nói "broker đã nhận", không nói "có queue
nào nhận được".** Exchange tồn tại nhưng thiếu binding — hoặc routing key gõ sai một
ký tự — thì broker vẫn **ack**, message rơi vào hư không, và outbox đánh dấu thành
công. Kết quả: hàng `cv_extractions` nằm `QUEUED` vĩnh viễn mà không có việc nào trong
broker. [Tài liệu RabbitMQ nói rõ ca này](https://www.rabbitmq.com/docs/confirms).

Sửa: bật `mandatory: true` và lắng `'return'`. Message không tới được queue nào sẽ
quay lại qua sự kiện `return` **trước** khi confirm về.

```ts
// publisher.ts — bổ sung
const daBiTraVe = new Set<string>()
ch.on('return', (msg) => {
  const id = msg.properties.messageId
  if (id) daBiTraVe.add(id)
  logger.error('Message không tới được queue nào', {
    exchange: msg.fields.exchange, rk: msg.fields.routingKey, messageId: id,
  })
})

ch.publish(exchange, routingKey, body, {
  persistent: true,
  // BẮT BUỘC cho mọi lệnh nghiệp vụ. Không có nó, sai binding là mất việc trong im lặng.
  mandatory: true,
  messageId: envelope.id,
  …
}, (err) => {
  if (err) return reject(err)
  // Broker gửi `return` TRƯỚC `ack`, nên tới đây đã biết chắc.
  if (daBiTraVe.delete(envelope.id)) {
    return reject(new KhongDinhTuyenError(exchange, routingKey, envelope.id))
  }
  resolve()
})
```

Kèm **timeout 5 giây** cho cả lời hứa: broker treo mà không ack cũng không return thì
lời hứa không bao giờ giải quyết, và relay đứng im mãi.

**Hai loại message, hai luật `mandatory` khác nhau** — R06 yêu cầu tách:

| Loại | `mandatory` | Không tới được queue thì |
| --- | --- | --- |
| **Lệnh nghiệp vụ** (`cv.scan.requested`, `notify.email`, `notify.persist`) | `true` | Coi là **thất bại**. Outbox giữ `publishedAt = null`, lùi `nextTryAt`, ghi `lastError` |
| **Sự kiện realtime tạm thời** (`realtime.emit`) | `false` | **Bình thường.** Không có instance API nào đang sống thì cũng không có socket nào để gửi. Đánh dấu đã phát |

Dòng thứ hai là lý do phải phân loại: bật `mandatory` cho `realtime.emit` sẽ khiến mọi
lần deploy (khoảnh khắc không instance nào bind) sinh ra một đống lỗi giả.

---

## 4. Transactional outbox

### 4.1 — Bài toán, nói chính xác

Đề bài hỏi: *"Làm rõ cách tránh mất sự kiện nếu lưu database thành công nhưng phát
Socket.IO thất bại."* Đây là bài toán **dual write** — hai hệ thống, không có
transaction chung. Bốn thứ tự đều hỏng:

| Cách | Hỏng thế nào |
| --- | --- |
| Ghi DB rồi publish | DB commit xong, process chết trước publish ⇒ **mất sự kiện** |
| Publish rồi ghi DB | Publish xong, DB rollback ⇒ **sự kiện ma**, worker đi tìm hàng không tồn tại |
| Publish trong transaction | Publish không rollback được. Transaction rollback ⇒ vẫn là sự kiện ma |
| Thử lại publish trong `catch` | Giảm xác suất, không loại bỏ. Process chết giữa `catch` thì vẫn mất |

**Cách duy nhất đúng: outbox.** Ghi ý định phát sự kiện vào **cùng database, cùng
transaction** với dữ liệu nghiệp vụ. Một relay riêng đọc bảng đó và publish. DB là
nguồn sự thật duy nhất; broker chỉ là đường vận chuyển.

### 4.2 — Bảng

```prisma
/// Ý định phát một sự kiện, ghi CÙNG TRANSACTION với dữ liệu nghiệp vụ.
///
/// Vì sao cần: xem plan 02 mục 4.1. Tóm tắt — không có bảng này thì "đơn đã lưu
/// nhưng thông báo không tới" và "thông báo đã tới nhưng đơn không tồn tại" đều
/// là chuyện xảy ra thật, không phải lý thuyết, và cả hai đều im lặng.
///
/// Bảng này dùng CHUNG cho cả chat và scan CV. Hai bảng outbox là hai relay, hai
/// chỗ có thể kẹt, và hai lần phải nhớ dọn.
model OutboxMessage {
  id String @id @default(cuid())

  /// Trùng với routing key, ví dụ 'cv.scan.requested'.
  type       String
  exchange   String
  routingKey String

  /// Đời của `payload`. Xem packages/contracts.
  version Int @default(1)

  /// Thân message. Relay bọc thêm envelope lúc publish.
  payload Json

  correlationId String

  /// null = chưa đẩy đi. Có giá trị = broker đã xác nhận (publisher confirm).
  publishedAt DateTime?

  /// Số lần relay thử và thất bại. Vượt trần thì ngừng thử, chờ người xem.
  attempts  Int       @default(0)
  lastError String?
  /// Chỉ thử lại sau mốc này. Relay bỏ qua hàng chưa tới hạn.
  nextTryAt DateTime  @default(now())

  /* ------------------------------------------------------- claim của relay */
  /// Relay nào đang giữ hàng này, và giữ tới lúc nào.
  ///
  /// BẮT BUỘC có hai cột này — cơ chế ở mục 4.3 điểm 2 đọc và ghi chúng. Row lock
  /// của Postgres chết khi transaction commit, nên quyền giữ hàng phải nằm ở một
  /// giá trị ghi xuống đĩa, không nằm ở lock.
  claimedBy  String?
  claimUntil DateTime?

  createdAt DateTime @default(now())

  /// Chỉ mục cho đúng câu truy vấn của relay: hàng chưa đẩy, đã tới hạn, cũ trước.
  /// Đúng hình dạng câu SELECT của relay ở mục 4.3: lọc chưa phát, tới hạn, chưa
  /// bị ai claim, dưới trần attempts; sắp cũ trước.
  @@index([publishedAt, nextTryAt, claimUntil, createdAt])
  @@map("outbox_messages")
}
```

### 4.3 — Relay

```ts
// apps/api/src/messaging/outbox.ts — ĐỀ XUẤT (khung)

/** Ghi ý định phát sự kiện. GỌI TRONG transaction nghiệp vụ, không ngoài. */
export async function ghiOutbox(
  tx: Prisma.TransactionClient,
  input: { type: string; exchange: string; routingKey: string; version?: number
           payload: unknown; correlationId: string },
): Promise<void>

/** Vòng lặp đẩy. Chạy trong process API (kể cả khi WORKER_INLINE=false). */
export function batDauRelay(): () => void
```

Sáu chi tiết quyết định relay đúng hay sai:

1. **Nhịp quét: 1 giây, cộng một cú hích tức thì.** Sau khi transaction commit, gọi
   `hichRelay()` để relay chạy ngay thay vì chờ tick — độ trễ cảm nhận được của chat
   phụ thuộc trực tiếp vào con số này. Nhịp 1 giây vẫn giữ làm lưới an toàn khi cú
   hích bị lỡ (process chết ngay sau commit).

2. **Claim tường minh bằng `claimedBy` + `claimUntil`, không dựa vào row lock** (sửa R08).

   Bản trước dùng `FOR UPDATE SKIP LOCKED` rồi commit rồi mới publish. Sai ở chỗ:
   **row lock chỉ sống tới hết transaction**
   ([tài liệu PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)).
   Commit xong là hàng tự do trở lại, relay khác quét thấy ngay và publish trùng. Giữ
   transaction mở suốt lúc publish thì lại giữ lock qua một lời gọi mạng, và transaction
   thứ hai muốn cập nhật đúng hàng đó sẽ chờ chính cái lock của mình.

   Cách đúng — ba bước, mỗi bước một transaction ngắn:

   ```sql
   -- Bước 1: CLAIM. SKIP LOCKED vẫn dùng, nhưng chỉ để chọn hàng trong ĐÚNG câu này.
   -- Quyền giữ hàng nằm ở claimUntil ghi xuống đĩa, không ở row lock.
   UPDATE outbox_messages o
      SET "claimedBy" = $meId, "claimUntil" = now() + interval '30 seconds',
          attempts = attempts + 1
    WHERE o.id IN (
      SELECT id FROM outbox_messages
       WHERE "publishedAt" IS NULL
         AND "nextTryAt" <= now()
         AND attempts < 10                                  -- ← loại hàng đã bỏ cuộc
         AND ("claimUntil" IS NULL OR "claimUntil" < now())  -- ← claim của kẻ khác còn hiệu lực
       ORDER BY "createdAt" ASC
       LIMIT 50
       FOR UPDATE SKIP LOCKED
    )
   RETURNING *;
   -- COMMIT ngay. Không giữ transaction qua lời gọi mạng.
   ```

   ```
   Bước 2: publish có confirm + mandatory (mục 3.1). Ngoài transaction.

   Bước 3: đánh dấu bằng CAS —
     UPDATE outbox_messages
        SET "publishedAt" = now(), "claimedBy" = NULL, "claimUntil" = NULL
      WHERE id = $id AND "claimedBy" = $meId;
     0 hàng ⇒ claim đã hết hạn và relay khác đã nhận; KHÔNG ghi đè.

   Thất bại ở bước 2 —
     UPDATE … SET "claimedBy" = NULL, "claimUntil" = NULL,
                  "nextTryAt" = now() + backoff, "lastError" = $ma
      WHERE id = $id AND "claimedBy" = $meId;
   ```

   **Chấp nhận phát trùng, và nói rõ vì sao chấp nhận được.** Relay chết sau khi broker
   confirm nhưng trước bước 3 ⇒ claim hết hạn ⇒ message được phát lần hai. Không có
   cách nào loại bỏ điều đó mà không có transaction phân tán. Ba lớp chống trùng ở
   mục 5 lo phần hậu quả: `processed_messages` chặn ở consumer, CAS lease chặn ở
   `cv_extractions`. Nên **một bản `cv.scan.requested` trùng không sinh ra lời gọi
   Gemini thứ hai** — trừ khi lần đầu thật sự đã hỏng, mà lúc đó gọi lại là đúng.

   **Không hứa exactly-once cho lời gọi Gemini.** Cái ta bảo đảm là *at-least-once giao
   việc* cộng *chống trùng ở nơi tiêu thụ*, và đó là điều duy nhất bảo đảm được.

3. **Đánh dấu `publishedAt` SAU khi confirm về VÀ không bị `return`**, bằng CAS như
   bước 3 ở trên. Trước confirm là nói dối; sau confirm nhưng bỏ qua `return` là nói
   dối tinh vi hơn (mục 3.1).

4. **Trần thử lại: 10 lần, backoff `nextTryAt = now + min(2^attempts, 300) giây`.**
   Vượt trần thì để nguyên `publishedAt = null` và ngừng thử; `/api/health/chi-tiet`
   đếm số hàng như vậy — xem mục 8.

5. **Dọn hàng đã đẩy.** Xoá `publishedAt < now() - 7 ngày`, chạy mỗi giờ. Không dọn
   thì bảng phình mãi và Neon free chỉ có 0,5 GB.

6. **Relay chạy ở API, không ở worker.** Nó đọc bảng của API. Worker có outbox riêng
   của nó cho `cv.scan.completed`, và relay riêng trong process worker — cùng code,
   khác chủ sở hữu dữ liệu. Đây là chỗ ranh giới dữ liệu ở
   [01](01-kien-truc-va-ranh-gioi.md) mục 4.3 thể hiện ra thành hai vòng lặp riêng.

### 4.4 — Chuỗi đầy đủ, ví dụ scan CV

```
POST /api/toi/quet-cv  (multipart)
  │
  ├─ sniff + kiểm số trang + phát hiện mật khẩu     ← lỗi ở đây: 400, chưa tốn gì
  ├─ sha256(buffer) → contentHash
  ├─ upload Cloudinary (authenticated)              ← lỗi ở đây: 502, chưa ghi DB
  │
  ├─ BEGIN
  │    giữ 1 lượt scan (INSERT ... ON CONFLICT ... WHERE)   ← hết lượt: rollback, 429
  │    INSERT cv_extractions (status = QUEUED)
  │    ghiOutbox(type='cv.scan.requested', payload={extractionId, …})
  │  COMMIT
  │
  ├─ hichRelay()
  └─ 202 Accepted { extractionId, status: 'QUEUED' }

relay (≤1 s sau)
  └─ publish → uniwork.documents / cv.scan.requested   (confirm)
       └─ đánh dấu publishedAt

worker
  ├─ nhận message, kiểm processed_messages(messageId)  ← đã xử lý: ack, dừng
  ├─ CAS: UPDATE cv_extractions SET status='PROCESSING', leaseExpiresAt=now()+5min
  │        WHERE id=? AND status IN ('QUEUED','PROCESSING') AND
  │              (leaseExpiresAt IS NULL OR leaseExpiresAt < now())
  │        → 0 hàng: ai đó đang giữ, ack và dừng
  ├─ tải file bằng signed URL
  ├─ gọi Gemini (structured output)
  ├─ BEGIN
  │    UPDATE cv_extractions SET status='NEEDS_REVIEW', result=…
  │    INSERT processed_messages(messageId, consumer)
  │    ghiOutbox(type='cv.scan.completed', …)
  │  COMMIT
  └─ channel.ack(msg)      ← ACK SAU KHI COMMIT, không trước

relay của worker
  └─ publish cv.scan.completed → uniwork.documents

API (consumer cv.scan.result.q)
  ├─ cập nhật trạng thái hiển thị, tạo Notification
  └─ io.to(`user:${userId}`).emit('cv-scan:xong', …)
```

**Điểm mấu chốt:** `ack` nằm **sau** `COMMIT`. Đảo lại thì process chết giữa hai
bước ⇒ message đã ack, kết quả chưa lưu ⇒ CV bốc hơi và người dùng thấy "QUEUED"
vĩnh viễn.

---

## 5. Chống xử lý trùng — ba lớp

Đề bài yêu cầu "Queue bị chạy lại không được tạo hồ sơ hoặc kết quả trùng". RabbitMQ
bảo đảm **at-least-once**, không phải exactly-once. Nên chống trùng là việc của
consumer, và cần cả ba lớp vì mỗi lớp bắt một loại trùng khác nhau.

### Lớp 1 — bảng `processed_messages`, chống **giao lại cùng một message**

```prisma
/// Message nào đã xử lý xong rồi. Chống at-least-once của RabbitMQ.
///
/// Khoá chính GỘP (messageId, consumer): cùng một message có thể được nhiều
/// consumer khác nhau xử lý một cách chính đáng — `cv.scan.completed` vừa đi vào
/// consumer tạo thông báo, vừa đi vào consumer bắn Socket.IO. Chỉ lấy `messageId`
/// làm khoá thì consumer thứ hai bị coi là trùng và im lặng bỏ qua.
model ProcessedMessage {
  messageId   String
  consumer    String
  processedAt DateTime @default(now())

  @@id([messageId, consumer])
  @@index([processedAt])
  @@map("processed_messages")
}
```

Ghi hàng này **trong cùng transaction** với việc nghiệp vụ. Ghi ngoài thì có khe hở:
commit việc rồi chết trước khi ghi dấu ⇒ lần giao lại làm lại việc.

Dọn: xoá `processedAt < now() - 7 ngày`, cùng job dọn outbox. Bảy ngày dài hơn mọi
đường retry (tổng ~35 phút) rất nhiều.

### Lớp 2 — CAS trên trạng thái, chống **hai worker cùng lúc**

`UPDATE … WHERE status IN ('QUEUED','PROCESSING') AND lease hết hạn` — xem mục 4.4.
Lớp 1 không bắt được ca này vì hai worker chạy song song, chưa ai kịp ghi dấu.

### Lớp 3 — unique nghiệp vụ, chống **người dùng bấm hai lần**

```prisma
@@unique([ownerUserId, contentHash, pipelineVersion])
```

Cùng người, cùng file, cùng đời pipeline ⇒ **không tạo hàng mới**. Nhưng *"trả lại bản
đã có"* thì tuỳ trạng thái, không phải luôn luôn — xem ngay dưới.

#### Trả lại cái gì, theo trạng thái (sửa #14)

Bản trước trả hàng cũ cho **mọi** trạng thái, kể cả `FAILED`. Hậu quả: Cloudflare sập
nửa tiếng, job hỏng; nửa tiếng sau người dùng tải lại **đúng file đó** và nhận lại
nguyên bản thất bại cũ — không có đường nào chạy lại ngoài việc xoá đi, mà xoá thì mất
cả file lẫn bằng chứng lỗi.

| Trạng thái hàng đã có | Trả gì | Tốn lượt? |
| --- | --- | --- |
| `NEEDS_REVIEW` / `CONFIRMED` | **200** kèm kết quả cũ | Không |
| `QUEUED` / `PROCESSING` | **200** kèm trạng thái đang chạy | Không |
| `FAILED` vì **file người dùng** (`FILE_UNSUPPORTED`, `NOT_A_CV`) | **409** — cùng file thì cùng kết quả, đổi file đi | Không |
| `FAILED` vì **lỗi hệ thống** (5xx, timeout, `QUOTA_TIMEOUT`, `MODEL_OUTPUT_INVALID`) | **Chạy lại được** — xem dưới | **Có**, một lượt mới |

Chỉ nhóm cuối mới đáng chạy lại: file không đổi, pipeline không đổi, chỉ có nhà cung
cấp lúc đó hỏng.

#### Giao thức chạy lại — một endpoint, CAS, không xoá gì

```
POST /api/toi/quet-cv/:id/chay-lai
```

```sql
-- Một transaction. CAS trên chính trạng thái, nên bấm hai lần chỉ chạy một lần.
UPDATE cv_extractions
   SET status = 'QUEUED',
       "runSeq" = "runSeq" + 1,        -- ← đời chạy mới
       "modelRuns" = 0, "quotaWaits" = 0,
       "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
       "errorCode" = NULL, "nextAttemptAt" = now(),
       "quotaDay" = $ngayVN, "quotaSettledAt" = NULL   -- reservation MỚI
 WHERE id = $id AND "ownerUserId" = $uid
   AND status = 'FAILED'
   AND "errorCode" IN ('MODEL_5XX','TIMEOUT','QUOTA_TIMEOUT','MODEL_OUTPUT_INVALID')
RETURNING "runSeq";
-- 0 hàng ⇒ 409. Không phải FAILED-hệ-thống, hoặc ai đó vừa bấm trước.
```

Rồi giữ một lượt mới và ghi outbox `cv.scan.requested` với `runSeq` mới, **trong cùng
transaction đó**.

**`runSeq` phải có mặt trong message và trong mọi CAS về sau.** Không có nó thì callback
của lần chạy cũ — một message còn kẹt đâu đó, hoặc một worker vừa tỉnh dậy — sẽ ghi kết
quả cũ đè lên lần chạy mới. Điều kiện ghi kết quả thành:

```sql
WHERE id = $id AND "leaseOwner" = $myLease AND "runSeq" = $runSeqTrongMessage
```

Lịch sử lỗi **không xoá**: `errorCode` cũ chuyển sang bảng `parked_messages` hoặc một
cột `lichSuLoi Json[]`, để còn biết CV này đã hỏng mấy lần vì lý do gì.

#### `replay-parked` phải phối hợp với DB, không chỉ đẩy message

Script ở mục 7 mà chỉ Shovel message trở lại queue thì **không chạy lại được gì**: hàng
đã ở `FAILED` nên CAS `status IN ('QUEUED','PROCESSING')` không khớp, và `messageId` cũ
đã nằm trong `processed_messages`.

Nên `replay-parked` phải: với mỗi hàng parked → gọi **đúng giao thức
`chay-lai`** ở trên (CAS + `runSeq` mới + message mới với `messageId` mới), không đẩy
lại message cũ. Message cũ chỉ là bằng chứng, không phải thứ để phát lại.

**Nghiệm thu:** cùng một file hỏng vì nhà cung cấp, bấm chạy lại sau khi họ phục hồi →
thành công, **không** phải sửa file hay đổi pipeline. Bấm chạy lại hai lần liên tiếp →
đúng **một** lần chạy mới. Callback của lần chạy cũ tới muộn → bị `runSeq` từ chối.

`pipelineVersion` trong khoá là có chủ đích: đổi prompt hay đổi schema thì **phải**
cho quét lại cùng file đó, nếu không người dùng vĩnh viễn kẹt với kết quả của bản cũ.

`ownerUserId` trong khoá **cũng** là có chủ đích, và là ràng buộc bảo mật chứ không
phải tối ưu: hai người nộp cùng một file (cùng hash) sẽ có **hai** hàng riêng. Không
bao giờ có đường nào để người B thấy kết quả của người A. Đề bài yêu cầu "Không tái
sử dụng kết quả giữa người dùng theo cách làm lộ dữ liệu" — cách chắc chắn nhất là
làm cho việc tái sử dụng **không tồn tại về mặt cấu trúc**, thay vì thêm một câu
kiểm tra ai đó có thể quên.

---

## 6. Consumer: ack thủ công, prefetch, phân loại lỗi

### 6.1 — Khung

```ts
// apps/api/src/messaging/consumer.ts — ĐỀ XUẤT
export interface ConsumerOptions<T> {
  queue: string
  /** Tên định danh, đi vào processed_messages.consumer. */
  name: string
  schema: z.ZodType<T>
  /** Đời `v` mà consumer này hiểu. Cao hơn thì park. */
  supportedVersion: number
  prefetch: number
  handle: (data: T, ctx: { messageId: string; attempt: number
                           correlationId: string }) => Promise<void>
}
```

```ts
await ch.prefetch(options.prefetch)          // 1 cho worker CV
await ch.consume(options.queue, onMessage, { noAck: false })   // ack thủ công
```

**`prefetch(1)` cho `cv.scan.q`** — không phải để tiết kiệm RAM mà vì free tier
Gemini có RPM rất thấp (con số thật phải đo, xem [00](00-khao-sat.md) C.2). Lấy 10
message một lúc rồi gọi song song = 429 hàng loạt = đốt cả ba lần retry cho mỗi cái.

**`noAck: false` bắt buộc.** `noAck: true` nghĩa là RabbitMQ coi message đã xong ngay
lúc gửi đi; worker chết giữa chừng thì message mất hẳn. Với "đọc CV" thì đó là CV
biến mất không dấu vết.

### 6.2 — Ba nhánh kết thúc, và cả ba đều ACK sau khi ĐÃ GHI DB (sửa R03, R06)

Bản trước có hai lỗi trong khối này: nhánh (2) dựa vào DLX để chọn bậc retry (không
làm được, mục 1.1), và nhánh (3) viết `await ch.publish(...)` — nhưng `publish` của
amqplib trả về **boolean**, không phải Promise
([API amqplib](https://amqp-node.github.io/amqplib/channel_api.html)). `await` một
boolean trả về ngay lập tức, nên message được ack trước khi broker xác nhận bất cứ
điều gì.

**Luật mới, một câu:** mọi nhánh đều ghi trạng thái xuống **database trong một
transaction** rồi mới `ack`. Không nhánh nào gửi message trực tiếp; muốn phát gì thì
ghi outbox trong chính transaction đó.

```ts
try {
  await handle(data, ctx)              // handle tự COMMIT phần nghiệp vụ + processed_messages
  ch.ack(msg)                          // (1) xong
} catch (err) {
  const loai = phanLoaiLoi(err)

  if (loai === 'TAM_THOI' && job.modelRuns < 3) {
    // (2) Trả lease + hẹn giờ + ghi outbox retry, TẤT CẢ trong một transaction.
    //     Xem mục 1.5. KHÔNG nack, KHÔNG dựa vào DLX.
    await hoanLaiVaHenGio(job, backoffCua(job.modelRuns))
    ch.ack(msg)
  } else if (loai === 'CHO_QUOTA') {
    // (2b) Không tính là một lần thử. quotaWaits += 1, hẹn theo circuit.openUntil.
    await hoanLaiVaHenGio(job, thoiGianChoCircuit(), { laChoQuota: true })
    ch.ack(msg)
  } else {
    // (3) Hết đường. Ghi FAILED + parked_messages + outbox thông báo, rồi ack.
    await ghiBoCuoc(job, msg, loai)
    ch.ack(msg)
  }
}
```

### 6.2c — Nhánh "không phân loại được": sửa lại cho đúng (sửa #10)

Bản trước viết: `nack(msg, false, false)` để broker đếm `x-delivery-count`, sau 5 lần
`x-delivery-limit` thì park. **Sai về cơ chế.**

`requeue = false` **không** tạo ra 5 lần giao lại. Message đi thẳng sang DLX **ngay lần
đầu** ([tài liệu DLX](https://www.rabbitmq.com/docs/dlx)). `x-delivery-limit` chỉ đếm
những lần message **quay lại queue chính** — tức là ca `requeue = true`, hoặc channel
đứt khi chưa ack. Và **từ RabbitMQ 4.3, `basic.nack` không tăng delivery-count như
`basic.reject`** ([quorum queues](https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling)),
nên dựa vào bộ đếm đó còn phải **ghi rõ version broker thật đang chạy** — mà trên
CloudAMQP ta không chọn được version.

Còn một lỗi thứ hai đi kèm: bản trước để job ở `PROCESSING` cho tới hết lease. Message
đã bị park, nhưng sweeper thấy lease hết hạn lại **sinh một message mới** — đi vòng qua
đúng cái giới hạn giao lại vừa dựng. Job và bằng chứng parked mâu thuẫn nhau.

**Sửa — hai nhánh theo việc DB còn sống hay không:**

```ts
} else {
  // Lỗi không phân loại được / không retry được.
  if (await dbConSong()) {
    // DB còn: KẾT THÚC hẳn vòng đời job trong MỘT transaction, rồi mới ack.
    //   cv_extractions → FAILED, leaseOwner = NULL, leaseExpiresAt = NULL
    //   parked_messages  ← bằng chứng
    //   chotGiuChoScan   ← settle quota, CAS, đúng một lần (plan 05 mục 3.3.0)
    //   processed_messages
    await ketThucHan(job, msg, loai)
    ch.ack(msg)
  } else {
    // DB chết: KHÔNG ack — ack là nói dối rằng đã xử lý xong.
    // Ngừng nhận message mới rồi để kết nối tự đứt; broker giao lại toàn bộ.
    await ch.cancel(consumerTag)
    // Không nack, không ack. Message quay lại khi channel đóng.
    throw new DbKhongSanSangError()
  }
}
```

**`leaseExpiresAt = NULL` cùng transaction là mấu chốt.** Không có nó, sweeper vẫn
thấy một job `PROCESSING` quá hạn và tạo message mới cho một job đã `FAILED` và đã park.

**Không** chữa bằng `requeue = true`. Nó đẩy message về đầu queue ngay lập tức: vòng
lặp nóng vài nghìn lần mỗi giây, CPU 100 %, và nếu lỗi xảy ra *sau* khi đã gọi model
thì **hạn mức bốc hơi trong vài phút** — triệu chứng duy nhất là "sao hết quota rồi".

`x-delivery-limit: 5` vẫn giữ trên queue, nhưng đổi vai: nó là lưới cho ca **channel
đứt liên tục giữa chừng** (worker crash-loop), không phải đường park của lỗi logic.

**Nghiệm thu:** lỗi lạ không gọi model quá một lần; sau khi sweeper chạy **và** sau khi
worker restart, job vẫn `FAILED` và `parked_messages` vẫn đúng một hàng — không có
message mới nào được sinh ra.

### 6.2b — Bảng `parked_messages`: bằng chứng nằm ở database

```prisma
/// Message đã bỏ cuộc. Bảng này là BẰNG CHỨNG; `cv.scan.parked.q` chỉ là chỗ thao
/// tác lại cho tiện.
///
/// Vì sao không chỉ dựa vào queue: CloudAMQP Little Lemur XOÁ queue không ai tiêu
/// thụ sau 28 ngày — mà `parked.q` theo định nghĩa là queue không ai tiêu thụ. Nghỉ
/// một kỳ là mất sạch bằng chứng lỗi. Postgres không làm thế.
model ParkedMessage {
  id         String   @id @default(cuid())
  messageId  String
  consumer   String
  type       String
  version    Int
  reason     String   /// 'VERSION_QUA_MOI' | 'HET_LAN_THU' | 'LOI_LAP_TRINH' | …
  payload    Json
  createdAt  DateTime @default(now())

  @@unique([messageId, consumer])
  @@index([createdAt])
  @@map("parked_messages")
}
```

Nhánh **version lạ** (mục 3.3) sửa theo cùng luật: ghi `parked_messages` trong một
transaction **rồi mới** `ack` — bản trước ghi "ack rồi đẩy parked", tức là mất message
nếu process chết giữa hai bước.

### 6.3 — Phân loại lỗi

Đề bài: *"Phân biệt lỗi được retry và lỗi phải yêu cầu người dùng đổi file."*

| Nhóm | Ví dụ | Xử lý | Trạng thái & bộ đếm |
| --- | --- | --- | --- |
| **Tạm thời** | mất mạng, Cloudinary 5xx, Gemini 5xx, timeout | Trả lease + `nextAttemptAt = now + 30 s / 5 min / 30 min` + outbox retry, một transaction, rồi ack (mục 1.5) | `QUEUED`, **`modelRuns += 1`**, trần 3 |
| **Chờ hạn mức** | Gemini 429 / `RESOURCE_EXHAUSTED` | Cùng cơ chế, `nextAttemptAt = circuit.openUntil`. **Không tiêu một lần thử** | `QUEUED` + `blockedReason='QUOTA'`, **`quotaWaits += 1`**, hạn chót 24 h |
| **Model trả JSON hỏng** | không parse được, thiếu trường bắt buộc | Retry **đúng 1 lần** với chỉ dẫn chặt hơn; vẫn hỏng → bỏ cuộc | `modelRuns += 1`; hỏng lần hai → `FAILED` `MODEL_OUTPUT_INVALID` |
| **Người dùng phải đổi file** | không phải pdf/jpg/png, hỏng, có mật khẩu, quá số trang, không phải CV | **Không retry lần nào.** Ghi `FAILED` + ack | `FAILED`, `errorCode='FILE_UNSUPPORTED'` … |
| **Lập trình sai** | `TypeError`, Zod của chính ta ném | Ghi `parked_messages` + `FAILED`, rồi ack. Thử lại chỉ lặp lại đúng lỗi | `FAILED`, `errorCode='INTERNAL'` |
| **Không phân loại được** | lỗi lạ chưa gặp | `nack(msg, false, false)` — để broker đếm `x-delivery-count`, sau 5 lần `x-delivery-limit` tự đẩy sang `parked.q` | `PROCESSING` cho tới khi lease hết hạn |

Hai cột cuối là chỗ R03 yêu cầu tách: **`modelRuns` đếm lần Gemini thật sự chạy,
`quotaWaits` đếm lần hoãn vì hết hạn mức.** Trần 3 áp lên cột thứ nhất. Gộp hai cột
thì một buổi Google siết hạn mức sẽ đốt sạch cả ba lần thử của mọi job đang chờ, và
tất cả cùng `FAILED` dù chưa có job nào thật sự lỗi.

Phần lớn nhóm 4 đã bị chặn từ tầng HTTP trước khi vào queue. Nhánh này ở worker là
lưới an toàn cho ca message cũ nằm trong queue từ trước khi luật đổi.

**Điểm đề bài nhấn mạnh, nhắc lại cho rõ:** nhóm "hết hạn mức" **không được** biến
thành nhóm "tạm thời". Hàng đợi có thể làm việc chờ trông êm ái, nhưng nó không tạo
ra thêm quota. Người dùng phải thấy đúng chữ "đang chờ hạn mức, dự kiến sau HH:MM"
chứ không phải một spinner quay mãi.

### 6.4 — Phục hồi khi worker khởi động lại

Hai cơ chế chồng lên nhau, cố ý:

1. **RabbitMQ tự lo.** Kênh đóng đột ngột ⇒ mọi message chưa ack được giao lại. Đây
   là cơ chế chính và nó không cần ta viết gì.
2. **Lease trong database.** Hàng `PROCESSING` có `leaseExpiresAt` (5 phút). Một job
   quét mỗi phút đưa hàng quá hạn về `QUEUED` **và** ghi outbox `cv.scan.requested`
   mới. Đây là lưới cho ca cơ chế 1 không đủ: broker mất message (Little Lemur xoá
   queue nhàn rỗi 28 ngày), hoặc worker treo mà kết nối vẫn sống nên broker chưa
   giao lại.

Cơ chế 2 có thể sinh trùng — cơ chế chống trùng ở mục 5 lo phần đó. Thà thừa một
message còn hơn một CV kẹt mãi.

---

## 7. Dead letter queue: `cv.scan.parked.q`

**Không TTL, không tự xoá.** Đây là nơi message đi vào và **chờ người**.

| Việc | Cách làm |
| --- | --- |
| Xem có gì trong đó | RabbitMQ Management UI ở `http://localhost:15672` (local), hoặc `/api/health/chi-tiet` trả về `parkedCount` |
| Cảnh báo | `parkedCount > 0` là bất thường, luôn phải xem |
| Xử lý lại | Shovel trong Management UI, hoặc script `pnpm --filter @uniwork/worker replay-parked` |

**Cạm bẫy Little Lemur:** "queue không ai tiêu thụ trong 28 ngày sẽ bị xoá". `parked.q`
theo định nghĩa là queue **không ai tiêu thụ**. Nghĩa là trên CloudAMQP free, DLQ có
thể tự bốc hơi cùng mọi bằng chứng lỗi trong đó.

**ĐỀ XUẤT:** không dựa vào `parked.q` làm nơi lưu trữ. Khi park một message, ghi song
song một hàng vào bảng `outbox_messages` với `type='cv.scan.parked'`… không — đúng
hơn là ghi vào chính `cv_extractions` (`status='FAILED'`, `errorCode`, `lastPayload`).
Queue để thao tác lại, **database để làm bằng chứng**. Postgres không xoá bảng của ta
sau 28 ngày.

---

## 8. Quan sát được

Thêm `GET /api/health/chi-tiet` (chỉ ADMIN — `/api/health` phải giữ nguyên "cực nhẹ,
không chạm database" theo README §3):

```jsonc
{
  "rabbit":  { "ketNoi": "up", "kenhPublish": "up" },
  "outbox":  { "choDay": 0, "quaTranThuLai": 0, "cuNhat": null },
  "hangDoi": { "cvScanQ": 0, "retry1": 0, "retry2": 0, "retry3": 0, "parked": 0 },
  "scan":    { "queued": 0, "processing": 1, "leaseQuaHan": 0 },
  "ai":      { "circuitMo": false, "moDenLuc": null,
               "homNay": { "requests": 12, "inputTokens": 41200, "outputTokens": 6100 } }
}
```

Bốn con số phải nhìn hằng ngày, mỗi cái ứng với một chế độ hỏng thầm lặng:

| Số | Bất thường khi | Nghĩa là |
| --- | --- | --- |
| `outbox.choDay` | > 50 và tăng | Relay chết hoặc broker từ chối. Sự kiện đang tồn đọng, người dùng không thấy gì |
| `outbox.quaTranThuLai` | > 0 | Có sự kiện **đã bỏ cuộc**. Mất thật nếu không ai xem |
| `hangDoi.parked` | > 0 | Có việc đã bỏ cuộc sau 3 lần |
| `scan.leaseQuaHan` | > 0 liên tục | Worker treo, hoặc job quét dọn chết |

**Không ghi nội dung tin nhắn, nội dung CV, hay bất kỳ trường PII nào vào log.** Chỉ
ghi id, độ dài, mã lỗi, số token, mili-giây. Xem [09](09-phan-bien.md) mục 6.

---

## 9. Thêm vào `docker-compose.yml`

Theo đúng nếp của Redis đang có ở đó: **dưới profile, không tự khởi động**.

```yaml
  rabbitmq:
    image: rabbitmq:4-management-alpine
    container_name: uniwork-rabbitmq
    restart: unless-stopped
    # Cùng lý do Redis nằm dưới profile: không phải ngày nào cũng cần, và máy dev
    # đã từng hết RAM tới mức Docker Desktop sập (docs/moi-truong-may-dev.md).
    # Bật khi làm scan CV: docker compose --profile mq up -d
    profiles: ['mq']
    environment:
      RABBITMQ_DEFAULT_USER: uniwork
      # Mật khẩu chỉ dùng ở máy local, không phải bí mật gì.
      RABBITMQ_DEFAULT_PASS: uniwork_dev
    ports:
      - '5672:5672'    # AMQP
      - '15672:15672'  # Management UI — http://localhost:15672
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      # Cùng lý do healthcheck của Postgres: container "đã khởi động" không có
      # nghĩa là "đã nhận được kết nối AMQP". Worker nối quá sớm sẽ ECONNREFUSED.
      test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping']
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

Thêm script gốc: `"mq:up": "docker compose --profile mq up -d --wait"`.

Bản `-management-alpine` nặng hơn bản trần khoảng 30 MB nhưng cho Management UI —
với mục tiêu **học** message queue thì nhìn thấy exchange, binding, message tồn
đọng và DLQ bằng mắt đáng giá hơn nhiều so với 30 MB.

---

### 9.1 — Broker chạy ở đâu trên production (bổ sung 2026-09-12)

**Không cần nâng cấp Render.** Nhưng cũng **không chạy RabbitMQ trên Render** — kể cả
gói trả phí Web Service. Ba lý do, và lý do đầu là lý do cứng:

1. **Render Web Service chỉ nói HTTP/HTTPS trên một cổng.** AMQP (5672) là TCP thô.
   Dù có gói đắt tới đâu, API cũng không nối vào được. Bind cổng 15672 (Management UI)
   làm cổng web thì chỉ được cái giao diện, không được giao thức.
2. **Ngủ 15 phút.** Broker ngủ là broker chết — publish thất bại chứ không chờ.
3. **Đĩa ephemeral.** `persistent: true` và `durable` mất sạch mỗi lần restart, tức là
   mất đúng thứ đã chọn RabbitMQ để có.

Loại service **đúng** trên Render là Private Service kèm disk — chỉ có ở bản trả phí,
và lúc đó ta tự vận hành RabbitMQ: nâng cấp, giám sát, sao lưu. Đắt hơn và nhiều việc
hơn một broker hosted miễn phí.

**Cách đúng: broker nằm NGOÀI Render.** Render free giữ nguyên, chỉ là client nối ra.

| Môi trường | Broker | Tiền |
| --- | --- | --- |
| Máy dev | Docker `--profile mq` | 0 |
| Render free | **CloudAMQP Little Lemur** (nối ra ngoài qua AMQP) | 0 |
| Sau này | CloudAMQP trả phí, hoặc RabbitMQ trên VPS ([01](01-kien-truc-va-ranh-gioi.md) 4.4) | 4–20 USD |

Kết nối **đi ra** từ Render Web Service là bình thường — đúng như cách app đang nối
tới Neon và Brevo. Không cần mở cổng, không cần đổi gói.

**Bốn chỗ Render-free-ngủ gặp broker, và tại sao đều ổn:**

| Chuyện | Hậu quả | Đã lo ở đâu |
| --- | --- | --- |
| Service ngủ → kết nối AMQP đứt | Consumer biến mất. Message **nằm lại queue**, không mất — đây đúng là việc queue sinh ra để làm | — |
| Service dậy | `connection.ts` nối lại **và assert lại topology + consumer** | [mục 2](#2-kết-nối-connectionts) điểm 2 |
| `WORKER_INLINE=true` → worker ngủ theo API | Job scan nằm chờ tới lúc service dậy. Thực tế: người vừa upload CV chính là request đánh thức nó; ngoài ra `keep-alive.yml` giữ thức 07:00–23:59 giờ VN | [01](01-kien-truc-va-ranh-gioi.md) 4.1 |
| Nghỉ dài, queue nhàn rỗi 28 ngày → Little Lemur xoá | `assertQueue` lúc khởi động dựng lại. Chỉ mất message đang nằm trong đó | [mục 7](#7-dead-letter-queue-cvscanparkedq) |

Dòng đầu đáng chú ý: với Render free, **có broker còn tốt hơn không có**. Hiện tại
email ứng tuyển gửi thẳng trong request — service ngủ giữa chừng là mất. Có queue thì
việc nằm chờ tới lúc dậy.

**Hai điều phải xác nhận lúc tạo tài khoản CloudAMQP** (ngày 4):

- **Quorum queue có tạo được không.** Little Lemur là instance chia sẻ; quorum cần
  cluster. Không được thì dùng `classic` và dựa hoàn toàn vào `attempt` trong envelope
  — xem [mục 1.2](#12--quorum-chứ-không-classic).
- **Số kết nối.** Little Lemur cho 20; ta dùng **1 kết nối mỗi process** (nhiều kênh
  trên đó — xem [mục 2](#2-kết-nối-connectionts)). Còn thừa rất nhiều, nhưng nếu ai đó
  lỡ mở kết nối mỗi lần publish thì 20 hết trong vài giây.

**Và một lựa chọn rẻ hơn nữa, đáng cân nhắc cho 14 ngày:** production **chưa cần**
broker. Demo ngày 14 chạy trên máy local với Docker RabbitMQ; hai feature AI chỉ deploy
lên Render sau khi đã ổn định. Khi đó việc đăng ký CloudAMQP lùi hẳn sang giai đoạn 2,
và tuần 1–2 không phải phụ thuộc vào một dịch vụ bên ngoài chưa ai dùng bao giờ.

---

## 10. Kiểm thử tầng messaging

| Cần chứng minh | Cách | Làn test |
| --- | --- | --- |
| Outbox ghi trong cùng transaction | Ép transaction ném lỗi sau `ghiOutbox` → không có hàng outbox nào | `vitest` (mock) |
| Relay không đánh dấu khi confirm lỗi | Giả `publish` reject → `publishedAt` vẫn `null`, `attempts=1`, `nextTryAt` lùi | `vitest` |
| Hai relay không publish trùng | Hai transaction song song trên Postgres thật, đếm số lần `publish` được gọi | `vitest.db` |
| Message trùng chỉ xử lý một lần | Gọi consumer hai lần cùng `messageId` → một hàng nghiệp vụ, `processed_messages` chặn lần hai | `vitest` |
| Version cao hơn bị park, không quay vòng | Đưa `v: 99` → hàm handle không được gọi, message vào parked | `vitest` |
| `nack` không requeue thẳng | Xác nhận `ch.nack` được gọi với tham số thứ ba là `false` | `vitest` — kiểm **hình dạng lời gọi**, đúng mẫu ở `docs/nep-kiem-thu.md` mục 2 |
| Retry đi đúng bậc | Local thật: chặn Gemini, xem message đi qua retry.1 → retry.2 → retry.3 → parked trên Management UI | Tay, ghi lại thời điểm |
| Worker chết giữa chừng thì message quay lại | `docker kill` worker lúc đang gọi Gemini, xem message xuất hiện lại | Tay |

Ca "nack không requeue" **phải** kiểm bằng hình dạng lời gọi, không kiểm kết quả:
truyền `true` vẫn cho ra cùng một kết quả cuối (message được xử lý lại), chỉ khác là
nó quay vòng nóng. Đây đúng loại lỗi mà `docs/nep-kiem-thu.md` mục 2 gọi là
*"thứ gì sai mà không có biểu hiện thì phải kiểm ở chỗ nó được quyết định"*.
