# Sprint 3 — Tìm kiếm & Lọc

**Thời lượng:** 5 ngày làm việc (tuần 6) · **Nhóm:** 3 người

| Ký hiệu | Vai trò | Tên |
| --- | --- | --- |
| **DEV1** | Backend, hạ tầng, database, deploy API | Khang |
| **DEV2** | Frontend, CI, deploy web | Bảo |
| **BA** | Phân tích nghiệp vụ, viết tài liệu, wireframe | Quốc |

## Mục tiêu sprint

Theo timeline 8 tuần, mốc cuối tuần 6 là: **"Lọc theo lịch rảnh chạy đúng — tính năng lõi"**. Đây là thứ phân biệt UniWork với một trang đăng tin thường: sinh viên lọc được việc theo đúng khung giờ mình rảnh, không phải đọc từng tin để tự đối chiếu.

Năm tính năng của sprint:

1. Lưu tin (bookmark)
2. Full-text search theo tên/mô tả tin
3. Lọc theo lịch rảnh + hiện điểm phù hợp (tính năng lõi)
4. Lọc đa tiêu chí: mức lương, kỹ năng, cam kết tối thiểu
5. Phân trang danh sách việc làm công khai

## Cách chia việc lần này khác Sprint 2

Sprint 2 buộc phải chia theo **pha**: DEV1 dựng xong toàn bộ API tin tuyển dụng (T67–T72) rồi DEV2 mới có dữ liệu thật để nối form (T73–T74) — vì bảng `Job` và luồng trạng thái của nó **chưa hề tồn tại**, DEV2 không có gì để gọi trước đó.

Sprint 3 không rơi vào tình huống đó, vì mọi dữ liệu nền đã có sẵn từ Sprint 1–2:

| Cần cho tính năng | Đã có sẵn ở |
| --- | --- |
| Ca làm của tin | `PublicJobSummary.shifts: JobShiftItem[]` — đã trả kèm mỗi tin từ Sprint 2 |
| Lịch rảnh của sinh viên đang đăng nhập | `useAvailability()` — hook đã dùng ở trang hồ sơ từ Sprint 1 |
| Bảng lưu tin | Model `SavedJob` đã có từ migration Sprint 0, **chưa có endpoint nào đọc/ghi nó** |
| Tổng số tin khớp bộ lọc | `listPublicJobs` đã trả `total` từ Sprint 2 (`prisma.$transaction` đếm song song), chỉ thiếu `page`/`limit` |

Vì vậy sprint này chia theo **tính năng** (vertical slice) thay vì theo pha BE/FE: mỗi tính năng là một khối trọn vẹn (đủ BE nếu cần + FE + test), làm xong khối nào **commit khối đó**, không dồn hết BE của cả 5 tính năng lại rồi mới bắt đầu FE. Một khối làm xong là một thứ demo được ngay, không phải chờ khối khác mới nhìn thấy kết quả.

**Tính năng 3 (lõi) ban đầu dự tính làm thuần frontend, nhưng đã chuyển sang server** — lý do và chi phí ở phần bên dưới.

## Bảng tính năng

| # | Tên | BE cần thêm | FE cần thêm | Vì sao độc lập |
| --- | --- | --- | --- | --- |
| 1 | Lưu tin | 3 endpoint mới, module riêng | Nút bookmark trên `JobCard`, trang "Tin đã lưu" | Không đụng tới `GET /api/viec-lam` hay bất cứ tính năng nào khác — bảng `SavedJob` độc lập hoàn toàn |
| 2 | Full-text search | Thêm tham số `q` vào query đã có | Ô tìm kiếm trên `JobList` | Thêm tham số, không sửa tham số cũ nào |
| 3 | Lọc lịch rảnh + điểm phù hợp | `optionalAuth` + phép giao trong SQL | Badge điểm trên thẻ tin, ô lọc, nút sắp xếp | Không đụng bộ lọc nào khác — chỉ thêm tham số |
| 4 | Lọc đa tiêu chí | Thêm 4 tham số vào query đã có | Bật 3 ô đang khoá trong `FilterSidebar` + chọn đơn vị lương | Thêm tham số, không sửa tham số cũ |
| 5 | Phân trang | Thêm `page`/`limit`, đã có `total` sẵn | "Tải thêm" hoặc phân trang số trong `JobList` | Object response đã bọc sẵn từ Sprint 1 — thêm trường không phá hợp đồng cũ |

Bốn tính năng 2, 3, 4, 5 đều đọc/sửa cùng khu vực code (`jobs.service.ts#listPublicJobs`, `FilterSidebar.tsx`, `JobList.tsx`) — không phụ thuộc NHAU về mặt nghiệp vụ, nhưng đụng chung file thì làm đồng thời (nhiều người) sẽ dễ conflict. Vì đội chỉ có một người thật sự gõ code phần này, thứ tự dưới đây là gợi ý để mỗi lần sửa file là một commit sạch, không phải một ràng buộc bắt buộc:

```
1. Lưu tin                        — làm trước vì hoàn toàn tách biệt, xong sớm có cái để demo
2. Lọc lịch rảnh + điểm phù hợp   — tính năng lõi, giá trị cao nhất, không đụng backend
3. Full-text search                — đơn giản nhất trong nhóm còn đụng backend
4. Lọc đa tiêu chí                 — 3 tham số cộng dồn lên endpoint vừa sửa ở bước 3
5. Phân trang                      — làm sau cùng vì mỗi lần đổi bộ lọc ở trên đều ảnh hưởng
                                     việc tính `total`/`page`, gộp một lần đỡ sửa lại hai lần
```

---

## Tính năng 1 — Lưu tin

Model `SavedJob(studentProfileId, jobId)` có từ Sprint 0, chưa có endpoint nào chạm tới.

**Endpoint đề xuất** (mount trong `modules/jobs/`, không tạo module mới — lý do giống Sprint 2: cùng bảng `Job`, tránh export qua lại):

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| `POST` | `/api/toi/tin-da-luu/:jobId` | Lưu tin. Gọi lại tin đã lưu thì **idempotent** (200, không lỗi) — không có lý do bắt người dùng nhớ mình đã bấm hay chưa |
| `DELETE` | `/api/toi/tin-da-luu/:jobId` | Bỏ lưu. Gọi khi chưa lưu thì cũng 200, cùng lý do idempotent |
| `GET` | `/api/toi/tin-da-luu` | Danh sách tin đã lưu của chính mình, kèm dữ liệu tin (dùng lại `CHON_JOB_PUBLIC`) |

**Việc cần quyết định:** tin đã lưu mà sau đó bị đóng (`CLOSED`) hoặc bị xoá thì sao?

- Tin `CLOSED`: vẫn hiện trong danh sách đã lưu, nhưng đánh dấu rõ "Đã đóng" — sinh viên nên biết tin này không còn nhận hồ sơ, không nên lặng lẽ biến mất khỏi danh sách của họ.
- Tin bị xoá cứng: theo bảng T71 ở Sprint 2, chỉ tin `DRAFT`/`PENDING` xoá được, mà `SavedJob` chỉ có thể trỏ tới tin đã từng `OPEN` (chỉ endpoint công khai mới có nút lưu) — nên tình huống "tin đã lưu bị xoá cứng" **không xảy ra được** trong luồng hiện tại. Không cần xử lý.

**FE:** icon bookmark trên `JobCard` (cả ở `JobList` và `JobDetail`), toggle lạc quan (optimistic update) qua `setQueryData` — đây là dữ liệu của chính người đang xem, đúng mẫu đã dùng ở Sprint 1, không phải mẫu `staleTime` của Sprint 2 (T84) vốn dành cho dữ liệu người khác đổi. Thêm trang "Tin đã lưu" nối vào menu sinh viên.

**Test:** idempotent (lưu 2 lần không lỗi, bỏ lưu 2 lần không lỗi), ownership (sinh viên A không thấy/xoá được mục đã lưu của sinh viên B — dù `SavedJob` không có id riêng để đoán, vẫn nên test rõ), danh sách hiện đúng tin `CLOSED` kèm nhãn.

---

## Tính năng 3 — Lọc theo lịch rảnh + điểm phù hợp (lõi)

**Chạy ở SERVER, không phải frontend** — đổi so với bản kế hoạch đầu, xem phần dưới.

Hai bảng `job_shifts`/`availabilities` cố ý cùng hình dạng `(dayOfWeek, slot)` từ Sprint 0 — lý do ghi rõ trong `LuoiKhungGio.tsx` — nên phép so khớp là giao hai tập hợp, chạy được thẳng trong SQL.

### Hai câu hỏi khác nhau, hai con số khác nhau

Chốt 2026-08-27 sau khi rà lại `minShiftsPerWeek`:

```ts
ghepLich(caLam, lichRanh, minShiftsPerWeek): {
  matchedShifts: number
  totalJobShifts: number
  eligible:   boolean | null   // "tôi CÓ nhận nổi việc này không?"
  matchScore: number  | null   // "việc này hợp lịch tôi tới đâu?"
}
```

```
eligible   = matchedShifts >= minShiftsPerWeek   (null → ngưỡng là 1)
matchScore = matchedShifts / totalJobShifts × 100
```

**Gộp hai thứ làm một là hỏng theo cả hai chiều:**

- Lấy `matched / minShiftsPerWeek` làm điểm thì **mọi** người đủ điều kiện đều thành 100%. Sinh viên trùng 5/20 ca và sinh viên trùng 18/20 ca hiện giống hệt nhau — điểm mất sạch khả năng phân biệt, mà phân biệt chính là lý do nó tồn tại.
- Lấy `matched / totalJobShifts` làm cổng vào thì tin mở 20 ca cần 5 sẽ loại oan người trùng 8 ca (40%), dù 8 ≥ 5 nên họ thừa sức nhận việc.

Ngưỡng được **chặn trần ở tổng số ca mở**: tin mở 3 ca mà đòi nhận 5 là lỗi nhập liệu, không phải yêu cầu khắt khe — không chặn thì tin đó không bao giờ `eligible` với ai và biến mất khỏi mọi kết quả lọc, trong khi nhà tuyển dụng thấy tin mình vẫn `OPEN`. `createJobSchema` chặn ở tầng Zod cho tin mới, `ghepLich` chặn thêm lần nữa cho dữ liệu cũ.

### `null` khác `0`, và `null` khác `false`

| Tình huống | `matchScore` | `eligible` | Giao diện |
| --- | --- | --- | --- |
| Chưa khai lịch / khách / NTD | `null` | `null` | Badge tự ẩn; lời mời khai lịch hiện **một lần** ở đầu `JobList` |
| Đã khai, không trùng ca nào | `0` | `false` | "Chưa đủ ca" |
| Đã khai, trùng nhưng chưa đủ ngưỡng | vd. `25` | `false` | "Chưa đủ ca — bạn rảnh 1/4 ca" |
| Đủ ngưỡng | vd. `50` | `true` | "50%" |

Trả `0` cho dòng đầu thì sinh viên chưa khai lịch thấy **mọi tin đều 0%** rồi kết luận trang này không có việc nào hợp với mình. Kiểu `number | null` đẩy việc phân biệt vào tầng kiểu — TypeScript **bắt** mọi chỗ hiển thị phải xử lý nhánh `null` mới cho biên dịch qua.

### Sắp xếp: đủ điều kiện trước, rồi mới tới điểm

`matchScore` lấy mẫu số là tổng số ca của tin, nên tin mở nhiều ca luôn khó đạt điểm cao hơn tin ít ca. Sắp thuần theo điểm sẽ đẩy tin người ta **không nhận nổi** lên trên tin họ nhận được — hỏng đúng mục đích của việc sắp xếp.

**`TimeSlot` là KHUNG KHAI BÁO, không phải ca làm việc** (chốt 2026-08-27).

Đây là phân biệt quan trọng nhất của cả mô hình ghép lịch:

- Sinh viên khai `T2 MORNING` = *"thứ Hai buổi sáng tôi có thể làm"*
- Tin khai `T2 MORNING` = *"cần người có thể làm thứ Hai buổi sáng"*

Quán cần người 10:00–16:00 sẽ khai `MORNING` + `AFTERNOON` — nghĩa là "ứng viên phải rảnh được trong cả hai khung", **không** phải "ca kéo 12 tiếng". Giờ làm cụ thể do hai bên chốt khi phỏng vấn.

Đã cân nhắc và **bỏ** phương án tăng lên 6 khung (06–09, 09–12…): nó không giải quyết vấn đề gốc, vì ca thật ở tin part-time Việt Nam dài 6–8 tiếng với ranh giới mỗi nơi một khác — mịn hơn vẫn chỉ là xấp xỉ. Muốn đúng hẳn phải chuyển sang `startTime`/`endTime`, và khi đó phép ghép, lưới khai lịch, validate lẫn ràng buộc đều phải dựng lại (việc của v2).

Hệ quả **bắt buộc** cho giao diện: không chỗ nào được gọi đây là "ca làm việc". Đã sửa `JobDetail` ("Khung giờ cần người"), `PostJob` ("Khung giờ cần người"), và `LuoiKhungGio` (khoảng giờ hiện `~06:00 – 12:00` để đọc ra là ước chừng).

**Bậc màu gợi ý** (tinh chỉnh khi làm UI, không phải luật cứng): ≥ 80% xanh lá, 40–79% vàng, < 40% xám.

**Lọc "chỉ hiện việc khớp lịch rảnh" chạy ở SERVER** — đổi so với bản kế hoạch đầu (2026-08-27).

Bản đầu định lọc client-side với lý do quy mô nhỏ. Lý do đó đúng nhưng **không phải lý do quan trọng nhất**, và bỏ qua một lỗi thật:

- Lọc ở web thì `total` do server đếm kể một câu chuyện khác với số thẻ đang hiện — "Tìm thấy 40 tin" trong khi màn hình có 12 thẻ.
- Tới **tính năng 5 (Phân trang)**, mỗi trang tải 20 tin rồi lọc còn 6, trang sau còn 11 — số lượng nhảy loạn mỗi lần bấm "Tải thêm". Đó là lỗi đúng nghĩa, không phải chuyện quy mô.

Chi phí để làm đúng nhỏ hơn dự tính: phép giao diễn đạt được bằng Prisma, **không cần raw SQL**.

```ts
shifts: { some: { OR: lichRanh.map((o) => ({ dayOfWeek: o.dayOfWeek, slot: o.slot })) } }
```

Dùng đúng `@@index([dayOfWeek, slot])` đã có sẵn trên `job_shifts` từ Sprint 0 — chính là lý do hai bảng `job_shifts`/`availabilities` được thiết kế cùng bộ cột.

**Endpoint cần biết ai đang xem, nhưng vẫn phải mở cho khách.** Giải bằng middleware `optionalAuth` mới: đọc token nếu có, không có thì cho qua như khách, token hỏng cũng cho qua (phiên vừa hết hạn mà mở trang việc làm phải thấy danh sách, không phải trang lỗi). Đây **không** phải nới lỏng bảo mật — phạm vi dữ liệu vẫn đúng bằng `status = 'OPEN'`; danh tính chỉ thêm một trường và bật một bộ lọc tuỳ chọn.

**Điểm số tính bằng JS trên tập kết quả, không phải trong SQL.** `CHON_JOB_PUBLIC` vốn đã lấy `shifts` của mỗi tin nên không tốn thêm truy vấn nào. Sắp xếp theo điểm cũng chạy ở đây và **đúng**, vì `take: 100` lấy về toàn bộ tập kết quả chứ không phải một trang.

> ⚠ **Ràng buộc phải nhớ khi làm tính năng 5:** phép cắt trang phải diễn ra **sau** bước chấm điểm và sắp xếp trong service, không được đẩy thành `skip`/`take` trong SQL. Đẩy xuống SQL thì database sắp theo `publishedAt` rồi mới cắt, và ta chấm điểm trên một trang đã bị cắt sai — kết quả trông vẫn hợp lý nên sẽ không ai nhận ra. Tính điểm bằng `$queryRaw` sẽ gỡ được ràng buộc này, đổi lại phải chép toàn bộ mệnh đề lọc sang SQL viết tay và giữ hai bản khớp nhau mãi mãi.

**Chỉ áp dụng cho sinh viên đã đăng nhập** — nút và badge ẩn hẳn với khách và với nhà tuyển dụng đang xem thử trang công khai, không hiện disabled kèm giải thích như Sprint 2 làm với "Ứng tuyển" (khác nhau: "Ứng tuyển" disabled vì tính năng CHƯA XONG, còn cái này ẩn vì đối tượng xem KHÔNG ÁP DỤNG được — sinh viên A xem lịch rảnh của ai khi chưa đăng nhập?).

**Test:** hàm tính điểm với các trường hợp biên ở trên, component test cho checkbox lọc, test hiển thị đúng gợi ý khi chưa khai lịch rảnh.

---

## Tính năng 2 — Full-text search

Mở rộng `publicJobQuerySchema` (hiện chỉ có `city`, `district`, `scheduleType`):

```ts
q: locTuyChon, // tìm trong title HOẶC description
```

**BE** (`listPublicJobs`): Postgres `ILIKE` qua Prisma `contains` + `mode: 'insensitive'`, không cần cột `tsvector` hay full-text index — ở quy mô 30–50 dòng, quét tuần tự không đáng lo, và thêm hạ tầng tìm kiếm cho một bảng nhỏ là phí công không cần thiết.

```ts
...(query.q ? {
  OR: [
    { title: { contains: query.q, mode: 'insensitive' } },
    { description: { contains: query.q, mode: 'insensitive' } },
  ],
} : {}),
```

**FE:** ô tìm kiếm trên `JobList.tsx` (phía trên hoặc cạnh `FilterSidebar`), debounce ~300ms trước khi gọi API, đồng bộ vào query string để chia sẻ link tìm kiếm được.

**Test:** khớp theo `title`, khớp theo `description`, không phân biệt hoa/thường, chuỗi rỗng trả về như không lọc, tìm không dấu có khớp có dấu hay không (quyết định rõ — Postgres `ILIKE` mặc định **không** bỏ dấu tiếng Việt; nếu cần, để Sprint sau, ghi rõ giới hạn này trong tài liệu bàn giao).

---

## Tính năng 4 — Lọc đa tiêu chí

Ba ô đang khoá trong `FilterSidebar.tsx`: mức lương (dòng 136–149), cam kết tối thiểu (dòng 151–158), và kỹ năng (chưa dựng UI, cần thêm mới).

**Lương** — bảng lương có 3 đơn vị (`HOUR`, `SHIFT`, `MONTH`, xem `SALARY_UNIT_LABELS`). **Không quy đổi ba đơn vị về cùng một thang**: quy đổi đòi giả định "một ca mấy giờ", "một tháng mấy ca" — hai con số thay đổi theo từng tin, nên mọi phép quy đổi đều là bịa ra một tỉ lệ rồi lọc theo nó.

Thay vào đó: **sinh viên chọn đơn vị trước, thanh trượt đổi khoảng theo đơn vị đó, chỉ lọc trong nhóm tin cùng đơn vị.**

```
BE: salaryUnit = <đơn vị chọn>
    AND salaryNegotiable = false
    AND salaryMax >= <giá trị chọn>
```

Khoảng cho từng đơn vị, lấy theo dữ liệu thật trong `seed.ts` (nới rộng hai đầu để còn chỗ cho tin mới, **không phải số bịa**):

| Đơn vị | Giá trị thật trong seed | Khoảng thanh trượt đề xuất |
| --- | --- | --- |
| `HOUR` | 24.000 – 32.000 | 15.000 – 60.000 |
| `SHIFT` | 120.000 – 350.000 | 100.000 – 500.000 |
| `MONTH` | 2.000.000 – 3.500.000 | 1.000.000 – 15.000.000 |

**Vì sao không giữ phương án "chỉ lọc theo giờ"** (phương án ở bản kế hoạch đầu, đã bỏ): đếm trong `seed.ts` có 4 tin `HOUR`, 3 tin `SHIFT`, 2 tin `MONTH`. Bộ lọc chỉ-theo-giờ sẽ **giấu 5 trên 9 tin** mỗi khi sinh viên bật nó — hơn nửa danh mục, không phải ca biên đáng một dòng chú thích. Chi phí để làm đúng chỉ là **một tham số truy vấn** (`salaryUnit`) cộng việc thanh trượt đổi khoảng theo lựa chọn; rẻ hơn nhiều so với thứ nó cứu.

**Không chọn đơn vị = không lọc lương** (mặc định). Không mặc định sẵn `HOUR`, vì như thế lại rơi đúng vào cái bẫy vừa mô tả, chỉ khác là người dùng không biết mình đang bị lọc.

**So theo `salaryMax`, không phải `salaryMin`** — đã chốt 2026-08-25.

| Công thức | Tin 20.000–30.000đ khi lọc "từ 25.000đ" |
| --- | --- |
| `salaryMin >= X` | **Loại** — sàn của tin chưa chạm mức sinh viên muốn |
| `salaryMax >= X` ← **chọn cái này** | **Giữ** — tin CÓ THỂ trả tới 30k |

Lý do: tin 20–30k thật sự có khả năng trả 25k, loại nó đi là giấu mất một cơ hội có thật; và khoảng lương luôn hiện trên thẻ tin nên sinh viên tự đánh giá được vì sao nó lọt vào. Bộ lọc quá chặt thì tin biến mất im lặng, người dùng không có cách nào biết mình vừa bỏ lỡ gì.

Chú thích ở `schema.prisma` (`salaryNegotiable`) **đã sửa cho khớp** — bản Sprint 0 viết `salaryMin >= 25000`, nay ghi lại thành `salaryMax` kèm lý do. Hai nơi lệch nhau chính là cách sinh ra lỗi ở sprint sau.

**Tin "Thoả thuận" (`salaryNegotiable = true`) bị loại khỏi mọi bộ lọc lương** — min/max đều null nên không có gì để so sánh. Schema đã chốt điều này ("tin không ghi giá bị loại, đúng ý người lọc") và vẫn đúng. Nhưng khi bộ lọc lương dùng được cho cả ba đơn vị thì nó được bật thường xuyên hơn hẳn, nên phải **nói rõ trên UI** (ví dụ: "Đang ẩn tin lương thoả thuận"), không để tin lặng lẽ biến mất. Seed có 1 tin dạng này.

**Kỹ năng** — thêm multi-select (hoặc danh sách checkbox) lấy từ `GET /api/skills` đã có. Quyết định: khớp **BẤT KỲ** một kỹ năng nào trong danh sách chọn (OR), không bắt khớp hết (AND) — sinh viên có 3 kỹ năng muốn tìm việc dùng được ít nhất một cái, bắt khớp hết sẽ trả về gần như rỗng.

```
BE: skills = { some: { skillId: { in: query.skillIds } } }
```

**Cam kết — HAI bộ lọc riêng, không gộp làm một** (chốt 2026-08-27).

Bản kế hoạch đầu gộp thành một ô "Cam kết tối thiểu" lọc theo `minShiftsPerWeek`, trong khi nhãn trên `FilterSidebar` lại đọc như `commitmentMonths`. Hai cột đó nói hai chuyện khác nhau:

| Cột | Nghĩa | Bộ lọc |
| --- | --- | --- |
| `minShiftsPerWeek` | Cường độ mỗi tuần | "Bạn nhận tối đa bao nhiêu ca/tuần?" → `<= X` |
| `commitmentMonths` | Thời gian gắn bó | "Bạn gắn bó được tối đa bao lâu?" → `<= X` |

Khảo sát tin part-time thật ở Việt Nam (IZONE, Ecombest, Dream Viet, Levents…) cho thấy chúng **tồn tại song song** chứ không thay thế nhau — nhiều tin quy định đồng thời "tối thiểu 5 ca/tuần" *và* "gắn bó tối thiểu 3–6 tháng". Gộp làm một là lấy mất khả năng diễn đạt nhu cầu thật của người lọc.

Cả hai đều **để tin không quy định lọt qua** (`null` không vi phạm ngưỡng nào): `ONE_TIME` không có `minShiftsPerWeek`, `SEASONAL`/`ONE_TIME` không có `commitmentMonths`.

Nhãn trên giao diện đứng từ phía **người lọc** nên là **tối đa**, không phải "tối thiểu" như cột trong database — người tìm việc nói "tôi nhận nhiều nhất 5 ca/tuần", còn tin nói "tôi cần ít nhất 5 ca/tuần".

**Quan hệ giữa các bộ lọc:** **AND giữa các nhóm** (khu vực VÀ loại thời gian VÀ lương VÀ kỹ năng), **OR trong nhóm kỹ năng** (có bất kỳ kỹ năng nào trong danh sách chọn). Đây là mẫu người dùng quen từ mọi trang thương mại điện tử — chọn thêm một nhóm là thu hẹp kết quả, chọn thêm một mục trong cùng nhóm là mở rộng.

**Test:** mỗi bộ lọc riêng; kết hợp 2–3 nhóm cùng lúc (xác nhận AND giữa nhóm, OR trong nhóm kỹ năng); tin `ONE_TIME` không bị lọc bởi cam kết tối thiểu; chọn đơn vị lương `MONTH` **không** trả về tin `HOUR`/`SHIFT` dù giá trị số có khớp; tin `salaryNegotiable = true` bị loại khỏi mọi bộ lọc lương ở cả ba đơn vị; không chọn đơn vị lương thì không lọc lương chút nào.

---

## Tính năng 5 — Phân trang

`total` đã có sẵn trong `PublicJobListResponse` từ Sprint 2. Còn thiếu `page`/`limit` (hoặc `skip`/`take`) và UI tương ứng.

**Quyết định cần chốt trước khi code:** "Tải thêm" (infinite load, nối thêm vào danh sách cũ) hay phân trang số (1 2 3 …, thay hẳn danh sách)?

Đề xuất **"Tải thêm"** — hợp với T86 Sprint 2 (đăng tin được bằng điện thoại): phân trang số cần bấm chính xác vào số nhỏ trên màn cảm ứng, "Tải thêm" chỉ cần một nút to. TanStack Query có sẵn `useInfiniteQuery` cho đúng mẫu này.

```ts
// BE: publicJobQuerySchema thêm
page: z.coerce.number().int().min(1).default(1),
// GIOI_HAN_CONG_KHAI (100) đổi vai trò: từ "chặn cứng" thành "kích thước 1 trang"
```

**Test:** trang 2 không lặp lại tin của trang 1, `total` khớp số thật khi có tin mới được duyệt giữa hai lần tải, `take` vẫn không vượt quá giới hạn cho dù `limit` bị truyền giá trị lớn bất thường.

---

## BA — độc lập từ đầu, không đổi

| Việc | Kết quả cần đạt |
| --- | --- |
| Viết test case cho luồng tìm kiếm/lọc (bao gồm 4 bộ lọc + phân trang + lưu tin) | Bảng test case đủ ca, kể cả lọc rỗng kết quả và kết hợp nhiều bộ lọc |
| Kiểm thử trên bản deploy thật | Kết quả thực tế + danh sách lỗi tìm được |
| Chương 4 báo cáo | Bản nháp đủ ý, có mô tả thuật toán ghép lịch và công thức điểm phù hợp |

## Tự kiểm trước khi coi một tính năng là xong

Áp dụng cho mọi tính năng ở trên — chạy hết trước khi commit, không phải trước khi cả sprint xong:

- [ ] `pnpm lint && pnpm typecheck && pnpm test` xanh
- [ ] Nếu có endpoint mới/tham số mới: kiểu ở `packages/shared/src/api.ts` và `validation.ts` đã cập nhật, gọi thử bằng curl thấy đúng
- [ ] Nếu tính năng chỉ áp dụng cho sinh viên đã đăng nhập (lọc lịch rảnh, lưu tin): thử với tài khoản khách/NTD, xác nhận ẩn đúng chứ không lỗi
- [ ] Test có ca âm — không chỉ ca "lọc ra đúng kết quả", còn phải có ca "lọc không ra gì" và "kết hợp nhiều bộ lọc cùng lúc"
- [ ] Đã thử trên bản deploy thật trước khi đánh dấu xong hẳn, không chỉ trên máy

## Rủi ro của riêng sprint này

| Rủi ro | Dấu hiệu sớm | Xử lý |
| --- | --- | --- |
| Lọc lịch rảnh client-side chậm khi dữ liệu tăng | Trang giật khi bật checkbox lọc với > 200 tin | Ghi lại làm ghi chú kỹ thuật, chuyển sang JOIN ở Sprint sau nếu xảy ra — không phải vấn đề ở quy mô đồ án |
| Tin "Thoả thuận" biến mất im lặng khi bật bộ lọc lương | BA test thấy tin quen thuộc không còn trong kết quả mà không hiểu vì sao | Hiện nhãn "Đang ẩn tin lương thoả thuận" ngay cạnh bộ lọc, không đợi bị báo lỗi mới thêm |
| Code lọc lương viết theo `salaryMin` do đọc phải tài liệu cũ | Test lọc lương cho kết quả khác dự đoán ở tin có khoảng lương rộng (vd. 20–30k) | Đã chốt `salaryMax` và sửa chú thích `schema.prisma` cho khớp. Viết sẵn một ca test đúng tình huống 20–30k lọc "từ 25k" để bắt được ngay nếu ai đó đổi nhầm |
| Bốn tính năng 2–5 cùng sửa `listPublicJobs`/`FilterSidebar.tsx` — làm chồng lên nhau (dù chỉ một người code) dễ để sót một nhánh `if` cũ | Test cũ của tính năng trước bị tính năng sau làm hỏng mà không ai để ý | Chạy lại toàn bộ `jobs.test.ts` sau mỗi tính năng, không chỉ test mới viết |
