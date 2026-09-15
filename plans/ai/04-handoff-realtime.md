# 04 — Handoff sang nhà tuyển dụng: máy trạng thái, Socket.IO, reconnect

Đọc [03-chatbot-va-tool.md](03-chatbot-va-tool.md) trước — data model `ChatSession`
và `ChatMessage` khai ở đó.

---

## 1. Máy trạng thái

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
              ┌───────────┐                                    │
   tạo phiên  │ AI_ACTIVE │◄───────────────────┐               │
   ──────────►│           │                    │               │
              └─────┬─────┘                    │ (E) quay-lai-ai
                    │                          │    SV chủ động
        (A) chuyen-ntd                         │               │
            SV bấm nút, PHẢI có jobId          │               │
                    ▼                          │               │
           ┌──────────────────┐                │               │
           │ WAITING_EMPLOYER │────────────────┼───────────────┘
           └────┬────────┬────┘   (B) huy-cho, SV huỷ
                │        │
   (C) tiep-nhan│        │ (D) ket-thuc  ← SV hoặc NTD, cả hai đều được
       NTD bấm  │        │
                ▼        ▼
        ┌──────────────┐ │
        │ HUMAN_ACTIVE │─┤ (D) ket-thuc
        └──────────────┘ │
                         ▼
                   ┌──────────┐
                   │  CLOSED  │  ← cuối. Mở lại = phiên MỚI,
                   └──────────┘     previousSessionId trỏ về đây
```

| # | Từ | Sang | Ai | Điều kiện | Hiệu ứng phụ |
| --- | --- | --- | --- | --- | --- |
| A | `AI_ACTIVE` | `WAITING_EMPLOYER` | STUDENT | `kind = AI_STUDENT`; tin `OPEN`, NTD đã `verifiedAt`; **và `handoffEmployerProfileId` đang null HOẶC đúng bằng NTD của tin này** ([03](03-chatbot-va-tool.md) 5.0) | Abort run AI đang chạy; **đóng băng** `handoffEmployerProfileId` + `jobId`; ghi tin mở đầu `visibleToEmployer=true`; đặt `employerVisibleFromSeq` (chỉ khi đang null); thông báo + email NTD |
| B | `WAITING_EMPLOYER` | `AI_ACTIVE` | STUDENT | — | Tin `SYSTEM` "bạn đã huỷ chờ"; **không** thông báo NTD |
| C | `WAITING_EMPLOYER` | `HUMAN_ACTIVE` | EMPLOYER | Đúng NTD của tin | Tin `SYSTEM`; thông báo SV; emit realtime |
| D | `WAITING_EMPLOYER` hoặc `HUMAN_ACTIVE` | `CLOSED` | cả hai | — | Tin `SYSTEM` kèm ai kết thúc |
| E | `HUMAN_ACTIVE` | `AI_ACTIVE` | STUDENT | — | Tin `SYSTEM`; NTD **giữ nguyên quyền đọc** phần cũ (quyền neo vào `handoffEmployerProfileId`, không vào `state` — [03](03-chatbot-va-tool.md) 6.2c), **không** đọc được phần mới vì tin giai đoạn AI đều `visibleToEmployer = false`. Socket của NTD ở phòng `:ntd` cũng không nhận gì mới (mục 3.3) |

### 1.1 — Vì sao E không đưa `employerVisibleFromSeq` về null

Quay lại AI rồi chuyển đi lần nữa: nếu xoá mốc thì NTD lần hai đọc lại từ đầu, kể cả
đoạn sinh viên nói chuyện riêng với AI ở giữa. Giữ mốc cũ, và lần chuyển thứ hai
**không** dịch mốc lên (chỉ đặt khi nó đang `null`) — NTD thấy đúng phần đã từng
được chia sẻ, cộng phần mới, không có đoạn giữa.

Còn `visibleToEmployer` của từng tin thì lo phần còn lại: tin sinh viên nói với AI
trong giai đoạn `AI_ACTIVE` giữa hai lần chuyển đều là `false`.

**Hai lớp chồng nhau là cố ý.** Mốc `seq` là lớp thô, cờ từng tin là lớp tinh. Sai
một lớp thì lớp kia còn đỡ.

### 1.2 — Mọi chuyển trạng thái là một `UPDATE` có điều kiện

```ts
const kq = await tx.chatSession.updateMany({
  where: { id: sessionId, state: 'WAITING_EMPLOYER' },   // ← trạng thái NGUỒN
  data:  { state: 'HUMAN_ACTIVE', handoffAcceptedAt: new Date() },
})
if (kq.count === 0) throw conflict('Hội thoại này không còn ở trạng thái chờ')
```

**Không bao giờ** `findUnique` rồi kiểm `if (s.state === …)` rồi `update`. Giữa ba
bước đó có khe hở, và các khe hở này có người thật đi qua: sinh viên huỷ chờ đúng
lúc NTD bấm tiếp nhận.

`updateMany` cho `count`, và `count === 0` là câu trả lời **chính xác** cho "ai đó đã
đổi trước tôi". Đây là compare-and-swap, không phải khoá.

---

## 2. Ba ca đua, và cách xử từng ca

### 2.1 — AI đang sinh chữ, sinh viên bấm chuyển

Đã mô tả ở [03](03-chatbot-va-tool.md) mục 1.2. Nhắc lại kết luận: lớp bị động
(`INSERT … WHERE state='AI_ACTIVE' AND activeAiRunId=?`) là lớp đúng; lớp chủ động
(abort) chỉ tiết kiệm token.

Người dùng thấy: chữ đang chảy **dừng lại giữa chừng**, thay bằng
*"Đã chuyển sang nhà tuyển dụng, đang chờ họ trả lời."* Không phải màn hình trắng.

### 2.2 — Hai NTD cùng tiếp nhận

Một công ty có thể có nhiều người dùng chung tài khoản (thực tế ở Việt Nam rất hay).
`updateMany` với `where.state = 'WAITING_EMPLOYER'` giải quyết: người thứ hai nhận
`count === 0` → 409 *"Hội thoại này vừa được tiếp nhận rồi."*

### 2.3 — Sinh viên huỷ chờ đúng lúc NTD tiếp nhận

Cả hai đều là `updateMany` từ `WAITING_EMPLOYER`. Postgres nối tiếp chúng. Ai tới
trước thắng, người kia nhận 409 với thông điệp đúng. **Không có trạng thái lai.**

Ca này phải có test riêng ở làn `vitest.db` — mock Prisma không tái hiện được việc
Postgres nối tiếp hai `UPDATE` trên cùng một hàng.

---

## 3. Socket.IO

### 3.1 — Gắn vào server đang có

```ts
// apps/api/src/index.ts
const httpServer = createServer(createApp())
const io = taoIo(httpServer)          // ← mới
httpServer.listen(env.PORT, env.HOST, …)
```

Cùng một cổng, cùng một process. Socket.IO tự nhận đường `/socket.io/`.

**CORS phải khai riêng.** `cors()` của Express không áp cho WebSocket:

```ts
new Server(httpServer, {
  cors: { origin: corsOrigins, credentials: true },
  // Buộc dùng WebSocket luôn, không long-polling trước.
  // Lý do: long-polling trên Render free tạo một request HTTP mỗi 25 giây cho
  // mỗi client — vừa tốn compute-hour vừa làm nhiễu request log.
  transports: ['websocket'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
```

### 3.2 — Xác thực handshake, và vấn đề token 15 phút

Client gửi access token trong `auth`, **không** trong query string (query string đi
vào log của mọi proxy):

```ts
const socket = io(API_URL, { auth: { token: accessToken } })
```

```ts
io.use((socket, next) => {
  const payload = verifyAccessToken(socket.handshake.auth?.token)
  if (!payload) return next(new Error('UNAUTHORIZED'))
  socket.data.user = { id: payload.sub, role: payload.role }
  socket.data.expiresAt = payload.exp * 1000
  next()
})
```

**Vấn đề thật:** access token sống 15 phút
([env.ts](../../apps/api/src/config/env.ts) `ACCESS_TTL`). Một kết nối WebSocket sống
hàng giờ. Không xử lý thì tài khoản bị khoá lúc 10:00 vẫn chat được tới 14:00 — đánh
đổi 15 phút mà `requireAuth` cố ý chấp nhận trở thành đánh đổi vô hạn.

**ĐỀ XUẤT:** hẹn giờ ngắt theo `exp` của chính token đó.

```ts
const conLai = socket.data.expiresAt - Date.now()
const hen = setTimeout(() => {
  socket.emit('phien:het-han')      // client gọi /auth/refresh rồi nối lại
  socket.disconnect(true)
}, Math.max(0, conLai)).unref()
socket.on('disconnect', () => clearTimeout(hen))
```

Client nghe `phien:het-han` → refresh → `socket.connect()` lại. Người dùng không thấy
gì (mất kết nối < 1 giây, và tin nhắn được tải bù bằng `cursor`).

Cách khác — cho client gửi token mới qua một sự kiện `phien:gia-han` — cũng được và
mượt hơn, nhưng phức tạp hơn và không cần cho quy mô hiện tại. Ghi lại ở đây để sau
này không phải nghĩ lại.

### 3.3 — Phòng

Ba loại, tên có tiền tố để không bao giờ đụng nhau:

| Phòng | Ai vào | Dùng cho |
| --- | --- | --- |
| `user:<userId>` | chính người đó, tự động lúc kết nối | Thông báo riêng: scan CV xong, có tin mới, NTD đã tiếp nhận |
| `hoi-thoai:<sessionId>:chu` | **chỉ chủ phiên** (`ownerUserId`) | Mọi tin, kể cả tin AI |
| `hoi-thoai:<sessionId>:ntd` | **chỉ NTD nhận handoff** | **Chỉ** tin `visibleToEmployer = true` |
| `ntd:<employerProfileId>` | mọi user của NTD đó | Hộp thư: có hội thoại mới đang chờ |

**Hai phòng cho một hội thoại, không phải một (sửa R02).** Bản trước dùng một phòng
chung `hoi-thoai:<id>`, nghĩa là mọi `emit` tới cả hai bên — và khi phiên quay lại
`AI_ACTIVE`, NTD đang ngồi trong phòng sẽ **nhận realtime từng câu sinh viên nói với
trợ lý**, dù REST đã chặn họ đọc. Lỗ đó không lộ ra ở bất kỳ test REST nào.

Luật phát, một dòng:

```ts
io.to(`hoi-thoai:${id}:chu`).emit('hoi-thoai:tin-moi', { message })
if (message.visibleToEmployer) {
  io.to(`hoi-thoai:${id}:ntd`).emit('hoi-thoai:tin-moi', { message })
}
```

Cùng một cờ `visibleToEmployer` quyết định cả câu truy vấn REST lẫn phòng socket. Một
nguồn sự thật, hai đường dùng — không có chỗ cho hai bên lệch nhau.

Vào phòng `:ntd` **không** phụ thuộc `state` (xem [03](03-chatbot-va-tool.md) mục 6.2c);
gửi tin thì có. Và vì `handoffEmployerProfileId` đã đóng băng, không có ca "phải đuổi
socket ra khỏi phòng khi quyền đổi".

**Vào phòng phải kiểm ở server, mỗi lần.** Không tin `sessionId` client gửi:

```ts
socket.on('hoi-thoai:vao', async ({ sessionId }, ack) => {
  const quyen = await quyenTruyCapPhien(socket.data.user, sessionId)   // chat.access.ts
  if (!quyen) return ack({ ok: false, code: 'FORBIDDEN' })

  // Vào ĐÚNG phòng theo vai, không phải một phòng chung.
  //
  // Bản trước join `hoi-thoai:<id>` nhưng emit vào `:chu` / `:ntd` — join báo
  // thành công và client KHÔNG BAO GIỜ nhận được tin nào. Lỗi không có triệu
  // chứng nào ngoài "realtime không chạy", nên tên phòng phải đến từ
  // `quyenTruyCapPhien`, không cho nơi gọi tự ghép chuỗi.
  await socket.join(quyen.phong)

  // Trả `cursor`, KHÔNG trả seq lớn nhất của phiên — với NTD thì dãy seq có
  // khoảng trống hợp lệ. Xem mục 5.3.
  ack({ ok: true, cursor: quyen.cursor, duocGui: quyen.duocGui })
})
```

`quyenTruyCapPhien` là **một** hàm, dùng chung cho cả Socket.IO lẫn REST. Hai bản sao luật
phân quyền là hai bản sao sẽ lệch nhau.

```ts
// apps/api/src/modules/chat/chat.access.ts — ĐỀ XUẤT (sửa R01, R02)

/** Vai của người xem TRONG phiên này — không phải Role của tài khoản. */
export type VaiTrongPhien = 'CHU' | 'NTD_NHAN_HANDOFF'

export interface QuyenTruyCap {
  vai: VaiTrongPhien
  /** Phòng socket được vào. Suy từ `vai`, không cho nơi gọi tự chọn. */
  phong: string
  seqHienTai: number
  /** Chỉ đọc tin có seq >= mốc này. */
  docTuSeq: number
  /** Có thêm điều kiện `visibleToEmployer = true` không. */
  chiTinChiaSe: boolean
  /** Được GỬI tin ngay bây giờ không — cái này MỚI phụ thuộc `state`. */
  duocGui: boolean
}

export async function quyenTruyCapPhien(
  user: { id: string; role: Role },
  sessionId: string,
): Promise<QuyenTruyCap | null>
```

| Điều kiện | `vai` | `phong` | `docTuSeq` | `chiTinChiaSe` | `duocGui` |
| --- | --- | --- | --- | --- | --- |
| `session.ownerUserId === user.id` | `CHU` | `hoi-thoai:<id>:chu` | `1` | `false` | `state === 'HUMAN_ACTIVE'` |
| `user` thuộc `session.handoffEmployerProfileId` (khác null) | `NTD_NHAN_HANDOFF` | `hoi-thoai:<id>:ntd` | `employerVisibleFromSeq` | **`true`** | `state === 'HUMAN_ACTIVE'` |
| còn lại, kể cả ADMIN | — | — | — | — | `null` → **403** |

Ba điểm sửa so với bản trước:

1. **Neo vào `ownerUserId`, không vào `studentProfile.userId`** — nếu không thì phiên
   `AI_EMPLOYER` của chính NTD không ai đọc được (R01).
2. **Quyền đọc của NTD không còn điều kiện `state != 'AI_ACTIVE'`** — nó neo vào việc
   `handoffEmployerProfileId` đã đặt hay chưa. Đây là chỗ bản trước tự mâu thuẫn với
   transition E (R02).
3. **`duocGui` là trường riêng.** Đọc và gửi là hai câu hỏi; gộp chúng chính là nguồn
   của mâu thuẫn trên.

`docTuSeq` và `chiTinChiaSe` trả về ngay ở đây để mọi câu truy vấn tin nhắn có sẵn cả
hai điều kiện — không ai phải nhớ thêm `WHERE`, cùng nếp với `TRANG_THAI_MO_LIEN_HE`.

---

## 4. Sự kiện Socket.IO

Khai ở `packages/contracts/src/socket-events.ts`, hai phía cùng import.

### Client → Server (đều có ACK)

| Sự kiện | Payload | ACK |
| --- | --- | --- |
| `hoi-thoai:vao` | `{ sessionId }` | `{ ok, seqHienTai? , code? }` |
| `hoi-thoai:ra` | `{ sessionId }` | `{ ok }` |
| `hoi-thoai:gui` | `{ sessionId, clientMessageId, noiDung }` | `{ ok, messageId?, seq?, code? }` |
| `hoi-thoai:dang-go` | `{ sessionId }` | không ACK — mất cũng không sao |
| `hoi-thoai:tai-bu` | `{ sessionId, cursor }` | `{ ok, tinNhan: [...], cursor, conNua }` |

### Server → Client

| Sự kiện | Payload | Gửi vào phòng |
| --- | --- | --- |
| `hoi-thoai:tin-moi` | `{ sessionId, message: TinNhan }` | `hoi-thoai:<id>` |
| `hoi-thoai:trang-thai` | `{ sessionId, state, boiUserId? }` | `hoi-thoai:<id>` |
| `hoi-thoai:dang-go` | `{ sessionId, userId }` | `hoi-thoai:<id>` |
| `ntd:hoi-thoai-cho` | `{ sessionId, jobId, tenTin, luc }` | `ntd:<employerProfileId>` |
| `thong-bao:moi` | `{ notification }` | `user:<userId>` |
| `cv-scan:tien-trinh` | `{ extractionId, status, tienDo? }` | `user:<userId>` |
| `cv-scan:xong` | `{ extractionId, status, soTruong, soCanhBao }` | `user:<userId>` |
| `phien:het-han` | `{}` | socket đó |

### 4.1 — ACK là bắt buộc cho `hoi-thoai:gui`

Đề bài: *"Tin nhắn có ID, xác nhận lưu, chống gửi trùng và cơ chế tải bù sau reconnect."*

`socket.emit()` không có gì bảo đảm. Với ACK thì client biết chắc:

```ts
socket.timeout(10_000).emit('hoi-thoai:gui', payload, (err, res) => {
  if (err)      return danhDauChuaGui(clientMessageId)   // hết giờ → nút "gửi lại"
  if (!res.ok)  return hienLoi(res.code)
  danhDauDaGui(clientMessageId, res.messageId, res.seq)
})
```

Server **chỉ** ACK sau khi transaction commit. Trước commit là nói dối, và người dùng
sẽ thấy dấu tick rồi tin nhắn biến mất khi tải lại trang.

### 4.2 — Không tin gửi tin qua Socket.IO là đường **duy nhất**

`POST /api/hoi-thoai/:id/tin-nhan` phải làm được y hệt. Lý do:

- WebSocket bị chặn ở một số mạng (trường học, wifi công cộng có proxy).
- Không có REST thì không test được bằng Supertest — repo đang dựa nặng vào
  Supertest ([nep-kiem-thu.md](../../docs/nep-kiem-thu.md) mục 4).

Cả hai đường gọi **cùng một** `chat.service.guiTinNhan()`. Socket handler là lớp vỏ
mỏng, không chứa nghiệp vụ.

---

## 5. NTD offline, presence, và tải bù

### 5.1 — NTD offline

Đề bài: *"Nhà tuyển dụng offline: lưu tin, thông báo đang chờ, nhận lại khi online."*

Thiết kế này **không có khái niệm gửi tin trực tiếp**. Mọi tin đều:

1. Ghi vào `chat_messages` (nguồn sự thật).
2. Ghi `outbox_messages` cùng transaction.
3. Relay publish → mọi instance emit vào phòng.

NTD offline ⇒ bước 3 rơi vào hư không ⇒ **không mất gì**, vì bước 1 đã xong. Lúc họ
mở app: `GET /api/hoi-thoai/:id?cursor=<cursor đang giữ>` trả về đủ.

Không cần hàng đợi tin nhắn riêng cho người offline. Database **là** hàng đợi đó.

Kèm theo — cùng transaction:
- `Notification` (dùng `createNotification(tx, …)` đã có).
- Email qua Brevo **chỉ khi** transition A (yêu cầu chuyển) và NTD chưa online, và
  **tối đa 1 email/phiên/giờ** — không thì mỗi tin nhắn một email và Brevo hết 300
  mail/ngày trong buổi sáng.

### 5.2 — Presence: đọc từ đâu

"NTD có đang online không" **không** đọc từ adapter Socket.IO — với cách fan-out
bằng RabbitMQ ở [02](02-messaging-rabbitmq.md) mục 1.3 thì mỗi instance chỉ thấy
socket của chính nó.

**ĐỀ XUẤT:** một bảng nhỏ, cập nhật lúc kết nối/ngắt và mỗi 60 giây.

```prisma
/// Ai đang mở app. Xấp xỉ, không chính xác tuyệt đối.
///
/// Cần một bảng vì với nhiều instance, mỗi instance chỉ biết socket của mình.
/// Chấp nhận trễ tới 90 giây: dùng để quyết định "có gửi email không", không
/// dùng để hiện chấm xanh thời gian thực.
model UserPresence {
  userId    String   @id
  lastSeenAt DateTime
  /// Số socket đang mở, tổng trên mọi instance. Có thể lệch khi instance chết
  /// đột ngột — vì vậy lastSeenAt mới là cột quyết định, không phải cột này.
  connections Int    @default(0)

  @@index([lastSeenAt])
  @@map("user_presence")
}
```

`online = lastSeenAt > now() - 90 giây`. Instance chết đột ngột không kịp giảm
`connections`, nên `lastSeenAt` là cột đáng tin, `connections` chỉ để tham khảo.

**Không** hiện chấm xanh "đang hoạt động" cho sinh viên thấy. Nó gợi ý một mức chính
xác mà số liệu này không có, và tạo kỳ vọng sai ("thấy online sao không trả lời").

### 5.3 — Tải bù: dùng CURSOR, không dùng "seq phải liên tục" (sửa #11)

**Bản trước sai với vai NTD.** Nó dựa vào "seq thủng ⇒ mất tin". Nhưng NTD chỉ đọc tin
`visibleToEmployer = true`: họ nhận seq 10, sinh viên nói riêng với AI ở 11–15, chia sẻ
tiếp ở 16. **Khoảng trống 11–15 là đúng quyền, không phải mất tin** — và client sẽ gọi
`tai-bu` mãi cho những seq nó vĩnh viễn không được phép thấy.

Sửa: server trả **cursor**, client không bao giờ tự suy từ số nguyên.

```ts
/** Mốc đồng bộ. Đục — client chỉ cất đi và gửi lại, không đọc, không tính toán. */
type Cursor = string   // base64 của { seq, v } — xem ghi chú bên dưới

// Server → client, kèm mọi tin nhắn và mọi ACK
{ tinNhan: TinNhan[], cursor: Cursor, conNua: boolean }
```

`cursor` mã hoá **seq lớn nhất mà server ĐÃ XÉT** cho vai đó — không phải seq lớn nhất
mà client *nhận được*. Sinh viên nói riêng 5 câu thì cursor của NTD vẫn tiến từ 10 lên
15 dù họ không nhận tin nào; lần `tai-bu` sau bắt đầu từ 16 và **trả về mảng rỗng một
cách hợp lệ**.

Đục (base64) chứ không phải số trần: một con số tăng đều là kênh rò rỉ — NTD đếm được
sinh viên đã trao đổi riêng bao nhiêu câu với trợ lý.

**Bốn bước sau reconnect:**

```
1. socket.on('connect')          → gửi lại `hoi-thoai:vao` cho mọi phiên đang mở
2. ACK trả `cursor` của server   → so với cursor client đang giữ
3. khác nhau                     → `hoi-thoai:tai-bu { cursor }`
                                   → có thể trả MẢNG RỖNG + cursor mới. Bình thường.
4. tin nào `clientMessageId` chưa ACK → gửi lại; server dedupe, trả tin cũ
```

Bước 3 trả rỗng là **kết quả đúng**, không phải lỗi. Client cập nhật cursor và dừng —
không thử lại.

### 5.4 — Đối soát định kỳ, kể cả khi socket VẪN đang nối (sửa #12)

Bản trước chỉ polling khi socket **mất kết nối**, và chỉ phát hiện thủng khi **nhận
được sự kiện tiếp theo**. Cả hai đều không cứu được ca thật này:

> API mất kết nối RabbitMQ đúng lúc CV quét xong. Socket giữa trình duyệt và API
> **vẫn sống**. Sự kiện cuối cùng không bao giờ tới. Không có sự kiện nào sau nó để
> lộ ra khoảng thủng. Người dùng nhìn spinner **vô hạn**.

Luật: **trạng thái chưa kết thúc thì phải đối soát, bất kể socket ra sao.**

| Màn hình | Đối soát khi nào | Dừng khi nào |
| --- | --- | --- |
| Tiến trình quét CV | Mỗi 5 s (jitter ±1 s), **kể cả socket connected** | `status` vào trạng thái cuối (`NEEDS_REVIEW`/`CONFIRMED`/`FAILED`) |
| Hội thoại đang mở | Khi tab `focus`/`visibilitychange`, và mỗi 30 s | Rời phiên |

Backoff cho màn hình quét: 5 s trong phút đầu, 15 s tới phút thứ năm, 60 s sau đó —
job scan có thể chờ hạn mức hàng chục phút và không đáng gõ cửa mỗi 5 giây suốt.

Jitter là bắt buộc: không có nó thì 20 tab mở cùng lúc sẽ gọi đồng pha mãi mãi.

**Nghiệm thu:** bỏ **đúng** sự kiện cuối cùng (chặn ở tầng emit), **không** ngắt socket,
**không** gửi thêm tin, **không** remount — UI vẫn phải tự cập nhật trong 10 giây.

Bước 4 là chỗ hai cơ chế gặp nhau: gửi lại + `@@unique([sessionId, clientMessageId])`
= gửi lại bao nhiêu lần cũng không sinh tin trùng. Không có bước 4 thì tin gửi đúng
lúc mất mạng sẽ im lặng biến mất — không ai báo lỗi, và người dùng tưởng đã gửi.

**Trần tải bù: 200 tin mỗi lần.** Lệch nhiều hơn thì trả `{ quaNhieu: true }` và
client tải lại cả phiên bằng REST. Không có trần thì một client offline một tuần sẽ
kéo cả nghìn tin qua WebSocket một lượt.

---

## 6. Nhiều instance: ba phương án

**ĐỌC ĐƯỢC:** adapter chính thức của Socket.IO gồm Redis, Redis Streams, MongoDB,
Postgres, Cluster, GCP Pub/Sub, AWS SQS, Azure Service Bus. AMQP/RabbitMQ **chỉ có
bản cộng đồng** ([socket.io/docs/v4/adapter](https://socket.io/docs/v4/adapter/)).

| Phương án | Hạ tầng thêm | Ưu | Nhược |
| --- | --- | --- | --- |
| **A. Fan-out tự viết bằng RabbitMQ** (queue mỗi instance) | 0 — đã có broker | Không thêm gì; nhìn thấy message chạy trên Management UI, nhìn được message trên Management UI khi cần dò | Không đồng bộ `rooms` giữa instance; `fetchSockets()` chỉ thấy cục bộ |
| **B. `@socket.io/postgres-adapter`** | 0 — đã có Postgres | Adapter chính thức, đồng bộ đủ `rooms` | `NOTIFY`/`LISTEN` **không chạy qua PgBouncer transaction mode** — phải dùng `DIRECT_URL`, tức thêm một kết nối trực tiếp mà Neon free đếm rất chặt. Payload > 8 KB rơi xuống bảng phụ |
| **C. `@socket.io/redis-adapter`** | Redis (Render free **có** Key Value) | Mặc định của ngành, nhanh nhất | Thêm một dịch vụ nữa để dựng và theo dõi |

**ĐỀ XUẤT:**
- **Bây giờ (1 instance):** adapter mặc định trong bộ nhớ. `SOCKET_ADAPTER=''`.
  Fan-out RabbitMQ (A) **vẫn dựng** — vì API và worker là hai process khác nhau ngay
  từ local, và `cv-scan:xong` phải đi từ worker sang API bằng đường nào đó.
- **Khi lên 2+ instance:** thêm **C** (Redis). Không phải B, vì `LISTEN` trên
  `DIRECT_URL` của Neon là đúng thứ hạn mức kết nối của Neon free ghét nhất.
- **Không** dùng adapter AMQP cộng đồng. Đội Socket.IO không bảo trì nó.

**Sticky session — nói chính xác (sửa R10).** Bản trước ghi "điều kiện tiên quyết cho
cả ba", và đó là quá tuyệt đối.

[Tài liệu Socket.IO](https://socket.io/docs/v4/using-multiple-nodes/) nói: sticky
session cần khi dùng **HTTP long-polling**, vì một phiên gồm nhiều request HTTP rời
rạc phải tới cùng một node. **WebSocket-only thì không cần** — chỉ có một kết nối duy
nhất, và nó ở lại đúng node đã bắt tay.

| Cấu hình | Sticky? |
| --- | --- |
| `transports: ['websocket']` ở **cả client lẫn server** (thiết kế này) | **Không cần** |
| Có long-polling, dù chỉ để dự phòng | **Bắt buộc** |

Nên đây là **lý do thứ hai và mạnh hơn** để bỏ long-polling: nó gỡ một yêu cầu hạ
tầng khỏi đường mở rộng. Đánh đổi phải chấp nhận: mạng chặn WebSocket thì client
không có đường dự phòng trong Socket.IO — chỗ đó rơi sang polling REST
`GET /api/hoi-thoai/:id?cursor=<opaque>`, xem mục 8.

Còn adapter thì vẫn cần khi lên nhiều instance, độc lập với chuyện sticky.

---

## 7. Ngữ cảnh chuyển sang NTD — chuyển đúng phần nào

Đề bài: *"Chỉ chuyển phần ngữ cảnh liên quan đến công việc; không chia sẻ toàn bộ
lịch sử AI riêng tư."*

### 7.1 — Cái gì đi qua

| Loại | NTD thấy | Vì sao |
| --- | --- | --- |
| Tin mở đầu do **sinh viên soạn** | **Có** | Họ tự viết, tự biết mình chia sẻ gì |
| Thẻ tin tuyển dụng (id, tên, ca làm) | **Có** | Không có nó thì NTD không biết đang nói về tin nào |
| Hồ sơ công khai của sinh viên (tên, trường, ngành, năm) | **Có** | Đã công khai với NTD qua luồng ứng tuyển |
| Tin nhắn sinh viên ↔ AI trước đó | **Không** | Đây là phần riêng tư |
| Câu trả lời của AI | **Không** | |
| Số điện thoại, email sinh viên | **Không** | Chỉ mở qua `TRANG_THAI_MO_LIEN_HE` khi đơn `SHORTLISTED`/`ACCEPTED` — chat **không** được là cửa sau của luật đó |

Dòng cuối là dòng quan trọng nhất. Commit `54e4d9c` vừa đưa việc che liên hệ xuống
tầng truy vấn. Một hộp chat cho phép sinh viên và NTD trao đổi tự do sẽ khiến luật
đó thành hình thức — nhưng đó là **sinh viên tự nguyện đưa số của mình**, khác hẳn
**hệ thống tự phát số ra**. Ranh giới: hệ thống không bao giờ hiển thị số; hai bên
tự gõ thì đó là lựa chọn của họ.

### 7.2 — Tin mở đầu: AI soạn nháp, sinh viên sửa và gửi

```
POST /api/hoi-thoai/:id/soan-nhap-chuyen   → { noiDungNhap: string }
POST /api/hoi-thoai/:id/chuyen-ntd         → { jobId, noiDung }   ← noiDung là thứ SV gửi thật
```

`soan-nhap-chuyen` **tốn một lượt AI** (nó là một lời gọi model). Rẻ hơn: dựng bản
nháp bằng **mẫu văn bản** từ `lyDo` mà tool `deNghiChuyenNhaTuyenDung` đã trả về,
không gọi model lần nữa.

**ĐỀ XUẤT:** dùng mẫu, không gọi model.

```
Chào anh/chị, em quan tâm tin "{tenTin}".
{lyDo}
Anh/chị cho em hỏi thêm được không ạ?
```

Sinh viên sửa thoải mái trước khi gửi. Lý do: tiết kiệm một lượt trên hạn mức 5
lượt/ngày cho một câu chào hỏi mà mẫu làm tốt ngang model. Nếu sau này quota rộng
rãi thì đổi sang gọi model — chỗ thay là một hàm.

### 7.3 — Cưỡng chế ở tầng truy vấn, không ở tầng response

Đúng bài học của commit `54e4d9c`:

```ts
// chat.service.ts — câu truy vấn cho NTD
prisma.chatMessage.findMany({
  where: {
    sessionId,
    seq: { gte: docTuSeq },              // ← từ quyenTruyCapPhien
    visibleToEmployer: true,             // ← cờ từng tin
  },
  orderBy: { seq: 'asc' },
})
```

Test canh phải kiểm **hình dạng câu truy vấn**, không kiểm response — vì bỏ một trong
hai điều kiện vẫn cho response "trông đúng" trong hầu hết ca:

```ts
const where = tinFindMany.mock.calls[0][0].where
expect(where.visibleToEmployer).toBe(true)
expect(where.seq).toEqual({ gte: 5 })
```

Đây đúng mẫu ở [nep-kiem-thu.md](../../docs/nep-kiem-thu.md) mục 2.

---

## 8. Lỗi và fallback

| Hỏng ở đâu | Người dùng thấy | Hệ thống |
| --- | --- | --- |
| WebSocket bị chặn | Chat vẫn chạy, chậm hơn | Client tự chuyển sang polling `GET /api/hoi-thoai/:id?cursor=<opaque>` mỗi 5 giây |
| Mất kết nối | "Đang kết nối lại…" | Socket.IO tự nối lại; sau đó chạy 4 bước ở 5.3 |
| Gửi tin lúc mất mạng | Tin hiện với dấu đồng hồ + nút "gửi lại" | ACK hết giờ 10 giây → đánh dấu chưa gửi |
| Chuyển sang NTD chưa `verifiedAt` | "Nhà tuyển dụng này chưa được xác minh, chưa nhắn được." | 409. Cùng luật với việc tin chưa duyệt không hiện công khai |
| Tin bị đóng lúc đang chờ | Vẫn chuyển được; NTD vẫn trả lời được | Không chặn — người ta hỏi về việc vừa đóng là chuyện bình thường |
| Tin bị **xoá** | Phiên còn, thẻ tin thành "Tin đã bị gỡ" | `jobId` → null (`onDelete: SetNull`), `handoffEmployerProfileId` giữ nguyên |
| NTD không tiếp nhận sau 48 giờ | "Chưa có phản hồi. Bạn có thể quay lại trợ lý." | Job quét mỗi giờ: `WAITING_EMPLOYER` quá 48 giờ → tin `SYSTEM` + gợi ý. **Không** tự đổi trạng thái |
| Relay outbox kẹt | Tin nhắn vẫn lưu, realtime trễ | `outbox.choDay` tăng — xem [02](02-messaging-rabbitmq.md) mục 8 |
| Deploy giữa lúc đang chat | Mất kết nối < 1 giây rồi nối lại | `io.close()` trong `shutdown()`; client tự nối lại và tải bù |

Ba dòng cuối cùng đáng chú ý: **mọi chế độ hỏng của realtime đều suy biến về "chậm",
không suy biến về "mất"**. Đó là hệ quả trực tiếp của việc database là nguồn sự thật
và Socket.IO chỉ là đường vận chuyển nhanh.
