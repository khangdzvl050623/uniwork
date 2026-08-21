# Sprint 1 — Auth & Hồ sơ

**Thời lượng:** 10 ngày làm việc (tuần 2–3) · **Nhóm:** 3 người

| Ký hiệu | Vai trò | Tên |
| --- | --- | --- |
| **DEV1** | Backend, hạ tầng, database, deploy API | Khang |
| **DEV2** | Frontend, CI, deploy web | Bảo |
| **BA** | Phân tích nghiệp vụ, viết tài liệu, wireframe | Quốc |

## Mục tiêu sprint

Cuối sprint phải **đăng nhập được bằng cả ba vai trò và tạo hồ sơ hoàn chỉnh** (mốc cuối tuần 3 trong timeline).

Cụ thể là đi trọn được đường này trên bản deploy thật, không phải trên máy:

> Sinh viên đăng ký → nhận email OTP → xác thực → đăng nhập → điền hồ sơ → khai kỹ năng → khai lịch rảnh → tải CV lên → đóng trình duyệt → mở lại vẫn còn đăng nhập.

Và đường song song cho nhà tuyển dụng: đăng ký → nộp giấy tờ → tài khoản ở trạng thái `PENDING`, chưa đăng tin được.

## Đã có sẵn từ Sprint 0

Nêu ra để không ai làm lại:

| Có rồi | Ở đâu |
| --- | --- |
| Schema Prisma đầy đủ, 3 migration đã chạy | `apps/api/prisma/schema.prisma` |
| Model `User`, `UserAccount`, `RefreshToken`, `OneTimeToken`, `StudentProfile`, `EmployerProfile`, `EmployerDocument`, `StudentSkill`, `Availability` | cùng file |
| Enum `Role`, `UserStatus`, `OneTimeTokenType`, `AuthProvider`, `ReviewStatus` | cùng file |
| `@node-rs/argon2` đã cài | `apps/api/package.json` |
| Middleware lỗi tập trung, `respond`, `logger`, `errors` | `apps/api/src/middlewares`, `src/lib` |
| Hợp đồng API dùng chung (`ApiResponse`, `ApiErrorCode`) | `packages/shared/src/api.ts` |
| Khung UI trang đăng nhập/đăng ký và trang lịch rảnh | `apps/web/src/pages/Auth.tsx`, `Availability.tsx` |
| CI: lint → typecheck → test → build | `.github/workflows/ci.yml` |

**Chưa có:** module `auth`, module `profile`, middleware phân quyền, thư viện JWT, thư viện gửi email, luồng upload file. API hiện chỉ có `health` và `skills`.

## Danh sách công việc

Mã tiếp nối Sprint 0 (kết thúc ở T32).

### Tuần 2 — Xác thực

| Mã | Ngày | Người | Công việc | Kết quả cần đạt |
| --- | --- | --- | --- | --- |
| T33 | 1 | DEV1 | Cài `jsonwebtoken`, `cookie-parser`; thêm 6 biến môi trường mới vào **cả 5 nơi** (xem ghi chú T33): `JWT_ACCESS_SECRET`, `ACCESS_TTL`, `REFRESH_TTL_DAYS`, `BREVO_API_KEY`, `MAIL_FROM`, `APP_URL` | Thiếu biến bắt buộc thì app dừng ngay lúc khởi động; `pnpm test` và CI vẫn xanh |
| T34 | 1 | DEV1 | `lib/password.ts` — băm và kiểm mật khẩu bằng Argon2id | Băm cùng một mật khẩu hai lần ra hai chuỗi khác nhau, kiểm vẫn đúng |
| T35 | 1–2 | DEV1 | `lib/token.ts` — ký và giải mã JWT access; sinh refresh token ngẫu nhiên, **lưu vào bảng `RefreshToken` dưới dạng đã băm** | Xem trực tiếp trong database không đọc được refresh token gốc |
| T36 | 2–3 | DEV1 | `POST /api/auth/dang-ky` cho cả hai vai trò. SV tạo kèm `StudentProfile`, NTD tạo kèm `EmployerProfile` ở trạng thái `PENDING` | Đăng ký trùng email trả `CONFLICT`, không tạo bản ghi rác |
| T37 | 3 | DEV1 | `POST /api/auth/dang-nhap` — trả access token trong body, refresh token trong **cookie httpOnly + SameSite=None + Secure** | Đăng nhập từ domain Vercel gọi API Render thành công (khác domain) |
| T38 | 3–4 | DEV1 | `POST /api/auth/refresh` — **xoay vòng token**: mỗi lần refresh thì huỷ token cũ và cấp token mới | Dùng lại refresh token cũ bị từ chối và **huỷ toàn bộ phiên của user đó** |
| T39 | 4 | DEV1 | `POST /api/auth/dang-xuat` — xoá cookie và huỷ refresh token trong DB | Đăng xuất rồi gọi refresh trả `UNAUTHORIZED` |
| T40 | 4 | DEV1 | Middleware `requireAuth` và `requireRole(...roles)` | Gọi endpoint cần quyền mà không có token trả `UNAUTHORIZED`, sai vai trò trả `FORBIDDEN` |
| T41 | 5 | DEV1 | Gửi email qua Brevo: `lib/mailer.ts` + mẫu email OTP | Nhận được email thật trong hộp thư |
| T42 | 5 | DEV1 | `POST /api/auth/gui-otp` và `POST /api/auth/xac-thuc-email` dùng bảng `OneTimeToken` type `EMAIL_VERIFICATION` | OTP hết hạn sau 10 phút; dùng rồi không dùng lại được |
| T43 | 5 | DEV1 | Chống dò mật khẩu: giới hạn số lần gọi `/dang-nhap` và `/gui-otp` theo IP + email | Quá ngưỡng trả `RATE_LIMITED` |
| T44 | 1–2 | DEV2 | `lib/auth-store.ts` — giữ access token **trong bộ nhớ**, không dùng localStorage | Mở tab mới vẫn đăng nhập được nhờ refresh token trong cookie |
| T45 | 2–3 | DEV2 | Chặn lỗi 401 tập trung trong `apiFetch`: tự gọi refresh một lần rồi thử lại request | Access token hết hạn giữa chừng, người dùng không thấy gì bất thường |
| T46 | 3–4 | DEV2 | Hoàn thiện form đăng ký/đăng nhập hai vai trò trên khung `Auth.tsx` có sẵn, validate bằng Zod dùng chung với API | Sai định dạng thì báo ngay dưới ô nhập, không đợi server trả lời |
| T47 | 4–5 | DEV2 | Màn hình nhập OTP + nút gửi lại (có đếm ngược) | Nhập sai OTP báo lỗi rõ ràng, không mất dữ liệu đã nhập |
| T48 | 5 | DEV2 | `<RequireAuth>` và `<RequireRole>` bọc route; chuyển hướng về `/dang-nhap` kèm đường dẫn quay lại | Vào `/admin` khi chưa đăng nhập bị đẩy về đăng nhập, đăng nhập xong quay lại đúng `/admin` |
| T49 | 1–3 | BA | BRD module **Ứng tuyển** | 1 trang: trường dữ liệu · luồng chính · lỗi và ngoại lệ · quy tắc che thông tin liên hệ |
| T50 | 3–5 | BA | BRD module **Admin** | 1 trang: tiêu chí duyệt NTD · tiêu chí duyệt tin · quy tắc quản lý danh mục kỹ năng |

### Tuần 3 — Hồ sơ

| Mã | Ngày | Người | Công việc | Kết quả cần đạt |
| --- | --- | --- | --- | --- |
| T51 | 6 | DEV1 | `GET /api/toi` — trả thông tin user đang đăng nhập kèm hồ sơ theo vai trò | Không bao giờ trả về trường mật khẩu hay token |
| T52 | 6–7 | DEV1 | `GET` và `PUT /api/toi/ho-so-sinh-vien` — trường, ngành, năm học, giới thiệu | Sửa hồ sơ của người khác trả `FORBIDDEN` |
| T53 | 7 | DEV1 | `GET` và `PUT /api/toi/ho-so-ntd` — tên công ty, mô tả, địa chỉ, website | NTD ở trạng thái `PENDING` vẫn sửa được hồ sơ nhưng chưa đăng tin được |
| T54 | 7–8 | DEV1 | `PUT /api/toi/ky-nang` — thay toàn bộ danh sách `StudentSkill` trong một transaction | Gửi danh sách rỗng thì xoá hết, không để lại bản ghi mồ côi |
| T55 | 8 | DEV1 | `GET` và `PUT /api/toi/lich-ranh` — thay toàn bộ `Availability` trong một transaction | Ghi 21 ô (7 ngày × 3 buổi) chỉ mất một lần gọi |
| T56 | 8–9 | DEV1 | Upload CV PDF — **quyết định chỗ lưu trước khi code, xem ghi chú bên dưới**. Giới hạn 5MB, chỉ nhận `application/pdf` | Tải lên file `.exe` đổi đuôi thành `.pdf` bị từ chối |
| T57 | 9 | DEV1 | NTD nộp giấy tờ vào `EmployerDocument` (3 loại: giấy phép KD, mã số thuế, CCCD) | Nộp đủ 3 loại thì hồ sơ chuyển sang chờ admin duyệt |
| T58 | 9–10 | DEV1 | Test: đăng ký, đăng nhập, xoay vòng refresh token, phân quyền, hồ sơ | `pnpm test` xanh, có ca test cho **dùng lại refresh token cũ** |
| T59 | 6–7 | DEV2 | Trang hồ sơ sinh viên: thông tin cơ bản + upload CV có thanh tiến độ | Tải file 5MB thấy tiến độ, không tưởng trang treo |
| T60 | 7–8 | DEV2 | Màn khai kỹ năng: chọn từ danh mục `GET /api/skills` (**bỏ phần chọn mức độ**, xem ghi chú bên dưới) | Chọn 10 kỹ năng rồi lưu, tải lại trang vẫn còn |
| T61 | 8–9 | DEV2 | Hoàn thiện lưới khai lịch rảnh trên khung `Availability.tsx` có sẵn: 7 ngày × 3 buổi, kéo chọn nhiều ô | Kéo chuột qua nhiều ô chọn được cả vùng, không phải bấm từng ô |
| T62 | 9 | DEV2 | Trang hồ sơ NTD: thông tin công ty + nộp 3 loại giấy tờ, hiện rõ trạng thái duyệt | NTD nhìn phát biết mình đang thiếu giấy tờ nào |
| T63 | 10 | DEV2 | Kiểm tra responsive toàn bộ màn hình sprint này trên máy thật | Dùng được bằng một tay trên điện thoại |
| T64 | 6–8 | BA | Thiết kế màn hình Sprint 2 trên Figma: đăng tin, danh sách tin, chi tiết tin, quản lý tin của NTD | 4 frame, link share được, giao **trước khi Sprint 2 bắt đầu** |
| T65 | 8–9 | BA | Viết test case và kiểm thử luồng Sprint 1 trên bản deploy | Bảng test case có cột kết quả thực tế; lỗi tìm được ghi thành issue |
| T66 | 9–10 | BA | Chương 1–2 báo cáo: đặt vấn đề, khảo sát hiện trạng, phân tích yêu cầu | Bản nháp đủ ý, có sơ đồ use case 4 tác nhân |

## Đường đi của DEV1 — dựng theo thứ tự này

Làm đúng thứ tự thì không bao giờ phải quay lại sửa cái đã xong. Mỗi bậc chỉ dùng thứ đã dựng ở bậc dưới.

```
1. config/env.ts          thêm biến           ← T33
2. lib/password.ts        băm mật khẩu        ← T34   (không phụ thuộc gì)
3. lib/token.ts           ký/giải JWT         ← T35   (cần env)
4. modules/auth/          đăng ký, đăng nhập  ← T36–T39 (cần password + token)
5. middlewares/auth.ts    requireAuth/Role    ← T40   (cần token)
6. lib/mailer.ts          gửi email           ← T41   (cần env)
7. modules/auth/ otp      xác thực email      ← T42   (cần mailer)
8. modules/profile/       hồ sơ, kỹ năng, lịch ← T51–T55 (cần middlewares/auth)
```

Cây thư mục sau khi xong sprint — theo đúng khuôn `modules/skills/` đã có:

```
apps/api/src/
├── config/env.ts                    ← sửa (T33)
├── lib/
│   ├── password.ts                  ← mới (T34)
│   ├── token.ts                     ← mới (T35)
│   └── mailer.ts                    ← mới (T41)
├── middlewares/
│   └── auth.ts                      ← mới (T40): requireAuth, requireRole
└── modules/
    ├── auth/
    │   ├── auth.routes.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   └── auth.test.ts
    └── profile/
        ├── profile.routes.ts
        ├── profile.controller.ts
        ├── profile.service.ts
        └── profile.test.ts
```

Nhớ khai route mới vào `src/routes.ts` — quên bước này thì endpoint viết xong vẫn trả 404 và rất mất thời gian mới nghĩ ra.

**Kiểu dữ liệu trả về khai ở `packages/shared/src/api.ts`**, không khai trong `apps/api`. DEV2 cần đúng những kiểu đó để dựng form. Chốt và push kiểu **ngay ngày 2**, đừng đợi viết xong service — DEV2 đang chờ.

## Ghi chú cho T33 — thêm một biến môi trường là sửa năm file

Sửa một chỗ quên bốn chỗ kia thì lỗi không hiện ngay, mà hiện lúc deploy hoặc lúc CI chạy — hai thời điểm khó tìm nguyên nhân nhất.

| # | File | Đặt gì vào | Có commit? |
| --- | --- | --- | --- |
| 1 | `apps/api/src/config/env.ts` | Khai key + kiểu + ràng buộc trong schema Zod | Có |
| 2 | `apps/api/.env.example` | Key kèm giá trị **giả**, làm mẫu cho người mới clone | Có |
| 3 | `apps/api/.env` | Giá trị **thật** để chạy trên máy mình | Không — `.gitignore` đã chặn |
| 4 | `render.yaml` | Khai key kèm `sync: false`, giá trị nhập tay trên dashboard Render | Có, nhưng chỉ có key |
| 5 | `apps/api/vitest.config.ts` | Giá trị **giả** cho lúc chạy test | Có |

File thứ 5 hay bị quên nhất. Lý do cần nó: test có đường import `health.test.ts → app.ts → config/env.js`, nên chạy `pnpm test` là `env.ts` **được nạp thật**. Thêm một biến bắt buộc mà không khai giá trị giả ở đây thì **CI đỏ ngay**, dù code hoàn toàn đúng.

```ts
// apps/api/vitest.config.ts
env: {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'x'.repeat(48),   // đủ dài để qua .min(32)
  BREVO_API_KEY: 'test-key',
  APP_URL: 'http://localhost:5173',
}
```

Đặt ở `vitest.config.ts` chứ không phải ở `ci.yml`: như vậy chạy trên máy và chạy trên CI giống hệt nhau, tránh cảnh "máy tôi xanh mà CI đỏ".

### Biến nào được có `default()`, biến nào không

`default()` chính là thứ quyết định "quên khai thì app chết hay chạy tiếp".

| Biến | Có default? | Vì sao |
| --- | --- | --- |
| `ACCESS_TTL` `REFRESH_TTL` | **Có** — `'15m'`, `'30d'` | Chỉ là tinh chỉnh, không phải bí mật |
| `JWT_ACCESS_SECRET` | **Không** | Đặt default là lỗ hổng nghiêm trọng: ai đọc source trên GitHub cũng biết chuỗi ký, tự ký được token giả mạo bất kỳ ai |
| `BREVO_API_KEY` `APP_URL` | **Không** | Quên khai thì phải vỡ lúc khởi động, chứ không phải lúc người dùng bấm gửi OTP |

Sinh chuỗi bí mật: `openssl rand -base64 48`. Hai secret phải **khác nhau** — dùng chung một chuỗi thì access token có thể đem đi làm refresh token.

### Giá trị nào commit được, giá trị nào không

| Loại | Ví dụ | Đặt ở đâu |
| --- | --- | --- |
| Chỉ sống trong máy ảo CI, bên ngoài không với tới | `postgresql://test:test@localhost:5432/test` | Commit thẳng, không sao |
| Mở được thứ có thật ngoài đời | chuỗi Neon, `BREVO_API_KEY`, khoá Cloudinary | **GitHub Secrets**, gọi bằng `${{ secrets.TÊN }}` |

Câu tự hỏi khi phân loại: *lộ chuỗi này ra thì kẻ xấu làm được gì?* Với `test:test@localhost` — không gì cả, vì máy ảo đó bị xoá khi job kết thúc. Với chuỗi Neon — đọc và xoá được database thật.

## Ghi chú cho T35–T38 — vì sao refresh token phải làm đúng

Đây là phần dễ làm sai nhất sprint này, và làm sai thì không ai phát hiện cho tới lúc bị lợi dụng.

**Access token để trong bộ nhớ, refresh token để trong cookie httpOnly.** Không để access token vào `localStorage`: bất kỳ đoạn script nào chạy trên trang cũng đọc được, chỉ cần một thư viện npm bị nhiễm là mất sạch. Cookie `httpOnly` thì JavaScript không đọc được.

**Refresh token lưu vào database dưới dạng đã băm.** Nếu lưu nguyên văn, ai xem được database là chiếm được mọi phiên đăng nhập. Băm rồi thì bản trong database vô dụng nếu không có bản gốc.

**Xoay vòng token, và phát hiện dùng lại.** Mỗi lần refresh thì token cũ bị huỷ, cấp token mới. Nếu có ai đó gọi refresh bằng một token **đã bị huỷ**, nghĩa là token đó đã bị đánh cắp — lúc này huỷ toàn bộ phiên của user đó và bắt đăng nhập lại. Không có bước này thì kẻ trộm dùng token vô thời hạn mà chủ tài khoản không hề biết.

Vì web ở domain Vercel còn API ở domain Render, cookie phải có `SameSite=None; Secure`, và API phải bật `credentials: true` trong CORS. Thiếu một trong hai thì trình duyệt lặng lẽ không gửi cookie — đăng nhập trên máy thì được, lên bản deploy thì hỏng.

## Ghi chú cho T60 — vì sao bỏ phần "chọn mức độ"

Bảng `StudentSkill` chỉ có `(studentProfileId, skillId)`, KHÔNG có cột mức độ thành thạo. Comment trong `schema.prisma` từ Sprint 0 đã nói đây là thứ để dành: bảng nối được khai tường minh thay vì quan hệ ngầm của Prisma chính là để sau này thêm cột mà không phải viết migration chuyển dữ liệu.

Thêm mức độ bây giờ nghĩa là: sửa schema, viết migration, sửa `replaceSkills` ở T54 (đã merge, đã có test), sửa cả kiểu dùng chung. Đổi lại được gì thì chưa rõ — điều kiện nghiệm thu của chính T60 không nhắc tới mức độ, và mức độ do người dùng **tự khai** thì nhà tuyển dụng cũng khó tin: ai cũng chọn "thành thạo".

Đã chốt với Khang: bỏ, để dành. Khi nào làm thì làm cùng lúc với bộ lọc tìm ứng viên theo kỹ năng — lúc đó mới biết cần bao nhiêu bậc và bậc nào thật sự dùng để lọc.

## Đăng nhập Google — ĐÃ LÀM XONG phần code, chờ khoá

Code đã hoàn chỉnh và test được ở mọi nhánh trừ nhánh cần Google thật. **Chưa chạy được cho tới khi có `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.**

Cách lấy khoá (miễn phí, khoảng 5 phút):

1. Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo project mới (tên gì cũng được).
2. **APIs & Services → OAuth consent screen** → chọn **External** → điền tên ứng dụng, email hỗ trợ, email liên hệ. Không cần submit để Google xét duyệt — ở chế độ *Testing* vẫn đăng nhập được, chỉ giới hạn 100 tài khoản và phải thêm email người dùng thử vào mục **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Mục **Authorized redirect URIs**, thêm CHÍNH XÁC hai dòng (kể cả dấu gạch chéo — lệch một ký tự là Google trả `redirect_uri_mismatch`):
   - `http://localhost:4000/api/auth/google/callback`
   - `https://<tên-service>.onrender.com/api/auth/google/callback`
5. Copy **Client ID** và **Client secret** vào `apps/api/.env`, rồi khởi động lại API.

Trong lúc chưa có khoá, mọi thứ vẫn chạy: `googleSanSang` trong `/api/health` trả `false`, web tự ẩn nút Google, đăng nhập bằng mật khẩu không ảnh hưởng gì. Đây là lý do hai biến này là hai biến DUY NHẤT có giá trị mặc định rỗng — xem `config/env.ts`.

Nhớ khai thêm `API_URL` (địa chỉ công khai của chính API) — Google bắt `redirect_uri` phải tuyệt đối, và không suy ra được từ request vì sau proxy của Render thì `req.host` là tên miền nội bộ.

## Ghi chú cho Đăng nhập Google — thiết kế đã chốt

Không thuộc T51–T58, để làm sau khi xong hồ sơ. Chốt trước để khi bắt tay vào không phải dừng giữa chừng hỏi lại.

- **Authorization Code Flow**, `redirect_uri` trỏ về backend (`/api/auth/google/callback`), không phải frontend. Token thật của Google không bao giờ chạm trình duyệt. Client chỉ nhận access/refresh token do UniWork tự phát hành — dùng chung cơ chế JWT đã có (access 15 phút, refresh 7 ngày, cookie httpOnly).
- Scope xin: `openid email profile`. Không xin thêm Calendar/Drive nếu không dùng.
- **Dùng bảng `UserAccount` đã có sẵn trong schema** (không đổi tên thành `OAuthAccount`, không đổi `providerAccountId` thành `providerUserId`, không đổi sang `uuid()` — giữ nguyên `cuid()` và enum `AuthProvider` cho khớp phần còn lại của schema). Không lưu access_token/id_token của Google, chỉ đọc `email`, `email_verified`, `sub`, `name`, `picture` từ id_token rồi bỏ.
- Gộp tài khoản theo email: **chỉ tự động liên kết khi Google trả `email_verified: true`**. Nếu `false` thì từ chối, báo lỗi rõ, không tự gộp — tránh chiếm tài khoản bằng email chưa xác thực.
- **Đặt mật khẩu lần đầu cho tài khoản chỉ đăng nhập Google**: dùng lại luồng "quên mật khẩu" (OTP qua email, chưa có mã T — xem mục dưới), không dựng endpoint `POST /api/auth/dat-mat-khau` riêng chỉ dựa vào access token còn hiệu lực. Lý do: access token hợp lệ không đủ đảm bảo — phiên bị chiếm (XSS đọc token trong bộ nhớ, hoặc lộ máy chưa khoá) thì kẻ đó gắn được mật khẩu vĩnh viễn, sống lâu hơn phiên 15 phút đã chiếm được. Đi qua email lại thì phải chứng minh còn giữ hộp thư, giống hệt lúc đăng ký.
- `state` param chống CSRF ở bước redirect: lưu vào cookie httpOnly sống ngắn (vài phút) lúc redirect, đối chiếu query param lúc callback — không cần thêm session store.
- Verify id_token bằng `google-auth-library` (`OAuth2Client.verifyIdToken()`), không tự viết decode/verify JWT tay.
- Refresh token đã là bảng riêng theo từng thiết bị từ đầu, nên đăng nhập song song nhiều thiết bị bằng nhiều phương thức khác nhau (điện thoại Google, laptop mật khẩu) không cần xử lý gì thêm.

## Ghi chú cho quên mật khẩu — chưa có mã T

Không thuộc T51–T58. Dùng lại đúng cơ chế OTP 6 số đã có ở T42 (bảng `OneTimeToken`, type `PASSWORD_RESET` đã có sẵn trong schema), không phải link trong email.

- `POST /api/auth/quen-mat-khau { email }` → luôn trả cùng một thông điệp bất kể email có tồn tại hay không, tránh dò email.
- `POST /api/auth/dat-lai-mat-khau { email, code, matKhauMoi }` → đúng mã thì ghi `passwordHash` mới, đánh dấu mã đã dùng, và **thu hồi toàn bộ refresh token đang sống của user đó** (đăng xuất mọi thiết bị) — phòng trường hợp người yêu cầu đổi mật khẩu vì nghi tài khoản đã bị lộ.
- Hai điểm sau **chưa chốt, phải hỏi lại trước khi code**: ngưỡng rate limit cho `/quen-mat-khau` (theo email hay IP, bao nhiêu lần/khoảng thời gian), và giới hạn số lần nhập sai OTP ở `/dat-lai-mat-khau` (khoá sau mấy lần sai, khoá bao lâu, có cần thêm captcha không).

## Ghi chú cho T56 — CV lưu ở đâu

**Phải chốt trước khi viết code, không vừa code vừa nghĩ.**

Render gói miễn phí có filesystem **tạm**: mỗi lần service khởi động lại — mà nó ngủ và dậy liên tục — mọi file ghi lên đĩa đều mất. Lưu CV vào thư mục trên server là mất dữ liệu, và lỗi này chỉ lộ ra sau vài giờ nên rất dễ lọt qua lúc test.

| Cách | Được | Mất |
| --- | --- | --- |
| Cloudinary / Supabase Storage (gói miễn phí) | Đúng cách làm, có CDN, không giới hạn số lần đọc | Thêm một dịch vụ ngoài phải đăng ký và giữ khoá |
| Lưu thẳng vào Neon dạng `bytea` | Không thêm dịch vụ nào, sao lưu chung với database | Neon miễn phí chỉ 0.5GB; mỗi CV ~1MB nên khoảng 400 CV là đầy |
| Chỉ lưu **đường dẫn** tới CV người dùng tự host (Google Drive) | Không tốn gì | Không kiểm soát được link còn sống hay không |

Đề xuất: **Cloudinary**. Đồ án cần chứng minh biết xử lý file thật, mà 0.5GB của Neon còn phải dành cho dữ liệu nghiệp vụ.

**Đã chốt và đã làm: Cloudinary**, chế độ `type: upload` (công khai) — xem `lib/cloudinary.ts`. CV không nhạy cảm bằng giấy tờ tuỳ thân (T57 bên dưới) nên public URL là đủ, không cần signed URL.

## Ghi chú cho T57 — giấy tờ NTD dùng chế độ Cloudinary khác CV

CV (T56) và giấy tờ NTD (T57) đều lưu trên Cloudinary nhưng **cố ý khác chế độ**, vì độ nhạy cảm khác nhau:

| | CV (T56) | Giấy tờ NTD (T57) |
| --- | --- | --- |
| Chế độ Cloudinary | `type: upload` (công khai) | `type: authenticated` (riêng tư) |
| Vì sao | CV vốn là tài liệu bán công khai — các trang tuyển dụng khác đều cho xem link CV thoải mái | CCCD lộ ra là nguy cơ giả mạo danh tính thật; giấy phép KD/mã số thuế cũng là thông tin doanh nghiệp không nên public |
| Cách xem | `cvUrl` trả thẳng trong `GET /api/toi`, dùng được mãi | Không có URL nào trong response hồ sơ — phải gọi riêng `GET /api/toi/giay-to/:type/xem` để xin signed URL sống 5 phút |
| Ai xem được | Bất kỳ ai có link | Chỉ NTD chủ giấy tờ đó (và sau này ADMIN lúc duyệt, xem `getDocumentViewUrl` trong `profile.service.ts`) |

Cột `cloudinaryPublicId` trong bảng `EmployerDocument` **không phải URL xem được** — chỉ là định danh để dựng lại signed URL lúc cần, ký bằng `CLOUDINARY_API_SECRET`. Biết đúng giá trị này cũng không xem được gì nếu không đi qua backend.

Mỗi NTD chỉ có **một bản hiện hành cho mỗi loại giấy tờ** (`@@unique([employerProfileId, type])` trong schema) — nộp lại thì ghi đè bản cũ, kể cả bản đã bị admin từ chối, không tồn đọng nhiều bản cùng loại.

## Ghi chú cho T41 — email và cold start

**Đã chốt: Brevo.** Timeline ghi Brevo, Excel ghi Resend — chọn Brevo và đã sửa code cho khớp.

Lý do bỏ Resend: gói miễn phí của nó chỉ gửi được tới email đã xác thực cho tới khi xác thực tên miền — mà đồ án không có tên miền, nên hôm bảo vệ người chấm nhập email lạ sẽ không nhận được gì. Brevo chỉ đòi xác thực ĐỊA CHỈ GỬI, người nhận tự do.

1. Xác thực một tên miền thật (mất tiền tên miền).
2. Chuẩn bị sẵn tài khoản demo đã xác thực, và ở môi trường demo cho phép hiện OTP ngay trên màn hình.

Thêm nữa, API ngủ sau 15 phút và mất tới ~50 giây để dậy. Lần bấm "Đăng nhập" đầu tiên sau khi ngủ sẽ treo rất lâu. Nút bấm phải có trạng thái đang tải và **không được đặt timeout dưới 60 giây**.

## Tự kiểm trước khi mở PR — phần DEV1

Chạy hết danh sách này trước khi tạo PR. Mấy dòng có dấu ⚠ là lỗi từng làm sập dự án thật, không phải lo xa.

**Trước mỗi lần push**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` xanh trên máy
- [ ] Endpoint mới đã khai vào `src/routes.ts` và gọi thử bằng curl/Postman thấy trả đúng
- [ ] Kiểu response đã có trong `packages/shared/src/api.ts`, không phải khai riêng trong `apps/api`

**Về bảo mật — kiểm bằng mắt, không đoán**

- [ ] ⚠ Mọi response có chứa user **không** kèm `passwordHash`, `refreshToken`, hay bất kỳ token nào. Dùng `select` liệt kê tường minh, đừng trả cả object Prisma
- [ ] ⚠ Refresh token trong bảng `RefreshToken` là **chuỗi đã băm** — mở Prisma Studio nhìn thấy chuỗi gốc là sai
- [ ] ⚠ Không có `console.log` nào in ra mật khẩu, token, hay OTP. Log lên Render là ai xem cũng được
- [ ] Endpoint sửa dữ liệu đều có `requireAuth`, và kiểm **chủ sở hữu** chứ không chỉ kiểm vai trò. Sinh viên A gọi API sửa hồ sơ của sinh viên B phải trả `FORBIDDEN`
- [ ] Đăng ký trùng email trả `CONFLICT`, không tạo bản ghi rác trong `StudentProfile`/`EmployerProfile`

**Về database**

- [ ] Thao tác ghi nhiều bảng cùng lúc (đăng ký, thay kỹ năng, thay lịch rảnh) nằm trong `prisma.$transaction`. Nửa chừng lỗi mà đã ghi được một nửa là hỏng dữ liệu
- [ ] Không đổi `schema.prisma` mà quên tạo migration. Kiểm bằng `prisma migrate dev --create-only` — nó phải báo không có gì để tạo

**Trước khi coi là xong hẳn**

- [ ] ⚠ Đã thử **trên bản deploy thật**, không chỉ trên máy. Cookie xuyên domain là thứ chỉ hỏng khi lên Vercel + Render
- [ ] Đã khai biến môi trường mới trên dashboard Render, không chỉ trong `.env` máy mình
- [ ] Bấm chức năng đó sau khi API vừa ngủ dậy (chờ 20 phút) — không bị timeout

## Sản phẩm bàn giao

| Sản phẩm | Người | Hạn |
| --- | --- | --- |
| BRD module Ứng tuyển + Admin | BA | Hết ngày 5 |
| Biến môi trường mới khai đủ 5 nơi; kiểu response auth đã push lên `packages/shared` | DEV1 | **Hết ngày 2** |
| API auth đầy đủ (đăng ký, đăng nhập, refresh, đăng xuất, OTP) chạy trên Render | DEV1 | Hết ngày 5 |
| Đăng nhập được từ web trên Vercel, giữ phiên qua lần tải lại trang | DEV2 | Hết ngày 5 |
| Figma 4 frame cho Sprint 2 | BA | **Hết ngày 8** |
| API hồ sơ, kỹ năng, lịch rảnh, upload CV | DEV1 | Hết ngày 9 |
| Trang hồ sơ SV và NTD hoàn chỉnh, khai được kỹ năng và lịch rảnh | DEV2 | Hết ngày 10 |
| Bảng test case đã chạy + danh sách lỗi | BA | Hết ngày 10 |
| Chương 1–2 báo cáo (bản nháp) | BA | Hết ngày 10 |

## Phụ thuộc

| Việc | Chờ | Ghi chú |
| --- | --- | --- |
| T44, T45 | T37 | Frontend cần biết hình dạng response đăng nhập. DEV1 chốt kiểu trong `packages/shared` **ngay ngày 2**, đừng đợi code xong |
| T48 | T40 | Route bảo vệ phía web phải khớp tên vai trò với `requireRole` phía API |
| T59, T60, T61 | T52, T54, T55 | Trong lúc chờ API, DEV2 dựng giao diện với dữ liệu giả rồi thay nguồn sau — đúng cách đã làm ở trang chủ |
| T47 | T42 | Màn OTP cần biết OTP dài mấy ký tự và hết hạn bao lâu |
| Sprint 2 | T64 | BA giao thiết kế trễ thì Sprint 2 phải dựng theo phỏng đoán |

## Rủi ro của riêng sprint này

| Rủi ro | Dấu hiệu sớm | Xử lý |
| --- | --- | --- |
| Cookie xuyên domain không chạy trên bản deploy | Trên máy thì được, lên Vercel thì đăng nhập xong lại mất phiên | Test trên bản deploy thật **từ ngày 3**, không đợi cuối sprint |
| Upload file ăn hết thời gian | Ngày 9 vẫn chưa tải được file nào lên | Cắt sang lưu link Google Drive, ghi rõ là hạn chế đã biết |
| Brevo hết hạn mức 300 email/ngày | Người ngoài nhóm không nhận được OTP | Bật chế độ hiện OTP trên màn hình ở môi trường demo |
| Hai dev cùng sửa `packages/shared` | Conflict liên tục ở `api.ts` | DEV1 là người duy nhất thêm type vào `shared`; DEV2 báo qua chat khi cần type mới |
