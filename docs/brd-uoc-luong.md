# BRD ước lượng — bản dựng tạm cho T29

**Trạng thái:** DEV1 dựng phỏng đoán → **BA đã rà soát và trả lời hết**. Không còn điểm treo. Schema T29 và seed T30 đang khớp với tài liệu này.

Bảng phụ thuộc trong [sprint-0.md](sprint-0.md) đã lường trước tình huống này: *"T29 chờ T17, T18, T19 — BRD trễ thì schema phải dựng theo phỏng đoán, Sprint 1 làm lại"*. Tài liệu này là phần "phỏng đoán" đó, viết ra thành văn bản thay vì để trong đầu — và nhờ vậy BA rà được từng điểm thay vì phải đọc schema để đoán DEV1 đã nghĩ gì. Phần "Sprint 1 làm lại" không xảy ra: bảy điểm phỏng đoán ban đầu, BA chốt cả bảy, không điểm nào phải dựng lại.

Khi BRD chính thức (T17–T19) được bàn giao, đối chiếu với tài liệu này trước — lệch chỗ nào sửa chỗ đó.

## Suy ra từ đâu

Không bịa. Mỗi trường trong schema đều truy ngược được về một trong bốn nguồn đã có trong repo:

| Nguồn | Cho ta biết |
|---|---|
| [gioi-thieu-du-an.md](gioi-thieu-du-an.md) | Ba nhóm chức năng, khác biệt lõi là ghép theo lịch rảnh |
| [packages/shared/src/domain.ts](../packages/shared/src/domain.ts) | Bộ giá trị cố định đã chốt: `ROLES`, `SCHEDULE_TYPES`, `JOB_STATUSES`, `APPLICATION_STATUSES`, `DayOfWeek` |
| [apps/web/src/pages/PostJob.tsx](../apps/web/src/pages/PostJob.tsx) | Form đăng tin đã dựng — chính là danh sách trường của module Đăng tin |
| [apps/web/src/data/mock.ts](../apps/web/src/data/mock.ts) | Hình dạng dữ liệu giao diện đang bind vào |

`JOB_STATUSES` và `APPLICATION_STATUSES` trong `domain.ts` hiện chưa chỗ nào dùng. Chúng được khai sẵn từ Sprint 0 như từ vựng dự kiến — T29 là lúc chúng có bảng thật để gắn vào.

---

## Module 1 — Auth (ước lượng T17)

### Trường dữ liệu

| Bảng | Trường | Ghi chú |
|---|---|---|
| `users` | email, passwordHash, role, status, emailVerifiedAt | Đã có từ T13 |
| `refresh_tokens` | userId, tokenHash, expiresAt, revokedAt, userAgent, ip | Mới |
| `auth_tokens` | userId, tokenHash, type, expiresAt, usedAt | Mới — xác thực email và đặt lại mật khẩu dùng chung một bảng |

Ba quyết định đáng nói:

**Lưu `tokenHash` chứ không lưu token.** Refresh token là thứ đăng nhập được. Để nguyên trong database nghĩa là ai đọc được database thì đăng nhập được bằng tài khoản bất kỳ — đúng thứ ta đã tránh khi băm mật khẩu, không có lý do gì bỏ qua ở đây.

**Có hàng riêng cho từng refresh token, không phải một cột trên `users`.** Nhờ vậy mới đăng nhập được nhiều thiết bị, và mới có màn hình "đăng xuất khỏi thiết bị khác" ở Sprint 6. Cột `revokedAt` cho phép thu hồi mà vẫn giữ lại vết.

**Email xác thực và đặt lại mật khẩu dùng chung một bảng**, phân biệt bằng cột `type`. Hai luồng này giống hệt nhau về cơ chế: sinh chuỗi ngẫu nhiên, gửi mail, hết hạn sau N phút, dùng một lần. Tách hai bảng chỉ để copy y nguyên cấu trúc là nhân đôi chỗ phải sửa.

### Luồng chính

```
Đăng ký → tạo user (emailVerifiedAt = null) → gửi mail xác thực
        → bấm link → emailVerifiedAt = now
Đăng nhập → kiểm mật khẩu → phát access token (15 phút) + refresh token (30 ngày)
Làm mới → đổi refresh token cũ lấy cặp mới, đánh dấu cái cũ revokedAt
```

### Lỗi và ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Email đã tồn tại | 409, không tiết lộ tài khoản đó vai trò gì |
| Sai mật khẩu | 401, thông báo chung "email hoặc mật khẩu không đúng" |
| Chưa xác thực email | Đăng nhập được nhưng chặn ứng tuyển và đăng tin |
| `status = SUSPENDED` | 403, mọi refresh token bị thu hồi |
| Refresh token đã dùng lại lần hai | Dấu hiệu bị đánh cắp — thu hồi toàn bộ token của user đó |

---

## Module 2 — Đăng tin (ước lượng T18)

### Trường dữ liệu

Đọc thẳng từ form [PostJob.tsx](../apps/web/src/pages/PostJob.tsx):

| Nhóm | Trường |
|---|---|
| Cơ bản | title, description, requirements[], benefits[], city, district, quantity |
| Thời gian | scheduleType, commitmentMonths, minShiftsPerWeek, startDate, endDate, workDate + lưới ca làm |
| Lương và kỹ năng | salaryMin, salaryMax, salaryUnit, kỹ năng yêu cầu, deadline |
| Vòng đời | status, publishedAt, closedAt, rejectionReason, viewCount |

Ba trường ngày (`startDate`, `endDate`, `workDate`) loại trừ nhau theo `scheduleType` — form đã hiện đúng như vậy, mỗi loại một nhóm ô khác nhau. Ở tầng database chúng đều để `null` được; ràng buộc "thời vụ thì phải có ngày bắt đầu" thuộc về Zod ở tầng service, vì nó là luật nghiệp vụ có thể đổi, không phải bất biến cấu trúc.

### Giấy tờ xác minh

Mục T18 yêu cầu rõ phần này. Bảng `employer_documents`: mỗi giấy tờ một hàng, có `type` (giấy phép kinh doanh / mã số thuế / CCCD người đại diện), `fileUrl` trỏ Cloudinary, `status` và `reviewNote` của admin.

Cột `verifiedAt` sẵn có trên `employer_profiles` giữ nguyên vai trò kết luận cuối: có giấy tờ được duyệt thì admin đặt mốc này, và đây là thứ quyết định tin có được hiện công khai hay không. Bảng giấy tờ là hồ sơ chứng minh, không phải cờ điều khiển.

### Luồng chính

```
DRAFT → (gửi duyệt) → PENDING → (admin duyệt)  → OPEN → (hết hạn / đủ người) → CLOSED
                              → (admin từ chối) → DRAFT + rejectionReason
```

### Lỗi và ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Nhà tuyển dụng chưa có `verifiedAt` | Lưu nháp được, gửi duyệt thì 403 |
| `salaryMin > salaryMax` | 422 |
| Không chọn ca làm nào | 422 — thiếu ca thì tin không lọc theo lịch được, mất luôn tính năng lõi |
| `deadline` trong quá khứ | 422 |
| Sửa tin đang `OPEN` | Quay lại `PENDING`, phải duyệt lại |
| **Sửa tin đã `CLOSED`** | **409 — không cho sửa, gợi ý đăng tin mới** (bổ sung khi làm T70, xem lý do bên dưới) |
| Sửa tin của nhà tuyển dụng khác | 403 — kiểm chủ sở hữu, không chỉ kiểm vai trò |

#### Vì sao chặn sửa tin `CLOSED`

BRD gốc không nhắc trạng thái này. Chốt khi làm T70:

`CLOSED` nghĩa là tin đã kết thúc — tuyển đủ người hoặc hết hạn. Cho sửa nó rồi đẩy về `PENDING` là **hồi sinh một tin đã đóng**, trong khi các đơn ứng tuyển cũ vẫn trỏ vào đúng tin đó. Ứng viên đã bị từ chối ở đợt tuyển trước bỗng thấy mình đang có đơn ở một tin "đang mở" với nội dung và mức lương khác hẳn thứ họ từng nộp.

Muốn tuyển tiếp thì đăng tin mới: đơn của đợt cũ và đợt mới tách bạch, và lịch sử của mỗi đợt vẫn đọc được.

Không áp dụng cho `DRAFT` và `PENDING` — hai trạng thái đó chưa có ứng viên nào và vốn dĩ đang trong quá trình soạn thảo.

---

## Module 3 — Tìm kiếm việc (ước lượng T19)

### Trường dữ liệu

Bộ lọc đọc từ [FilterSidebar.tsx](../apps/web/src/components/FilterSidebar.tsx): khu vực, loại thời gian, mức lương theo giờ, kỹ năng, cam kết tối thiểu, và ô quan trọng nhất — **chỉ hiện việc khớp lịch rảnh**.

Ô đó cần một bảng mà hiện chưa có: `availabilities` — mỗi ô sinh viên tô trong lưới 7 ngày × 3 khung giờ là một hàng.

### Cách ghép lịch

Lịch rảnh của sinh viên và ca làm của tin dùng **chung một cấu trúc**: `(dayOfWeek, slot)`. Ghép hai bên chỉ là phép giao tập hợp, không cần thuật toán gì.

```sql
-- Tin nào có ít nhất một ca nằm trong lịch rảnh của sinh viên
job_shifts JOIN availabilities USING (day_of_week, slot)
```

Đây là lý do `Availability` và `JobShift` cố tình giống hệt nhau về cột. Nhìn qua tưởng lặp, nhưng chúng là hai thực thể khác nhau — một cái mô tả người, một cái mô tả việc — và việc chúng cùng hình dạng chính là thứ làm bộ lọc chạy được bằng một câu JOIN.

### Điểm phù hợp

Công thức đã ghi trong [JobCard.tsx](../apps/web/src/components/JobCard.tsx): kỹ năng khớp + ca khớp + mức đáp ứng cam kết.

Điểm này **tính lúc chạy, không lưu trên `jobs`** — nó phụ thuộc vào người đang xem, cùng một tin cho ra điểm khác nhau với hai sinh viên khác nhau. Chỗ duy nhất nó được lưu là cột `matchScore` trên `applications`: đóng băng điểm tại thời điểm ứng tuyển, để nhà tuyển dụng xem lại vẫn thấy đúng con số hồi đó, kể cả khi sinh viên đã đổi lịch rảnh từ lâu.

### Lỗi và ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Sinh viên chưa khai lịch rảnh | Bật lọc theo lịch thì trả rỗng kèm gợi ý đi khai lịch, không phải danh sách trống không lời giải thích |
| Ứng tuyển hai lần cùng một tin | Chặn ở tầng database bằng `@@unique([jobId, studentProfileId])` |
| Ứng tuyển tin đã `CLOSED` | 409 |
| Tin bị gỡ sau khi đã ứng tuyển | Đơn giữ nguyên, sinh viên vẫn xem được trạng thái |

---

## Cắt khỏi phạm vi T29

Ba thứ **cố ý không đưa vào** đợt migration này:

| Bỏ qua | Lý do |
|---|---|
| `notifications` | Thuộc Sprint 5. Không có gì trong ba BRD chạm tới, thêm bây giờ là bảng rỗng nằm không |
| `job_reports` (báo cáo tin lừa đảo) | Thuộc trang quản trị, Sprint 6 |
| Bảng thống kê cho admin | Sprint 6, và nhiều khả năng là view/truy vấn tổng hợp chứ không phải bảng |

Nguyên tắc: bảng nào chưa có luồng nghiệp vụ ghi vào thì chưa tạo. Migration thêm bảng thì rẻ, còn bảng rỗng nằm trong schema nhiều tháng thì tới lúc dùng gần như chắc chắn sai hình dạng.

---

## Đã chốt

Hai điểm dưới đây DEV1 đã quyết, không chờ BA nữa. Ghi lại lý do ở đây để sau không ai mở lại tranh luận từ đầu.

### Giữ ba khung giờ cố định, không cho nhập giờ tự do

Khung giờ tự do nghe linh hoạt hơn nhưng kéo theo cả bài toán so khoảng thời gian chồng lấn, trong khi lợi ích thực tế gần như không có: ca làm của quán cà phê và lịch học của sinh viên vốn đã theo buổi.

Ba khung rời rạc là thứ làm phép ghép lịch trở thành một câu JOIN. Bỏ nó đi là bỏ luôn thiết kế của toàn bộ tính năng lõi.

### Lịch rảnh để phẳng, không chia theo học kỳ

Hai thứ này hay bị lẫn, nên nói rõ: chúng trả lời hai câu khác nhau.

| | `availableFrom` / `availableUntil` | Lịch rảnh theo học kỳ |
|---|---|---|
| Trả lời | Còn đi làm được **tới bao giờ** | Rảnh **giờ nào**, trong **giai đoạn nào** |
| Số lượng | Một khoảng trên hồ sơ | Nhiều lưới, mỗi lưới một thời hạn |
| Phục vụ | Lọc tin đòi cam kết dài | Lọc tin khớp khung giờ |

Cặp `availableFrom`/`availableUntil` **không** thay thế được lịch theo học kỳ — nó không biết gì về giờ giấc. Nó chỉ trả lời "sinh viên này còn ở lại đủ lâu cho tin cam kết 6 tháng không".

Vẫn chọn để phẳng, vì ba lý do:

1. Thời khoá biểu đổi hai lần một năm và sinh viên sửa lưới mất 30 giây. Lưu lịch sử của thứ tự sửa được trong nửa phút là đổi rất nhiều phức tạp lấy rất ít giá trị.
2. Không ai tìm việc cho học kỳ sau. Sinh viên tìm việc làm **bây giờ**.
3. Chi phí nằm ở truy vấn: có học kỳ thì mọi câu ghép lịch phải kèm điều kiện ngày, cộng đống ca biên — hai lưới chồng ngày, khoảng trống giữa hai học kỳ, lưới tương lai khai rồi bỏ quên lưới hiện tại.

Điểm yếu duy nhất — lưới cũ âm thầm sai khi qua học kỳ mới — chữa được **không cần đổi schema**: `availabilities.createdAt` chính là mốc sửa lưới lần cuối, vì luồng sửa lưới xoá rồi tạo lại cả bộ. Quá 3 tháng thì nhắc sinh viên xem lại.

Nếu sau này BA khẳng định phải có học kỳ thật, đó vẫn là migration **bổ sung** (thêm `validFrom`/`validUntil` vào `availabilities`), không phải viết lại.

---

## BA đã trả lời — năm quyết định

Không còn điểm nào treo. Phần dưới ghi lại kết luận cùng chỗ DEV1 siết thêm.

### Giấy tờ xác minh — giữ ba loại

Giấy phép kinh doanh, mã số thuế, CCCD người đại diện. BA xác nhận đủ để chứng minh danh tính đơn vị tuyển dụng.

Đây là **danh sách loại giấy tờ được chấp nhận**, không phải danh sách bắt buộc nộp đủ ba. Bảng `employer_documents` cho mỗi giấy tờ một hàng, nên hộ kinh doanh cá thể nộp CCCD, công ty nộp giấy phép kinh doanh — admin xét theo từng hồ sơ. Kết luận cuối vẫn nằm ở `employer_profiles.verifiedAt`.

Thêm loại thứ tư sau này chỉ là thêm một giá trị vào enum `DocumentType`, không đụng cấu trúc bảng.

### `SEASONAL` không dùng chung `commitmentMonths` với `RECURRING`

BA đúng, và lý do BA nêu là lý do đúng: tin Tết có `startDate`/`endDate` gói gọn 10 ngày mà lại mang `commitmentMonths = 1` thì hai trường nói hai chuyện khác nhau, người viết giao diện không biết tin cái nào.

Phân công cuối cùng:

| | `commitmentMonths` | `startDate` | `endDate` | `workDate` | `minShiftsPerWeek` |
|---|---|---|---|---|---|
| `RECURRING` | dùng, có thể trống | có thể trống | **cấm** | **cấm** | dùng |
| `SEASONAL` | **cấm** | **bắt buộc** | **bắt buộc** | **cấm** | dùng |
| `ONE_TIME` | **cấm** | **cấm** | **cấm** | **bắt buộc** | **cấm** |

Hai chỗ DEV1 điều chỉnh so với đề xuất gốc:

**Không ép `commitmentMonths` bắt buộc với `RECURRING`.** Có việc định kỳ không đòi cam kết gì cả — "rảnh buổi nào làm buổi đó". Nguyên tắc: chỉ cấm cái **mâu thuẫn**, không cấm cái **chưa khai**.

**Cấm `minShiftsPerWeek` với `ONE_TIME`.** BA không nhắc, nhưng việc chỉ diễn ra một buổi thì "số ca tối thiểu mỗi tuần" vô nghĩa.

**Và quan trọng nhất: luật này được canh ở database, không chỉ ở form.** BA viết "để trống/null, không hiển thị field trên form". Ẩn ô trên form là trải nghiệm người dùng, không phải ràng buộc — một script sửa dữ liệu, một câu SQL vá tay lúc gấp, hay một endpoint viết vội ở sprint sau đều đi vòng qua form được. Luật thật nằm ở CHECK `jobs_schedule_fields_check`.

### Duyệt lại sau khi sửa tin

BA đề xuất: chỉ bắt duyệt lại khi sửa **lương, địa điểm, ca làm**; sửa mô tả và yêu cầu thì không, để giảm tải cho admin.

Mục tiêu giảm tải là đúng, nhưng **danh sách trường đang thiếu đúng chỗ nguy hiểm nhất**. Lý do tồn tại của khâu duyệt là chặn tin lừa đảo, mà tin lừa đảo không đổi lương — nó đổi **mô tả**. Đăng "Nhân viên văn phòng 30k/giờ" cho qua duyệt, rồi sửa mô tả thành "đóng 500k phí đồng phục trước khi nhận việc". Bỏ `description` khỏi danh sách là mở đúng cánh cửa mà khâu duyệt sinh ra để đóng.

Danh sách chốt lại — sửa các trường sau thì tin quay về `PENDING`:

**`title` · `description` · `salaryMin` · `salaryMax` · `salaryNegotiable` · `city` · `district` · ca làm · `quantity`**

Không cần duyệt lại: `benefits`, `requirements`, `skills`. Đây là phần bổ sung chi tiết, rủi ro thấp.

Ghi thêm cho Sprint 6: cách làm chuẩn của các trang lớn là **giữ bản cũ vẫn hiển thị trong lúc bản sửa chờ duyệt**, thay vì gỡ tin xuống. Cần thêm bảng phiên bản tin, chưa làm bây giờ.

Luật này thuần tầng service, không đụng schema.

### Sinh viên rút đơn — làm

Đồng ý, chi phí gần bằng không: `WITHDRAWN` đã có sẵn trong enum.

Một chi tiết nghiệp vụ cần chốt kèm: rút rồi **nộp lại được không**. Ràng buộc `@@unique([jobId, studentProfileId])` không cho tạo đơn thứ hai, nên nộp lại phải là **đổi trạng thái hàng cũ** về `PENDING` chứ không tạo hàng mới. Cách này còn tốt hơn: nhà tuyển dụng không bị nhìn thấy hai đơn trùng của cùng một người.

### Lương thoả thuận — bổ sung

BA đúng: ép ghi số thì nhà tuyển dụng bịa số, và dữ liệu bịa còn tệ hơn dữ liệu trống.

Cách thực hiện có siết thêm. Không để `salaryMin = null` một mình mang nghĩa "thoả thuận" — null như vậy mơ hồ, không phân biệt được **cố ý không ghi** với **quên điền**. Thay vào đó có cờ tường minh `salaryNegotiable`, và CHECK `jobs_salary_check` bắt ba cột này luôn nhất quán: hoặc thoả thuận và không có số nào, hoặc có đủ hai số với `min <= max`.

`salaryUnit` **vẫn bắt buộc** kể cả khi thoả thuận — "thoả thuận theo giờ" khác "thoả thuận theo tháng", sinh viên cần biết đang mặc cả trên đơn vị nào.

Kéo theo một luật lọc cần BA xác nhận lại: khi sinh viên đặt mức lương sàn, tin thoả thuận **bị loại khỏi kết quả**. Lý do: không có số thì không so được, mà hiện lên thì hỏng ý nghĩa của bộ lọc. Khi không lọc lương thì tin vẫn hiện bình thường.
