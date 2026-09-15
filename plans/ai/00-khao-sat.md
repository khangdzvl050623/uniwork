# 00 — Khảo sát: tái sử dụng được gì, và những gì đã kiểm chứng bên ngoài

**Trả lời đầu ra 1.** Khảo sát tại commit `720242b`, nhánh `dev`, ngày 2026-09-12.

Chia làm ba phần:
- **A.** Thứ đã có trong repo, dùng lại được, kèm đường dẫn.
- **B.** Thứ đã có nhưng **không** dùng lại được, và vì sao.
- **C.** Sự thật bên ngoài repo đã kiểm bằng tài liệu chính thức.

Phần cuối phân biệt rõ ba loại phát biểu trong toàn bộ bộ plan này:
**ĐỌC ĐƯỢC** (từ repo hoặc tài liệu chính thức) · **GIẢ ĐỊNH** (chưa kiểm được) ·
**ĐỀ XUẤT** (quyết định thiết kế).

---

## A. Dùng lại được

### A.1 — Hạ tầng request/response

| Thứ | Đường dẫn | Dùng vào đâu |
| --- | --- | --- |
| `createApp()` — thứ tự middleware có chủ đích | [apps/api/src/app.ts](../../apps/api/src/app.ts) | Gắn thêm route `/api/tro-ly`, `/api/hoi-thoai`, `/api/toi/quet-cv`. **Không** đổi thứ tự middleware. |
| `apiRouter` — một chỗ khai mount | [apps/api/src/routes.ts](../../apps/api/src/routes.ts) | Thêm 3 dòng `apiRouter.use(...)`. Chú ý luật "khai trước `/toi`" đã ghi ở đó. |
| `ok()` / `fail()` — hai hàm duy nhất được gửi response | [apps/api/src/lib/respond.ts](../../apps/api/src/lib/respond.ts) | Mọi endpoint mới. **Trừ** endpoint stream SSE — xem mục B.1. |
| `AppError` + `badRequest/unauthorized/forbidden/notFound/conflict/tooManyRequests` | [apps/api/src/lib/errors.ts](../../apps/api/src/lib/errors.ts) | Toàn bộ. Cần thêm đúng **một** mã lỗi mới, xem A.7. |
| `errorHandler` | [apps/api/src/middlewares/error-handler.ts](../../apps/api/src/middlewares/error-handler.ts) | Không sửa. |
| `logger` — JSON ở production, màu ở local | [apps/api/src/lib/logger.ts](../../apps/api/src/lib/logger.ts) | Dùng cho log token/latency. **Ràng buộc mới:** không đưa nội dung tin nhắn hay nội dung CV vào `meta`. Xem [09](09-phan-bien.md) mục 6. |
| `server.close()` + `prisma.$disconnect()` khi SIGTERM | [apps/api/src/index.ts:38-70](../../apps/api/src/index.ts#L38-L70) | Phải mở rộng: đóng Socket.IO, đóng kênh RabbitMQ, chờ tool đang chạy. Xem [01](01-kien-truc-va-ranh-gioi.md) mục 5. |

### A.2 — Xác thực và phân quyền — dùng lại **nguyên vẹn**

| Thứ | Đường dẫn | Ghi chú |
| --- | --- | --- |
| `requireAuth` — đọc `Authorization: Bearer`, KHÔNG đọc cookie | [apps/api/src/middlewares/auth.ts:47-66](../../apps/api/src/middlewares/auth.ts#L47-L66) | Lý do chống CSRF ghi ngay tại chỗ. Socket.IO handshake phải theo đúng nguyên tắc này — xem [04](04-handoff-realtime.md) mục 3. |
| `optionalAuth` | [apps/api/src/middlewares/auth.ts:82-92](../../apps/api/src/middlewares/auth.ts#L82-L92) | Dùng cho tool `timViecLam` khi khách chưa đăng nhập (nếu về sau mở chat cho khách). Hiện chat **bắt buộc** đăng nhập. |
| `requireRole(...roles)` | [apps/api/src/middlewares/auth.ts:100-107](../../apps/api/src/middlewares/auth.ts#L100-L107) | Tách tool sinh viên / tool NTD. |
| `verifyAccessToken` | [apps/api/src/lib/token.ts](../../apps/api/src/lib/token.ts) | Dùng trong `io.use()` để xác thực handshake. |

**Điểm quan trọng cho chat:** `requireAuth` cố ý **không truy vấn database** — token
hợp lệ là đủ, đánh đổi là tài khoản vừa bị khoá vẫn gọi được API tối đa 15 phút.
Với REST thì 15 phút là trần. Với **Socket.IO thì không** — một kết nối mở có thể
sống hàng giờ. Phải xử lý riêng, xem [04](04-handoff-realtime.md) mục 3.2.

### A.3 — Nghiệp vụ: đúng những hàm mà tool AI sẽ gọi

Đây là phần đắt nhất đã có sẵn. Tool của chatbot **không tự truy vấn database** —
nó gọi thẳng các hàm này, nhờ vậy thừa hưởng nguyên vẹn mọi luật phân quyền và
che dữ liệu đã được test.

| Hàm | Đường dẫn | Thành tool nào |
| --- | --- | --- |
| `listPublicJobs(query, userId?)` | [jobs.service.ts:1074](../../apps/api/src/modules/jobs/jobs.service.ts#L1074) | `timViecLam` |
| `getPublicJob(jobId, userId?)` | [jobs.service.ts:1223](../../apps/api/src/modules/jobs/jobs.service.ts#L1223) | `xemChiTietViec` |
| `listSavedJobs(userId)` | [jobs.service.ts:1376](../../apps/api/src/modules/jobs/jobs.service.ts#L1376) | `xemTinDaLuu` |
| `listMyJobs(userId)` / `getMyJob(userId, jobId)` | [jobs.service.ts:190](../../apps/api/src/modules/jobs/jobs.service.ts#L190), [:203](../../apps/api/src/modules/jobs/jobs.service.ts#L203) | `xemTinCuaToi`, `xemChiTietTinCuaToi` (NTD) |
| `listStudentApplications(userId)` | [applications.service.ts:390](../../apps/api/src/modules/applications/applications.service.ts#L390) | `xemDonUngTuyenCuaToi` |
| `listApplicants(...)` | [applications.service.ts:547](../../apps/api/src/modules/applications/applications.service.ts#L547) | `xemUngVien` (NTD) |
| `getStudentProfile(userId)` | [profile.service.ts:181](../../apps/api/src/modules/profile/profile.service.ts#L181) | `xemHoSoCuaToi` |
| `getAvailability(userId)` | [profile.service.ts:422](../../apps/api/src/modules/profile/profile.service.ts#L422) | `xemLichRanhCuaToi` |
| `listSkills()` | [skills.service.ts:16](../../apps/api/src/modules/skills/skills.service.ts#L16) | `danhMucKyNang` |

#### Vì sao điều này quan trọng hơn nó trông

`listApplicants` và `listStudentApplications` **không trả số điện thoại và email**
trừ khi đơn ở trạng thái `SHORTLISTED` hoặc `ACCEPTED`. Luật đó nằm ở
`TRANG_THAI_MO_LIEN_HE`
([packages/shared/src/domain.ts:367](../../packages/shared/src/domain.ts#L367)), và
được cưỡng chế **ở tầng câu truy vấn**, không phải lọc ở tầng response:

```ts
// applications.service.ts:432
select: TRANG_THAI_MO_LIEN_HE.includes(ownership.status) ? ... : ...
```

Commit `54e4d9c` ("che lien he NTD o tang truy van") đưa nó xuống tầng đó, và
`docs/nep-kiem-thu.md` mục 2 ghi lại một ca test canh đúng chỗ này:

```ts
const selectKin = donFindMany.mock.calls[0][0].select.studentProfile.select
expect(selectKin.phone).toBeUndefined()
```

**Hệ quả cho thiết kế tool:** nếu tool gọi lại các hàm này, model **về mặt vật lý
không nhìn thấy** số điện thoại chưa được mở khoá — dữ liệu đó không bao giờ rời
khỏi Postgres. Nếu tool tự viết `prisma.application.findMany()`, luật ấy biến mất
im lặng và không test nào bắt được. Đây là lý do **cứng** cho quy tắc
"tool gọi service, không gọi Prisma" ở [03](03-chatbot-va-tool.md) mục 4.

### A.4 — Ghép lịch và chấm điểm — dùng lại nguyên vẹn, không viết lại

| Thứ | Đường dẫn |
| --- | --- |
| `ghepLich()`, `nguongCaToiThieu()` | [packages/shared/src/phu-hop.ts](../../packages/shared/src/phu-hop.ts) |
| `chamDiemPhuHop()`, `tongHopDiem()`, `tinhDoPhu()`, `duNguongCa()` | cùng file |
| `TRONG_SO_MAC_DINH`, `PHIEN_BAN_CHAM_DIEM = 'v1'` | cùng file |

Ba nguyên tắc trong file đó mà **prompt của chatbot phải tôn trọng**, nếu không AI
sẽ nói ngược với chính con số trên màn hình:

1. `null` **khác** `0`. `null` = chưa đo được; `0` = đã đo, không khớp. AI không
   được diễn giải "chưa khai lịch rảnh" thành "không hợp lịch".
2. `eligible` là **cổng**, `matchScore` là **mức độ**. Không suy cái này ra cái kia.
3. `coverage.apDung === coverage.doDuoc` thì im lặng; khác thì phải nói "điểm này
   tính trên `doDuoc`/`apDung` tiêu chí".

Ba câu đó đi vào system prompt, và [08](08-kiem-thu.md) có ca test cho từng câu.

### A.5 — File: sniff, Cloudinary, giới hạn

| Thứ | Đường dẫn | Dùng vào đâu |
| --- | --- | --- |
| `sniffFileKind(buffer)` → `'pdf' \| 'jpeg' \| 'png' \| null` | [apps/api/src/lib/file-sniff.ts](../../apps/api/src/lib/file-sniff.ts) | **Đúng ba định dạng mà scan CV cần.** Dùng nguyên, không sửa. |
| `uploadDocumentFile(buffer, publicId, format)` — `type: 'authenticated'` | [apps/api/src/lib/cloudinary.ts:112](../../apps/api/src/lib/cloudinary.ts#L112) | Mẫu cho file scan CV. Xem cảnh báo ở B.3. |
| `getSignedDocumentUrl(publicId, format)` → `{ url, expiresAt }`, TTL 5 phút | [apps/api/src/lib/cloudinary.ts:160](../../apps/api/src/lib/cloudinary.ts#L160) | Cho worker tải file về, và cho người dùng xem lại bản gốc lúc đối chiếu. |
| `HAS_REAL_KEY` — không có khoá thật thì trả URL giả, không gọi mạng | [cloudinary.ts:33](../../apps/api/src/lib/cloudinary.ts#L33) | **Mẫu bắt buộc phải nhân bản cho Gemini.** Không có nó thì cả nhóm phải có API key mới chạy được dự án, và test sẽ gọi mạng thật. |
| `MAX_FILE_SIZE = 5 * 1024 * 1024`, `MAX_FILE_SIZE_LABEL = '5MB'` | [packages/shared/src/validation.ts:312](../../packages/shared/src/validation.ts#L312) | Xem đánh giá lại ở [06](06-scan-cv.md) §2 — đề xuất **giữ 5 MB**, không nâng lên 10 MB. |
| `multer` đã là dependency | [apps/api/package.json](../../apps/api/package.json) | Không cần thêm gì cho upload. |

### A.6 — Dữ liệu và hồ sơ — đích ánh xạ của scan CV

Trường thật trong `StudentProfile`
([schema.prisma:309-339](../../apps/api/prisma/schema.prisma#L309-L339)):

```
fullName  university  major  year  bio  cvUrl  phone
expectedHourlyRate  availableFrom  availableUntil
skills: StudentSkill[]   ← nối tới Skill do admin quản lý
```

Đây là **toàn bộ** đích ánh xạ hợp lệ. Mọi thứ khác model đọc được từ CV (kinh
nghiệm, chứng chỉ, dự án, người tham chiếu) **không có trường trong hệ thống** và
phải rơi vào `additionalSections` — xem [06](06-scan-cv.md) §3.

`Skill` là danh mục **admin quản lý, không cho nhập tự do**
([schema.prisma:417-440](../../apps/api/prisma/schema.prisma#L417-L440)); lý do
chống "Giao tiếp"/"giao tiếp"/"Kỹ năng giao tiếp" thành ba tag. `JobSkill` dùng
`onDelete: Restrict`. **Scan CV tuyệt đối không được tạo hàng `Skill` mới.**

Hàm ghi có sẵn:
`updateStudentProfile` ([profile.service.ts:187](../../apps/api/src/modules/profile/profile.service.ts#L187)),
`replaceSkills` ([:360](../../apps/api/src/modules/profile/profile.service.ts#L360)).

> **⚠ Không dùng lại được nguyên trạng trong transaction xác nhận CV — xem B.5.**

### A.7 — Những thứ nhỏ nhưng tiết kiệm nhiều

| Thứ | Đường dẫn | Ghi chú |
| --- | --- | --- |
| `Notification` + `createNotification(tx, ...)` **nhận `tx`** | [notifications.service.ts:53](../../apps/api/src/modules/notifications/notifications.service.ts#L53) | Đã đúng hình dạng để dùng trong transaction outbox. Thêm 3 giá trị vào `enum NotificationType`. |
| Extension `unaccent` đã cài | [migrations/20260906120000_sprint5_tim_khong_dau/](../../apps/api/prisma/migrations/) | **Dùng lại để ánh xạ kỹ năng từ CV** sang danh mục: "Kỹ năng giao tiếp" ≈ "ky nang giao tiep". Không cần thư viện bỏ dấu. |
| `rateLimit({max, windowMs, keyOf})` + `ipAndEmail` | [middlewares/rate-limit.ts](../../apps/api/src/middlewares/rate-limit.ts) | Đủ cho lớp **chống spam theo IP**. **Không đủ** cho quota theo tài khoản — xem B.2. |
| Hai làn test tách riêng | [vitest.config.ts](../../apps/api/vitest.config.ts) (mock Prisma) + [vitest.db.config.ts](../../apps/api/vitest.db.config.ts) (Postgres thật, `fileParallelism: false`) | Làn thứ hai là chỗ **duy nhất** kiểm được ràng buộc unique một phần của quota và exclusion constraint. |
| `docker-compose.yml` đã có Redis dưới profile `cache` | [docker-compose.yml](../../docker-compose.yml) | Thêm RabbitMQ cùng kiểu: một profile riêng, **không** bật mặc định. |
| `ApiErrorCode` | [packages/shared/src/api.ts:49](../../packages/shared/src/api.ts#L49) | Cần thêm mã mới, xem bên dưới. |

**Mã lỗi cần thêm vào `API_ERROR_CODES`** — mỗi mã một lý do, không gộp:

| Mã | HTTP | Khi nào | Vì sao không dùng mã có sẵn |
| --- | --- | --- | --- |
| `AI_QUOTA_EXCEEDED` | 429 | Hết lượt AI trong ngày | `RATE_LIMITED` nghĩa là "chờ vài giây rồi thử lại". Cái này phải chờ tới ngày mai, và web phải hiện màn hình khác hẳn: gợi ý tìm kiếm thường + nút nhắn NTD. |
| `AI_BUSY` | 409 | Tài khoản đã có một yêu cầu AI đang chạy | Không phải lỗi tần suất; thử lại ngay sau khi cái kia xong là được. |
| `AI_UNAVAILABLE` | 503 | Circuit breaker đang mở (Google trả 429/5xx) | Lỗi phía nhà cung cấp, không phải lỗi người dùng. Có `Retry-After`. |
| `FILE_UNSUPPORTED` | 400 | File hỏng, có mật khẩu, quá số trang, không phải CV | Phân biệt với `VALIDATION_ERROR` để web hiện nút "chọn file khác" thay vì báo lỗi form. |

---

## B. Đã có nhưng KHÔNG dùng lại được

Bốn chỗ. Mỗi chỗ là một quyết định đã đúng cho hoàn cảnh cũ và không còn đúng.

### B.1 — `ok()` không dùng được cho stream

`ok()` gọi `res.status().json()` — đóng response ngay. Endpoint stream câu trả lời
AI phải giữ kết nối mở và ghi từng đoạn.

**ĐỀ XUẤT:** thêm **một** helper `streamSse(res)` cạnh `respond.ts`, và nó là ngoại
lệ **duy nhất** của luật "hai hàm duy nhất được phép gửi response". Ghi lý do ngay
trong `respond.ts` để người sau không tưởng là ai đó quên.

Không dùng `res.json()` trần ở bất cứ chỗ nào khác.

### B.2 — `rateLimit` **không** đủ làm quota AI

Bốn lý do, ba trong số đó ghi sẵn trong chính file đó:

1. **Đếm trong bộ nhớ** — "khởi động lại là mất sạch bộ đếm"
   ([rate-limit.ts:30-33](../../apps/api/src/middlewares/rate-limit.ts#L30-L33)).
   Render free ngủ dậy liên tục ⇒ quota 5 lượt/ngày reset mỗi lần service dậy.
2. **Đếm theo IP** — đề bài nói thẳng: nhiều sinh viên chung một mạng trường.
3. **Không có khái niệm hoàn lượt.** Quota AI phải phân biệt *giữ chỗ* / *đã dùng*
   / *hoàn lại*; một `count++` không làm được.
4. **Một lượt người dùng có thể là nhiều request model.** Bộ đếm HTTP đếm request
   HTTP, không đếm vòng tool calling.

**ĐỀ XUẤT:** giữ `rateLimit` làm **lớp chống spam theo IP** đứng trước (ví dụ
30 request/phút/IP cho nhánh `/api/tro-ly`), và làm quota tài khoản bằng bảng
Postgres với phép cộng nguyên tử. Hai lớp, hai mục đích, không thay thế nhau.
Chi tiết ở [05](05-quota-dung-chung.md).

### B.3 — `uploadCvFile` lưu CV ở chế độ **công khai**

```ts
// cloudinary.ts:78 — không có `type: 'authenticated'`
{ resource_type: 'raw', folder: 'uniwork/cv', public_id: `${userId}.pdf`, overwrite: true }
```

Ai biết URL là đọc được CV, không cần đăng nhập. `public_id` lại đúng bằng `userId`
— tức là **đoán được**: có id một sinh viên là dựng được URL CV của họ.

File giấy tờ NTD thì làm đúng (`type: 'authenticated'` + signed URL 5 phút,
[cloudinary.ts:100-110](../../apps/api/src/lib/cloudinary.ts#L100-L110)), kèm
comment giải thích vì sao CCCD nhạy cảm hơn CV.

**Đây là lỗ hổng có sẵn, không do plan này sinh ra.** Nhưng plan này chạm đúng vào
CV, nên:
- File **scan** dùng `type: 'authenticated'`, `public_id` chứa một chuỗi ngẫu nhiên
  (không phải `userId`), folder `uniwork/cv-scan/`. Không tái sử dụng đường cũ.
- Ghi lỗ hổng của `uploadCvFile` vào [09](09-phan-bien.md) mục 8 như một việc riêng
  cần lịch riêng. **Không sửa lén trong plan này** — nó đụng dữ liệu đang có và cần
  migration URL, là một việc độc lập.

### B.5 — `updateStudentProfile` và `replaceSkills` không vào được transaction ngoài

Phát hiện khi đối chiếu lại source cho review R05, ngày 2026-09-12.

```ts
// profile.service.ts:193 — client GLOBAL
const updated = await prisma.studentProfile.update({ where: { userId }, … })

// profile.service.ts:375 — tự mở transaction RIÊNG, cũng bằng client global
await prisma.$transaction([
  prisma.studentSkill.deleteMany({ where: { studentProfileId } }),
  prisma.studentSkill.createMany({ … }),
])
```

Prisma **không có transaction ngầm theo ngữ cảnh**. Gọi hai hàm này bên trong
`prisma.$transaction(async (tx) => …)` thì chúng chạy **ngoài** transaction đó, dù mã
nguồn trông như ở trong. Hậu quả với luồng xác nhận CV: hồ sơ cập nhật xong,
`cv_extractions` rollback, người dùng bấm lại → hồ sơ ghi hai lần.

Thêm hai điều nữa:

- `replaceSkills` **xoá sạch rồi ghi lại**. Gọi thẳng nó với danh sách kỹ năng từ CV
  sẽ **xoá mất kỹ năng người dùng tự khai**.
- Mẫu chữa "đọc hiện tại → hợp tập → replace" có lost update: giữa lúc đọc và lúc ghi,
  một request khác thêm kỹ năng thì thay đổi đó biến mất.

**Cách sửa** — thêm hàm nhận `Prisma.TransactionClient`, và dùng `createMany` với
`skipDuplicates` thay cho đọc-hợp-ghi: [06](06-scan-cv.md) §9.2. Hàm cũ giữ nguyên
chữ ký, thân đổi thành wrapper — không endpoint nào đang chạy bị đổi hành vi.

### B.4 — `keep-alive.yml` không giữ được worker

Ping `/api/health` giữ **API** thức. Nếu worker là service Render thứ hai thì nó có
vòng đời riêng và ping đó không chạm tới. Xem [01](01-kien-truc-va-ranh-gioi.md) mục 4.

---

## C. Sự thật bên ngoài repo — đã kiểm bằng tài liệu chính thức

Ngày kiểm: **2026-09-12**. Ghi cả ngày cập nhật của trang nguồn, vì đây là vùng
đang đổi nhanh.

### C.1 — Model Gemini và free tier

**ĐỌC ĐƯỢC** từ [trang giá chính thức](https://ai.google.dev/gemini-api/docs/pricing)
(cập nhật 2026-09-11) — cột "Free Tier":

| Model | Free tier |
| --- | --- |
| `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash` | Có |
| `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` | Có |
| `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro` | Có |
| `gemini-3.1-pro-preview` | **Không** |

**ĐỌC ĐƯỢC** từ [trang model](https://ai.google.dev/gemini-api/docs/models)
(cập nhật 2026-09-04): id chuỗi đúng là `gemini-3.8-flash`, `gemini-3.5-flash-lite`,
`gemini-2.5-flash`, v.v.

### C.2 — Quota cụ thể: KHÔNG khẳng định được con số

**ĐỌC ĐƯỢC** từ [trang rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
(cập nhật 2026-09-02): trang này **không còn bảng số**. Nó viết:

> "Rate limits depend on a variety of factors (such as your usage tier) and can be
> viewed in Google AI Studio."
>
> "Specified rate limits are not guaranteed and actual capacity may vary."

Có nhiều trang blog bên thứ ba đưa bảng số cụ thể (2.5 Flash 10 RPM / 250 RPD,
2.5 Flash-Lite 15 RPM / 1000 RPD…). **Không đưa những con số đó vào kế hoạch.**
Chúng không xác nhận được từ nguồn chính thức, và trang chính thức nói thẳng là
hạn mức thay đổi theo tài khoản.

**Nhưng ba điều VỀ CƠ CHẾ thì trang đó nói rõ, và cả ba đổi thiết kế** (kiểm lại
2026-09-12 cho review R11):

> "Requests per day (**RPD**) quotas reset at **midnight Pacific time**."
>
> "Rate limits are applied **per project, not per API key**."
>
> Giới hạn đo trên **ba chiều**: RPM, TPM (input), RPD — và **khác nhau theo từng model**.

| Điều | Hệ quả trong plan |
| --- | --- |
| Reset theo giờ Pacific | Phải có **hai** hàm ngày: `ngayVN()` cho quota người dùng, `ngayPacific()` cho ngân sách provider. Lệch 14–15 tiếng — [05](05-quota-dung-chung.md) mục 1 |
| Theo project, không theo khoá | Tạo khoá thứ hai **không** cho thêm quota. Ngân sách chung là bắt buộc, không phải tuỳ chọn |
| Có RPM và TPM, không chỉ RPD | Trần theo ngày **mù** với burst. Cần bảng cửa sổ phút — [05](05-quota-dung-chung.md) mục 4.1 |
| Khác nhau theo model | Hai model = hai túi riêng, và circuit breaker phải khoá **theo model** |

**Cách kiểm đúng, làm ở ngày 1:**

1. Mở https://aistudio.google.com/rate-limit → xem RPM / TPM / RPD **thật của
   project này** cho từng model.
2. Chép vào `docs/gemini-quota-<ngày>.md`, kèm ảnh chụp màn hình và ngày đo.
3. Đặt hằng số cấu hình **thấp hơn** con số đo được, không bằng.
4. Đặt lịch đo lại mỗi 2 tuần. Con số này đổi mà không báo trước.

Trước khi có bước 1, mọi tính toán "5 lượt × N người = đủ hay không đủ" đều là
suy đoán. [09](09-phan-bien.md) mục 4 liệt kê nó trong nhóm "phải đo, không được đoán".

### C.3 — Điều khoản dữ liệu free tier vs. paid tier

**ĐỌC ĐƯỢC** từ [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
(cập nhật 2026-04-28). Trích nguyên văn:

| | Unpaid Services (free tier) | Paid Services |
| --- | --- | --- |
| Dùng dữ liệu để cải tiến sản phẩm | "Google uses the content you submit… and any generated responses to provide, improve, and develop Google products" | "Google doesn't use your prompts… or responses to improve our products" |
| Người thật đọc | "Human reviewers may read, annotate, and process your API input and output." | không nêu |
| Cảnh báo | "**Do not submit sensitive, confidential, or personal information to the Unpaid Services.**" | không có cảnh báo tương ứng |
| Lưu log | — | "for a limited period of time, solely for detecting and preventing violations" |

Đây là ràng buộc nặng nhất của cả kế hoạch. Xem [09](09-phan-bien.md) mục 1.

### C.4 — Đọc PDF/ảnh

**ĐỌC ĐƯỢC** từ [document processing](https://ai.google.dev/gemini-api/docs/document-processing)
(cập nhật 2026-09-04):

- Trần của Gemini: **50 MB hoặc 1000 trang**. Trần ta tự đặt (5 MB / 5 trang) là
  **hẹp hơn nhiều**, và hẹp vì RAM 512 MB của Render, không vì Gemini.
- Mỗi trang PDF ≈ **258 token**. 5 trang ≈ 1.290 token input. Rất rẻ.
- "native vision to understand entire document contexts" — trang được xử lý như
  ảnh, scale tối đa 3072×3072. **Nghĩa là CV scan/ảnh chụp đọc được, không cần OCR
  riêng.** Xác nhận quyết định "không thêm pipeline OCR" trong đề bài.
- Với model Gemini 3: "You are not charged for tokens originating from the extracted
  native text in PDFs."
- **Tài liệu không nói gì về PDF có mật khẩu** ⇒ **GIẢ ĐỊNH:** không hỗ trợ. Ta phải
  tự phát hiện và từ chối trước khi gọi API, xem [06](06-scan-cv.md) §2.3.

**ĐỌC ĐƯỢC** từ [Files API](https://ai.google.dev/gemini-api/docs/files)
(cập nhật 2026-09-04): 20 GB/project, 2 GB/file, **file tự xoá sau 48 giờ**, miễn phí.
Với file ≤ 5 MB thì gửi inline đơn giản hơn; Files API chỉ đáng dùng khi gọi lại
nhiều lần trên cùng file. **ĐỀ XUẤT:** dùng inline, không dùng Files API.

### C.5 — Vercel AI SDK: **v7**, API đã khác v5

Kiểm bằng npm registry ngày 2026-09-12:

| Gói | Bản mới nhất |
| --- | --- |
| `ai` | **7.0.99** |
| `@ai-sdk/google` | **4.0.69** |
| `socket.io` | 4.8.3 |
| `amqplib` | 2.0.1 |
| `zod` | 4.6.2 (repo đang `^4.4.3` — tương thích) |

**ĐỌC ĐƯỢC** từ [tài liệu AI SDK v7](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
và [structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).
**Bốn chỗ khác v5, dùng nhầm là code không chạy:**

| v5 (rất nhiều ví dụ trên mạng) | v7 (đúng hiện tại) |
| --- | --- |
| `tool({ parameters: z.object(...) })` | `tool({ inputSchema: z.object(...) })` |
| `maxSteps: 5` | `stopWhen: isStepCount(5)` — mặc định `isStepCount(20)` |
| `generateObject({ schema })` | `generateText({ output: Output.object({ schema }) })` |
| `onStepFinish` | `onStepEnd` |

**ĐỌC ĐƯỢC** từ [trang provider Google](https://ai-sdk.dev/providers/ai-sdk-providers/google)
(bản v7):

```ts
import { google } from '@ai-sdk/google'          // dùng biến môi trường mặc định
import { createGoogle } from '@ai-sdk/google'    // khi cần tự cấu hình
```

- Biến môi trường mặc định: `GOOGLE_GENERATIVE_AI_API_KEY`.
- Gửi file trong message:
  ```ts
  { type: 'file', data: buffer, mediaType: 'application/pdf', filename: 'cv.pdf' }
  ```
- Provider options có: `safetySettings`, `thinkingConfig` (`thinkingLevel`,
  `thinkingBudget`), `structuredOutputs` (mặc định `true`).

**Ràng buộc thi công:** khi viết code cho hai feature này, **mở tài liệu v7 ra đọc**,
không dùng trí nhớ và không copy ví dụ blog. Phần lớn nội dung trên mạng còn ở v5.

### C.6 — Giới hạn structured output của Gemini

**ĐỌC ĐƯỢC** từ [structured output](https://ai.google.dev/gemini-api/docs/structured-output)
(cập nhật 2026-09-02):

- Hỗ trợ: `type` (`string/number/integer/boolean/object/array/null`), `title`,
  `description`, `properties`, `required`, `additionalProperties`, `enum`,
  `format` (date-time/date/time), `minimum`, `maximum`, `items`, `prefixItems`,
  `minItems`, `maxItems`, `anyOf`, `$ref`.
- Nullable: đưa `'null'` vào mảng type — `{"type": ["string", "null"]}`.
- Giới hạn nêu thẳng: "**Very large or deeply nested schemas may be rejected**" và
  "Not all JSON Schema features are supported".

**Hệ quả cho schema trích xuất CV:** schema 4 nhóm × nhiều mảng lồng nhau là **đúng
vùng nguy hiểm** mà câu trên cảnh báo. Không có ngưỡng cụ thể nào được công bố ⇒
**phải thử thật ở ngày 1**, và có phương án B (tách làm hai lần gọi) nếu bị từ chối.
Xem [06](06-scan-cv.md) §3.4.

### C.6b — Cloudflare Workers AI (kiểm 2026-09-13, sau khi chốt đổi provider cho CV)

**ĐỌC ĐƯỢC** từ [Service-Specific Terms](https://www.cloudflare.com/service-specific-terms-developer-platform/),
mục Workers AI / AI Gateway:

> "Unless otherwise agreed, Cloudflare does not use any Customer Content to train
> generative AI tools."

Đây là lý do đổi. So sánh trực tiếp với C.3 ở trên.

**ĐỌC ĐƯỢC** từ [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
(cập nhật 2026-08-28):

- Free: **10.000 Neuron/ngày**. *"To use more than 10,000 Neurons per day, you need to
  sign up for the Workers Paid plan."* ⇒ **không tự tràn sang trả phí**, request lỗi.
- Trả phí: 0,011 USD / 1.000 Neuron.
- `@cf/meta/llama-3.2-11b-vision-instruct`: **4.410 neuron/M token vào, 61.493/M ra**.

**ĐỌC ĐƯỢC** từ [JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/):
9 model hỗ trợ `response_format`, và **`@cf/meta/llama-3.2-11b-vision-instruct` nằm
trong danh sách** — dạng `{ type: 'json_schema', json_schema: {...} }`.

**ĐỌC ĐƯỢC** từ [moondream3.1-9B-A2B](https://developers.cloudflare.com/workers-ai/models/moondream3.1-9B-A2B/):
`@cf/moondream/moondream3.1-9B-A2B`, 9B MoE, `image` nhận **"public HTTPS URL or
base64 data URI"**, `max_tokens` mặc định **8192** (trần 28.672), có `task: query |
caption | point | detect`. Năng lực công bố gồm *"document and PDF parsing… OCR
(including multilingual), and handwriting recognition"*. **Không** có `response_format`
trong schema đầu vào.

**ĐỌC ĐƯỢC** từ [trang model Llama Vision](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/):
phải **đồng ý giấy phép Meta một lần cho mỗi tài khoản** bằng cách gửi
`{"prompt":"agree"}`. Không làm bước này thì mọi lời gọi sau đều lỗi, với thông báo
không nhắc gì tới giấy phép.

**ĐỌC ĐƯỢC** từ [REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/):
`POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{model}`,
`Authorization: Bearer {token}`. Gọi được từ ngoài Cloudflare ⇒ **worker Node hiện tại
dùng được ngay, không cần đổi chỗ deploy.**

**GIẢ ĐỊNH, phải đo bằng spike:**

| Chưa biết | Vì sao tài liệu không trả lời được |
| --- | --- |
| Moondream có nhận **PDF** qua data URI không | Năng lực ghi "PDF parsing" nhưng schema chỉ nói "image" |
| Trường `image` của Llama Vision là `number[]` hay data URI | Trang model không in schema đầu vào |
| Neuron thật mỗi CV | Phụ thuộc cách model tile ảnh |
| Chất lượng trên CV thật so với ngưỡng **bịa = 0** | Không suy được từ số tham số |

`plans/ai/spike/thu-workers-ai.mjs` chạy cả bốn trong một lệnh.

### C.7 — Hạ tầng: Render và RabbitMQ

**ĐỌC ĐƯỢC** từ [Render free tier](https://render.com/docs/free): gói free chỉ có
**Web Service, Static Site, Postgres, Key Value**. **Background Worker và Cron Job
không có bản free.** "Other service types don't support Free instances."

**Từ trang của CloudAMQP** (nguồn của chính nhà cung cấp, nên kiểm lại lúc đăng ký):
gói free *Little Lemur* — 1 triệu message/tháng, 20 kết nối, tối đa 100 queue,
tối đa 10.000 message tồn, **queue không ai tiêu thụ trong 28 ngày sẽ bị xoá**.

Điều cuối cùng đáng chú ý: nếu để queue DLQ nằm im 28 ngày, nó biến mất cùng mọi
message trong đó. Xem [02](02-messaging-rabbitmq.md) mục 7.

### C.8 — Socket.IO nhiều instance

**ĐỌC ĐƯỢC** từ [tài liệu adapter](https://socket.io/docs/v4/adapter/): adapter
chính thức gồm Redis, Redis Streams, MongoDB, **Postgres**, Cluster, Google Cloud
Pub/Sub, AWS SQS, Azure Service Bus. AMQP/RabbitMQ **chỉ có bản cộng đồng**, không
chính thức.

**ĐỌC ĐƯỢC** từ [Postgres adapter](https://socket.io/docs/v4/postgres-adapter/):
gói `@socket.io/postgres-adapter`, chạy bằng `NOTIFY`/`LISTEN`, ngưỡng payload
8.000 byte (lớn hơn thì đẩy sang bảng phụ `socket_io_attachments`), và **vẫn cần
sticky session**.

**Hệ quả:** đừng dùng RabbitMQ làm adapter cho Socket.IO chỉ vì đã có RabbitMQ —
bản cộng đồng không được đội Socket.IO bảo trì. Xem [04](04-handoff-realtime.md)
mục 6 để so ba phương án.

---

## Bảng phân loại phát biểu

Để không lẫn ba loại với nhau ở các plan sau:

| Loại | Nghĩa | Ví dụ trong tài liệu này |
| --- | --- | --- |
| **ĐỌC ĐƯỢC** | Trích từ repo hoặc tài liệu chính thức, có đường dẫn | "Render free không có Background Worker" |
| **GIẢ ĐỊNH** | Chưa kiểm được, phải kiểm trước khi tin | "Gemini không đọc được PDF có mật khẩu" |
| **ĐỀ XUẤT** | Quyết định thiết kế của plan này | "Dùng inline data, không dùng Files API" |

Mọi con số quota Gemini trong bộ plan này là **cấu hình ta tự đặt**, không phải
hạn mức của Google. Hạn mức của Google chưa ai trong nhóm nhìn thấy.
