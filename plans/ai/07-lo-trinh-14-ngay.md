# 07 — Lộ trình 14 ngày, và phần chuyển sang giai đoạn 2

**Trả lời đầu ra 6.**

---

## 0. Đây là ƯỚC LƯỢNG, không phải số liệu đo được (sửa R15)

Bản trước viết *"neo vào vận tốc đã đo của chính repo"* và dẫn bảng Sprint 3/Sprint 4.
**Sai cách gọi.** Hai con số 1,5 tuần và 2 tuần lấy từ cột "Thời lượng" của bảng
**lộ trình** ở [README §7](../../README.md) và [docs/timeline-8-tuan.md](../../docs/timeline-8-tuan.md)
— đó là thời lượng **kế hoạch**, không phải thời gian thực tế đã bỏ ra. Trong repo
không có dữ liệu năng suất thật (không có time log, không có burndown), nên **không ai
biết Sprint 4 thật sự mất bao lâu.**

Nên mọi con số dưới đây là **ước lượng có giả định**, và ghi rõ giả định:

| Giả định | Nếu sai thì sao |
| --- | --- |
| Một dev backend, quen repo, 1 ngày-người = 1 ngày lịch | Người mới thì nhân 1,5–2 |
| Sprint 4 (một module, không hạ tầng mới) mất **đúng** 2 tuần như kế hoạch | Nếu thật sự mất 3 tuần thì mọi ước lượng dưới đây thấp ~50 % |
| Không có sự cố hạ tầng (máy hết RAM, Neon/Render sự cố) | Đã xảy ra một lần ngày 2026-09-12 |
| DEV2 giao giao diện đúng hẹn | Backend phải tự dựng HTML thô để kiểm luồng |

**Khoảng ước lượng, không phải một con số:** backend **33–46 ngày-người** sau hai vòng review
cộng quyết định ba đường trích xuất CV, điểm giữa ~39. Bản trước ghi lúc 24 lúc 25 ở hai chỗ khác nhau —
đó cũng là dấu hiệu con số đơn lẻ không có cơ sở. Cách cộng ra ở mục 1.

**Và phần dời sang ngày 15–24 là ĐỀ XUẤT chờ Oxa quyết, chưa phải điều đã chốt.**
Mục tiêu đang bàn là đủ hai feature trong 2 tuần; plan này nói nó không vừa và đưa ra
một cách xếp, không tự thay đổi phạm vi.

---

## 1. Ước tính công, trước khi xếp lịch

Đơn vị: **ngày-người backend**, một ngày = một ngày làm việc thật của một dev đã
quen repo này (đã trừ họp, review, sửa CI). Đọc mục 0 trước về độ tin cậy của các số.

### Feature 1 — Chat AI + handoff

| Việc | Ngày | Ghi chú |
| --- | --- | --- |
| `packages/contracts` + ESLint chặn import + khung env | 0,5 | |
| `modules/ai`: provider, `HAS_REAL_KEY`, prompt có version | 1,0 | |
| Quota: bảng, SQL nguyên tử, unique một phần, circuit, job quét dọn | 2,0 | Phần khó nhất; ca đua phải test ở làn `vitest.db` |
| Tool layer sinh viên (7 tool) + gọn dữ liệu + test | 1,5 | |
| Tool layer NTD (3 tool) + test | 0,5 | Dùng lại khuôn của tool sinh viên |
| `chat.service`: phiên, `seq`, chống trùng, cắt lịch sử | 1,5 | |
| SSE endpoint + abort + telemetry | 1,5 | |
| Socket.IO: gateway, auth handshake, phòng, ACK, hết hạn token | 2,0 | |
| Handoff: máy trạng thái, 3 ca đua, hộp thư NTD, presence | 2,0 | |
| Tầng realtime fanout `uniwork.realtime` + `rt.<instanceId>` | 0,5 | |
| **Cộng backend** | **13,0** | |
| *(Frontend: chat UI, stream, nút chuyển, hộp thư NTD)* | *3,0* | *DEV2* |

### Feature 2 — Scan CV

| Việc | Ngày | Ghi chú |
| --- | --- | --- |
| Messaging: connection, topology, confirm, outbox + relay, consumer, retry/DLQ | 2,5 | Dùng chung với chat |
| Upload: sniff, đếm trang, phát hiện mật khẩu, hash, Cloudinary authenticated | 1,0 | |
| Bảng `cv_extractions` + migration + unique một phần | 0,5 | |
| `apps/worker`: khung, lease, hai chế độ chạy | 1,0 | |
| Gọi Cloudflare Workers AI + Zod + chuẩn hoá | 1,5 | Cộng rủi ro schema quá lớn phải tách hai lời gọi — [06](06-scan-cv.md) §3.4 |
| Ánh xạ kỹ năng bằng `unaccent` | 0,5 | |
| Tính khác biệt + API xác nhận + transaction gộp kỹ năng | 1,5 | |
| Bộ 20 CV vàng + script chấm | 1,5 | **Không cắt được.** Xem [06](06-scan-cv.md) §6.2 |
| **Cộng backend** | **10,0** | |
| *(Frontend: form upload, tiến trình, màn hình đối chiếu)* | *2,5* | *DEV2* |

### Xuyên suốt

| Việc | Ngày |
| --- | --- |
| Telemetry, log không PII, `/api/health/chi-tiet` | 1,0 |
| `docker-compose` RabbitMQ, script, sửa README (hai chỗ sai ở [README](README.md)) | 0,5 |
| Đo hạn mức thật ở AI Studio, viết `docs/gemini-quota-…md` | 0,5 |
| **Cộng** | **2,0** |

### Việc phát sinh từ review R01–R16 (2026-09-12)

Không nằm trong bản ước lượng đầu. Đây là công **thêm**, không phải công đã tính lại.

| Việc | Ngày | Phát hiện |
| --- | --- | --- |
| Tách `packages/messaging` + `packages/ai-runtime` khỏi `apps/api` | **1,5** | R09 |
| Rate limiter RPM/TPM dùng chung + circuit theo model + hai hàm ngày | **1,0** | R11 |
| `capNhatHoSoTrongTx` / `themKyNangTrongTx` ở `modules/profile` | **0,5** | R05 |
| `kiemPdf` bằng `pdf-lib`, timeout, ca lỗi | **0,5** | R12 |
| Bộ 40 câu hỏi có nhãn tay + script chấm hai trục | **1,0** | R14 |
| Tách `mappedData` / `khongCoDichLuu` + bảng ánh xạ + chọn học vấn chính | **0,5** | R13 |
| `mandatory` + xử lý `return` + `parked_messages` | **0,5** | R06 |
| Claim lease cho outbox | **0,5** | R08 |
| Tầng realtime fanout tách khỏi tầng nghiệp vụ | **0,5** | R10 |
| `ownerUserId` + `kind` + 4 CHECK + ma trận quyền đọc/ghi | **0,5** | R01, R02 |
| **DTO lược PII cho tool** — allow-list, `hoTenVietTat`, mã tham chiếu, lịch sử lưu bản đã lược, ca test canh | **1,0** | #1 |
| **`revision` + `apiSend`** — xem bảng tách riêng bên dưới | **1,0** | #15 |
| Cursor đục thay `tuSeq` (server + client + 6 ca test) | **0,5** | #11 |
| Đối soát định kỳ khi socket còn nối (backoff + jitter, 2 màn hình) | **0,5** | #12 |
| `POST …/chay-lai` + `runSeq` + `replay-parked` theo giao thức mới | **1,0** | #14 |
| Tách `main.ts`/`worker.ts`; sửa nhánh ACK lỗi lạ; `leaseExpiresAt=NULL` | **0,5** | #9, #10 |
| Hai pha reserve/finalize neuron; cộng tổng qua model; `ngayUTC` | **0,5** | #2 |
| **Ba đường trích xuất CV** (chốt 2026-09-13) — xem bảng tách riêng | **3,5** | quyết định của Oxa |
| **Cộng gộp** | **15,5** | 7,0 vòng 1 · 5,0 vòng 2 · 3,5 quyết định PDF |

#### Chi tiết mục ba đường trích xuất CV

Chốt 2026-09-13: hỗ trợ **cả ba** loại đầu vào, người dùng chỉ chọn file và bấm
Upload. Rasterize PDF scan chạy **ở trình duyệt** bằng PDF.js — xem
[06 §1, §2.2](06-scan-cv.md).

| Việc | Ai | Ngày |
| --- | --- | --- |
| PDF.js lazy-load, `getTextContent()` dò lớp text, render JPEG 1600px tuần tự, progress + huỷ | **DEV2** | 1,5 |
| Nhận multipart `{ goc, trangAnh[]?, rasterFailed? }`, kiểm khớp số trang, lưu Cloudinary | BE | 0,5 |
| Worker: N lời gọi vision tuần tự + ghép + khử trùng + `MAU_THUAN` | BE | 1,0 |
| Test: CV scan thật, CV lai, PDF.js hỏng, mục cắt qua ranh giới trang | BE | 0,5 |
| **Cộng** | | **3,5** (1,5 là DEV2) |

**Rủi ro riêng:** đây là mục duy nhất phụ thuộc **năng lực máy người dùng**. Điện
thoại tầm trung render 5 trang có thể chậm hoặc treo tab. Nhánh `rasterFailed` là
lưới, nhưng phải đo thật ở ngày 7 — xem mục "còn phải đo".

#### Chi tiết mục `revision` + `apiSend` — việc chạm code ĐANG CHẠY

Tách riêng vì đây là mục duy nhất trong toàn bộ plan **sửa endpoint và hook đã có người
dùng**, và bản trước không liệt kê phần frontend.

| Việc | File | Ngày |
| --- | --- | --- |
| Cột `StudentProfile.revision` + migration (backfill 0) | `prisma/schema.prisma` | 0,1 |
| `capNhatHoSoTrongTx` / `themKyNangTrongTx` CAS trên `revision` | [profile.service.ts](../../apps/api/src/modules/profile/profile.service.ts) | (đã tính ở dòng R05) |
| `updateStudentProfile` + **`replaceSkills`** nhận `revision`, trả 409 khi lệch | cùng file | 0,2 |
| `UpdateSkillsInput` + `UpdateStudentProfileInput` thêm `revision: number`; `StudentProfileResponse` + `MeResponse` **trả** `revision` | [packages/shared/src/api.ts](../../packages/shared/src/api.ts) | 0,1 |
| Zod: `updateSkillsSchema` + `studentProfileSchema` thêm `revision` **bắt buộc** | [validation.ts](../../packages/shared/src/validation.ts) | 0,1 |
| **`apiSend<TReq, TRes>`** cạnh `apiFetch` | [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts) | 0,2 |
| **Xoá `interface StudentProfileInput` cục bộ**, nhập từ shared; đổi `useUpdateSkills` + `useUpdateStudentProfile` sang `apiSend` | [useProfile.ts](../../apps/web/src/hooks/useProfile.ts) | 0,2 |
| `SkillPicker` và form hồ sơ truyền `revision` đang hiển thị; xử 409 = "tải lại" | `components/profile/` | 0,1 |
| Ca test: 409 khi lệch revision · ca canh "không khai lại kiểu cục bộ" | `useProfile.test.ts`, `profile.test.ts` | (trong 0,2 ở trên) |

**Rủi ro hồi quy:** `PUT /api/toi/ky-nang` và `PUT /api/toi/ho-so-sinh-vien` là hai
endpoint Sprint 1 đang chạy thật. Client cũ không gửi `revision` sẽ nhận **400** — đó
là **fail-closed có chủ ý**, nhưng nghĩa là **web và api phải deploy cùng lúc**. Trên
Render + Vercel thì hai bên deploy độc lập, nên có một cửa sổ vài phút lệch phiên bản.

Xử: thả trong **một** PR, và trong 24 giờ đầu chấp nhận `revision` thiếu **chỉ ở
`PUT /api/toi/ho-so-sinh-vien`** (đường ít rủi ro hơn) kèm log `warn` đếm số lần —
rồi siết lại. `PUT /api/toi/ky-nang` siết ngay, vì đó chính là đường gây lost update.

**Nếu thấy cửa sổ lệch phiên bản không chấp nhận được** thì chọn phương án B ở
[06](06-scan-cv.md) §9.2 — tuyên bố ghi-sau-thắng — và **xoá** mọi câu nói đã chống
lost update.

Một phần được bù lại: **bỏ ba queue retry TTL/DLX** (R03) tiết kiệm ~0,5 ngày,
**bỏ ánh xạ kỹ năng khỏi worker** (R09) ~0,25, và **bỏ Cloudflare Worker riêng** — gọi
REST `/ai/tomarkdown` thẳng (#5) ~0,5. Tổng bù **−1,25**, ròng **+10,75 ngày**.

### Tổng

| | Ngày-người |
| --- | --- |
| Backend, bản đầu | 25,0 (khoảng 22–30) |
| Cộng phát sinh từ review vòng 1 (R01–R16) | +6,25 |
| Cộng phát sinh từ review vòng 2 (#1–#15) | **+4,5** |
| Cộng quyết định ba đường trích xuất CV | **+3,5** |
| **Backend, sau hai vòng review + quyết định PDF** | **~38 (khoảng 33–46)** |
| Frontend | 5,5 + 1,0 + 0,5 + **1,5 (PDF.js)** = **8,5** |

**14 ngày lịch ≈ 13–14 ngày-người ⇒ đang xin ~290 % năng lực.**

Con số tiếp tục xấu đi qua từng vòng review, và điều đó **không phải dấu hiệu review
sai**. Nó là dấu hiệu bản ước lượng đầu dựa trên một thiết kế chưa chạy được. Mỗi vòng
đổi một phần "chưa biết là sai" thành "biết và đã sửa" — công thật không tăng, chỉ là
lần đầu nhìn thấy nó.

Với **hai** dev backend, 14 ngày ≈ 26–28 ngày-người — vẫn thiếu ~10. Cách xếp ở mục 3
và bảng 42 yêu cầu ở mục 3b vẫn đúng, nhưng **số mục phải dời sang G2 sẽ nhiều hơn 5**.
Đây là lúc cần Oxa quyết, không phải lúc tôi tự cắt.

**14 ngày lịch với một dev backend ≈ 13–14 ngày-người.** Thiếu **~26 ngày**, tức là
kế hoạch đang xin **~290 %** năng lực.

Con số này xấu đi so với bản đầu (180 %) **không phải vì phạm vi tăng** — phạm vi
giữ nguyên đúng hai feature. Nó xấu đi vì bản trước ước lượng trên một thiết kế có
sáu chỗ không chạy được, và sửa cho chạy được thì tốn thêm.

Với **hai** dev backend thì 14 ngày ≈ 26–28 ngày-người và vừa khít — nhưng
`docs/timeline-8-tuan.md` ghi nhóm có **DEV1 backend, DEV2 frontend, BA**. Một dev
backend. Và mục Rủi ro của chính tài liệu đó viết: *"Chỉ có 2 dev, một người nghỉ là
mất 50% năng lực."*

---

## 2. Nguyên nhân quá tải — bốn thứ, không phải một

| Nguyên nhân | Ngày | Có bỏ được không |
| --- | --- | --- |
| **RabbitMQ thay vì BullMQ** | ~+1,5 | Bỏ được. BullMQ có sẵn retry/backoff/dashboard; RabbitMQ phải tự dựng. **Đã chốt RabbitMQ**, ghi ở đây để biết cái giá |
| **Socket.IO là hạ tầng hoàn toàn mới** trong repo — README §2 từng loại nó | ~4,0 | Không. Handoff cần realtime |
| **Quota nguyên tử làm đúng** (giữ/dùng/hoàn, project budget, circuit) | ~2,0 | Không. Làm sai thì hết quota giữa buổi demo |
| **Hai feature cùng lúc**, mỗi cái đủ một sprint theo thời lượng KẾ HOẠCH của sprint trước | — | Không, đề bài yêu cầu cả hai |

Không có nguyên nhân nào là "làm chậm". Chúng là khối lượng thật.

---

## 3. Cách sắp xếp: một vòng dọc trước, bề mặt sau

**Không cắt yêu cầu nào.** Cắt theo **chiều ngang** (bề mặt), không theo chiều dọc
(luồng). Ngày 14 phải demo được:

- Sinh viên hỏi AI → AI gọi tool → trả lời có dẫn nguồn dữ liệu thật
- Hết lượt → thông báo đúng, vẫn tìm việc được
- Bấm "nhắn NTD" → NTD nhận thông báo → tiếp nhận → hai bên chat thật
- Tải CV lên → RabbitMQ → worker → Gemini → màn hình đối chiếu → xác nhận → hồ sơ đổi

Bốn luồng đó **đi hết**, không có khúc nào là giả.

Thứ **chuyển sang giai đoạn 2** (ngày 15–24), kèm lý do:

| Chuyển gì | Vì sao chuyển được | Ngày |
| --- | --- | --- |
| ~~Trợ lý cho vai NTD~~ | **ĐÃ ĐƯA VỀ G1** sau R01: schema cũ không cho NTD tự dùng trợ lý được, nên sửa schema là phải làm ngay; sửa xong thì 3 tool NTD chỉ còn 0,5 ngày. Xem mục 3b dòng #3 | — |
| **Chạy thử fanout với 2 instance thật** | Render free chạy **một** instance, chưa có nhu cầu. **Thiết kế và code fanout `rt.<id>` vẫn nằm trong G1** ([02](02-messaging-rabbitmq.md) 1.3) — chỉ hoãn phần dựng 2 process để kiểm | 0,5 |
| **`UserPresence`** | Chỉ dùng để quyết định gửi email hay không. Giai đoạn 1: **luôn** gửi email khi chuyển, kèm chống trùng 1 email/giờ/phiên | 0,5 |
| **Nút "quay lại AI"** (transition E) | Bốn transition kia là bộ khung tối thiểu. E là tiện ích | 0,5 |
| **Kiểm trích dẫn** (`kiemTrichDan`) | Cần trích text từ PDF. Bộ CV vàng đã đo được recall — đây chỉ là tín hiệu tự động thêm | 1,0 |
| **Phương án B hai lần gọi** cho schema | Chỉ làm **nếu** thử nghiệm ngày 1 cho thấy cần | 1,0 |
| **`unmappedContent` gán tay vào trường** | Giai đoạn 1 chỉ hiện để đọc. Gán tay là tiện ích | 1,0 (FE) |
| **Job dọn** (outbox, processed, file 30 ngày) | Không cần trong 2 tuần đầu. Nhưng **phải làm trước khi có người dùng thật** | 0,5 |
| **`/api/health/chi-tiet` đầy đủ** | Giai đoạn 1 chỉ cần `outbox.choDay` và `parked` | 0,5 |

Cộng giai đoạn 2: **~6 ngày** backend + 1 ngày frontend. Vẫn còn ~5 ngày chênh so với
ước tính 25 — phần chênh đó nằm ở việc **giai đoạn 1 sẽ chạy quá giờ**, và đó là điều
phải nói trước chứ không phải phát hiện vào ngày 13.

---

## 3b. Từng yêu cầu giao ngày nào, ai làm, nghiệm thu bằng gì (R15)

R15 yêu cầu liệt kê rõ thay vì chỉ nói tổng. **G1** = trong 14 ngày; **G2** = đề xuất
dời, **chờ Oxa quyết**.

| # | Yêu cầu trong đề bài | Giai đoạn | Ngày | Ai | Nghiệm thu |
| --- | --- | --- | --- | --- | --- |
| 1 | SV hỏi đáp, tra cứu việc bằng ngôn ngữ tự nhiên | **G1** | 10–11 | BE+FE | Hỏi "việc pha chế Cầu Giấy" → tool chạy → trả lời dẫn tin thật |
| 2 | Tìm việc theo lịch rảnh qua chat | **G1** | 10 | BE | Tool `timViecLam` với `matchAvailability` trả đúng tập của `listPublicJobs` |
| 3 | **NTD hỏi đáp về dữ liệu tuyển dụng của mình** | **G1** | 10 | BE | Phiên `AI_EMPLOYER` tạo được, 3 tool NTD chạy, tài khoản khác đọc → 403 |
| 4 | Phân loại 6 nhóm câu hỏi | **G1** | 10, 13 | BE | Bộ 40 câu nhãn tay: ≥80 % đúng nhóm, 100 % có căn cứ |
| 5 | Nút nhắn NTD bất kỳ lúc nào khi đã xác định việc | **G1** | 13 | BE+FE | Nút hiện khi có `jobId`; AI không tự gửi |
| 6 | 4 trạng thái + 5 transition | **G1** | 13 | BE | 3 ca đua ở làn `vitest.db` |
| 7 | AI không chen vào khi đang chờ/chat người thật | **G1** | 11, 13 | BE | `/tro-ly/hoi` trả 409 khi `state != AI_ACTIVE` |
| 8 | AI đang stream mà chuyển → bỏ câu trả lời | **G1** | 13 | BE | Ca đua ở `vitest.db`, `errorCode='HANDOFF_DISCARDED'` |
| 9 | NTD offline: lưu tin, nhận lại khi online | **G1** | 12–13 | BE | Tắt socket NTD, gửi 3 tin, bật lại → đủ 3 |
| 10 | Chỉ chuyển ngữ cảnh liên quan | **G1** | 13 | BE | Test hình dạng `where`: có `visibleToEmployer` và `seq >= mốc` |
| 11 | Server kiểm quyền vào phòng/đọc/gửi | **G1** | 12 | BE | Ma trận [03](03-chatbot-va-tool.md) 6.2c, đủ 4 dòng |
| 12 | ID tin, xác nhận lưu, chống trùng, tải bù | **G1** | 11–12 | BE | ACK sau commit; gửi lại cùng `clientMessageId` → 200 tin cũ |
| 13 | Không mất sự kiện khi DB xong mà phát lỗi | **G1** | 5 | BE | Outbox + `mandatory` + claim lease |
| 14 | Quota 5 lượt/ngày cấu hình được | **G1** | 2–3 | BE | 6 request song song, hạn mức 5 → đúng 5 |
| 15 | Một yêu cầu AI đang xử lý mỗi tài khoản | **G1** | 2 | BE | Unique một phần, `vitest.db` |
| 16 | Theo dõi riêng lượt/request/token/vòng tool | **G1** | 3 | BE | 4 bảng, `requests` chỉ tăng ở `xinPhepGoiModel` |
| 17 | Quota tổng theo project/model, chung với scan | **G1** | 3 | BE | Trần 2 request → request thứ 3 bị chặn dù còn lượt |
| 18 | Hết free quota / 429 → giảm tải, không tự chuyển paid | **G1** | 3 | BE | Circuit theo model, 3 loại lỗi; chỉ một khoá trong env |
| 19 | Upload ảnh/PDF, Gemini đọc trực tiếp | **G1** | 7–8 | BE | Một CV giả đi hết `QUEUED → NEEDS_REVIEW` |
| 20 | Schema Zod, 4 nhóm dữ liệu | **G1** | 8 | BE | 5 nhóm sau R13, khớp bảng ánh xạ 3.1b |
| 21 | Tách kỹ năng ghi rõ / suy ra | **G1** | 8 | BE | Hai mảng riêng; nhóm suy ra không tick sẵn |
| 22 | Giữ nguồn trang/trích dẫn | **G1** | 8 | BE | `nguon.trang` có; không có bounding box |
| 23 | Phát hiện bỏ sót | **G1** | 8, 13 | BE | 3 tín hiệu bao phủ + bộ 20 CV vàng |
| 24 | Bản nháp tách hồ sơ, hiện khác biệt, không đè ngầm | **G1** | 9 | BE+FE | `KHAC` không tick sẵn; CAS `updatedAt` |
| 25 | Backend mapping + transaction; model không ghi DB | **G1** | 9 | BE | Một transaction 5 bước; ép lỗi giữa chừng → rollback hết |
| 26 | Schema/model/prompt version + lịch sử | **G1** | 8 | BE | 4 cột version trên `cv_extractions` |
| 27 | 5 trạng thái job, retry giới hạn, phục hồi sau restart | **G1** | 6, 8 | BE | `docker kill` worker → message quay lại, lease hết → xử lại |
| 28 | Chống trùng theo chủ/hash/pipeline | **G1** | 7 | BE | Nộp lại cùng file → không tạo job mới |
| 29 | Không tái dùng kết quả giữa người dùng | **G1** | 7 | BE | A và B cùng file → hai hàng, hai lần gọi model |
| 30 | Tiến trình realtime + API lấy trạng thái | **G1** | 9, 12 | BE+FE | Tắt socket → polling `GET :id` vẫn đúng |
| 31 | Kiểm loại file thật, file hỏng, PDF mật khẩu, không phải CV | **G1** | 7 | BE | `kiemPdf`; file bị chặn **không** sinh request tới Gemini |
| 32 | Nội dung CV là dữ liệu, không phải lệnh | **G1** | 8, 13 | BE | 2 ca injection trong bộ 20 CV vàng |
| 33 | RabbitMQ: exchange/rk/queue/retry/DLQ | **G1** | 4–6 | BE | Topology mục 1 dựng đủ; retry qua outbox đúng 3 bậc |
| 34 | Manual ACK, publisher confirms, prefetch, idempotency | **G1** | 4–6 | BE | Test hình dạng `nack(_,_,false)`; `mandatory` + `return` |
| 35 | Outbox + message contract có version | **G1** | 1, 5 | BE | `v: 99` → `parked_messages`, `handle` không chạy |
| 36 | Messaging cho scan **và** sự kiện chat/handoff | **G1** | 5, 13 | BE | `uniwork.chat` + `uniwork.notifications` có consumer thật |
| 37 | Nhiều instance Socket.IO và worker | **G1** thiết kế / **G2** chạy thử | 12 / — | BE | Fanout `rt.<id>` dựng ở G1; chạy 2 instance thật ở G2 |
| 38 | Áp outbox cho luồng nộp đơn | **G2** | — | BE | [02](02-messaging-rabbitmq.md) 1.4 — sau ngày 6, rủi ro hồi quy |
| 39 | `unmappedContent` gán tay vào trường | **G2** | — | FE | G1 chỉ hiện để đọc |
| 40 | Kiểm trích dẫn tự động | **G2** | — | BE | G1 dùng 3 tín hiệu bao phủ |
| 41 | Job dọn (outbox, processed, file 30 ngày) | **G2** | — | BE | **Phải xong trước người dùng thật**, không phải trước demo |
| 42 | Tách Document Service sở hữu DB riêng (nấc 2) | **G2** | — | BE | G1 dựng seam bằng package + ESLint |

**37 trên 42 yêu cầu nằm trong G1.** Năm mục G2: một là tiện ích (39), một là tín hiệu
bổ sung (40), một là nợ vận hành có hạn chót riêng (41), một là mở rộng ngoài phạm vi
hai feature (38), một là lộ trình dài (42). **Không mục nào là chức năng cốt lõi của
hai feature.**

## 4. Lịch 14 ngày

Ký hiệu: **BE** = dev backend · **FE** = DEV2 · **⚑** = cổng quyết định, không đạt
thì dừng lại xử lý chứ không đi tiếp.

### Tuần 1 — nền và một vòng dọc của scan CV

| Ngày | BE | FE | Nghiệm thu |
| --- | --- | --- | --- |
| **1** | ⚑ Đo hạn mức thật ở AI Studio (RPM/TPM/**RPD**, và **có tách theo model không**), viết `docs/gemini-quota-<ngày>.md`. ⚑ Chạy `thu-schema.ts`: gửi 1 CV giả với schema đầy đủ, xem Gemini nhận hay từ chối. Tạo `packages/contracts`. | Khảo sát UI chat + màn hình đối chiếu | **⚑ Có con số hạn mức thật + ảnh chụp. ⚑ Biết schema đầy đủ dùng được hay phải sang phương án B** |
| **1b** | Tách `packages/messaging` + `packages/ai-runtime` khỏi `apps/api` (R09). Tạo `apps/worker` rỗng. **Rồi mới** bật rule ESLint cấm import. Thêm biến env | — | `pnpm typecheck` xanh; `apps/worker` build được mà không import `apps/api` |
| **2** | Bảng quota (`AiUsageDay`, `AiTurn`, `AiRequestLog`, `AiProjectBudgetDay`, `AiCircuit`) + migration + unique một phần | Khung trang trợ lý | Test làn `vitest.db`: 6 request song song trên hạn mức 5 → đúng 5 qua. Lượt thứ hai khi chưa settle → `P2002` |
| **3** | `giuLuot` / `chotLuot` / hoàn lượt + circuit + job quét `RESERVED` treo | Component tin nhắn | Bảng hoàn lượt ở [05](05-quota-dung-chung.md) 3.3 có test cho **từng** dòng |
| **4** | `docker compose --profile mq up`. `messaging/`: connection, topology, confirm channel, publisher | — | Management UI thấy đủ 6 queue và binding. Publish thử, message tới nơi |
| **5** | Outbox: bảng, `ghiOutbox`, relay + `SKIP LOCKED` + backoff. `processed_messages` | Form upload CV | Ép transaction rollback sau `ghiOutbox` → không có hàng nào. Ép confirm lỗi → `publishedAt` vẫn null |
| **6** | `consumer.ts`: manual ack, prefetch, phân loại lỗi, retry 3 bậc, park. Bảng `cv_extractions` | Màn hình tiến trình | **Local thật:** chặn Gemini, xem message đi retry.1 → .2 → .3 → parked trên UI |
| **7** | Upload: sniff, `demTrangPdf`, `pdfCoMatKhau`, hash, Cloudinary authenticated, `POST /api/toi/quet-cv` | — | 6 ca âm trả đúng 6 thông điệp khác nhau. Nộp lại cùng file → không tạo job mới |

**Cổng cuối tuần 1:** upload một CV → hàng `cv_extractions` ở `QUEUED` → message có
mặt trong `cv.scan.q` trên Management UI. Worker chưa cần chạy.

### Tuần 2 — worker, chat, handoff

| Ngày | BE | FE | Nghiệm thu |
| --- | --- | --- | --- |
| **8** | `apps/worker`: khung, hai chế độ chạy, lease + CAS, gọi Gemini + `Output.object` + Zod | — | Một CV giả đi hết: `QUEUED` → `PROCESSING` → `NEEDS_REVIEW`, `result` là JSON hợp lệ |
| **9** | Ánh xạ kỹ năng `unaccent`, tính `coverage`, tính khác biệt, `POST …/xac-nhan` (transaction, **gộp** kỹ năng) | Màn hình đối chiếu | Xác nhận → hồ sơ đổi đúng. **Kỹ năng cũ không bị xoá.** Xác nhận lần hai → 409 |
| **10** | `modules/ai`: provider, prompt sinh viên, `ai.runner` + `stopWhen` + abort. 7 tool sinh viên | Ô chat + stream | Tool set test đủ: mỗi tool 1 ca dương, 1 ca rỗng, 1 ca sai quyền |
| **11** | SSE `POST /api/tro-ly/hoi` + `GET …/luot-con-lai`. `chat.service`: phiên, `seq`, chống trùng | Nhận SSE, render dần | Hỏi "có việc pha chế ở Cầu Giấy không" → tool chạy → câu trả lời dẫn tin thật |
| **12** | Socket.IO: gateway, auth, phòng, ACK, hết hạn token, tải bù | Kết nối WS | Mở 2 tab, gửi từ tab A → tab B thấy. Ngắt mạng 30 giây → nối lại → tải bù đủ |
| **13** | Handoff: 5 transition, 3 ca đua, hộp thư NTD, thông báo + email. Bộ 20 CV vàng + script chấm. **Bộ 40 câu hỏi nhãn tay + script chấm hai trục (R14)** | Nút chuyển + hộp thư NTD | ⚑ Ca đua ở `vitest.db` đều xanh. ⚑ Bộ CV vàng: **tỉ lệ bịa = 0**, recall `caNhan`+`hocVan` ≥ 0,8. ⚑ Bộ 40 câu: ≥80 % đúng nhóm, **100 % có căn cứ**, 100 % an toàn |
| **14** | Chạy 5 đột biến ([08](08-kiem-thu.md) mục 6). Sửa README hai chỗ sai. Kiểm bằng dữ liệu thật | Đánh bóng, responsive | ⚑ `pnpm lint && pnpm typecheck && pnpm test` — **kiểm bằng `echo $?`**. Đủ 4 luồng demo |

---

## 5. Phụ thuộc — cái gì chặn cái gì

```
ngày 1  contracts + env
   │
   ├──► ngày 2–3  quota ──────────────┬──► ngày 10–11  chat AI
   │                                   │
   └──► ngày 4–6  messaging ───┬──► ngày 8–9  worker + xác nhận
                                │
        ngày 7  upload ─────────┘

        ngày 12  Socket.IO ──► ngày 13  handoff
```

| Chặn cứng | Vì sao |
| --- | --- |
| 1 → mọi thứ | Không có `contracts` thì worker sẽ import thẳng của api và seam mất |
| 2–3 → 10 và 8 | Cả chat lẫn scan đều giữ lượt trước khi gọi model |
| 4–5 → 6 | Không có outbox thì consumer không có gì để tiêu thụ |
| 6 → 8 | Worker cần khung consumer |
| 12 → 13 | Handoff cần phòng và ACK |

**Chạy song song được nếu có hai người:** nhánh `messaging → worker` (ngày 4–9) và
nhánh `quota → chat` (ngày 2–3, 10–11) chỉ gặp nhau ở `contracts` và bảng outbox.

---

## 6. Bốn cổng quyết định

Mỗi cổng có một **hành động cụ thể** nếu không đạt. Không cổng nào là "cố thêm chút".

### ⚑ Cổng 1 — cuối ngày 1: hạn mức thật

**Đạt khi:** có ảnh chụp AI Studio và `docs/gemini-quota-<ngày>.md` ghi RPM/TPM/RPD
thật cho `AI_CHAT_MODEL` và `AI_SCAN_MODEL`.

**Không đạt** (không truy cập được, hoặc RPD < 100): dừng lại nửa ngày quyết định.
RPD quá thấp thì 5 lượt/ngày × 20 người là không khả thi, và phải hạ xuống 2 lượt
hoặc chuyển `AI_CHAT_MODEL` sang bản Flash-Lite có hạn mức rộng hơn. **Quyết định này
phải ra trước khi viết dòng code quota nào**, vì nó đổi con số mặc định.

### ⚑ Cổng 2 — cuối ngày 1: schema có được nhận không

**Đạt khi:** Gemini nhận schema đầy đủ và trả về JSON hợp lệ cho một CV giả.

**Không đạt:** cộng ngay **1 ngày** cho phương án B (hai lần gọi), và **rút** một mục
từ giai đoạn 1 sang giai đoạn 2 — đề xuất rút "nút quay lại AI". Không âm thầm nuốt
thêm một ngày vào lịch đã chật.

### ⚑ Cổng 3 — cuối ngày 7: một vòng dọc của scan

**Đạt khi:** upload → hàng `QUEUED` → message thấy được trên Management UI.

**Không đạt:** vấn đề nằm ở tầng messaging, và nó chặn ngày 8–9. Dừng chat lại, dồn
người vào đây. Chat trễ hai ngày còn cứu được; messaging hỏng thì cả feature 2 hỏng.

### ⚑ Cổng 4 — cuối ngày 13: chất lượng trích xuất

**Đạt khi:** bộ 20 CV vàng cho **tỉ lệ bịa = 0** và recall `caNhan`+`hocVan` ≥ 0,8.

**Tỉ lệ bịa > 0:** **không phát hành feature 2**, dù mọi thứ khác xanh. Một hệ thống
điền sai tên trường vào hồ sơ rồi tính `matchScore` trên đó là tệ hơn không có gì.
Sửa prompt (siết quy tắc 1 và 2), chạy lại. Vẫn > 0 thì phát hành ở chế độ
**"chỉ hiện, không tick sẵn ô nào"** — người dùng phải tự tick từng trường.

**Recall < 0,8 nhưng bịa = 0:** phát hành được, kèm câu trên màn hình:
*"Trợ lý đọc được một phần. Bạn kiểm và bổ sung giúp."*

---

## 7. Rủi ro lịch, và phản ứng

| Rủi ro | Dấu hiệu sớm | Phản ứng |
| --- | --- | --- |
| Ngày 2–3 quota tràn giờ | Cuối ngày 3 test ca đua chưa xanh | Đây là phần **không được làm ẩu**. Lấy giờ từ ngày 13 (bộ CV vàng lùi sang giai đoạn 2) — nhưng khi đó **feature 2 không được phát hành**, chỉ chạy nội bộ |
| Socket.IO ngày 12 tràn | Cuối ngày 12 chưa gửi được tin giữa hai tab | Bỏ Socket.IO ở giai đoạn 1, dùng **polling 3 giây** cho chat người thật. Handoff vẫn chạy đủ, chỉ kém mượt. Rẻ hơn nhiều so với cắt handoff |
| Gemini đổi model / đổi hạn mức giữa chừng | 429 hàng loạt, hoặc lỗi model không tồn tại | Đã có `AI_CHAT_MODEL`/`AI_SCAN_MODEL` là biến. Đổi một biến, deploy lại |
| Máy dev hết RAM | Docker sập, `Prisma kind: Closed` | Chạy chẩn đoán trong `docs/moi-truong-may-dev.md` **trước khi đổ lỗi cho code**. Đã mất một buổi vì bỏ qua bước này |
| DEV2 trễ màn hình đối chiếu | Cuối ngày 11 chưa có khung | Backend làm một trang HTML thô để kiểm luồng. Không chờ |
| Một người nghỉ | — | `docs/timeline-8-tuan.md` đã ghi: mất 50% năng lực. Với lịch đang ở ~290 % thì **phải cắt sang giai đoạn 2 ngay**, không chờ tới ngày 13 |

---

## 8. Nghiệm thu từng giai đoạn

### Cuối tuần 1

| Phải chứng minh được | Cách |
| --- | --- |
| Quota nguyên tử | Test `vitest.db`: 6 request song song, hạn mức 5 → đúng 5 |
| Hoàn lượt đúng | Bảng ở [05](05-quota-dung-chung.md) 3.3, mỗi dòng một test |
| Outbox không mất, không ma | Rollback sau `ghiOutbox` → 0 hàng; confirm lỗi → `publishedAt` null |
| Retry đúng bậc | Management UI, ghi lại mốc thời gian từng bậc |
| 6 ca âm của upload | 6 thông điệp khác nhau, 6 lần `curl` thật |
| Không rò PII vào log | `grep -cE "0[0-9]{9}|@" <log>` → **0** |

### Cuối tuần 2

| Phải chứng minh được | Cách |
| --- | --- |
| Bốn luồng demo đi hết | Quay màn hình, mỗi luồng một lượt |
| Ca đua handoff | 3 ca ở làn `vitest.db` |
| Reconnect không mất, không trùng | Ngắt mạng 30 giây giữa lúc gửi 3 tin → đủ 3, không có tin nào đôi |
| Cách ly dữ liệu người dùng | Người B gọi `GET /api/toi/quet-cv/<id của A>` → **403**, không phải 404, không phải mảng rỗng |
| Chất lượng trích xuất | Bộ 20 CV vàng, ba con số ghi vào `docs/` |
| Test có canh gác | 5 đột biến ở [08](08-kiem-thu.md) mục 6, mỗi cái làm đỏ đúng ca |
| CI xanh | `pnpm lint && pnpm typecheck && pnpm test` — kiểm bằng `echo $?`, **không** `| grep` |

---

## 9. Nói thẳng: ngày 14 sẽ chưa xong cái gì

Để không ai bất ngờ:

- **Trợ lý cho NTD chưa có.** Chỉ vai sinh viên.
- **Chạy nhiều instance chưa kiểm được.** Thiết kế có, chưa chạy thử.
- **Kiểm trích dẫn tự động chưa có.** Chỉ có ba tín hiệu bao phủ ở
  [06](06-scan-cv.md) §6.1.
- **`unmappedContent` chỉ đọc**, chưa gán tay được.
- **Job dọn chưa có** — outbox, `processed_messages`, và file Cloudinary sẽ tích lại.
  **Phải làm trước khi có người dùng thật**, không phải trước khi demo.
- **Chưa nhận CV thật.** Không phải vì chưa xong, mà vì điều khoản free tier cấm —
  xem [00](00-khao-sat.md) C.3 và [09](09-phan-bien.md) mục 1.

Bốn cái đầu là chuyện thời gian. Cái thứ năm là nợ vận hành. **Cái cuối là điều kiện
pháp lý, và nó không tự hết khi code xong.**
