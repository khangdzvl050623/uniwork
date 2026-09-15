# 09 — Phản biện: chỗ nào chưa hợp lý, rủi ro, cái gì phải đo

**Trả lời đầu ra 9.**

Xếp theo mức độ: mục 1–3 là thứ đổi được quyết định; 4 là thứ không được đoán; 5–9 là
đề xuất cải thiện trong đúng phạm vi hai feature.

---

> **ĐÃ GIẢI QUYẾT 2026-09-13 — đọc trước khi đọc mục 1.**
>
> Mục 1 dưới đây mô tả blocker lớn nhất của cả kế hoạch: điều khoản Gemini free tier
> cấm gửi thông tin cá nhân, mà CV thì 100 % là thông tin cá nhân.
>
> **Blocker đó đã được gỡ bằng cách đổi provider cho scan CV sang Cloudflare Workers
> AI** ([06](06-scan-cv.md) §12), nơi điều khoản ghi *"Unless otherwise agreed,
> Cloudflare does not use any Customer Content to train generative AI tools"*.
>
> Ba hệ quả:
> - **Rủi ro #3 ở mục 5 biến mất.** Không cần bật billing trước khi nhận CV thật.
> - **Không còn cần CV giả.** Bộ CV vàng dùng **CV thật** — [06](06-scan-cv.md) §6.2.
> - **Mục 1 vẫn còn hiệu lực MỘT PHẦN cho CHAT**, vì chat vẫn ở Gemini. Sinh viên
>   gõ tên và số điện thoại vào ô chat thì câu đó vẫn đi qua đường Unpaid. Mức độ
>   thấp hơn CV rất nhiều và xử lý được bằng một dòng cảnh báo trên giao diện —
>   nhưng **không phải bằng không**, xem 1b.
>
> Giữ nguyên mục 1 bên dưới làm hồ sơ quyết định: nó là lý do đổi provider.

### 1b. Phần còn lại: chat vẫn ở Gemini, và có HAI đường PII chứ không một

> **Sửa 2026-09-13 theo review #1.** Bản trước của mục này viết PII trong chat *"do
> người dùng chủ động gõ"*. **Sai, và sai theo hướng nguy hiểm** — nó bỏ sót đường
> lớn hơn.

| Đường | Ai đưa vào | Che bằng cảnh báo được? |
| --- | --- | --- |
| **A. Người dùng gõ** | Sinh viên tự gõ tên, sđt | Được, một phần |
| **B. Tool đọc từ database** | **Hệ thống**, không ai gõ gì | **Không.** Cảnh báo không chạm tới |

Đường B là đường lớn hơn, và nó ba nhánh:

- `xemHoSoCuaToi` trả `StudentProfileResponse` — bản trước **chỉ bỏ `cvUrl`**, còn
  `fullName` và `phone` vẫn đi thẳng vào ngữ cảnh Gemini.
- `xemDonUngTuyenCuaToi` trả `contact { contactName, phone, email }` của NTD khi đơn
  đã mở khoá.
- `xemUngVien` (vai NTD) trả **`phone` + `email` của từng sinh viên** khi đơn ở
  `SHORTLISTED`/`ACCEPTED`.

Ba nhánh đó đi qua đúng quyền, đúng luật `TRANG_THAI_MO_LIEN_HE`, và **vẫn là gửi
thông tin cá nhân sang một dịch vụ mà điều khoản cấm gửi**. Ít người test không đổi
được điều kiện đó — đây là điều khoản, không phải hạn mức.

**Sửa, và nó là thay đổi thiết kế chứ không phải một dòng cảnh báo:**

1. **Hai đường dữ liệu tách hẳn** — DTO cho model đã lược, DTO cho giao diện đầy đủ và
   **không đi qua model**. Model chỉ cầm mã tham chiếu (`ung-vien:3`). Đặc tả đầy đủ,
   kèm allow-list và ca test canh, ở [03](03-chatbot-va-tool.md) §3.2b.
2. **Lịch sử hội thoại lưu bản đã lược**, không lưu bản đầy đủ — nếu không thì PII
   quay lại ở vòng tool thứ hai.
3. Một dòng dưới ô chat cho **đường A**: *"Đừng gõ số điện thoại hay địa chỉ vào đây —
   muốn trao đổi riêng thì bấm nhắn nhà tuyển dụng."* Nó cũng đẩy người dùng về đúng
   luồng handoff.
4. **Không** log nội dung tin nhắn (§6.1) — đã có trong plan.
5. Nếu sau khi làm 1–3 vẫn còn nhánh phải gửi PII, chuyển **riêng nhánh đó** sang
   Cloudflare Workers AI. Cái mất là chất lượng function calling; đo bằng bộ 40 câu
   ([03](03-chatbot-va-tool.md) §2.2b) rồi hãy quyết, đừng đoán.

Việc 1 và 2 là **bắt buộc trước khi có người dùng thật**, ngang hàng với việc đã làm
cho CV — không phải "nên làm".

---

## 1. Mâu thuẫn cứng: "chi phí API bằng 0" và "nhận CV thật" loại trừ nhau

Đây là điểm nghiêm trọng nhất của cả đề bài, và nó không phải chuyện kỹ thuật.

**ĐỌC ĐƯỢC**, [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms),
cập nhật 2026-04-28, mục Unpaid Services:

> "Google uses the content you submit to the Services and any generated responses to
> provide, improve, and develop Google products"
>
> "Human reviewers may read, annotate, and process your API input and output."
>
> "**Do not submit sensitive, confidential, or personal information to the Unpaid Services.**"

CV chứa họ tên, số điện thoại, email, địa chỉ, trường, nơi làm việc cũ. Đó **đúng
định nghĩa** của thứ điều khoản cấm gửi. Không phải "nên cân nhắc" — là "đừng gửi".

Với chat thì nhẹ hơn nhưng cùng loại: sinh viên gõ *"em tên Nam, đang học BKHN năm 3,
số em là 09…"* thì câu đó cũng đi qua đường Unpaid.

### Vì sao không xử được bằng kỹ thuật

Có thể nghĩ tới: che PII trước khi gửi. Không dùng được cho scan CV — **cả tài liệu
là PII**, và mục đích của tính năng chính là đọc nó. Che xong thì không còn gì để đọc.

### Ba phương án, và đề xuất

| | Nội dung | Chi phí | Đánh giá |
| --- | --- | --- | --- |
| **A** | Giai đoạn test chỉ dùng CV giả; **bật billing trước khi có người dùng thật** | Vài USD/tháng ở quy mô này ([01](01-kien-truc-va-ranh-gioi.md) 8.4) | **Đề xuất.** Rẻ, đúng điều khoản, không đổi dòng code nào |
| B | Giữ free tier, có màn hình cảnh báo rõ, người dùng tự chọn | 0 đồng | Vẫn ngược với *"do not submit"*. Và sinh viên không đọc cảnh báo |
| C | Bỏ scan CV, chỉ giữ chat | 0 đồng | Mất một nửa đề bài |

**Đề xuất A, và quyết định phải ra ở tuần 1, không phải ngày phát hành.** Nó đổi
`docs/` và màn hình đồng ý, không đổi kiến trúc — chậm mà không mất gì.

**Điều phải nói rõ:** "Gemini có free tier" là đúng. "Vậy nên chi phí bằng 0" là sai
theo hai đường khác nhau — đường điều khoản (mục này) và đường hosting
([01](01-kien-truc-va-ranh-gioi.md) 8.4: Render trả phí 7 USD/service, và
`WORKER_INLINE=true` chỉ hoãn chứ không xoá khoản đó).

---

## 2. Chưa hợp lý: "5 lượt/ngày" là một con số chưa có căn cứ

Đề bài đặt 5 lượt/tài khoản/ngày. Con số đó nói về **lượt người dùng**. Hạn mức của
Google áp lên **request và token** ([05](05-quota-dung-chung.md) mục 1).

Một lượt = 1 đến 5 request (tool calling). Nên:

```
20 người × 5 lượt × trung bình 3 request = 300 request/ngày
```

Và **không ai trong nhóm biết trần thật là bao nhiêu**, vì trang rate-limits chính
thức đã bỏ bảng số và chỉ sang AI Studio ([00](00-khao-sat.md) C.2).

**Ba khả năng, ba hành động khác nhau:**

| Trần thật (RPD) | Hành động |
| --- | --- |
| ≥ 1000 | 5 lượt/ngày thoải mái. Giữ nguyên |
| 200–1000 | Vừa khít. Cần trần project (`AI_PROJECT_REQUESTS_PER_DAY`) làm thật, không chỉ khai |
| < 200 | **5 lượt là không khả thi.** Hạ xuống 2–3, hoặc đổi sang model Flash-Lite hạn mức rộng hơn |

Đây là cổng quyết định ngày 1 ([07](07-lo-trinh-14-ngay.md) cổng 1). Viết xong tầng
quota rồi mới phát hiện trần là 100 RPD thì phải đổi cả con số mặc định lẫn thông điệp
người dùng.

**Cải thiện đề xuất:** thêm **hạn mức theo giờ** bên cạnh hạn mức theo ngày — ví dụ
tối đa 2 lượt/giờ/tài khoản. Nó ngăn 20 người cùng dùng hết 5 lượt trong 10 phút buổi
tối và chạm RPM (chứ không phải RPD). Chi phí: một cột nữa trong `AiUsageDay`, ~2 giờ.

---

## 3. RabbitMQ: chi phí có thật, và README gốc đang nói ngược

Chi phí: **+1,5 đến 2 ngày** so với BullMQ ([01](01-kien-truc-va-ranh-gioi.md) 7.2),
trên một lịch đã ở **~290 %** năng lực ([07](07-lo-trinh-14-ngay.md) mục 1). Con số đó
đã nằm trong ước lượng, không phải chi phí ẩn — nhưng nó là con số thật.

**Bốn nhu cầu kỹ thuật mà nó phục vụ**, để lúc bị hỏi "sao không dùng bảng Postgres":

1. Trích xuất CV mất 20–40 giây. Không giữ được trong request handler trên instance
   512 MB, và mất trắng nếu Render ngủ giữa chừng.
2. Việc phải sống sót qua lúc service ngủ — queue làm điều đó theo bản chất.
3. Retry có backoff + dead-letter cho một nhà cung cấp bên ngoài hay hỏng.
4. **Hai kiểu tiêu thụ khác nhau trên cùng một sự kiện**: nghiệp vụ chạy đúng một lần
   (queue dùng chung), realtime chạy một lần mỗi instance (fanout). Đây là chỗ exchange
   hơn hẳn một bảng hàng đợi — với bảng thì phải tự viết cả hai cơ chế.

Điểm 4 chỉ xuất hiện sau khi review vòng 2 chỉ ra lỗi routing realtime (#10). Nó không
có trong lập luận ban đầu, và nó là lý do kỹ thuật mạnh nhất trong bốn cái.

**README §2 của repo đang nói ngược**, hai vế:

| README viết | Thực tế |
| --- | --- |
| *"không có tầng free tier thực dụng cho message broker"* | **Sai** — CloudAMQP Little Lemur free có tồn tại |
| *"hệ thống này không có bài toán mà nó giải"* | **Đã hết đúng** kể từ khi có hai feature này — xem bốn điểm trên |

Phải sửa cả hai dòng đó lúc thi công. Để nguyên thì người đọc sau thấy một hệ thống
dùng broker mà chính tài liệu của nó nói là không cần.

Nhưng nói cho công bằng: ở quy mô **hiện tại** — một producer, một consumer, vài chục
message/ngày — một bảng Postgres cũng chạy được cả bốn điểm, chỉ là phải tự viết nhiều
hơn. RabbitMQ là lựa chọn đúng cho hướng đi, không phải lựa chọn bắt buộc cho quy mô.

---

## 4. Phải đo, không được đoán

Sáu thứ. Mỗi thứ có cách đo cụ thể và **thời điểm** phải có kết quả.

| # | Đo gì | Cách | Hạn |
| --- | --- | --- | --- |
| 1 | **Hạn mức thật của project** | AI Studio → `docs/gemini-quota-<ngày>.md` + ảnh chụp | **Ngày 1** |
| 2 | **Gemini có nhận schema đầy đủ không** | `apps/worker/scripts/thu-schema.ts`, 1 CV giả | **Ngày 1** |
| 3 | **Chất lượng trích xuất** — recall, precision, **tỉ lệ bịa** | 20 CV vàng có nhãn tay ([06](06-scan-cv.md) §6.2) | **Ngày 13** |
| 4 | **Phân loại 6 nhóm + tính có căn cứ** | **40** câu nhãn tay (7 nhóm, có injection), model thật, version cố định. Ground truth là **nhãn người**, không phải `category` suy từ trace | **Ngày 13** — chuyển vào giai đoạn 1 theo R14, vì khoanh phạm vi là chức năng cốt lõi |
| 5 | **Token thật mỗi lượt** | `AiRequestLog` sau 1 tuần dùng thật, xem phân vị 50/90/99 | Tuần 3 |
| 6 | **Tỉ lệ handoff hữu ích** | `handoffProposed` vs `handoffAccepted` vs NTD trả lời trong 24 h | Tuần 4 |

### Vì sao (3) là số quan trọng nhất

Ba con số, nhưng **tỉ lệ bịa** quyết định feature dùng được hay không:

- Recall 60%, bịa 0% → **dùng được.** Người dùng bổ sung phần thiếu, họ vẫn lợi.
- Recall 95%, bịa 3% → **không dùng được.** Cứ 33 trường thì một trường sai được gieo
  vào hồ sơ, rồi `chamDiemPhuHop` tính điểm trên dữ liệu sai đó, rồi NTD đọc hồ sơ sai.
  Và **không ai phát hiện**, vì nó "trông có lý".

Đây là lý do màn hình đối chiếu **không tick sẵn** ô `KHAC`
([06](06-scan-cv.md) §9.1), và là lý do ngưỡng phát hành đặt ở **bịa = 0** chứ không
phải "recall cao".

### Vì sao (4) không thể suy ra

Không có cách nào biết trước model phân loại đúng bao nhiêu phần. Đặc biệt cặp dễ lẫn:

- **Nhóm 2 (cần NTD quyết) ↔ nhóm 6 (không có dữ liệu).**
  *"Ca tối có được về sớm 30 phút không?"* — model có thể gọi `xemChiTietViec`, không
  thấy thông tin, rồi nói "tin không ghi" (nhóm 6) thay vì đề nghị chuyển (nhóm 2).
  Câu trả lời nhóm 6 **không sai**, nhưng nó bỏ lỡ đúng việc tính năng handoff sinh ra
  để làm.
- **Nhóm 3 (hướng dẫn) ↔ nhóm 4 (ngoài phạm vi).**
  *"Làm sao để CV đẹp hơn?"* — hướng dẫn dùng sản phẩm hay tư vấn nghề nghiệp?

Chỉ đo được bằng 30 câu có nhãn tay. Trước khi có số đó, mọi tinh chỉnh prompt là
đoán mò — và tệ hơn, là đoán mò **có vẻ đang tiến bộ**.

---

## 5. Rủi ro lớn nhất, xếp theo mức

| # | Rủi ro | Khả năng | Hậu quả | Giảm bằng |
| --- | --- | --- | --- | --- |
| **1** | **Không kịp 14 ngày** | **Cao** | Cả hai feature dở dang | Bốn cổng quyết định + danh sách giai đoạn 2 đã viết sẵn ([07](07-lo-trinh-14-ngay.md)) |
| **2** | **Model bịa dữ liệu vào hồ sơ** | Trung bình | Dữ liệu sai lan sang `matchScore` và mắt NTD. Im lặng | Không tick sẵn `KHAC`; ngưỡng bịa = 0; tách `kyNangSuyRa` |
| ~~3~~ | ~~Điều khoản free tier~~ | **ĐÃ GỠ** | — | Đổi scan CV sang Cloudflare Workers AI. Còn phần chat, mức thấp — xem 1b |
| **3′** | **Chất lượng model nhỏ hơn** (Moondream 9B / Llama 11B vs Gemini Flash) | **Chưa biết** | Nếu bịa > 0 thì feature không dùng được, và đã đi hết 14 ngày mới biết | Chạy `plans/ai/spike/thu-workers-ai.mjs` với CV thật **trước ngày 7**, không đợi ngày 13 |
| **4** | Hết quota giữa buổi demo | Trung bình | Demo hỏng | Đo hạn mức ngày 1; circuit breaker; **và một kịch bản demo có dữ liệu ghi sẵn** |
| **5** | Ca đua quota làm sai | Trung bình | Vượt hạn mức Google, hoặc tài khoản bị khoá vĩnh viễn vì lượt treo | SQL nguyên tử; job quét lượt treo; test ở làn `vitest.db` |
| **6** | Socket.IO là hạ tầng mới với cả nhóm | Trung bình | Chat handoff không mượt, tốn ngày | Phương án lùi: polling 3 giây ([07](07-lo-trinh-14-ngay.md) mục 7) |
| **7** | Máy dev hết RAM | **Cao** (đã xảy ra 2026-09-12) | Mất buổi, và đổ oan cho code | Chạy chẩn đoán `docs/moi-truong-may-dev.md` **trước** khi bắt đầu; RabbitMQ dưới profile |
| **8** | Rò PII vào log | Trung bình | Log có tên và SĐT; ai xem log là đọc được | Luật "không log nội dung"; `grep` ngày 14 |
| **9** | Little Lemur xoá `parked.q` sau 28 ngày | Thấp | Mất bằng chứng lỗi | Database là bằng chứng, queue chỉ để thao tác ([02](02-messaging-rabbitmq.md) 7) |
| **10** | Gemini đổi model/hạn mức giữa chừng | Thấp trong 2 tuần | Phải sửa gấp | Model là biến môi trường |

**Rủi ro 4 đáng nói riêng:** demo trước hội đồng mà hết quota là chuyện có thật và
không cứu được tại chỗ. Cách chắc chắn: chuẩn bị **một tài khoản demo có sẵn 3 hội
thoại và 2 bản trích xuất đã hoàn tất trong database**, và một kịch bản demo chỉ tạo
mới **một** lượt chat + **một** lượt scan. Không phụ thuộc vào việc Google đang rộng
rãi hay không vào đúng giờ đó.

---

## 6. Chỗ đề bài chưa nói tới, nhưng phải xử

### 6.1 — Log và PII

Đề bài có nhắc "tránh ghi thông tin cá nhân vào log", nhưng chỗ dễ vi phạm nhất không
phải log ứng dụng — mà là:

| Chỗ | Rò gì | Xử |
| --- | --- | --- |
| Log lỗi Zod | Zod đưa **giá trị không hợp lệ** vào `issues` ⇒ số điện thoại sai định dạng đi vào log | Log `issue.path` và `issue.code`, **không** log `issue.input` |
| Log lỗi tool | Input của tool có thể chứa nội dung người dùng gõ | Log tên tool + mã lỗi, không log input |
| `AiTurn.errorCode` | An toàn (enum) | — |
| Message trong `parked.q` | Chứa `extractionId`, không chứa nội dung CV | An toàn theo thiết kế |
| Sentry / APM | Chưa có trong repo | Nếu thêm sau, phải cấu hình scrub trước |

Dòng đầu là chỗ hay lọt nhất, vì `logger.error('...', { issues })` trông vô hại.

### 6.2 — Ai chịu trách nhiệm cho câu AI nói

Chưa ai đặt câu hỏi này, và nó là câu hỏi sản phẩm.

AI nói *"tin này trả 30.000đ/giờ"* trong khi tin ghi 25.000đ (model đọc nhầm, hoặc
NTD sửa tin sau đó). Sinh viên đi làm rồi mới biết.

**Đề xuất, chi phí gần bằng 0:**
1. Mỗi câu trả lời có dẫn nguồn: khi model dùng kết quả tool, UI hiện thẻ tin bên
   dưới câu trả lời với **số liệu lấy thẳng từ database**, không lấy từ chữ model viết.
2. Một dòng chân trang: *"Thông tin do trợ lý tổng hợp, hãy xác nhận lại với nhà tuyển
   dụng trước khi nhận việc."*
3. Lưu `AiTurn.toolNames` để tra lại lượt nào dựa trên tool nào — đã có trong schema.

Điểm 1 quan trọng nhất: **con số hiện trên màn hình đến từ database, chữ của model chỉ
là lời dẫn.** Nó biến một lớp rủi ro thành một lớp trình bày.

### 6.3 — Sinh viên trao đổi thẳng SĐT trong chat

Luật `TRANG_THAI_MO_LIEN_HE` chặn hệ thống phát số điện thoại ra trước khi đơn
`SHORTLISTED`. Hộp chat tự do cho phép hai bên tự gõ số cho nhau.

**Đây không phải lỗ hổng** — hệ thống không phát gì; người dùng tự nguyện. Nhưng nó
làm luật kia bớt ý nghĩa, và **đáng ghi nhận rõ** thay vì để ai đó phát hiện sau và
tưởng là bug.

**Đề xuất:** không chặn, không lọc. Thêm một dòng gợi ý ở lần đầu mở hộp chat:
*"Bạn nên trao đổi qua UniWork tới khi hai bên chốt lịch phỏng vấn."* Lọc số điện
thoại tự động sẽ chặn nhầm mã tin, mã ca, mức lương — và người ta sẽ viết
"không chín một hai..." để lách.

### 6.4 — Xoá dữ liệu

Sinh viên xoá tài khoản: `onDelete: Cascade` lo phần database. **Không** lo file trên
Cloudinary — nó nằm ngoài Postgres.

**Đề xuất:** hook xoá tài khoản đọc `cv_extractions.cloudinaryPublicId` **trước** khi
cascade, ghi vào một hàng outbox `file.xoa`, worker dọn. ~0,5 ngày, nằm trong giai
đoạn 2 nhưng **phải xong trước người dùng thật**.

---

## 7. Điểm mạnh của đề bài — nói để không cắt nhầm

Ba yêu cầu trong đề bài là **đúng** và tinh tế hơn vẻ ngoài. Chúng dễ bị cắt vì trông
như chi tiết nhỏ:

1. **"Phân biệt lượt được giữ, đã dùng, hoàn lại và tài nguyên API thực sự đã tiêu
   thụ."** Bốn con số, và đúng là bốn. Gộp thành một `count` là mất khả năng trả lời
   *"vì sao tôi mất lượt mà không nhận được câu trả lời nào"* — câu hỏi sẽ có người hỏi.

2. **"Nếu gợi ý kỹ năng từ mô tả kinh nghiệm, phải tách khỏi kỹ năng được ghi rõ và
   không tự xác nhận."** Đây là yêu cầu chống ảo giác chính xác nhất trong cả đề bài,
   và cách hiện thực đúng là **hai mảng riêng**, không phải một cờ boolean
   ([06](06-scan-cv.md) §3.3).

3. **"Không tạo tọa độ bounding box giả nếu phương án hiện tại không xác định được."**
   Đúng hoàn toàn, và hiếm khi được nói ra. Một khung vẽ sai chỗ tệ hơn không có
   khung: nó khiến người kiểm tin rằng hệ thống biết nó đang nói về đâu.

Cả ba đều được giữ nguyên trong plan này.

---

## 8. Nợ có sẵn, phát hiện trong lúc khảo sát

Không thuộc phạm vi hai feature, nhưng chạm vào cùng vùng nên ghi lại. **Không sửa
lén trong plan này** — mỗi cái là một việc riêng cần lịch riêng.

| Nợ | Chi tiết | Mức |
| --- | --- | --- |
| **`uploadCvFile` lưu CV công khai** | `cloudinary.ts:78` không có `type: 'authenticated'`, và `public_id = userId` nên **đoán được**. Biết id một sinh viên là đọc được CV của họ | **Cao** |
| README mô tả bảng `EmailQueue` không tồn tại | README §2 nói hàng đợi bằng bảng Postgres; `grep` ra 0 kết quả. Email gửi thẳng trong request (`applications.service.ts:236`) | Trung bình — tài liệu sai |
| README nói không có free tier cho broker | CloudAMQP Little Lemur có tồn tại ([00](00-khao-sat.md) C.7) | Thấp |
| Email gửi ngoài transaction, không thử lại | `guiEmailAnToan` sau commit. Brevo hỏng ⇒ mất thông báo, không ai biết | Trung bình — **outbox ở plan này giải được**, nếu muốn dùng lại |
| **Thân request của API không được kiểm kiểu** | `apiFetch<T>` — `T` chỉ kiểu hoá **response**; tham số thứ hai là `RequestInit` với `body: BodyInit`, và **62 chỗ gọi** đều `JSON.stringify(...)` trước khi đưa vào. Kiểu của dữ liệu gửi đi biến mất hoàn toàn | **Trung bình–cao** |
| ↳ hệ quả đã xảy ra | `grep -r "UpdateSkillsInput\|UpdateStudentProfileInput" apps/web` → **0**. `useProfile.ts:35` khai interface cục bộ `StudentProfileInput` **4 trường**, trong khi shared có **7** — thiếu `phone`, `availableUntil`, `expectedHourlyRate`. Đã lệch, không ai biết | |
| ↳ README §2 nói sai | *"đổi backend là FE báo lỗi compile ngay"* — đúng với response, **sai với request body**. Chỗ sai thứ ba của README | Thấp — tài liệu |

**Về lỗ `apiFetch`:** plan này chỉ vá **ba endpoint nó chạm tới**, bằng `apiSend<TReq,
TRes>` ([06](06-scan-cv.md) §9.4). Chuyển nốt 62 chỗ gọi còn lại là **việc riêng**,
ước ~1 ngày, và nên làm — nhưng không nhét vào một lịch đang ở 290 %.

Đây cũng là lời nhắc cho chính bộ plan này: mọi câu dạng *"hai phía cùng repo nên
TypeScript sẽ bắt được"* phải **kiểm bằng code trước khi viết ra**. Câu đó nghe rất
hợp lý, đúng với repo này ở chiều response, và sai ở đúng chiều đang cần.

Dòng cuối là cơ hội: outbox dựng cho scan CV **có thể dùng ngay** cho email ứng
tuyển, biến lời mô tả trong README thành sự thật. ~0,5 ngày. Nhưng nó **không nằm
trong phạm vi hai feature** — ghi lại để nhóm quyết định riêng.

---

## 9. Bốn đề xuất cải thiện, trong đúng phạm vi

Xếp theo tỉ lệ lợi ích / chi phí.

### 9.1 — Trần lượt theo giờ, không chỉ theo ngày (~2 giờ)

Đã nói ở mục 2. Một cột `turnsThisHour` + mốc giờ trong `AiUsageDay`. Nó bảo vệ **RPM**
— thứ mà trần theo ngày hoàn toàn mù.

### 9.2 — Thẻ dẫn nguồn dưới mỗi câu trả lời (~4 giờ, phần lớn là FE)

Đã nói ở 6.2. Số liệu trên thẻ lấy từ kết quả tool đã lưu, **không** từ chữ model
viết. Biến rủi ro ảo giác thành vấn đề trình bày.

Kèm theo: lưu `AiTurn.toolResults` (đã cắt gọn) để dựng thẻ mà không gọi lại service.
Cân nhắc dung lượng — chỉ lưu id và vài trường, không lưu cả object.

### 9.3 — Chế độ "chỉ hiện, không tick" cho scan CV (~2 giờ)

Một cờ `SCAN_TU_TICK=false`. Khi bộ CV vàng cho tỉ lệ bịa > 0, bật cờ này thay vì
hoãn phát hành: người dùng vẫn được hưởng phần đọc đúng, và **mọi** trường đều phải
tick tay.

Đây là **van an toàn cho cổng 4** ([07](07-lo-trinh-14-ngay.md)) — nó biến một quyết
định nhị phân ("phát hành hay không") thành một nút xoay.

### 9.4 — Một script demo dựng dữ liệu sẵn (~3 giờ)

`apps/api/scripts/demo-tro-ly.ts`: tạo một tài khoản sinh viên có 3 hội thoại hoàn
chỉnh (một AI, một đang chờ NTD, một đã chat người thật) và 2 bản trích xuất ở
`NEEDS_REVIEW`, ghi thẳng vào database **không gọi Gemini**.

Giải quyết rủi ro số 4 ở mục 5, và cũng là dữ liệu để DEV2 dựng giao diện mà không
phải chờ backend xong — nghĩa là nó trả lại thời gian ngay trong 14 ngày, không phải
sau.

---

## 11. Đối chiếu review ngoài R01–R16 (2026-09-12)

Đã đọc source lại cho từng mục. **16/16 xác nhận**, không mục nào phản biện được —
chỉ có ba mục cần nói thêm về cách sửa (R03, R09, R12), ghi ở cột cuối.

### P1

| # | Phát hiện | Xác nhận bằng | Đã sửa ở đâu | Quyết định cuối |
| --- | --- | --- | --- | --- |
| **R01** | Schema chat không cho NTD tự dùng trợ lý | Bản trước để `studentProfileId` bắt buộc; endpoint cho EMPLOYER | [03](03-chatbot-va-tool.md) §5 schema, §5.0, §6.2b/6.2c; [04](04-handoff-realtime.md) §3.3 | Thêm `ownerUserId` + `kind: AI_STUDENT\|AI_EMPLOYER`, tách hẳn **chủ phiên** khỏi **người nhận handoff**. 4 CHECK constraint viết tay ép đúng |
| **R02** | Handoff lần hai có thể lộ hội thoại giữa hai NTD | Bản trước cho đổi `employerProfileId` theo job mới; `duocVaoPhong` mâu thuẫn với transition E | [03](03-chatbot-va-tool.md) §5.0, §6.2c; [04](04-handoff-realtime.md) §1 bảng A/E, §3.3, §3.4 | **Đóng băng** NTD và job sau handoff đầu; đổi NTD ⇒ phiên mới (409 + gợi ý). ACL **đọc tách khỏi ghi** — đọc neo vào `handoffEmployerProfileId`, không vào `state`. Hai phòng socket `:chu` / `:ntd` |
| **R03** | Retry không đi qua ba bậc, và xung đột lease | `x-dead-letter-routing-key` là hằng của queue ⇒ mọi nack về bậc 1 | [02](02-messaging-rabbitmq.md) §1.1, §1.5, §6.2, §6.3; [06](06-scan-cv.md) schema | **Bỏ hẳn DLX+TTL retry**, chuyển sang **outbox có lịch** (`nextTryAt`). Lease trả trong cùng transaction ⇒ hết xung đột. Thêm `leaseOwner` (CAS chủ lease) và tách `modelRuns` / `quotaWaits` / `dispatches`. *Nói thêm:* mất giá trị minh hoạ delay-queue; giữ DLX cho nhánh `x-delivery-limit → parked` |
| **R04** | Sweeper 2 phút hoàn nhầm scan còn hợp lệ | Bản trước tạo `AiTurn` từ lúc QUEUED, sweeper quét mọi `RESERVED` > 2 phút | [05](05-quota-dung-chung.md) §2 `AiTurn`, §3.2; [06](06-scan-cv.md) schema | Tách **giữ chỗ của job** (`AiUsageDay`, sống hàng giờ) khỏi **lượt gọi model** (`AiTurn`, sống vài giây). Sweeper chỉ đụng `ai_turns`. Thêm `quotaDay` + `quotaSettledAt` (CAS) và `runnerId` để shutdown không hoàn lượt của process khác |
| **R05** | Xác nhận CV không lưu nguyên tử được | [profile.service.ts:193](../../apps/api/src/modules/profile/profile.service.ts#L193) dùng `prisma` global; [:375](../../apps/api/src/modules/profile/profile.service.ts#L375) tự mở `$transaction` | [00](00-khao-sat.md) B.5; [06](06-scan-cv.md) §9.2, §9.4 | Thêm `capNhatHoSoTrongTx` / `themKyNangTrongTx` nhận `Prisma.TransactionClient`; hàm cũ thành wrapper, không đổi hành vi. Kỹ năng dùng `createMany({skipDuplicates})` — **thêm, không đọc-hợp-ghi** ⇒ hết lost update. CAS `updatedAt` chống đè luồng sửa hồ sơ song song |
| **R06** | Có nhánh ACK thành công dù message chưa tới nơi | Confirm không bắt unroutable; `ch.publish` trả boolean, `await` nó là no-op | [02](02-messaging-rabbitmq.md) §3.1, §6.2, §6.2b; [01](01-kien-truc-va-ranh-gioi.md) §3.3 | `mandatory: true` + bắt `'return'` + timeout 5 s cho **lệnh nghiệp vụ**; `mandatory: false` cho **realtime tạm thời**. Park và nhánh version lạ: ghi `parked_messages` trong transaction **rồi mới** ack |

### P2

| # | Phát hiện | Đã sửa ở đâu | Quyết định cuối |
| --- | --- | --- | --- |
| **R07** | Quota project cộng hai lần; giữ lượt chưa có transaction bao đủ | [05](05-quota-dung-chung.md) §3.3, §4.1; [03](03-chatbot-va-tool.md) §1, §1.1, §6.2b | `requests` **chỉ** tăng ở `xinPhepGoiModel()`, ngay trước mỗi HTTP (bọc ở tầng `fetch` để đếm cả SDK retry); `chotLuot` chỉ ghi token và **idempotent bằng CAS** `state='RESERVED'`. Giữ lượt + tạo turn + ghi câu hỏi vào **một** transaction ⇒ `AI_BUSY` không trừ lượt. `sessionId` thành bắt buộc, thêm `POST /api/hoi-thoai` |
| **R08** | Outbox chưa có vòng đời claim | [02](02-messaging-rabbitmq.md) §4.3 điểm 2 | Claim tường minh `claimedBy` + `claimUntil` (30 s), commit → publish → mark bằng CAS. Query loại `attempts >= 10`. **Chấp nhận phát trùng sau crash**, ghi rõ: không hứa exactly-once cho lời gọi Gemini |
| **R09** | Worker không có đường hợp lệ tới quota/provider/messaging | [01](01-kien-truc-va-ranh-gioi.md) §3, §3.0, §3.4; [06](06-scan-cv.md) §8 | Tách **`packages/messaging`** và **`packages/ai-runtime`** khỏi `apps/api`; `contracts` chỉ giữ định dạng. Bảng sở hữu 6 dòng. **Worker không ánh xạ kỹ năng** — chuyển sang API lúc dựng màn hình duyệt. *Nói thêm:* schema Prisma còn ở `apps/api/prisma` — phụ thuộc **build-time**, cắt ở nấc 2 |
| **R10** | Queue kết quả chung không tới đúng instance | [02](02-messaging-rabbitmq.md) §1 sơ đồ, §1.3, §1.3b; [04](04-handoff-realtime.md) §6 | **Hai tầng**: nghiệp vụ = queue dùng chung (1 lần); realtime = exchange fanout + `rt.<instanceId>` (N lần). Consumer nghiệp vụ **không** tự emit, nó ghi outbox `realtime.emit`. Bật Redis adapter ⇒ **tắt fanout**, đổi sang `rt.single.q`. Sticky session: **không cần** với WebSocket-only — sửa câu tuyệt đối của bản trước |
| **R11** | Ngân sách app lẫn với quota thật của Gemini | [00](00-khao-sat.md) C.2; [05](05-quota-dung-chung.md) §1, §2, §4.1, §4.2, §4.3 | Hai hàm ngày: `ngayVN()` cho người dùng, **`ngayPacific()`** cho provider. Thêm `AiProviderWindow` (RPM/TPM theo phút, dùng chung API+worker). `AiProjectBudgetDay` thêm chiều **`feature`** vào khoá ⇒ chia được cả khi hai biến trỏ cùng model. **Circuit theo `modelId`**, ba loại lỗi RPM/RPD/SERVER. Sửa cách gọi "mượn quota" |
| **R12** | Quét byte không thực thi được trần số trang | [06](06-scan-cv.md) §2.1, §2.2b | Dùng **`pdf-lib`** đọc page tree + `EncryptedPDFError`, timeout 3 s, chạy **ở API** (người dùng phải biết ngay tại màn hình upload). Parse thất bại ⇒ yêu cầu đổi file. Tiêu chí: **file bị chặn không sinh request nào tới Gemini**. *Nói thêm:* thêm một dependency, nhưng là kiểm định đầu vào — không đổi hướng trích xuất, không thêm OCR |
| **R13** | `mappedData` chưa khớp trường lưu được | [06](06-scan-cv.md) §3.1, §3.1b, §3.2, §8.2 | Thêm nhóm thứ năm **`khongCoDichLuu`** (kinh nghiệm, chứng chỉ, email, địa chỉ, liên kết) — giữ cấu trúc, **không** có nút lưu. Bảng ánh xạ 13 dòng `JSON → trường → quy tắc → áp dụng?`. `hoTen` và `year` **không** ghi được. Người dùng **chọn** học vấn chính (`hocVanChinh`), không tự lấy mục đầu |
| **R14** | Chưa chứng minh chatbot khoanh đúng phạm vi | [03](03-chatbot-va-tool.md) §2.2b; [07](07-lo-trinh-14-ngay.md) ngày 13; [08](08-kiem-thu.md) §7b R14 | Nhãn suy từ trace là **telemetry**, không phải ground truth; thêm giá trị `UNKNOWN`. Bộ **40 câu nhãn tay** (7 nhóm, có injection) chuyển **vào ngày 13**, không dời giai đoạn 2. Chấm **hai trục**: hành vi ≥80 %, **có căn cứ 100 %**, an toàn 100 %. Công bố số ca từng nhóm |
| **R15** | Lộ trình tự đổi phạm vi và gọi ước lượng là "đã đo" | [README](README.md) §Kết luận; [07](07-lo-trinh-14-ngay.md) §0, §1, §3b | Bỏ chữ "đã đo"; ghi rõ nguồn là bảng **kế hoạch**, repo không có time log. Ước lượng thành **khoảng 27–37**, kèm 4 giả định. Bảng **42 yêu cầu → giai đoạn → ngày → ai → nghiệm thu**; 37/42 trong 14 ngày. Ghi rõ phần dời là **đề xuất chờ quyết** |
| **R16** | Chi phí chat thấp hơn 10 lần | [01](01-kien-truc-va-ranh-gioi.md) §8.4; [README](README.md) §1b | Sửa số học **và** giả định. Tách bảng A (chi phí thật hiện tại = **0 USD**, broker Little Lemur Free) khỏi bảng B (kịch bản Gemini trả phí). Tính lại token gồm vòng tool và phương án B: chat **~18 USD/tháng**, scan ~0,7. Kết luận đổi: khoản lớn nhất là **model**, không phải hosting |

### Còn phải đo bằng thực nghiệm, chưa quyết được trên giấy

| Cần đo | Vì sao chưa quyết được | Khi nào | Kết quả đổi cái gì |
| --- | --- | --- | --- |
| RPM/TPM/RPD thật của project, **và có tách theo model không** | Trang chính thức bỏ bảng số, chỉ sang AI Studio | **Ngày 1** | 5 lượt/ngày có khả thi không; ngưỡng `AI_PROJECT_REQUESTS_PER_DAY`; chia 70/30 có ý nghĩa không |
| Gemini có nhận schema đầy đủ không | Tài liệu chỉ nói "very large or deeply nested schemas may be rejected", không có ngưỡng | **Ngày 1** | Một request hay phương án B hai request ⇒ đổi chi phí và `AiTurn.requestCount` |
| CloudAMQP Little Lemur có cho **quorum queue** không | Instance chia sẻ, quorum cần cluster | **Ngày 4** | `classic` thì mất `x-delivery-limit` ⇒ chỉ còn `attempt` trong envelope làm chốt chặn |
| Recall / precision / **tỉ lệ bịa** của trích xuất | Không suy được từ schema; JSON hợp lệ không chứng minh gì | **Ngày 13** | Bịa > 0 ⇒ bật `SCAN_TU_TICK=false` thay vì hoãn phát hành (§9.3) |
| Độ chính xác phân loại 6 nhóm + tính có căn cứ | Nhãn suy từ trace không dùng làm ground truth được | **Ngày 13** | < 80 % ⇒ sửa prompt phạm vi; có căn cứ < 100 % ⇒ **chặn phát hành chat** |
| Token thật mỗi lượt (phân vị 50/90/99) | Ước lượng 9k input là suy từ số vòng tool, chưa đo | Tuần 3 | Con số 18 USD/tháng; và `AI_MAX_TOOL_ROUNDS` nên là 3 hay 4 |
| `pdf-lib` parse 5 MB tốn bao nhiêu RAM trên Render 512 MB | Ước lượng "hàng chục MB, < 1 giây" chưa đo | Ngày 7 | Quá nặng ⇒ đẩy `kiemPdf` sang worker, chấp nhận báo lỗi bất đồng bộ |
| Fanout `rt.<id>` với 2 instance thật | Chưa chạy bao giờ | G2 | Nếu hỏng ⇒ chuyển thẳng sang Redis adapter |

---

## 10. Tóm tắt một dòng cho mỗi mục

1. Free tier cấm gửi thông tin cá nhân — bật billing trước khi nhận CV thật, không sau.
2. "5 lượt/ngày" chưa có căn cứ cho tới khi mở AI Studio xem trần thật.
3. RabbitMQ có bốn nhu cầu kỹ thuật thật; README gốc nói ngược ở hai vế, phải sửa.
4. Sáu thứ phải đo; **tỉ lệ bịa = 0** là ngưỡng phát hành, không phải recall cao.
5. Rủi ro lớn nhất là **tiến độ**, không phải kỹ thuật.
6. Log Zod là chỗ rò PII dễ nhất; con số trên màn hình phải đến từ database.
7. Ba yêu cầu tinh tế nhất của đề bài đã được giữ nguyên — đừng cắt nhầm.
8. `uploadCvFile` đang để CV công khai với `public_id` đoán được — nợ có sẵn, việc riêng.
9. Bốn cải thiện, tổng ~11 giờ, và cái thứ tư trả lại thời gian ngay.
