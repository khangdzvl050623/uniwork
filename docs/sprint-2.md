# Sprint 2 — Tin tuyển dụng

**Thời lượng:** 10 ngày làm việc (tuần 4–5) · **Nhóm:** 3 người

| Ký hiệu | Vai trò | Tên |
| --- | --- | --- |
| **DEV1** | Backend, hạ tầng, database, deploy API | Khang |
| **DEV2** | Frontend, CI, deploy web | Bảo |
| **BA** | Phân tích nghiệp vụ, viết tài liệu, wireframe | Quốc |

## Mục tiêu sprint

Cuối sprint phải **có dữ liệu tin tuyển dụng thật trong hệ thống** (mốc cuối tuần 5 trong timeline).

Cụ thể là đi trọn được đường này trên bản deploy thật:

> Nhà tuyển dụng đã xác minh → đăng tin nháp → điền ca làm + kỹ năng yêu cầu → gửi duyệt → admin duyệt → tin hiện công khai → sinh viên mở trang việc làm thấy tin, bấm vào xem chi tiết.

Và nhánh từ chối: admin từ chối kèm lý do → tin về lại `DRAFT`, nhà tuyển dụng sửa và gửi lại.

**Cố ý CHƯA làm trong sprint này** (thuộc Sprint 3 — Tìm kiếm & Lọc, theo timeline): full-text search, lọc đa tiêu chí, thuật toán ghép lịch rảnh, điểm phù hợp. Trang danh sách việc làm sprint này chỉ hiện tin `OPEN`, lọc cơ bản theo khu vực và loại thời gian — xem ghi chú T79 vì sao ranh giới này quan trọng.

## Đã có sẵn từ Sprint 1

Nêu ra để không ai làm lại:

| Có rồi | Ở đâu |
| --- | --- |
| Model `Job`, `JobShift`, `JobSkill`, `Skill` đầy đủ, cùng quan hệ tới `EmployerProfile` | `apps/api/prisma/schema.prisma` |
| CHECK `jobs_schedule_fields_check` (ràng buộc `startDate`/`endDate`/`workDate`/`minShiftsPerWeek` theo `scheduleType`) và `jobs_salary_check` (`salaryNegotiable` nhất quán với `salaryMin`/`salaryMax`) | `apps/api/prisma/migrations/20260815070939_.../migration.sql` |
| Enum `JobStatus`, `ScheduleType`, `SalaryUnit` phía shared, khớp schema | `packages/shared/src/domain.ts` |
| BRD Module 2 (Đăng tin) đầy đủ: trường dữ liệu, luồng trạng thái, lỗi/ngoại lệ, 5 quyết định đã chốt (giấy tờ xác minh, `SEASONAL` tách khỏi `commitmentMonths`, trường nào bắt sửa tin quay lại `PENDING`, rút đơn, lương thoả thuận) | `docs/brd-uoc-luong.md` |
| `GET /api/skills` — đọc danh mục kỹ năng | `apps/api/src/modules/skills` |
| `GET`/`PUT /api/admin/nha-tuyen-dung/...` — mẫu hai tầng quyết định (chứng cứ / kết luận) và mẫu ownership + transaction, dùng lại tinh thần cho duyệt tin | `apps/api/src/modules/admin/admin.service.ts` |
| Giao diện đã dựng với dữ liệu giả, đúng hình dạng field của schema: form đăng tin, trang quản lý tin NTD, danh sách việc làm, chi tiết tin, trang duyệt tin admin | `PostJob.tsx`, `admin/EmployerJobs.tsx`, `JobList.tsx`, `JobDetail.tsx`, `admin/ReviewJobs.tsx` |
| Middleware `requireAuth`, `requireRole`; pattern `requireEmployerProfileId`/`requireStudentProfileId` để tra id hồ sơ từ `userId` | `middlewares/auth.ts`, `modules/profile/profile.service.ts` |

**Chưa có:** module `jobs` (mọi phía — NTD, admin, công khai). API hiện chưa có endpoint nào đọc hay ghi bảng `jobs`. Ba trang `PostJob.tsx`, `admin/EmployerJobs.tsx`, `JobList.tsx`, `JobDetail.tsx`, `admin/ReviewJobs.tsx` đang chạy 100% dữ liệu giả trong `apps/web/src/data/mock.ts` và `adminMock.ts`. Skills mới có phần đọc, chưa có phần admin thêm/sửa/xoá.

## Danh sách công việc

Mã tiếp nối Sprint 1 (kết thúc ở T66).

### Tuần 4 — Đăng tin và gửi duyệt

| Mã | Ngày | Người | Công việc | Kết quả cần đạt |
| --- | --- | --- | --- | --- |
| T67 | 1 | DEV1 | `POST`/`PUT`/`DELETE /api/admin/ky-nang` — admin thêm, đổi tên, xoá kỹ năng trong danh mục | Xoá kỹ năng đang có tin dùng (`JobSkill` tham chiếu) bị chặn — `Restrict` đã có sẵn ở schema, service phải trả lỗi rõ ràng thay vì để lộ lỗi Postgres |
| T68 | 1–2 | DEV1 | `POST /api/ntd/tin-tuyen-dung` — tạo tin `DRAFT`, kèm ca làm (`shifts[]`) và kỹ năng yêu cầu (`skillIds[]`) trong một transaction. Bọc `rateLimit` (~20 tin/giờ theo `userId`), dùng lại middleware sẵn có — xem ghi chú T68 | Gửi tin thiếu ca làm bị chặn ngay ở Zod (422), CHECK ở database là lớp phòng thủ thứ hai; gọi `POST` liên tục quá ngưỡng trả `RATE_LIMITED` |
| T69 | 2–3 | DEV1 | `GET /api/ntd/tin-tuyen-dung` (danh sách tin của chính mình, mọi trạng thái) và `GET /api/ntd/tin-tuyen-dung/:id` | NTD A gọi xem tin của NTD B trả `FORBIDDEN` |
| T70 | 3–4 | DEV1 | `PUT /api/ntd/tin-tuyen-dung/:id` — sửa tin. Sửa các trường đã chốt trong BRD thì tự động quay về `PENDING` | Sửa `benefits` không bắt duyệt lại; sửa `salaryMin` thì bắt |
| T71 | 4 | DEV1 | `DELETE /api/ntd/tin-tuyen-dung/:id` — **chỉ cho xoá khi `status = DRAFT`** | Xoá tin đã gửi duyệt (`PENDING` trở lên) trả `CONFLICT`, không đụng tới `Application` đã cascade |
| T72 | 4–5 | DEV1 | `POST /api/ntd/tin-tuyen-dung/:id/gui-duyet` — `DRAFT` → `PENDING` | NTD chưa có `verifiedAt` gọi vào trả `FORBIDDEN`, đúng luồng BRD đã chốt |
| T73 | 1–3 | DEV2 | Nối `PostJob.tsx` vào API thật — dùng chung form cho tạo và sửa. Ẩn/hiện đúng nhóm trường theo `scheduleType` (bảng đã chốt trong BRD), thêm ô "Lương thoả thuận" đang thiếu | Chọn `SEASONAL` thì ô `commitmentMonths` biến mất, ô `startDate`/`endDate` bắt buộc hiện ra |
| T74 | 3–5 | DEV2 | Trang quản lý tin của NTD (`admin/EmployerJobs.tsx`) nối API thật: danh sách, sửa, xoá tin nháp, nút gửi duyệt, hiện rõ `rejectionReason` khi bị từ chối | NTD nhìn phát biết tin nào đang ở trạng thái gì và vì sao bị từ chối, không phải đoán |
| T75 | 1–3 | BA | Viết test case cho luồng đăng tin — tạo, sửa, xoá, gửi duyệt, cả hai nhánh duyệt/từ chối | Bảng test case đủ ca, kể cả ca âm (sửa tin người khác, xoá tin đã mở) |
| T76 | 3–5 | BA | Tiếp tục Figma Sprint 3–4: bộ lọc tìm kiếm, trang kết quả, luồng ứng tuyển | Giao **trước khi Sprint 3 bắt đầu** |

### Tuần 5 — Duyệt tin và xem việc công khai

| Mã | Ngày | Người | Công việc | Kết quả cần đạt |
| --- | --- | --- | --- | --- |
| T77 | 6 | DEV1 | `GET /api/admin/tin-tuyen-dung` (lọc theo `status`, mặc định `PENDING`) — nối lại phần treo từ Sprint 1 (`ReviewJobs.tsx` đang mock) | Trả đúng field admin cần thấy để duyệt: tên NTD, ca làm, lương, không phải trả nguyên `Job` |
| T78 | 6–7 | DEV1 | `PUT /api/admin/tin-tuyen-dung/:id/duyet` — duyệt (`PENDING`→`OPEN`, đặt `publishedAt`) hoặc từ chối (`PENDING`→`DRAFT` + `rejectionReason` bắt buộc) | Từ chối không có lý do trả `VALIDATION_ERROR`, đúng mẫu đã làm ở duyệt giấy tờ NTD |
| T79 | 7–8 | DEV1 | `GET /api/viec-lam` — danh sách công khai, **chỉ `status = OPEN`**, lọc cơ bản `city`/`district`/`scheduleType`, sắp theo `publishedAt` giảm dần. Chặn cứng `take: 100` — xem ghi chú phân trang | **KHÔNG** làm lọc theo lịch rảnh, không làm full-text, không tính điểm phù hợp — ba thứ đó là Sprint 3. Endpoint không bao giờ trả quá 100 hàng dù bảng có bao nhiêu tin |
| T80 | 8 | DEV1 | `GET /api/viec-lam/:id` — chi tiết tin công khai, tăng `viewCount` | Xem tin `DRAFT`/`PENDING`/`CLOSED` qua endpoint công khai trả `NOT_FOUND`, không phải để lộ rồi chặn ở giao diện |
| T81 | 8–9 | DEV1 | Test: CRUD tin, ownership, chuyển trạng thái, duyệt/từ chối, danh sách công khai chỉ thấy `OPEN` | `pnpm test` xanh, có ca test cho **xoá tin đã `PENDING` bị chặn** |
| T82 | 9–10 | DEV1 | Buffer — sửa lỗi BA tìm được lúc kiểm thử trên bản deploy | Không còn issue mức nghiêm trọng nào mở |
| T83 | 6–7 | DEV2 | Trang duyệt tin của admin (`admin/ReviewJobs.tsx`) nối API thật | Admin duyệt một tin, tin đó xuất hiện ngay trên trang việc làm công khai không cần tải lại |
| T84 | 7–8 | DEV2 | Trang danh sách việc làm (`JobList.tsx`) nối API thật. Ô "chỉ hiện việc khớp lịch rảnh" giữ nguyên **vô hiệu hoá kèm chú thích "Có ở Sprint 3"**, không xoá UI đã dựng. Đặt `staleTime` riêng cho query công khai, `invalidateQueries` sau khi admin duyệt — xem ghi chú T84 | Mở `/viec-lam` thấy đúng tin thật đã được duyệt, không thấy tin `DRAFT`/`PENDING` của ai. **Mở `/viec-lam` trên HAI trình duyệt khác nhau, duyệt một tin ở trình duyệt A → trình duyệt B thấy tin trong vòng 15 giây mà không cần F5** |
| T85 | 8–9 | DEV2 | Trang chi tiết tin (`JobDetail.tsx`) nối API thật | Mở tin từ danh sách sang chi tiết đúng dữ liệu, nút "Ứng tuyển" hiện nhưng disabled kèm chú thích "Có ở Sprint 4" |
| T86 | 9–10 | DEV2 | Kiểm tra responsive toàn bộ 4 màn hình mới trên máy thật | Đăng tin được bằng điện thoại, không chỉ xem |
| T87 | 6–8 | BA | Kiểm thử luồng đăng tin + duyệt tin trên bản deploy thật | Bảng test case có cột kết quả thực tế; lỗi tìm được ghi thành issue |
| T88 | 8–10 | BA | Chương 3 báo cáo: thiết kế module Đăng tin | Bản nháp đủ ý, có sơ đồ trạng thái tin (`DRAFT`→`PENDING`→`OPEN`/`CLOSED`) |

## Đường đi của DEV1 — dựng theo thứ tự này

```
1. modules/skills/    thêm sửa xoá        ← T67   (độc lập, làm trước cho rảnh tay)
2. modules/jobs/      tạo tin (DRAFT)     ← T68   (cần requireEmployerProfileId có sẵn)
3. modules/jobs/      đọc, sửa, xoá       ← T69–T71 (cần T68)
4. modules/jobs/      gửi duyệt           ← T72   (cần T70, cần verifiedAt từ Sprint 1)
5. modules/admin/     duyệt tin           ← T77–T78 (cần T72 — không có gì để duyệt nếu chưa gửi được)
6. modules/jobs/      danh sách + chi tiết công khai ← T79–T80 (cần T78 — phải có tin OPEN thật để lọc)
```

Cây thư mục mới, theo đúng khuôn `modules/admin/` đã có:

```
apps/api/src/modules/
├── skills/
│   ├── skills.routes.ts             ← sửa (T67): thêm POST/PUT/DELETE
│   ├── skills.controller.ts         ← sửa
│   ├── skills.service.ts            ← sửa
│   └── skills.test.ts               ← sửa
└── jobs/
    ├── jobs.routes.ts                ← mới — mount CẢ BA nhánh (/ntd, /admin, /viec-lam công khai)
    ├── jobs.controller.ts
    ├── jobs.service.ts
    └── jobs.test.ts
```

Ba nhánh route (NTD quản lý tin mình, admin duyệt, công khai xem) đều đọc/ghi cùng bảng `Job` — gộp vào một module `jobs/` thay vì tách ba module, vì tách ra sẽ phải export lại `CHON_JOB`/kiểu response qua lại giữa ba file cho cùng một bảng.

**Kiểu dữ liệu trả về khai ở `packages/shared/src/api.ts`** — cùng nguyên tắc Sprint 1. Chốt và push kiểu công khai (`JobSummaryResponse`, `JobDetailResponse`) **ngay ngày 1–2**, DEV2 cần chúng để nối `JobList.tsx`/`JobDetail.tsx` từ đầu tuần 5.

## Ghi chú cho T68, T70 — luật lịch/lương đã canh ở database, service chỉ cần khớp

CHECK `jobs_schedule_fields_check` và `jobs_salary_check` **đã tồn tại từ migration Sprint 1** (`20260815070939_oauth_ready_va_luong_thoa_thuan`) — không cần viết migration mới cho luật này, chỉ cần Zod ở tầng service validate **giống hệt** để người dùng thấy lỗi rõ ràng (422 kèm tên trường) thay vì một lỗi Postgres khó đọc bắn lên tận response.

Bảng luật, chép lại từ BRD để khỏi phải mở hai file:

| | `commitmentMonths` | `startDate` | `endDate` | `workDate` | `minShiftsPerWeek` |
| --- | --- | --- | --- | --- | --- |
| `RECURRING` | dùng, có thể trống | có thể trống | **cấm** | **cấm** | dùng |
| `SEASONAL` | **cấm** | **bắt buộc** | **bắt buộc** | **cấm** | dùng |
| `ONE_TIME` | **cấm** | **cấm** | **cấm** | **bắt buộc** | **cấm** |

Lương: `salaryNegotiable = true` thì `salaryMin`/`salaryMax` phải null cả hai; `false` thì cả hai bắt buộc và `salaryMin <= salaryMax`. `salaryUnit` luôn bắt buộc.

## Ghi chú cho T70 — trường nào bắt tin quay lại `PENDING`

Đã chốt trong BRD, chép lại vì đây là chỗ dễ làm thiếu:

**Bắt duyệt lại:** `title`, `description`, `salaryMin`, `salaryMax`, `salaryNegotiable`, `city`, `district`, ca làm (`shifts`), `quantity`.

**Không bắt:** `benefits`, `requirements`, `skills`.

Lý do `description` nằm trong danh sách bắt buộc dù nghe như "chỉ là chữ": tin lừa đảo không đổi lương, nó đổi mô tả sau khi đã qua duyệt bằng một tin sạch. Bỏ `description` ra khỏi danh sách là mở đúng cửa mà khâu duyệt sinh ra để chặn.

## Ghi chú cho T71 — vì sao chỉ xoá được tin `DRAFT`

`Application.job` khai `onDelete: Cascade` — xoá một `Job` xoá theo mọi đơn ứng tuyển của tin đó. Một tin đã `PENDING` trở lên thì **có khả năng đã có ứng viên** (thực ra Sprint 4 mới xây xong luồng nộp đơn, nhưng luật này phải đúng ngay từ bây giờ để không phải sửa lại khi Sprint 4 tới). Cho xoá cứng một tin đã public là cho nhà tuyển dụng xoá luôn bằng chứng ứng tuyển của sinh viên — kể cả vô tình.

Muốn gỡ một tin đã `OPEN` thì dùng đường khác: đổi `status` sang `CLOSED` (giữ nguyên `Job`, giữ nguyên `Application`), không phải `DELETE`. Endpoint đóng tin không thuộc phạm vi sprint này — thời điểm dùng phổ biến nhất của nó là "đã tuyển đủ người", mà đó thuộc Sprint 4 (luồng ứng tuyển). Ghi lại ở đây để Sprint 4 không quên.

## Ghi chú cho T79 — ranh giới với Sprint 3, đọc kỹ trước khi code

Đây là chỗ dễ lấn phạm vi nhất sprint này, vì giao diện `JobList.tsx`/`FilterSidebar.tsx` **đã dựng sẵn** ô "chỉ hiện việc khớp lịch rảnh" từ lúc còn dùng dữ liệu giả.

`GET /api/viec-lam` sprint này **chỉ làm**:
- Lọc `status = 'OPEN'`
- Lọc cơ bản: `city`, `district`, `scheduleType` (so sánh bằng, không phải tìm kiếm mờ)
- Sắp xếp theo `publishedAt` giảm dần

**Chưa làm** (Sprint 3, theo timeline và BRD Module 3):
- Full-text search theo `title`/`description`
- Ghép lịch rảnh — JOIN `job_shifts`/`availabilities`, cần bảng `availabilities` phía sinh viên đã có từ Sprint 1 nhưng phép JOIN thì chưa viết
- Điểm phù hợp (tính lúc chạy, công thức trong `JobCard.tsx`)
- Lọc theo mức lương, kỹ năng

Phía web: ô khớp lịch rảnh và các bộ lọc chưa nối cứ **giữ nguyên trên giao diện, ở trạng thái disabled**, không xoá — đúng cách đã làm với nút "Ứng tuyển" ở `JobDetail.tsx` (T85). Xoá rồi Sprint 3 dựng lại là phí công hai lần.

## Ghi chú về phân trang — cố ý CHƯA làm, và vì sao hoãn được an toàn

Câu hỏi hợp lý: chốt kiểu response ngày 2 rồi, Sprint 3 mới thêm phân trang thì có phải sửa lại contract, kéo DEV2 sửa theo không?

**Không**, nhờ một quy ước đã có từ Sprint 1: mọi endpoint danh sách đều **bọc trong object**, không trả mảng trần.

```ts
ok(res, { users: await adminService.listUsers() })          // admin.controller.ts
ok(res, { employers: await adminService.listEmployers() })
```

Nên `{ jobs: [...] }` hôm nay trở thành `{ jobs: [...], total, page, limit }` ở Sprint 3 là thay đổi **cộng thêm**, không phá vỡ: `data.jobs.map(...)` bên web chạy nguyên, không sửa dòng nào. Nếu trả mảng trần `[...]` thì mới thật sự kẹt — đó chính là lý do quy ước bọc object tồn tại.

Vì sao không làm luôn cho xong:

- **UI phân trang là quyết định UX, không phải quyết định API.** Chọn "trang số" hay "tải thêm" phải quyết cùng lúc với bộ lọc mới ở Sprint 3, nơi `FilterSidebar` được dựng lại. Làm API trước mà chưa có UI dùng thì Sprint 3 vẫn sửa — làm hai lần.
- Quy mô thật: seed có 10 tin, bản demo cỡ 30–50.
- `GET /api/ntd/tin-tuyen-dung` chỉ trả tin của **một** NTD, thực tế dưới 50 — không bao giờ cần phân trang.

**Bù lại, làm ngay một thứ rẻ:** `GET /api/viec-lam` chặn cứng `take: 100` phía server. Đây không phải phân trang, chỉ là chặn trường hợp bảng phình mà endpoint dump toàn bộ. Không đụng gì tới contract.

## Ghi chú cho T68 — vì sao rate limit chứ không phải "tối đa N tin nháp"

Nguy cơ thật ở đây **không phải kẻ tấn công**: tạo tin đòi vai `EMPLOYER`, mà đăng ký NTD phải qua OTP email nên không ẩn danh. Ở quy mô đồ án, spam có chủ đích gần như không xảy ra.

Thứ dễ xảy ra hơn nhiều là **bug của chính mình**: người dùng bấm "Lưu nháp" hai lần, hoặc một vòng retry gọi lại `POST` liên tục. Đó mới là thứ tạo ra 200 tin rác trong 5 phút.

Với nguyên nhân đó, giới hạn "tối đa N tin `DRAFT`" là công cụ sai:

| | Giới hạn N tin `DRAFT` | `rateLimit` trên `POST` |
| --- | --- | --- |
| Chặn double-submit / retry loop | Không — N=20 thì vẫn tạo được 20 rác | **Có** |
| Ảnh hưởng người dùng thật | **Có** — NTD nhiều chi nhánh soạn sẵn 25 tin bị chặn oan | Gần như không |
| N bằng bao nhiêu? | Con số tuỳ tiện, không có cơ sở nghiệp vụ | Không phải chọn |
| Chi phí | COUNT query + mã lỗi + test | **Hạ tầng đã có sẵn** |

`rateLimit({ max, windowMs, keyOf })` ở `middlewares/rate-limit.ts` đã nhận tham số nên dùng lại được ngay — Sprint 1 đang dùng nó cho `/dang-nhap` và `/gui-otp`.

Cố ý **không** đặt giới hạn số tin `DRAFT`: đó là luật nghiệp vụ chưa ai yêu cầu, thêm vào là tự tạo ra một quy tắc phải đi giải thích với người dùng.

## Ghi chú cho T84 — cache của dữ liệu công khai khác hẳn Sprint 1

Sprint 1 mọi dữ liệu đều là **của chính người đang xem** (hồ sơ tôi, chỉ tôi sửa), nên vá thẳng vào cache sau mutation (`setQueryData`) là đủ.

Sprint 2 đổi bản chất: `/api/viec-lam` là dữ liệu **do người khác thay đổi** — admin duyệt tin, sinh viên đang xem không hề biết.

Hai tình huống khác nhau, đừng nhầm là một:

| Tình huống | Cơ chế đúng |
| --- | --- |
| Admin duyệt xong, tự mở `/viec-lam` kiểm tra (cùng trình duyệt) | `invalidateQueries(['viec-lam'])` sau mutation |
| Sinh viên ở máy khác đang mở sẵn trang | **Chỉ `staleTime` ngắn mới cứu được** — `invalidateQueries` chạy trong trình duyệt admin, không chạm tới trình duyệt sinh viên |

Cấu hình mặc định hiện tại là `staleTime: 60_000` và `refetchOnWindowFocus: false` (xem `lib/queryClient.ts`) — hợp lý cho dữ liệu Sprint 1, nhưng quá dài cho danh sách công khai. Đặt riêng cho query này 0–15 giây, và **ghi comment nói rõ vì sao khác mặc định**, nếu không lần sau có người "dọn dẹp" cho thống nhất là hỏng lại.

## Tự kiểm trước khi mở PR — phần DEV1

Chạy hết danh sách này trước khi tạo PR. Ba mục đầu lặp lại từ Sprint 1 vì vẫn đúng; các mục còn lại là mới, riêng cho module `jobs`.

**Trước mỗi lần push**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` xanh trên máy
- [ ] Endpoint mới đã khai vào `src/routes.ts` và gọi thử bằng curl thấy trả đúng
- [ ] Kiểu response đã có trong `packages/shared/src/api.ts`

**Riêng cho module `jobs`**

- [ ] ⚠ Mọi endpoint sửa/xoá tin đều kiểm **chủ sở hữu** (`employerProfileId` của tin khớp với người gọi), không chỉ kiểm `requireRole('EMPLOYER')`. NTD A sửa/xoá được tin của NTD B là lỗi nghiêm trọng nhất có thể có ở module này
- [ ] Tạo/sửa tin kèm `shifts[]`/`skillIds[]` nằm trong một `prisma.$transaction` — nửa chừng lỗi để lại tin không có ca làm nào là hỏng dữ liệu, không phải chuyện nhỏ
- [ ] `DELETE` chỉ chấp nhận khi `status = 'DRAFT'`, đã test ca `PENDING`/`OPEN` bị chặn
- [ ] Sửa tin có đổi một trong các trường nhạy cảm (xem bảng T70) thì `status` tự về `PENDING`, đã test cả chiều "sửa `benefits` thì không đổi status"
- [ ] Endpoint công khai (`/api/viec-lam*`) không yêu cầu đăng nhập, nhưng chỉ trả tin `status = 'OPEN'` — thử gọi thẳng bằng id của một tin `DRAFT` phải ra `NOT_FOUND`
- [ ] Zod validate luật lịch/lương ở tầng service **khớp chính xác** với CHECK ở database — không tự nới hay siết hơn, lệch nhau thì một phía nói dối

**Về database**

- [ ] Không đổi `schema.prisma` — module này dùng nguyên bảng đã có từ Sprint 0, không cần migration mới. Nếu thấy mình đang viết migration thì dừng lại kiểm tra có thật sự cần không
- [ ] `prisma migrate dev --create-only` báo không có gì để tạo

**Trước khi coi là xong hẳn**

- [ ] ⚠ Đã thử trên bản deploy thật: NTD (Render/production DB) đăng tin, admin duyệt, mở `/viec-lam` trên Vercel thấy tin đó
- [ ] Từ chối một tin thật, xác nhận tin quay về `DRAFT` kèm đúng `rejectionReason`, và tin đó **biến mất** khỏi `/viec-lam` công khai ngay lập tức

## Sản phẩm bàn giao

| Sản phẩm | Người | Hạn |
| --- | --- | --- |
| Bảng test case luồng đăng tin | BA | Hết ngày 3 |
| Kiểu response `jobs` đã push lên `packages/shared` | DEV1 | **Hết ngày 2** |
| API tin tuyển dụng đầy đủ (tạo, sửa, xoá, gửi duyệt, duyệt/từ chối, danh sách + chi tiết công khai) chạy trên Render | DEV1 | Hết ngày 8 |
| Form đăng tin và trang quản lý tin NTD dùng dữ liệu thật | DEV2 | Hết ngày 5 |
| Trang duyệt tin admin, danh sách + chi tiết việc làm công khai dùng dữ liệu thật | DEV2 | Hết ngày 9 |
| Figma Sprint 3–4 | BA | **Hết ngày 5** |
| Kết quả kiểm thử trên bản deploy + danh sách lỗi | BA | Hết ngày 8 |
| Chương 3 báo cáo (bản nháp) | BA | Hết ngày 10 |

## Phụ thuộc

| Việc | Chờ | Ghi chú |
| --- | --- | --- |
| T73, T74 | T68–T72 | DEV2 cần kiểu response thật để nối form — DEV1 chốt kiểu trong `packages/shared` ngay ngày 1–2, đừng đợi service xong |
| T77, T78 | T72 | Không có tin nào ở `PENDING` để duyệt nếu gửi duyệt chưa xong |
| T79, T80, T83–T85 | T78 | Danh sách/chi tiết công khai cần ít nhất một tin thật đã `OPEN` để kiểm — duyệt một tin thử ngay sau khi T78 xong, đừng đợi tới lúc viết xong T79 mới có dữ liệu để test |
| T81 | T67–T80 | Test toàn module chỉ viết được sau khi service ổn định; viết song song dễ phải sửa lại test theo mỗi lần đổi API |
| Sprint 3 | T76 | BA giao thiết kế trễ thì Sprint 3 phải dựng theo phỏng đoán, giống rủi ro đã xảy ra ở Sprint 1→2 |

## Rủi ro của riêng sprint này

| Rủi ro | Dấu hiệu sớm | Xử lý |
| --- | --- | --- |
| Nhầm phạm vi, lỡ tay làm luôn lọc lịch rảnh/full-text của Sprint 3 | T79 mất hơn 2 ngày dự kiến | Dừng lại, đọc lại ghi chú T79. Tính năng đó CÓ giao diện sẵn không có nghĩa nó thuộc sprint này |
| Quên kiểm ownership ở một trong bốn endpoint NTD (T69–T72) | Test case BA viết ở T75 phát hiện NTD A sửa được tin NTD B | Thêm helper `requireJobOwner(userId, jobId)` dùng chung cho cả bốn endpoint thay vì lặp lại kiểm tra bốn lần — lặp lại là dễ quên một chỗ |
| Luật CHECK ở database và Zod ở service lệch nhau (vd. Zod cho phép `SEASONAL` thiếu `endDate` nhưng database chặn) | Tạo tin trả lỗi 500 thay vì 422 rõ ràng | Viết test đối chiếu từng dòng bảng luật ở T68, không chỉ test "trường hợp thường gặp" |
| Duyệt xong tin không hiện ngay trên `/viec-lam` vì web cache cũ | BA test thấy "duyệt rồi mà sinh viên không thấy" | Đã gán vào **T84**. Lưu ý đừng chỉ dựa vào `invalidateQueries`: nó chạy trong trình duyệt admin, không chạm tới trình duyệt sinh viên ở máy khác. Với người xem khác máy thì chỉ `staleTime` ngắn mới có tác dụng — xem ghi chú T84 |
