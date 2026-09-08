# Sprint 5 — Hoàn thiện & Bảo vệ

**Thời lượng:** 5 ngày làm việc (tuần 8) · **Nhóm:** 3 người

| Ký hiệu | Vai trò | Tên |
| --- | --- | --- |
| **DEV1** | Backend, hạ tầng, database, deploy API | Khang |
| **DEV2** | Frontend, CI, deploy web | Bảo |
| **BA** | Phân tích nghiệp vụ, viết tài liệu, wireframe | Quốc |

## Mục tiêu sprint

Mốc cuối tuần 8 trong timeline: **"Sẵn sàng bảo vệ"**.

Đây là sprint duy nhất mà **sản phẩm bàn giao không phải một tính năng**. Bốn sprint trước trả lời câu "hệ thống làm được gì". Sprint này trả lời một câu khác hẳn:

> Một người lạ — không phải người trong nhóm, không được ai đứng cạnh giải thích — cầm điện thoại của họ, mở link deploy thật, và tự đi hết được một vòng tuyển dụng.

Ba chữ trong câu đó là ba nhánh việc của cả sprint, và mỗi chữ đều đang hỏng ở một mức khác nhau:

| Chữ | Đang hỏng ở đâu | Ra tính năng nào |
| --- | --- | --- |
| **người lạ** | Không ai ngoài nhóm từng đi hết luồng. Không có bằng chứng nào chứng minh luồng còn nguyên sau một tuần sửa lỗi | Tính năng 1 — E2E |
| **điện thoại của họ** | 5 trang chính có **0 điểm ngắt responsive**. Bảng ứng viên rộng 860px cứng | Tính năng 2 — Responsive |
| **đi hết được một vòng** | Vòng hiện dừng ở "NTD thấy số sinh viên". Sinh viên **không biết ai sắp gọi cho mình** | Tính năng 3 — Liên hệ hai chiều |

---

## ⚠ Phát hiện lớn nhất: phần lớn Sprint 5 theo kế hoạch **đã xong rồi**

Đây là điều đầu tiên phải nói, vì nếu không nói thì cả nhóm sẽ dành hai ngày đi xây lại thứ đang chạy.

[`timeline-8-tuan.md`](timeline-8-tuan.md) ghi Sprint 5 là *"API admin (duyệt NTD, duyệt tin, quản lý kỹ năng)"* + *"Trang admin"*. Rà lại mã nguồn hiện tại:

| Việc timeline giao cho Sprint 5 | Thật ra nằm ở đâu | Xong từ |
| --- | --- | --- |
| API duyệt nhà tuyển dụng | [`admin.routes.ts`](../apps/api/src/modules/admin/admin.routes.ts) — `GET /nha-tuyen-dung`, `PUT /:id/xac-minh`, `PUT /:id/giay-to/:type`, `GET /:id/giay-to/:type/xem` | Sprint 1 |
| API quản lý người dùng | `GET /admin/nguoi-dung`, `PUT /admin/nguoi-dung/:id/trang-thai` | Sprint 1 |
| API duyệt tin | [`jobs.routes.ts:92`](../apps/api/src/modules/jobs/jobs.routes.ts) — `adminJobRoutes`, `PUT /:id/duyet` | Sprint 2 |
| API quản lý kỹ năng | [`skills.routes.ts`](../apps/api/src/modules/skills/skills.routes.ts) — `adminSkillsRoutes`, đủ 4 thao tác CRUD | Sprint 2 |
| Trang admin | `pages/admin/` — 6 trang: `Dashboard`, `Users`, `ReviewJobs`, `ReviewEmployers`, `Skills`, `EmployerJobs` | Sprint 1–2 |
| Dashboard thống kê | `Dashboard.tsx` + `useAdminStats` + `components/admin/Charts` — dữ liệu thật, có `StatsRange` 7d/30d/90d/1y | Sprint 2 |

Cả `admin.test.ts` (16.2K) lẫn `skills.test.ts` (13.2K) đều đã có.

**Vì sao lệch:** timeline viết ở tuần 1, khi chưa ai biết admin sẽ được dựng sớm để có chỗ duyệt giấy tờ nhà tuyển dụng — mà không duyệt được thì Sprint 2 không có tin nào hiển thị công khai. Admin bị **kéo lên trước** vì nó chặn luồng chính, chứ không phải vì ai đó làm dư.

Nói cách khác: đây đúng là chuyện Sprint 4 đã gặp một lần và ghi lại — **thứ trông như phụ thuộc chưa chắc là phụ thuộc, và thứ ghi trong kế hoạch chưa chắc còn đúng với mã nguồn**. Lần đó ta phát hiện seed đã có sẵn đơn nên FE không cần chờ BE. Lần này ta phát hiện cả một sprint đã bị tiêu thụ trước.

Rà lại cả các khoản nợ mà [`sprint-4.md`](sprint-4.md) liệt kê ở mục *"Việc còn nợ"* — hai trong ba khoản cũng đã trả xong:

| Nợ ghi ở Sprint 4 | Hiện trạng |
| --- | --- |
| Sprint 3 tính năng 2 — full-text search | **Xong** — `jobs.service.ts:911`, `contains` + `mode: 'insensitive'` trên `title`/`description` |
| Sprint 3 tính năng 5 — phân trang | **Xong** — `jobs.service.ts:1060–1158`, kể cả nhánh khó `sort=match` phải sắp trước khi cắt trang |
| Sprint 2 T75, T76, T87, T88 | Việc của BA, không phải mã nguồn |
| Sprint 2 T86 — responsive 4 màn hình mới | **Chưa** — thành tính năng 2 của sprint này |

**Kết luận:** Sprint 5 phải được đặt lại phạm vi. Thứ còn thiếu không cùng loại với thứ kế hoạch mô tả.

---

## Sprint này khác bốn sprint trước ở định nghĩa "xong"

| | Sprint 1–4 | Sprint 5 |
| --- | --- | --- |
| Xong nghĩa là | Tính năng chạy đúng, test xanh | Người ngoài dùng được, trên máy của họ, không cần giải thích |
| Rủi ro chính | Làm sai nghiệp vụ | **Làm hỏng thứ đang chạy** trong lúc dọn dẹp |
| Bằng chứng | Unit test + `curl` | Một lượt đi thật, có người quay màn hình |
| Kẻ thù | Không kịp | Đụng vào quá nhiều thứ vì "tiện tay" |

Điều thứ hai đáng sợ hơn điều thứ nhất. Tuần cuối là tuần người ta sửa lỗi nhiều nhất, và cũng là tuần **không còn sprint nào phía sau để bắt lỗi mới sinh ra**. Đó chính là lý do tính năng 1 (E2E) xếp đầu chứ không xếp cuối: nó là lưới an toàn cho bốn tính năng còn lại của chính sprint này.

---

## Không có lớp nền

Sprint 4 có đúng một lớp nền nửa ngày chặn cả nhóm. Sprint 5 **không có gì chặn ai** — kiểm lại từng tính năng:

| Tính năng | Cần migration? | Cần ai xong trước? |
| --- | --- | --- |
| 1 — E2E | Không | Không (chạy trên mã đang có) |
| 2 — Responsive | Không | Không |
| 3 — Liên hệ hai chiều | **Không** — `EmployerProfile.phone` / `contactName` đã có cột từ Sprint 0 | Không |
| 4 — Tìm không dấu | Có, nhưng chỉ `CREATE EXTENSION` | Không |
| 5 — Dọn nợ & dữ liệu bảo vệ | Có (xoá cột chết) | Nên làm **cuối**, xem lý do ở mục đó |

Ràng buộc thứ tự thật sự chỉ có một, và nó ngược với trực giác:

```
1. E2E          — làm TRƯỚC, không phải sau. Nó là lưới hứng cho phần còn lại
2. Responsive   — song song, DEV2
3. Liên hệ hai chiều — song song, cần cả BE lẫn FE
4. Tìm không dấu     — song song, thuần BE
5. Dọn nợ + dữ liệu  — làm SAU CÙNG, vì nó đụng schema và seed
```

**Vì sao E2E làm trước.** Bốn tính năng còn lại đều là *sửa thứ đang chạy*: đổi layout, mở thêm trường trong `select`, đổi câu truy vấn tìm kiếm, xoá cột. Không có gì rơi vào loại "thêm file mới, không đụng ai" như tính năng 4 của Sprint 4. Làm E2E sau nghĩa là viết một bộ kiểm tra cho hiện trạng **đã bị mình làm hỏng mà không biết**, rồi ghi lại cái hỏng đó thành đặc tả — đúng lỗi loại ba trong [`nep-kiem-thu.md`](nep-kiem-thu.md), mục 1.

**Vì sao dọn nợ làm cuối.** Nó sửa `schema.prisma` và `seed.ts` — hai file mà mọi test và mọi lượt chạy thật đều dựa vào. Sửa đầu tuần thì mọi lỗi phát sinh suốt tuần đều phải loại trừ nó trước khi đi tìm nguyên nhân thật.

---

## Bảng tính năng

| # | Tên | BE cần thêm | FE cần thêm | Vì sao độc lập |
| --- | --- | --- | --- | --- |
| 1 | E2E hai luồng chính | Không (nhưng nối `test:db` vào CI — nợ Sprint 0) | Playwright + 2 kịch bản + workflow riêng | File mới hoàn toàn, không sửa dòng nào của app |
| 2 | Responsive | Không | Điểm ngắt cho 5 trang có **0 điểm ngắt** | Chỉ đụng `className`, không đụng logic |
| 3 | Liên hệ hai chiều | Mở rộng `select` ở 1 endpoint đã có | Khối liên hệ NTD trong `MyApplications` | Đọc thêm cột đã tồn tại. Không ghi gì |
| 4 | Tìm không dấu | `unaccent` + đổi mệnh đề `WHERE` | Không (ô tìm kiếm đã có) | Sửa đúng một nhánh `if` trong `listPublicJobs` |
| 5 | Dọn nợ & dữ liệu bảo vệ | Migration xoá cột chết, seed dựng cảnh demo | Không | Làm cuối, một mình một PR |

Chỗ chạm nhau giữa các tính năng: **chỉ có một**. Tính năng 3 sửa `MyApplications.tsx`, tính năng 2 cũng sẽ đụng file đó khi thêm điểm ngắt. Làm 3 trước rồi 2, hoặc một người làm cả hai.

---

## Quyết định phạm vi — thứ **cố tình không làm**

Tuần cuối là tuần dễ nhất để nhét thêm việc, vì mọi thứ đều trông "nhỏ thôi". Chốt trước, viết ra, để lúc mệt không phải quyết lại:

| Không làm | Lý do |
| --- | --- |
| **Báo cáo tin vi phạm** — ⏸ **hoãn quyết định, chưa chốt cắt** | [`timeline-8-tuan.md`](timeline-8-tuan.md) cắt từ tuần 1, nhưng README mục 7 vẫn hứa ở Sprint 5 — hai tài liệu đang nói ngược nhau. `schema.prisma:7` ghi *"để dành Sprint 5–6"* mà **bảng chưa từng được tạo**, nên đây không phải "làm nốt giao diện" mà là migration + endpoint + trang admin + luồng xử lý, **tối thiểu một ngày rưỡi**. **Chốt vào cuối ngày 3**: bốn tính năng còn lại xong đúng hạn thì cân nhắc làm; trễ dù chỉ nửa ngày thì cắt và sửa README. Quyết sớm hơn là quyết khi chưa có dữ liệu; quyết muộn hơn là không còn thời gian để làm |
| **Lịch rảnh có hạn dùng** | [`lich-ranh-co-han-dung.md`](lich-ranh-co-han-dung.md), ước tính 1,5–2 ngày, cần `btree_gist`. Và Sprint 4 đã ghi một nghi vấn chưa giải: `StudentProfile.availableUntil` có thể đã đủ, làm thêm là làm hai lần cùng một việc. **Không quyết trong tuần cuối** |
| **Bảng `JobView` để đếm lượt xem theo người** | Nợ ghi từ Sprint 4. Hiện `viewCount` đếm mỗi lần mở (đã trừ chủ tin). Sai lệch này không ai nhìn thấy trong buổi bảo vệ, và sửa đúng thì cần thêm bảng + khoá phiên |
| **Vai trò phụ dưới ADMIN** | Đã cắt từ tuần 1, lý do đầy đủ trong timeline. Không có gì đổi |
| **Chat SV ↔ NTD (WebSocket), chat AI** | Đề xuất và **bác bỏ ngày 2026-09-05**. Ba lý do, xếp theo sức nặng: (1) ⚠ **Nó mâu thuẫn với một quyết định sản phẩm đã chốt** — [`sprint-4.md`](sprint-4.md) mục *"Phạm vi: UniWork KHÔNG phải một ATS"* chốt rằng cuộc trò chuyện **cố ý** diễn ra ngoài ứng dụng, và `VIEC_TIEP_THEO` nói thẳng với NTD *"phần còn lại diễn ra giữa bạn và ứng viên"*. Thêm chat là tự phản bác thiết kế của chính mình, và hội đồng bắt được mâu thuẫn đó thì mất nhiều hơn được. (2) Chi phí thật: WebSocket là **tầng hạ tầng mới** — kết nối lâu dài, xác thực trên socket, trạng thái đã đọc, và Render free **ngủ sau 15 phút không lưu lượng**, tức là nền tảng hiện tại không đỡ nổi kết nối thường trực. (3) Đánh đổi cụ thể: làm chat thì phải hoãn xoá cột chết, hoãn `logoUrl`, có thể hoãn cả tìm không dấu — mà vẫn phải giữ kiểm thử, responsive và **thời gian để cả nhóm đọc lại hệ thống**. Đổi ba thứ chắc chắn xong lấy một thứ chưa ai làm bao giờ, ở tuần cuối |
| **Chuyển `matchScore` sang V2** | `sprint-4.md` mục *"Hướng V2"* ghi rõ: chưa cần chuẩn bị gì. Vẫn đúng |
| **Gộp `ILIKE` thành `tsvector` + GIN index** | Tính năng 4 chỉ bỏ dấu, **không** đổi sang full-text index. Ở 30–50 tin thì quét tuần tự vẫn dưới 5ms; thêm hạ tầng tìm kiếm ở tuần cuối là đổi một rủi ro đã biết lấy một rủi ro chưa biết |

Một câu để dùng lại khi có ai đề xuất thêm việc trong tuần này:

> Nó có làm buổi bảo vệ **hỏng** nếu thiếu không? Không → ghi vào mục "Việc còn nợ", không mở editor.

---

## Tính năng 1 — E2E hai luồng chính

Playwright thì chưa từng có — `apps/web/package.json` không có `@playwright/test`, không có `playwright.config.*`, không có thư mục `e2e/`.

Nhưng **có một làn test chạy trên Postgres thật**, và bỏ sót nó khi lập kế hoạch sẽ dẫn tới việc dựng lại hạ tầng đã có:

| Làn | Chạy bằng | Số ca | Chạm database thật? |
| --- | --- | --- | --- |
| Chính | `pnpm test` | 347 API + 140 web | **Không** — `vi.mock('../../lib/prisma.js')` ở mọi file test service |
| **Thứ hai** | **`pnpm test:db`** | [`test-db/rang-buoc.test.ts`](../apps/api/test-db/rang-buoc.test.ts) + [`test-db/seed.test.ts`](../apps/api/test-db/seed.test.ts) | **Có** — `new PrismaClient()`, truy vấn thật |

[`vitest.db.config.ts`](../apps/api/vitest.db.config.ts) nói rõ vì sao tách hai làn, và câu cuối của nó đáng nhớ:

> *"Làn này CỐ Ý gãy to khi không có database, không im lặng bỏ qua. Test tự bỏ qua khi thiếu điều kiện là loại tệ nhất: nó biến CI xanh thành lời nói dối."*

### ⚠ Và đây là lỗ hổng thật, to hơn thứ tôi tưởng lúc đầu

[`sprint-0.md:50–57`](sprint-0.md) đặc tả T22 ghi rõ: *"`pnpm test` và `pnpm test:db` là hai thứ khác nhau, và job CI phải chạy **cả hai**"*, kèm *"Job cho làn này cần một service Postgres"*. `turbo.json:21` cũng đã khai sẵn task `test:db`.

Kiểm `ci.yml` hôm nay: **không có bước `test:db`, không có service Postgres nào.** Và biến `DATABASE_URL=postgresql://test:test@localhost:5432/test` đặt ở bước Test đang trỏ vào một database **không tồn tại** — nó vô hại chỉ vì làn chính mock hết Prisma.

Nghĩa là bốn CHECK constraint viết tay trong migration — thứ mà `vitest.db.config.ts` nói *"là thứ duy nhất canh"* — **hiện không có ai canh trong CI**. Chúng có thể biến mất trong một lần sửa migration mà không công cụ nào kêu.

Việc này **không phát sinh thêm chi phí** cho sprint: `e2e.yml` dù sao cũng phải dựng service Postgres + `migrate deploy` + `seed`. Chạy thêm `pnpm test:db` trong cùng job đó tốn thêm vài giây và trả xong một khoản nợ từ Sprint 0.

Nghĩa là: làn chính bảo vệ **logic**, làn `test:db` bảo vệ **ràng buộc database**, và không có gì bảo vệ **chỗ nối giữa hai đầu**. Bug slug ở Sprint 3 (test dùng cuid, seed dùng `demo-job-cafe-toi`, 7/9 tin thật 404) rơi đúng vào khe đó, và nó đã lọt qua cả hai làn.

### Hai luồng nào

Không phải "E2E cho mọi thứ". Đúng **hai** kịch bản, chọn theo tiêu chí: *một lỗi ở đây làm buổi bảo vệ dừng lại*.

| Luồng | Các bước | Vì sao chọn |
| --- | --- | --- |
| **A — Đăng tin** | NTD đăng nhập → đăng tin → admin duyệt → tin hiện ở `/viec-lam` cho **khách chưa đăng nhập** | Đây là luồng đi qua nhiều tay nhất (NTD → admin → khách) và là luồng duy nhất chạm cả ba vai. Bước cuối — thấy được **khi chưa đăng nhập** — là thứ không lớp test nào hiện có kiểm |
| **B — Ứng tuyển** | SV đăng nhập → tìm tin → nộp đơn → NTD thấy đơn, **không thấy số điện thoại** → mời phỏng vấn → **số điện thoại hiện ra** | Đây là đúng câu chuyện đem đi bảo vệ. Và nó chứa luật bảo vệ dữ liệu — thứ phải kiểm bằng máy chứ không bằng mắt |

Luồng B kiểm cả một khẳng định âm (*"chưa mời thì không có số"*). Theo `nep-kiem-thu.md` mục 2: thứ sai mà không có biểu hiện phải được kiểm ở chỗ nó được quyết định. Ở tầng E2E, "chỗ nó được quyết định" là **response mạng**, không phải pixel trên màn hình — nên assert bằng `page.waitForResponse` rồi đọc JSON, đừng chỉ `expect(page.getByText(...)).toBeHidden()`.

### ⚠ Trước khi viết luồng A: một luật nghiệp vụ chưa được chốt

Bản đầu của tài liệu này viết tiêu chí *"bỏ `verifiedAt` khỏi điều kiện lọc tin công khai thì luồng A phải đỏ"*. **Điều kiện đó không tồn tại.** Đọc lại mã nguồn:

| Chỗ | Điều kiện thật |
| --- | --- |
| `listPublicJobs` — [`jobs.service.ts:995`](../apps/api/src/modules/jobs/jobs.service.ts) | `status: 'OPEN'`, **không** lọc `verifiedAt` |
| `getPublicJob` — [`jobs.service.ts:1174`](../apps/api/src/modules/jobs/jobs.service.ts) | `where: { id: jobId, status: 'OPEN' }`, **không** lọc `verifiedAt` |
| `publishJob` — [`jobs.service.ts:474`](../apps/api/src/modules/jobs/jobs.service.ts) | `if (!ntd.verifiedAt) throw …` |

Nghĩa là `verifiedAt` là **cổng lúc đăng**, không phải bộ lọc lúc đọc. Chưa xác minh thì không đưa tin lên `OPEN` được — và đó là một thiết kế hợp lý, rẻ hơn việc lọc lại ở mọi câu truy vấn đọc.

Nhưng nó để hở đúng một đường, và đường đó **có thật vì admin bấm được**:

> `setEmployerVerified(id, false)` ([`admin.service.ts:295`](../apps/api/src/modules/admin/admin.service.ts)) đặt `verifiedAt = null` và **không đụng gì tới các tin đang `OPEN`** của NTD đó. Hook phía web tên đúng là *"Chốt hoặc **thu hồi** xác minh"*.
>
> Vậy: admin thu hồi xác minh một NTD → mọi tin của họ **vẫn hiển thị công khai như cũ**.

Đây là câu hỏi nghiệp vụ, không phải câu hỏi kỹ thuật, và **BA phải chốt trước khi viết test** — viết test trước rồi chốt sau là cách biến hành vi hiện tại thành đặc tả, đúng lỗi loại ba trong [`nep-kiem-thu.md`](nep-kiem-thu.md) mục 1.

Ba đường đi được, xếp theo chi phí:

| Phương án | Làm gì | Chi phí | Đánh đổi |
| --- | --- | --- | --- |
| **A. Giữ nguyên, ghi vào tài liệu** | Không sửa code. Ghi rõ "thu hồi xác minh không gỡ tin đã đăng" | 0 | Trung thực nhưng để hở. Chấp nhận được nếu thu hồi là thao tác hiếm và admin biết phải đóng tin bằng tay |
| **B. Thu hồi thì đóng luôn tin** | `setEmployerVerified(id, false)` đóng mọi tin `OPEN` của NTD đó trong **cùng transaction** | ~2 giờ | Đúng ý định nhất. Nhưng là thao tác phá huỷ: xác minh lại thì tin **không** tự mở lại |
| **C. Thêm `verifiedAt` vào bộ lọc đọc** | Hai câu truy vấn công khai lọc thêm `employerProfile: { verifiedAt: { not: null } }` | ~1 giờ | Tin tự ẩn và tự hiện lại. Nhưng thêm điều kiện vào **đường nóng nhất** của hệ thống, và làm `verifiedAt` bị kiểm ở hai nơi |

**Tôi nghiêng về A cho sprint này**, không phải vì nó đúng nhất mà vì tuần cuối: B và C đều đụng vào đường đọc công khai — thứ mà mọi tính năng khác và cả buổi demo đều dựa vào. Nếu BA chốt B thì làm, nhưng làm **đầu tuần**, không phải ngày 4.

Cho tới khi chốt xong, tiêu chí đột biến của luồng A đổi thành thứ **thật sự có trong code**: sửa `status: 'OPEN'` thành `status: 'PENDING'` trong `listPublicJobs` → luồng A phải đỏ.

### Chạy ở đâu — và vì sao **không** nhét vào `ci.yml`

`ci.yml` hiện chạy trên **mọi push của mọi nhánh**. Thêm E2E vào đó nghĩa là mỗi lần push phải dựng Postgres, chạy migration, seed, build web, khởi động hai server — từ ~2 phút lên ~6–8 phút, cho một lần sửa chính tả trong README.

Tệ hơn: E2E là loại test **có thể đỏ mà không ai sai** (mạng chậm, animation chưa xong, port bị chiếm). Một CI bắt buộc mà thỉnh thoảng đỏ vô cớ sẽ dạy cả nhóm bấm "re-run" theo phản xạ — và cái phản xạ đó không phân biệt được lần đỏ vô cớ với lần đỏ thật.

**Quyết định:** workflow riêng `e2e.yml`, chạy khi mở/cập nhật PR vào `dev` và `main`, **không** chạy trên push nhánh feature.

```yaml
# .github/workflows/e2e.yml — khung, không phải bản chép dán
on:
  pull_request:
    branches: [dev, main]

services:
  postgres:
    image: postgres:17-alpine     # cùng tag với docker-compose.yml, đã đối chiếu
    env: { POSTGRES_PASSWORD: test, POSTGRES_DB: uniwork }
    options: >-
      --health-cmd pg_isready --health-interval 5s --health-retries 10
```

Các bước: `pnpm install` → `prisma migrate deploy` → `prisma db seed` → **`pnpm --filter @uniwork/api test:db`** → `pnpm build` → `playwright install --with-deps chromium` → chạy test → upload `playwright-report/` khi đỏ.

> ⚠ Chỉ một trình duyệt (`chromium`). Ba trình duyệt nhân ba thời gian và không thêm bằng chứng nào cho câu hỏi ta đang hỏi.

Bước `test:db` chèn **trước** Playwright là có chủ ý: nó chạy vài giây và kiểm ràng buộc database. Nếu một CHECK constraint đã biến mất thì E2E cũng sẽ đỏ, nhưng đỏ ở một chỗ xa nguyên nhân — mất nửa buổi truy ngược. Cho làn rẻ và gần nguyên nhân chạy trước.

⚠ `test:db` đòi seed đã chạy (`rang-buoc.test.ts` ném lỗi rõ nếu database rỗng) — nên thứ tự trên **không đảo được**.

### Dữ liệu cho E2E — chỗ dễ sai nhất

E2E khác unit test ở một điểm: **nó không mock được gì cả**, nên nó cần dữ liệu thật, và dữ liệu thật thì có trạng thái còn lại từ lần chạy trước.

Ba luật, chốt trước khi viết dòng đầu tiên:

1. **Mỗi lần chạy dựng lại database từ đầu** — `migrate reset --force` + `db seed`. Không "dọn sau khi chạy": lần chạy đứt giữa chừng thì không có ai dọn cả.
2. **Tài khoản test lấy từ seed, không tự đăng ký trong test.** Đăng ký thật cần OTP email — mà gọi Brevo trong CI là vừa chậm vừa phụ thuộc bên thứ ba. Seed đã có sẵn tài khoản đã xác thực cho cả ba vai.
3. **Test không được giả định id.** Bug slug ở Sprint 3 sinh ra đúng từ việc test tin rằng id có hình dạng cuid. E2E phải **điều hướng bằng thứ người dùng thấy** — bấm vào thẻ tin có tiêu đề X — chứ không dựng URL từ id.

### Chống đỏ vô cớ

| Cấm | Thay bằng |
| --- | --- |
| `waitForTimeout(2000)` | `expect(locator).toBeVisible()` — Playwright tự chờ |
| `page.click('.btn-primary')` | `getByRole('button', { name: 'Gửi hồ sơ' })` — đổi CSS không làm đỏ |
| `retries: 3` | `retries: 0` ở local, `1` ở CI. Retry cao là cách giấu test hỏng |

**Xong nghĩa là:**

- [ ] `pnpm e2e` chạy được ở máy local, không cần thêm bước tay nào ngoài bật Docker
- [ ] Hai luồng đều **xanh ba lần liên tiếp** — chạy một lần xanh chưa chứng minh gì
- [ ] Luồng B có assert **âm**: response ở `PENDING` không chứa `phone`
- [ ] Cố ý phá một thứ (`status: 'OPEN'` → `'PENDING'` trong `listPublicJobs`) → **luồng A đỏ**. Không đỏ nghĩa là test chưa canh gì
- [ ] BA đã chốt phương án A/B/C cho chuyện thu hồi xác minh, và **tài liệu ghi lại lựa chọn đó** — kể cả khi chọn "giữ nguyên"
- [ ] `e2e.yml` chạy trên PR, `ci.yml` **không dài thêm giây nào**
- [ ] **`pnpm test:db` chạy trong `e2e.yml` và đỏ được** — thử bằng cách tạm bỏ một CHECK constraint, xác nhận đỏ, rồi khôi phục. Nợ từ Sprint 0 T22, trả trong sprint này
- [ ] Test đỏ có ảnh chụp màn hình + trace tải về được từ Actions

---

## Tính năng 2 — Responsive

Đây là khoản nợ **T86** từ Sprint 2 (*"Đăng tin được bằng điện thoại, không chỉ xem"*), chưa từng được trả.

### Hiện trạng, đo chứ không đoán

Số dòng có điểm ngắt (`sm:` / `md:` / `lg:` / `xl:`) trên từng trang:

| Trang | Dòng có điểm ngắt | Đánh giá |
| --- | --- | --- |
| `Home.tsx` | 26 | Ổn — trang chủ được chăm nhất |
| `JobList.tsx` | 5 | Ổn |
| `PostJob.tsx` | 5 | Ổn |
| `AdminLayout.tsx` | 7 | Ổn — có sidebar thu gọn |
| `Header.tsx` / `Footer.tsx` | 4 / 4 | Ổn — đã có nút hamburger (`Menu`/`X`) |
| `JobDetail.tsx` | 3 | Cần xem lại — `lg:grid-cols-[1fr_320px]` có, nhưng nội dung bên trong chưa rà |
| `Profile.tsx` | 3 | Cần xem lại |
| `Availability.tsx` | 2 | **Khó nhất cả dự án** — lưới 7 cột × N khung giờ |
| `MyApplications.tsx` | 1 | **Hỏng** |
| **`Applicants.tsx`** | **0** | **Hỏng** — và có `<table className="min-w-[860px]">` |
| **`Auth.tsx`** | **0** | **Hỏng** — cửa vào của toàn hệ thống |
| **`EmployerProfile.tsx`** | **0** | **Hỏng** |
| **`SavedJobs.tsx`** | **0** | **Hỏng** |
| **`VerifyEmail.tsx`** | **0** | **Hỏng** |
| `admin/Users.tsx`, `admin/Skills.tsx` | 0 | Chấp nhận — xem quyết định dưới |
| `NotificationBell.tsx`, `UserMenu.tsx` | 0 / 0 | Cần xem lại — dropdown trên màn hẹp dễ tràn |

> **Cảnh báo về chính bảng này:** "0 điểm ngắt" ≠ "hỏng", và "7 điểm ngắt" ≠ "đúng". Một trang chỉ có một cột chữ thì không cần điểm ngắt nào. Bảng trên là **thứ tự đi kiểm**, không phải danh sách việc phải sửa. Kiểm bằng mắt trên máy thật rồi mới quyết.

Nhưng ba dòng in đậm thì gần như chắc chắn hỏng, vì lý do cấu trúc chứ không phải vì con số:

- `Applicants.tsx` — bảng `min-w-[860px]` trong màn 390px. Có `overflow-x-auto` nên **không vỡ layout**, nhưng NTD phải kéo ngang để thấy cột hành động. Đây là màn hình NTD dùng nhiều nhất.
- `Auth.tsx` — 13.2K không một điểm ngắt. Nếu form đăng nhập hỏng trên điện thoại thì **không có gì phía sau nó được xem cả**.
- `Availability.tsx` — lưới lịch tuần. Đây là tính năng lõi khác biệt của sản phẩm; nếu sinh viên không khai lịch được bằng điện thoại thì cả thuật toán ghép lịch không có đầu vào.

### Quyết định: đâu là "đủ", đâu là "quá"

Không phải mọi trang đều phải đẹp trên điện thoại. Chia theo **ai dùng nó ở đâu**:

| Nhóm | Trang | Mức yêu cầu |
| --- | --- | --- |
| **Sinh viên** — dùng bằng điện thoại là chính | `Auth`, `JobList`, `JobDetail`, `Profile`, `Availability`, `MyApplications`, `SavedJobs`, `VerifyEmail` | **Dùng được đầy đủ ở 390px.** Không cuộn ngang, không chữ dưới 14px, vùng bấm ≥ 44px |
| **Nhà tuyển dụng** — hay dùng máy tính, nhưng xem đơn thì mở điện thoại | `PostJob`, `Applicants`, `EmployerProfile` | **Xem được và hành động được** ở 390px. Đăng tin dài thì chấp nhận cuộn dọc |
| **Admin** — luôn ngồi máy tính | 6 trang `admin/` | **Cuộn ngang là chấp nhận được.** `min-w-[820px]` giữ nguyên |

Dòng cuối là một quyết định có chủ đích, không phải bỏ sót: bảng admin có 6–8 cột, ép xuống 390px thì phải đổi sang thẻ dọc — viết lại 6 trang cho một người dùng duy nhất luôn ngồi máy tính. **Ghi vào tài liệu bàn giao rằng khu admin yêu cầu màn ≥ 1024px**, thế là đủ.

### Cách sửa bảng ứng viên

`Applicants.tsx` là trường hợp khó nhất trong nhóm phải sửa. Hai hướng:

| Hướng | Chi phí | Vấn đề |
| --- | --- | --- |
| Giữ bảng, cho cuộn ngang | 0 | Cột hành động nằm ngoài màn. NTD không biết là có nút |
| **Bảng ở `md:`, thẻ dọc ở dưới `md:`** | ~2–3 giờ | Hai bản trình bày cho một dữ liệu, phải nhớ sửa cả hai |

Chọn hướng hai, và giảm chi phí bằng cách **tách phần trình bày một ứng viên ra một component dùng chung cho cả hai bản** — bảng dựng nó thành `<tr>`, thẻ dựng nó thành `<article>`, nhưng logic nhãn trạng thái / chip phù hợp / nút hành động chỉ có một chỗ. Nếu tách được thì "hai bản" chỉ là hai cái khung, không phải hai bản sao.

> ⚠ Tính năng 3 cũng sửa `MyApplications.tsx`. Làm 3 xong hẳn rồi mới thêm điểm ngắt, hoặc một người làm cả hai — đúng cách đã áp cho `Applicants.tsx` giữa tính năng 2 và 3 của Sprint 4.

**Xong nghĩa là:**

- [ ] Mở từng trang nhóm "Sinh viên" ở **390px** — không trang nào cuộn ngang
- [ ] Khai được lịch rảnh **bằng ngón tay trên máy thật**, không phải bằng chuột trong DevTools
- [ ] Đăng nhập, nộp đơn, xem đơn — cả ba làm trọn trên điện thoại thật
- [ ] Bảng ứng viên ở dưới `md:` hiện dạng thẻ, **nút hành động nhìn thấy được không cần kéo ngang**
- [ ] Không vùng bấm nào nhỏ hơn 44×44px trên các trang nhóm "Sinh viên"
- [ ] Chạy lại toàn bộ 140 test web — đổi layout không được làm đỏ test nào
- [ ] Đã ghi vào README: khu admin cần màn ≥ 1024px

---

## Tính năng 3 — Liên hệ hai chiều

### Vòng khép kín của Sprint 4 đang khuyết một nửa

Luồng đã chốt ở Sprint 4:

```
Sinh viên → Nộp đơn → NTD xem hồ sơ → Mời phỏng vấn → MỞ LIÊN HỆ → NTD gọi ra ngoài
```

Chữ "MỞ LIÊN HỆ" hiện chỉ mở **một chiều**. `applications.service.ts` có hai câu truy vấn trong một transaction, một dùng `CHON_UNG_VIEN_KIN`, một dùng `CHON_UNG_VIEN_MO` — và cả hai đều mở *thông tin của sinh viên cho nhà tuyển dụng*. Không có chiều ngược lại.

Đặt vào cảnh thật:

> Sinh viên nộp đơn thứ Hai. Thứ Tư mở app thấy trạng thái đổi thành **"Đã mời phỏng vấn"**. Thứ Năm có số lạ gọi tới. Bạn ấy đang đi học, thấy số lạ — **không nghe**.

Hệ thống biết chính xác ai sắp gọi, và không nói. Đây không phải tính năng thêm cho đẹp; nó là **nửa còn lại của thứ đã tự nhận là khép kín**.

### Và nó làm sống lại ba cột chết

Sprint 4 đã rà toàn bộ schema tìm cột chết và tìm được sáu. Ba cột đã trả về cho sinh viên (`phone`, `availableUntil`, `expectedHourlyRate`). Ba cột còn lại đều thuộc `EmployerProfile`, và đều được ghi chú là "nợ có tài liệu":

| Cột | Kiểm lại hôm nay |
| --- | --- |
| `EmployerProfile.phone` | Có cột. **Không màn hình web nào ghi, không màn hình nào đọc** |
| `EmployerProfile.contactName` | Seed ghi, `admin.service.ts:129` đọc — nhưng chỉ để **ghép vào chuỗi tìm kiếm** ở `ReviewEmployers.tsx:100`. Không ai *nhìn thấy* nó |
| `EmployerProfile.logoUrl` | `profile.service.ts` trả về trong API, `api.ts:317` khai kiểu — `grep` toàn bộ `apps/web/src`: **0 kết quả**. Trả về rồi vứt đi |

Ba cột này chết vì **chưa có ai cần chúng**. Tính năng này là người cần. Đây là lý do nó được chọn thay vì "xoá ba cột cho sạch": xoá thì mất luôn khả năng trả lời câu hỏi của sinh viên, mà câu hỏi đó có thật.

> ⚠ **Chết sâu hơn tưởng.** [`profile.service.ts:246–265`](../apps/api/src/modules/profile/profile.service.ts) — `updateEmployerProfile` **đọc** `contactName` và `phone` trong mệnh đề `select` trả về, nhưng khối `data:` chỉ ghi bốn trường `companyName` / `description` / `address` / `website`. `EmployerProfileInput` ở [`useProfile.ts:133`](../apps/web/src/hooks/useProfile.ts) cũng đúng bốn trường đó.
>
> Nghĩa là **API tự nó cũng không nhận hai trường này** — không phải chỉ thiếu ô nhập trên form. Nên nửa "cho NTD nhập" gồm bốn chỗ, không phải một: Zod schema → `updateEmployerProfile` → `EmployerProfileInput` → form. Ước tính lại tính năng này theo con số đó.

### Luật: đối xứng, cùng một mốc

Không phát minh luật mới. Dùng **đúng** luật đã có, soi gương:

| | Hiện có (Sprint 4) | Thêm (Sprint 5) |
| --- | --- | --- |
| Ai thấy | NTD thấy liên hệ của SV | SV thấy liên hệ của NTD |
| Mở khi | `TRANG_THAI_MO_LIEN_HE` = `SHORTLISTED`, `ACCEPTED` | **Y hệt** |
| Đóng lại khi | Đơn `WITHDRAWN` | **Y hệt** |
| Lọc ở đâu | Mệnh đề `select` của Prisma | **Y hệt** |

Dùng lại hằng `TRANG_THAI_MO_LIEN_HE` đã có trong `domain.ts` — **không** viết danh sách trạng thái thứ hai. Sprint 4 đã có một lần chép tay danh sách trạng thái rồi phải sửa lại thành `TRANG_THAI_KET_THUC.includes(...)`; hai bản của cùng một luật là hai chỗ để lệch nhau.

**Điểm khác biệt duy nhất, và phải viết vào chú thích:** liên hệ của sinh viên là **dữ liệu cá nhân** — số điện thoại của một người cụ thể. Liên hệ của nhà tuyển dụng là **thông tin doanh nghiệp** — số tổng đài, tên người phụ trách. Mức nhạy cảm khác nhau. Ta vẫn khoá cùng mốc, nhưng vì lý do khác: không phải để bảo vệ NTD, mà để **giữ đúng một luật duy nhất trong hệ thống** thay vì hai luật gần giống nhau.

### Chỗ sửa

Endpoint đã có, không thêm endpoint mới:

| Method | Đường dẫn | Sửa gì |
| --- | --- | --- |
| `GET` | `/api/toi/don-ung-tuyen` | `CHON_DON_SINH_VIEN` thêm nhánh liên hệ khi trạng thái mở |
| `PUT` | `/api/toi/ho-so-ntd` | Nhận thêm `contactName` + `phone` — xem cảnh báo ở trên, hiện API **không nhận** |

Chỗ sửa chính xác là [`applications.service.ts:317–330`](../apps/api/src/modules/applications/applications.service.ts):

```ts
const CHON_DON_SINH_VIEN = {
  ...CHON_DON,
  job: {
    select: {
      id: true,
      title: true,
      employerProfile: { select: { companyName: true, verifiedAt: true } },
      //                                ↑ thêm contactName + phone ở nhánh MỞ
    },
  },
  events: { orderBy: { createdAt: 'asc' as const }, select: { … } },
} satisfies Prisma.ApplicationSelect
```

Cùng kỹ thuật **hai hằng `select`** mà tính năng 2 của Sprint 4 đã dùng (`CHON_UNG_VIEN_KIN` / `CHON_UNG_VIEN_MO`, `applications.service.ts:454–469`). Prisma `select` là **theo câu truy vấn, không theo từng hàng**, nên không thể vừa lấy vừa che trong một lượt — phải hai câu, gộp trong một `$transaction`. Đây là chỗ dễ làm sai nhất và nó đã được giải một lần rồi; **đọc lại đoạn đó trước khi viết dòng đầu tiên**.

Và dùng lại đúng mẹo đã có ở `toApplicantItem` (dòng 580–582):

```ts
// `user` chỉ có mặt ở nhánh MỞ. Không cần kiểm lại trạng thái ở đây — hình
// dạng dữ liệu ĐÃ nói lên quyền, đó chính là điều phương án hai-truy-vấn mua được.
contact: sv.user ? { phone: sv.phone ?? null, email: sv.user.email } : null,
```

Chiều sinh viên phải giữ nguyên tính chất đó: hàm dựng response **không được kiểm lại `status`** để quyết định có che hay không. Kiểm hai lần ở hai tầng là hai chỗ để lệch nhau; nếu câu truy vấn không xin thì dữ liệu không có, thế là xong.

> ⚠ `getStudentApplication` (dòng 368–387) chạy **hai `findUnique`** — một để kiểm chủ sở hữu, một để lấy dữ liệu. Nhánh liên hệ phải vào **câu thứ hai**, và đừng nhân đôi câu thứ nhất theo. Sửa nhầm chỗ thì endpoint vẫn chạy đúng nhưng tốn thêm một lượt truy vấn cho mọi request.

**FE:** trong `MyApplications.tsx`, đơn ở `SHORTLISTED`/`ACCEPTED` hiện thêm một khối:

> **Nhà tuyển dụng sẽ liên hệ với bạn**
> Quán Cà phê Sương Mai · Chị Lê Thị Sương · 0901 234 567
> *Số này có thể gọi tới bạn trong vài ngày tới.*

Câu cuối là phần quan trọng nhất — nó là lý do tính năng tồn tại. Ở trạng thái thấp hơn thì **hiện ô khoá kèm câu giải thích**, không giấu hẳn ô: cùng cách đã áp cho phía NTD ở Sprint 4, và cùng lý do — người dùng cần biết thông tin đó tồn tại và biết cách mở.

**Thứ tự bắt buộc bên trong tính năng này:** nửa **nhập** phải xong trước nửa **hiện**. Làm ngược lại thì mọi đơn đều hiện "chưa cập nhật" và không có cách nào thử được — kể cả dữ liệu seed cũng không cứu được, vì seed ghi thẳng vào database chứ không đi qua endpoint đang cần kiểm.

Kiểu `StudentApplicationItem` đã có sẵn khối lồng `job.employer` (`applications.service.ts:340–347`), nên chỗ nhét thông tin liên hệ vào response đã có hình dạng rõ ràng — thêm một trường `contact` cạnh `companyName` / `verified`, đối xứng với `ApplicantItem.contact` phía NTD.

**Nhưng không dùng lại nguyên `ThongTinLienHe`.** Kiểu đó ở [`api.ts:998`](../packages/shared/src/api.ts) là:

```ts
export interface ThongTinLienHe {
  phone: string | null
  email: string
}
```

Nó **không có `contactName`**, mà giao diện thì cần tên người phụ trách — "Chị Lê Thị Sương" là thứ làm khối liên hệ có ích, không phải con số trần. Ép dùng lại thì hoặc mất tên, hoặc phải thêm `contactName` vào kiểu chung và bên sinh viên nhận một trường luôn `null` — hai cách đều tệ.

Đúng hình dạng là **mở rộng**, không phải dùng lại và cũng không phải khai kiểu thứ hai từ đầu:

```ts
/** Liên hệ phía nhà tuyển dụng — có thêm TÊN người phụ trách. */
export interface LienHeNhaTuyenDung extends ThongTinLienHe {
  contactName: string | null
}
```

`phone: string | null` giữ nguyên vì NTD có thể chưa điền. `email` giữ **bắt buộc** vì tài khoản nào cũng có email đăng nhập — đây là chỗ hai chiều thật sự giống nhau, nên phần chung nằm trong kiểu cha là đúng.

> Điều này cũng làm rõ hơn cái mà mục *"Luật: đối xứng"* ở trên đang nói: đối xứng là ở **luật mở khoá**, không phải ở **hình dạng dữ liệu**. Hai bên khoá cùng một mốc, nhưng thứ được mở ra thì khác nhau — một bên là dữ liệu cá nhân, một bên là thông tin doanh nghiệp có kèm tên người phụ trách.

**Test:**

- Đơn `PENDING` / `VIEWED` → response **không chứa** `employerProfile.phone`. Assert trên **hình dạng câu truy vấn** (`select`), không assert trên JSON trả về — theo `nep-kiem-thu.md` mục 2
- Đơn `SHORTLISTED` → có
- Đơn `WITHDRAWN` sau khi từng ở `SHORTLISTED` → **không** có
- NTD chưa điền `phone` → hiện "chưa cập nhật", **không** hiện `null` và không sập trang
- SV A không đọc được đơn của SV B (ca này đã có, chạy lại để chắc không vỡ)

**Xong nghĩa là:**

- [ ] `curl` bằng token sinh viên trên đơn `PENDING` — `grep` số điện thoại NTD **không ra gì**
- [ ] Cùng đơn đó sau khi NTD bấm "Mời phỏng vấn" — ra
- [ ] Rút đơn → đóng lại
- [ ] NTD sửa được `phone` và `contactName` trong trang hồ sơ, và giá trị **ghi xuống database** (kiểm bằng `psql`, không kiểm bằng cách F5 rồi thấy chữ — đây đúng là bẫy đã dẫm ở Sprint 4 với số điện thoại sinh viên)
- [ ] Đủ **bốn** chỗ của nửa nhập: Zod → `updateEmployerProfile` → `EmployerProfileInput` → form
- [ ] Hàm dựng response **không kiểm lại `status`** — che nằm ở câu truy vấn, không ở tầng trình bày
- [ ] Không có danh sách trạng thái nào bị chép tay — `grep "SHORTLISTED'" apps/api/src` chỉ ra chỗ khai hằng
- [ ] `LienHeNhaTuyenDung extends ThongTinLienHe` — mở rộng, không chép kiểu thứ hai gần giống, cũng không nhét `contactName` vào kiểu chung
- [ ] Quyết xong `logoUrl`: hoặc hiện trong khối liên hệ, hoặc **xoá cột** ở tính năng 5. Không để nguyên trạng "trả về rồi vứt"

---

## Tính năng 4 — Tìm kiếm không dấu

`sprint-3.md` khi làm full-text search đã ghi rõ giới hạn này và cố ý hoãn:

> *"tìm không dấu có khớp có dấu hay không (quyết định rõ — Postgres `ILIKE` mặc định **không** bỏ dấu tiếng Việt; nếu cần, để Sprint sau, ghi rõ giới hạn này trong tài liệu bàn giao)"*

Sprint sau là bây giờ. Và lý do làm nó **không phải** vì hoàn thiện cho đủ:

> Trong buổi bảo vệ, người chấm gõ vào ô tìm kiếm. Họ gõ **`gia su`** — không dấu, như mọi người gõ trên điện thoại. Hệ thống trả về **0 kết quả**, trong khi database có 4 tin gia sư.

Đó là mười giây khó chữa nhất của cả buổi. Chi phí sửa: một migration một dòng và một mệnh đề `WHERE`.

### Cách làm

Postgres có sẵn extension `unaccent`. Migration:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

Rồi đổi nhánh tìm kiếm ở `jobs.service.ts:911`. Hiện tại là Prisma `contains` — mà Prisma **không** gọi được hàm SQL trong `where`, nên nhánh này phải chuyển sang `$queryRaw` lấy danh sách `id` khớp, rồi `where: { id: { in: ids } }`.

```sql
SELECT id FROM jobs
WHERE unaccent(title) ILIKE unaccent($1)
   OR unaccent(description) ILIKE unaccent($1)
```

**Chỉ nhánh `q` đổi.** Mọi bộ lọc khác giữ nguyên trong Prisma. Đây là ranh giới phải giữ chặt: viết lại cả `listPublicJobs` bằng SQL thô ở tuần cuối là đổi một hàm 100 dòng đã có 40 test đứng canh lấy một hàm mới chưa ai chạy.

### Ba chỗ dễ vấp

| Bẫy | Xử lý |
| --- | --- |
| **`unaccent` không dùng được trong index thường** — nó `STABLE` chứ không `IMMUTABLE` | Không tạo index. Ở 30–50 tin thì quét tuần tự dưới 5ms. Nếu sau này cần: bọc `IMMUTABLE` rồi tạo index biểu thức — **không làm ở sprint này** |
| **Neon có cho `CREATE EXTENSION` không** | Có, `unaccent` nằm trong danh sách hỗ trợ. Nhưng **thử trên Neon trước khi viết code**, không phải sau — sai ở bước này thì cả tính năng đổ |
| **`$queryRaw` là cửa SQL injection** | `$queryRaw` với tham số `${}` của Prisma là prepared statement, an toàn. `$queryRawUnsafe` thì **không** — không dùng, dù chỉ để thử nhanh |

**Test:** `gia su` khớp `Gia sư`; `Gia sư` khớp `gia su`; `GIA SU` khớp (đã không dấu vẫn phải không phân biệt hoa thường); `đ` ↔ `d` (⚠ `unaccent` mặc định **có** xử lý `đ`→`d`, nhưng phải xác nhận bằng test thật chứ không tin); chuỗi rỗng trả về như không lọc; `%` và `_` trong từ khoá **không** thành ký tự đại diện.

**Xong nghĩa là:**

- [ ] `CREATE EXTENSION` chạy được **trên Neon**, không chỉ trên Postgres local
- [ ] `gia su` và `Gia sư` cho **cùng một tập kết quả** — so bằng số lượng và bằng danh sách id
- [ ] Ca `đ`/`d` có test, và test đó phản ánh hành vi thật đã đo, không phải hành vi mình đoán
- [ ] `%` trong từ khoá không làm vỡ kết quả
- [ ] Toàn bộ test lọc/sắp xếp cũ vẫn xanh — đây là chỗ dễ làm hỏng nhất
- [ ] Đo thời gian truy vấn trên dữ liệu seed, ghi lại con số vào PR

---

## Tính năng 5 — Dọn nợ & dữ liệu bảo vệ

Làm **cuối cùng**, một PR riêng. Gồm ba nhóm việc không liên quan nhau nhưng cùng một tính chất: chúng đều là *thứ người ngoài nhìn thấy*.

### 5a. Xoá cột chết

Sprint 4 rà ra sáu cột chết. Tình trạng sau khi kiểm lại hôm nay:

| Cột | Hiện trạng | Quyết định |
| --- | --- | --- |
| `StudentProfile.phone` | Đã dùng thật | Giữ |
| `StudentProfile.availableUntil` | Đã dùng thật — nuôi thành phần `commitment` khi chấm điểm | Giữ |
| `StudentProfile.expectedHourlyRate` | Đã dùng thật | Giữ |
| `StudentProfile.availableFrom` | **0 chỗ đọc.** Chỉ `seed.ts:759` ghi vào | **Xoá** |
| `EmployerProfile.phone` / `contactName` | Sống lại nhờ tính năng 3 | Giữ |
| `EmployerProfile.logoUrl` | Trả về API, `apps/web/src` không dùng dòng nào | **Quyết ở tính năng 3.** Không hiện thì xoá |

> ⚠ `availableFrom` chồng lấn với thiết kế trong [`lich-ranh-co-han-dung.md`](lich-ranh-co-han-dung.md). Sprint 4 đã ghi nghi vấn *"rất có thể mức hồ sơ đã đủ và việc kia không cần làm nữa"*. **Xoá cột không tự trả lời câu hỏi đó** — nên khi xoá, ghi một dòng vào tài liệu kia: *"`availableFrom` đã xoá ở Sprint 5; nếu làm hạn dùng lịch rảnh thì thiết kế lại từ đầu, đừng tìm cột này."* Xoá mà không để lại vết là cách người sau mất nửa ngày.

### 5b. Sửa tài liệu cho khớp mã nguồn

Sprint này bắt đầu bằng việc phát hiện kế hoạch lệch mã nguồn. Không sửa thì người chấm cũng sẽ phát hiện, và họ phát hiện ở buổi bảo vệ.

| File | Sai gì | Sửa thành |
| --- | --- | --- |
| `README.md` mục 7 | Sprint 5 hứa *"báo cáo vi phạm"* — chưa có bảng, chưa có endpoint | **Chỉ sửa nếu chốt cắt ở cuối ngày 3.** Nếu quyết làm thì README đang đúng, không đụng |
| `README.md` mục 7 | Có dòng *"Sprint 6 — Tài liệu, 1 tuần"* nhưng timeline chỉ có 8 tuần | Gộp vào Sprint 5 cho khớp |
| `schema.prisma:7` | *"Hai bảng job_reports và bảng thống kê admin vẫn để dành cho Sprint 5–6"* — bảng thống kê **không cần** vì dashboard tính trực tiếp | Viết lại: `job_reports` là hướng phát triển, không phải việc đang chờ |
| `timeline-8-tuan.md` | Cột Sprint 5 mô tả admin | Ghi chú admin đã hoàn thành sớm ở Sprint 1–2, Sprint 5 đổi phạm vi |
| `sprint-4.md` mục *Việc còn nợ* | Ghi Sprint 3 tính năng 2 và 5 còn nợ — **cả hai đã xong** | Đánh dấu đã trả |
| README + tài liệu bàn giao | Chưa ghi giới hạn nào | Thêm: khu admin cần màn ≥ 1024px; `viewCount` đếm lượt mở không khử trùng lặp theo người |

> ⚠ **Nhãn "Lượt xem" trên trang quản lý tin.** Con số này đếm mỗi lần trang chi tiết được mở (đã trừ chủ tin, sửa ở Sprint 4), **không** khử trùng lặp theo người. Sửa cho đúng cần bảng `JobView` — đã cắt ở mục phạm vi. Nên **đổi nhãn thành "Lượt mở"**: một chữ, không đụng backend, và nó nói đúng thứ đang được đếm. Đây là cách rẻ nhất để một con số không nói dối.

### 5c. Dựng cảnh cho buổi bảo vệ

`seed.ts` hiện 1012 dòng, dựng **dữ liệu để phát triển** — nhiều trạng thái, phủ hết các nhánh, tốt cho việc code. Đó không phải thứ cần cho buổi bảo vệ. Buổi bảo vệ cần **một câu chuyện đi được từ đầu đến cuối, không có gì thừa trên màn hình**.

### ⚠ Sửa seed KHÔNG dựng được cảnh trên bản deploy

Đây là chỗ bản đầu của tài liệu này viết sai, và sai theo kiểu tốn cả buổi mới phát hiện. [`seed.ts:965–981`](../apps/api/prisma/seed.ts):

```ts
async function main() {
  const skillIds = await seedSkills()          // ← dữ liệu tham chiếu: LUÔN nạp

  if (!laDatabaseNoiBo()) {                    // ← hostname phải nằm trong HOST_NOI_BO
    console.log('DATABASE_URL không trỏ tới máy này — bỏ qua toàn bộ dữ liệu demo.')
    return                                     // ← thoát TRƯỚC mọi thứ demo
  }
  …
}
```

Và lệnh build của Render **gọi `prisma db seed` ở mỗi lần deploy** (`seed.test.ts` tồn tại chính vì lý do đó). Nên trên Neon, mỗi lần deploy seed chạy, nạp danh mục kỹ năng, rồi **thoát ngay tại dòng `return`**. Không tài khoản, không tin, không đơn.

Cái chặn này **đúng và phải giữ**. Chú thích ngay trên nó đã nói vì sao, và cũng đã nói sẵn cách làm đúng:

> *"Biến `DATABASE_URL` rất dễ trỏ nhầm khi đang chuyển qua lại giữa Docker local và Neon — chỉ cần một lần chạy nhầm là dữ liệu giả nằm lẫn trong database thật… Tài khoản để demo trên bản deploy nên được tạo qua chính form đăng ký đó, không phải bằng seed."*

**Vậy dựng cảnh trên deploy bằng cách nào?** Đi qua chính sản phẩm — và đó không phải giải pháp chữa cháy, nó là **buổi tổng duyệt thật**:

| Bước | Làm ở đâu | Bắt được lỗi gì mà seed không bắt được |
| --- | --- | --- |
| 1. Đăng ký 1 SV + 1 NTD bằng form thật | Web deploy | Email OTP qua Brevo **có tới hộp thư thật không** — seed bỏ qua hoàn toàn khâu này |
| 2. Xác thực email bằng OTP thật | Hộp thư | Đường dẫn xác thực trong email có trỏ đúng domain production không |
| 3. NTD nộp giấy tờ, admin duyệt, xác minh | Web deploy | Upload Cloudinary chế độ `authenticated` chạy thật |
| 4. NTD đăng tin, admin duyệt tin | Web deploy | Đúng luồng của E2E luồng A, nhưng trên hạ tầng thật |
| 5. SV khai hồ sơ + lịch rảnh + kỹ năng, nộp đơn | Web deploy | Chấm điểm phù hợp trên dữ liệu thật, ra đủ 3/3 tiêu chí |
| 6. NTD mời phỏng vấn | Web deploy | Mở liên hệ hai chiều (tính năng 3) trên bản thật |

**Tài khoản admin là trường hợp riêng** — không có form đăng ký nào tạo ra vai `ADMIN`. Kiểm `bootstrap-admin.ts` (có `bootstrap-admin.test.ts`) xem cơ chế hiện tại tạo admin thế nào trên deploy; nếu nó chạy bằng biến môi trường thì dùng đúng đường đó, **đừng** `UPDATE users SET role='ADMIN'` bằng tay trong Neon.

Việc này mất khoảng **2–3 giờ** và phải làm **trước ngày bảo vệ ít nhất 3 ngày**, không phải tối hôm trước — vì nếu bước 2 hỏng (Brevo hết quota, email vào spam) thì cần thời gian để sửa.

Đổi lại, `seed.ts` chỉ cần sửa cho **máy local** — để cả nhóm và E2E có cảnh sạch. Hai môi trường, hai cách, và cái chặn `laDatabaseNoiBo()` giữ nguyên không đụng tới.

### Cảnh cần có (áp cho cả hai môi trường)

- **Ba tài khoản đã đăng nhập sẵn được**, mật khẩu ghi trong kịch bản, email **đã xác thực** — không ai muốn chờ OTP trước mặt hội đồng
- **Một tin còn hạn, `OPEN`, thuộc NTD đã `verifiedAt`** — và kiểm rằng nó thật sự hiện ở `/viec-lam` khi **đăng xuất**
- **Một đơn ở mỗi trạng thái** để mở màn hình nào cũng có gì đó, không có ô trống
- **Một sinh viên hồ sơ đầy đủ** — có lịch rảnh, có kỹ năng, có `availableUntil` — để chip điểm phù hợp hiện đủ **3/3 tiêu chí**, không hiện "tính trên 1/3"
- **Một tin đang chờ duyệt** để demo được thao tác duyệt của admin ngay tại chỗ

Và một việc dễ quên: **kiểm số giờ Render còn lại**. Gói free có 750 giờ/tháng; timeline đã liệt kê "Render free bị treo" là rủi ro có thật và đã từng chạm. Kiểm **trước buổi bảo vệ ba ngày**, không phải sáng hôm đó.

**Xong nghĩa là:**

- [ ] `pnpm db:reset && pnpm db:seed` trên **máy sạch** cho ra đúng cảnh trên — đây là môi trường **local**
- [ ] Cảnh trên bản **deploy** dựng bằng **6 bước đi qua form thật**, xong ít nhất 3 ngày trước bảo vệ. Có ảnh chụp từng bước làm bằng chứng
- [ ] `laDatabaseNoiBo()` **vẫn còn nguyên** trong `seed.ts` — không ai gỡ nó "cho tiện"
- [ ] `pnpm --filter @uniwork/api test:db` vẫn xanh sau khi sửa seed — `seed.test.ts` canh tính chất chạy lại nhiều lần không sinh bản sao, mà Render gọi `db seed` ở **mỗi lần deploy**
- [ ] Đăng xuất hoàn toàn → mở link deploy thật → thấy tin → đăng nhập → nộp đơn. Không bước nào cần giải thích
- [ ] Quyết định về báo cáo vi phạm **đã chốt và ghi lại** (làm hay cắt), README và `schema.prisma:7` khớp với quyết định đó
- [ ] `grep -rn "Sprint 6" README.md docs/` không còn hứa một sprint không tồn tại
- [ ] Migration xoá cột chạy được trên Neon, và `pnpm test` vẫn xanh sau khi xoá
- [ ] Dashboard Render báo số giờ còn dư an toàn tới ngày bảo vệ
- [ ] Một người trong nhóm **chưa từng đụng code phần này** tự đi hết kịch bản, không hỏi ai

---

## BA — trọng tâm đổi, khối lượng không đổi

Sprint này BA không còn sprint sau để chạy trước, nên toàn bộ thời gian dồn vào **kiểm chứng và trình bày**.

| Việc | Kết quả cần đạt |
| --- | --- |
| Kiểm thử toàn hệ thống trên bản deploy thật | Bảng test case có cột kết quả thực tế, đi cả 5 sprint chứ không riêng sprint này |
| **Kiểm thử trên điện thoại thật** | Ít nhất 2 máy khác nhau, ghi rõ model + kích thước màn. Đây là đầu vào trực tiếp cho tính năng 2 — làm **sớm trong tuần**, không phải cuối tuần |
| Kịch bản demo có tính giờ | Từng bước, ai bấm gì, mất bao lâu. Chạy thử **ba lần bấm giờ** — lần đầu luôn dài gấp đôi ước tính |
| Chương 5 + hoàn thiện báo cáo | Trong đó có một mục đáng viết riêng: **vì sao điểm phù hợp không hiện thành một con số trần trụi** — đây là phần thiết kế sâu nhất của cả đồ án |
| Slide | Ghi rõ phần nào **cố tình** không làm và vì sao. Hội đồng hỏi "sao không có X" thì câu trả lời tốt nhất là "có cân nhắc, đây là lý do", không phải "chưa kịp" |
| Video demo | Quay sau khi tính năng 1–4 đã xong. Quay sớm thì phải quay lại |
| Bảng câu hỏi dự kiến | Ít nhất: vì sao không phải ATS; điểm phù hợp tính thế nào; bảo vệ dữ liệu cá nhân ra sao; xử lý thế nào khi hai người cùng ứng tuyển một lúc |

---

## Tự kiểm trước khi coi một tính năng là xong

Áp cho mọi tính năng ở trên — chạy trước **mỗi** commit, không phải trước khi cả sprint xong:

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` — kiểm bằng **exit code**, không phải bằng `grep` output
- [ ] Chạy bằng **lệnh của repo**, không tự chế lệnh tương đương. Sprint 4 đã lọt một lỗi TS2345 vì tự gõ `tsc -b` trong khi repo dùng `tsc --noEmit`
- [ ] ⚠ **Chạy toàn bộ suite** (347 API + 140 web), không chỉ test vừa viết. Tuần này câu hỏi *"tôi có làm hỏng gì ngoài ý muốn không"* quan trọng hơn mọi tuần trước, vì không còn sprint nào phía sau
- [ ] ⚠ **`pnpm --filter @uniwork/api test:db` cũng phải chạy** — làn thứ hai, cần `pnpm db:up && pnpm db:seed` trước. Bắt buộc với mọi thay đổi đụng `schema.prisma`, migration, hoặc `seed.ts`. `pnpm test` **không** thay thế được nó: làn chính mock Prisma nên mù hoàn toàn với CHECK constraint
- [ ] ⚠ **Đột biến ít nhất một chỗ** cho mỗi tính năng có logic mới: phá một dòng, xem test có đỏ đúng chỗ không, rồi khôi phục. Không đỏ nghĩa là lỗ hổng test
- [ ] Thông tin liên hệ **không nằm trong response** khi đơn dưới `SHORTLISTED` — kiểm cả hai chiều, kiểm bằng `curl`
- [ ] Không có luật nghiệp vụ nào bị chép tay lần thứ hai — dùng hằng trong `domain.ts`
- [ ] Đã mở trên **máy thật**, không chỉ DevTools thu nhỏ
- [ ] Đã thử trên **bản deploy thật**, không chỉ trên máy
- [ ] Tài liệu đã sửa **cùng commit** với mã nguồn, không để dồn sang tính năng 5

---

## Rủi ro của riêng sprint này

| Rủi ro | Dấu hiệu sớm | Xử lý |
| --- | --- | --- |
| **Sửa lỗi làm sinh lỗi mới, không còn sprint nào bắt** | Test đỏ ở file không liên quan tới thứ vừa sửa | Đây chính là lý do E2E xếp **đầu** sprint. Nếu ngày 2 mà E2E chưa chạy được thì **dừng mọi tính năng khác** cho tới khi nó chạy |
| **E2E ngốn hết tuần** — hạ tầng mới luôn lâu hơn ước tính | Hết ngày 2 mà chưa có luồng nào xanh | Cắt xuống **một** luồng (B — ứng tuyển, vì nó chứa luật bảo vệ dữ liệu). Một luồng chạy được hơn hai luồng dở dang |
| **E2E đỏ vô cớ, cả nhóm học cách bỏ qua** | Bấm re-run là xanh | `retries: 0` ở local. Đỏ vô cớ hai lần liên tiếp thì **xoá ca đó**, đừng để nó dạy cả nhóm mất niềm tin vào CI |
| **Responsive lan thành thiết kế lại** | Bắt đầu đổi màu, đổi khoảng cách, đổi bố cục desktop | Phạm vi là **điểm ngắt**, không phải thiết kế. Desktop không được đổi một pixel nào |
| **`unaccent` không dùng được trên Neon** | `CREATE EXTENSION` báo lỗi quyền | Thử **trên Neon trước khi viết code**. Không được thì bỏ tính năng 4 — nó là thứ đầu tiên bị cắt |
| **`$queryRaw` làm hỏng lọc/sắp xếp đã chạy** | Test lọc cũ đỏ sau khi đổi nhánh `q` | Chỉ nhánh `q` chuyển sang SQL. Nếu phải đụng tới nhánh khác thì **dừng lại** — đó là dấu hiệu đang viết lại cả hàm |
| **Xoá cột làm hỏng thứ tưởng là không ai dùng** | `prisma migrate` chạy xong, test đỏ ở chỗ lạ | Xoá **cuối cùng**, PR riêng, dễ revert. `grep` toàn repo trước khi xoá, kể cả trong `seed.ts` và file test |
| **Luật thu hồi xác minh chưa chốt, test viết theo hành vi hiện tại** | Ai đó viết ca test cho `verifiedAt` mà không hỏi BA | BA chốt A/B/C **trước** khi viết luồng A. Tiêu chí đột biến tạm dùng `status: 'OPEN'` — thứ chắc chắn có trong code |
| **Tưởng sửa seed là dựng được cảnh trên deploy** | Chạy `db seed` trên Neon rồi ngồi chờ dữ liệu không bao giờ tới | `laDatabaseNoiBo()` chặn đúng như thiết kế. Cảnh trên deploy dựng bằng **6 bước đi qua form thật**, tính đủ 2–3 giờ vào kế hoạch |
| **Render treo đúng ngày bảo vệ** | Dashboard báo gần 750 giờ | Kiểm **trước ba ngày**. Phương án dự phòng: quay sẵn video demo đầy đủ — video không phụ thuộc uptime |
| **Người chấm mở bằng điện thoại, không ai từng thử** | — | BA kiểm trên máy thật **sớm trong tuần**, không phải cuối tuần |
| **Tính năng 3 và tính năng 2 cùng sửa `MyApplications.tsx`** | Test của tính năng 3 hỏng sau khi thêm điểm ngắt | Làm 3 xong hẳn rồi mới tới 2, hoặc một người làm cả hai — y hệt cách xử `Applicants.tsx` ở Sprint 4 |
| **Nhét thêm tính năng vào tuần cuối** | Câu "nhỏ thôi mà, nửa tiếng" | Mục *"Quyết định phạm vi"* ở trên tồn tại để trả lời đúng câu này. Ghi vào "Việc còn nợ", không mở editor |

---

## Việc còn nợ — bàn giao cho người sau

Sprint cuối, nên bảng này không còn là "để sprint sau". Nó là **tài liệu bàn giao**, và nên xuất hiện nguyên vẹn trong chương cuối của báo cáo — phần *hướng phát triển*.

| Việc | Vì sao chưa làm | Ghi ở đâu |
| --- | --- | --- |
| Báo cáo tin vi phạm | ⏸ Hoãn quyết định tới cuối ngày 3 — chỉ rơi xuống bảng này nếu lúc đó chốt cắt | Mục phạm vi ở trên |
| Lịch rảnh có hạn dùng | 1,5–2 ngày, cần `btree_gist`. **Và cần đối chiếu lại với `availableUntil` trước đã** | [lich-ranh-co-han-dung.md](lich-ranh-co-han-dung.md) |
| `JobView` — đếm lượt xem theo người | Cần thêm bảng + khoá phiên. Nhãn đã đổi thành "Lượt mở" để con số không nói dối | sprint-4.md |
| Vai trò phụ dưới ADMIN | Nhu cầu chưa xuất hiện | [timeline-8-tuan.md](timeline-8-tuan.md) |
| `matchScore` V2 | Chưa cần chuẩn bị gì | sprint-4.md, mục *Hướng V2* |
| Full-text index (`tsvector` + GIN) | Ở 30–50 tin thì quét tuần tự đủ nhanh. Cần khi tin lên hàng nghìn | Mục phạm vi ở trên |
| Responsive cho khu admin | Người dùng duy nhất luôn ngồi máy tính. Cần màn ≥ 1024px | Tính năng 2 |
| Chat SV ↔ NTD, chat AI | Nice-to-have từ đầu, và **đụng quyết định "không phải ATS"** — nếu làm thật thì phải mở lại quyết định đó trước, không phải thêm màn hình chat vào cạnh | Mục phạm vi ở trên + [sprint-4.md](sprint-4.md) |
| Đánh giá hai chiều, PWA, bản đồ việc gần trường | Nice-to-have từ đầu | README mục 7 |
| Quản lý ca sau khi nhận việc | **Cố tình ngoài phạm vi** — là một sản phẩm riêng, to ngang phần tuyển dụng hiện tại | README mục 7 |
