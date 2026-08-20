# Thử API bằng Postman

## Nhập bộ request

1. Mở Postman → **Import** → chọn `uniwork.postman_collection.json`
2. Chạy API ở máy: `pnpm --filter @uniwork/api dev` (cổng 4000)
3. Bấm **Run collection** để chạy cả 15 request từ trên xuống, hoặc bấm từng cái

Mỗi request có sẵn phần kiểm ở tab **Scripts → Post-response**, nên chạy xong là thấy xanh/đỏ ngay chứ không phải tự đọc JSON đoán đúng sai.

Bộ này **chạy lại được nhiều lần**: request `01` có script sinh email mới mỗi lượt chạy. Không có nó thì lần thứ hai trả `409` và test đỏ oan, dù chẳng có gì sai.

Muốn chạy cả bộ từ dòng lệnh, không cần mở Postman:

```bash
npx newman run docs/postman/uniwork.postman_collection.json
```

## Hai thứ Postman tự lo, đừng làm tay

**Access token.** Request `01 — Đăng ký` và `04 — Đăng nhập` có đoạn script tự lưu token vào biến bộ sưu tập:

```js
pm.collectionVariables.set('accessToken', pm.response.json().data.accessToken)
```

Các request cần đăng nhập chỉ việc khai header `Authorization: Bearer {{accessToken}}`. Không phải copy dán token thủ công sau mỗi lần đăng nhập.

**Refresh token.** Nó nằm trong cookie `httpOnly`, và **Postman tự giữ cookie** trong Cookie Jar. Nên request `08 — Refresh` không cần điền gì cả — cứ bấm Send.

> Nếu refresh trả 401 dù vừa đăng nhập xong: mở **Cookies** (dưới nút Send) → kiểm xem có `uniwork_rt` cho `localhost` không. Không có thì thường là chưa chạy bước đăng nhập, hoặc đã chạy `12 — Đăng xuất` rồi.

## Đổi sang thử bản deploy

Sửa biến `baseUrl` trong tab **Variables** của bộ sưu tập:

```
http://localhost:4000          → máy mình
https://<ten>.onrender.com     → bản deploy
```

⚠️ Lần gọi đầu sau khi Render ngủ mất tới **~50 giây**. Postman mặc định chờ tối đa 30 giây nên sẽ báo timeout dù API vẫn đang dậy. Vào **Settings → General → Request timeout** đặt `60000` (ms) trước khi thử.

## Thứ tự chạy có ý nghĩa

Bộ này cố ý xếp thành một câu chuyện, không phải danh sách rời rạc:

| # | Request | Kiểm điều gì |
| --- | --- | --- |
| 00 | Health | API sống chưa |
| 01 | Đăng ký SV | Tạo tài khoản; **không lộ** `passwordHash`/`refreshToken`; cookie có `HttpOnly` |
| 02 | Đăng ký trùng | Trả `409 CONFLICT` |
| 03 | Mật khẩu yếu | Trả `400`, lỗi gắn đúng vào trường `password` |
| 04 | Đăng nhập | Trả `accessToken`, tự lưu vào biến |
| 05 | Sai mật khẩu | Trả `401` với **đúng thông điệp như khi email không tồn tại** |
| 06 | Tôi là ai | Token hợp lệ → `200` kèm `displayName` |
| 07 | Tôi là ai, không token | `401 UNAUTHORIZED` |
| 08 | Refresh | Cấp cặp token mới (xoay vòng) |
| 09 | Gửi mã OTP | Mã 6 chữ số, tự lưu vào biến `otpCode` |
| 10 | Xác thực email | `emailVerifiedAt` có giá trị |
| 11 | Dùng lại mã | `400` — mã chỉ xài được một lần |
| 12 | Đăng xuất | Luôn `200`, kể cả khi không có cookie |
| 13 | Refresh sau đăng xuất | `401` — token đã thu hồi |
| 14 | Danh mục kỹ năng | Endpoint công khai vẫn chạy |

Ba bước dễ bị bỏ qua nhưng quan trọng nhất:

- **05** khoá chặt việc thông điệp lỗi không tiết lộ email nào đã đăng ký. Nếu ai đó sửa code cho "thân thiện hơn" bằng cách báo *"Email này chưa đăng ký"*, test này đỏ ngay.
- **11** chứng minh mã OTP chỉ dùng được một lần — và thông điệp lỗi giống hệt khi sai mã, không tiết lộ rằng mã đó từng đúng.
- **13** chứng minh đăng xuất thật sự thu hồi token ở phía server, chứ không chỉ xoá cookie ở trình duyệt.

## Thử tay việc phát hiện token bị trộm

Đây là hành vi quan trọng nhất của module auth, nhưng Postman không tự dựng được vì nó tự động thay cookie mới sau mỗi lần refresh. Làm tay:

1. Chạy `04 — Đăng nhập`
2. Mở **Cookies** → copy giá trị `uniwork_rt`, dán vào đâu đó (giả làm kẻ trộm giữ bản sao)
3. Chạy `08 — Refresh` → thành công, cookie đã đổi sang token mới
4. Tạo một request mới: `POST {{baseUrl}}/api/auth/refresh`, thêm header
   `Cookie: uniwork_rt=<giá trị đã copy ở bước 2>`
5. Gửi → phải trả **401**, và thông điệp nói mọi thiết bị đã bị đăng xuất
6. Chạy lại `08 — Refresh` → cũng **401**, vì toàn bộ phiên đã bị huỷ

Bước 6 là điểm mấu chốt. Nó chứng minh hệ thống không chỉ từ chối token cũ, mà còn **coi cả tài khoản là đã bị xâm phạm** và bắt đăng nhập lại từ đầu.

## Khi nào dùng Postman, khi nào dùng test tự động

Bộ này để **thử tay và demo**. Nó không thay được `pnpm test`:

| | Postman | `pnpm test` |
| --- | --- | --- |
| Cần API đang chạy | Có | Không |
| Cần database thật | Có | Không (giả lập Prisma) |
| Chạy trong CI | Không | Có, mỗi PR |
| Thấy được request/response thật | Có | Không |

Nên: sửa code xong chạy `pnpm test` trước, rồi mới mở Postman để nhìn tận mắt.
