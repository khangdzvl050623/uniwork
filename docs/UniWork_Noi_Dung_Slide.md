# UNIWORK: Nội dung trình chiếu

> **Cách sử dụng:** Mỗi mục tương ứng một slide. Sao chép phần **Nội dung trên slide** vào bài trình chiếu. Phần **Ghi chú thuyết trình** và **Hình minh họa** dùng khi chuẩn bị, không đưa thành chữ trên slide.
>
> Slide 1–15 là sản phẩm cốt lõi. Slide 16 là **Nice to have**, trình bày ngắn ở cuối nếu còn thời gian. **Phụ lục** không trình chiếu — để trả lời câu hỏi.

---

## Slide 1: UNIWORK

### Nội dung trên slide

**Nền tảng tuyển dụng việc làm part-time cho sinh viên**

Kết nối sinh viên với công việc phù hợp lịch học.

Tên môn học: …
Nhóm thực hiện: …
Thành viên: …
Giảng viên hướng dẫn: …

### Hình minh họa

Logo UniWork, hoặc ảnh chụp trang chủ. Nếu dùng ảnh chụp thì để mờ và đặt chữ đè lên.

---

## Slide 2: Bài toán thực tế

### Nội dung trên slide

**Sinh viên**

- Khó tìm công việc phù hợp với lịch học thay đổi.
- Tin tuyển dụng thiếu kiểm chứng, có nguy cơ lừa đảo.
- Khó theo dõi kết quả sau khi nộp CV.
- Có nguy cơ lộ số điện thoại và email.

**Nhà tuyển dụng**

- Khó tìm ứng viên đáp ứng đủ ca làm.
- Phát sinh trùng lịch học, lịch thi sau khi tuyển.

### Ghi chú thuyết trình

Câu hỏi mở đầu: "Điều gì khiến sinh viên phải bỏ một công việc dù có đủ kỹ năng?" Dẫn vào vấn đề trùng lịch học với ca làm.

### Hình minh họa

Hai cột icon đối xứng: bên trái sinh viên, bên phải nhà tuyển dụng. Hoặc một ảnh thời khoá biểu chồng lên ca làm việc.

---

## Slide 3: Giải pháp của UniWork

### Nội dung trên slide

- **Ghép lịch rảnh:** đối chiếu lịch sinh viên với ca tuyển dụng trên ma trận 7 × 3.
- **Đánh giá phù hợp:** kiểm tra số ca tối thiểu và chấm Match Score.
- **Theo dõi ứng tuyển:** hiển thị trạng thái và lưu lịch sử xử lý đơn.
- **Bảo vệ liên hệ:** mở số điện thoại, email khi ứng viên vào vòng phỏng vấn.
- **Kiểm duyệt hai lớp:** Admin xác minh giấy tờ doanh nghiệp, và duyệt từng tin trước khi tin lên sàn.

### Ghi chú thuyết trình

Nhấn mạnh ghép việc theo lịch rảnh là trọng tâm. Các chức năng còn lại hỗ trợ quy trình tuyển dụng và bảo vệ người dùng.

Về kiểm duyệt: đây là **hai cửa riêng biệt**. Doanh nghiệp đã xác minh giấy tờ vẫn phải chờ duyệt cho **mỗi tin mới**. Nếu bị hỏi vặn thì đây là chỗ hay được hỏi.

### Hình minh họa

Năm icon xếp hàng ngang, mỗi icon một gạch đầu dòng. Giữ icon cùng bộ, cùng nét.

---

## Slide 4: Đối tượng sử dụng và phân quyền

### Nội dung trên slide

| Đối tượng | Làm được gì |
| --- | --- |
| **Khách** (chưa đăng nhập) | Xem danh sách và chi tiết tin tuyển dụng · xem danh mục kỹ năng |
| **Sinh viên** | Hồ sơ, kỹ năng, CV · khai lịch rảnh 7 × 3 · tìm việc và lưu tin · nộp đơn, theo dõi, rút đơn |
| **Nhà tuyển dụng** | Hồ sơ doanh nghiệp, nộp giấy tờ xác minh · đăng tin và gửi duyệt · xem ứng viên, đổi trạng thái đơn |
| **Admin** | Xác minh giấy tờ doanh nghiệp · duyệt từng tin · quản lý danh mục kỹ năng · khoá / mở tài khoản |

**Vai chọn khi đăng ký và không đổi được.** Email xác thực bằng mã OTP.

### Ghi chú thuyết trình

Ba điểm dễ bị hỏi:

1. **Khách xem được tin mà không cần đăng nhập** — chủ đích, để tin tiếp cận được người chưa có tài khoản. Chỉ tin đã duyệt mới hiện.
2. **Sinh viên không thấy ứng viên khác, nhà tuyển dụng không thấy tin của nhau.** Quyền kiểm ở backend, không phải ẩn ở giao diện.
3. **Admin không đọc được thông tin liên hệ trong đơn** — họ duyệt tin và doanh nghiệp, không tham gia quá trình tuyển.

### Hình minh họa

Sơ đồ bốn khối xếp theo bậc: Khách → Sinh viên / Nhà tuyển dụng → Admin, mỗi khối một icon người. Hoặc bảng trên tô màu tiêu đề cột theo vai.

---

## Slide 5: Kiến trúc tổng thể

### Nội dung trên slide

**Modular Monolith trong Monorepo**

| Thành phần | Vai trò |
| --- | --- |
| `apps/web` | Giao diện React, ứng dụng SPA |
| `apps/api` | Backend Express, REST API và Socket.IO |
| `packages/shared` | Kiểu dữ liệu, Zod schema và thuật toán ghép việc dùng chung |
| PostgreSQL | Lưu trữ dữ liệu nghiệp vụ qua Prisma ORM |

**Quản lý workspace:** pnpm workspaces + Turbo.

### Ghi chú thuyết trình

Frontend và backend tách rõ trách nhiệm. Package dùng chung giúp thống nhất cấu trúc dữ liệu và logic ghép việc giữa hai phía — thuật toán chấm điểm chỉ có **một** bản, không phải hai bản dễ lệch nhau.

### Hình minh họa

Sơ đồ ba khối ngang: Web → API → PostgreSQL, và một khối `shared` nằm dưới nối lên cả Web lẫn API.

---

## Slide 6: Công nghệ sử dụng

### Nội dung trên slide

| Nhóm | Công nghệ |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Thư viện giao diện | TanStack Query, React Router, Radix UI / shadcn |
| Backend | Node.js, Express, Prisma ORM, Zod |
| Cơ sở dữ liệu | PostgreSQL trên Neon |
| Xác thực | JWT Access / Refresh Token, Argon2id |
| Lưu trữ và email | Cloudinary, Brevo Email OTP |

### Hình minh họa

Logo công nghệ xếp theo nhóm, nền trắng, cùng kích thước. Không đưa số phiên bản của tất cả thư viện lên slide.

> Thiếu thời gian thì gộp slide này vào slide 5: bỏ bảng, chỉ để một hàng logo dưới sơ đồ kiến trúc.

---

## Slide 7: Mô hình dữ liệu

### Nội dung trên slide

| Nhóm | Bảng tiêu biểu |
| --- | --- |
| Người dùng | `users`, `student_profiles`, `employer_profiles` |
| Việc làm | `jobs`, `job_shifts`, `job_skills` |
| Ghép việc | `availabilities`, `student_skills`, `skills` |
| Tuyển dụng | `applications`, `application_events` |

**Hai điểm thiết kế đáng nói**

- `availabilities` và `job_shifts` **cùng một hình dạng** — ngày trong tuần và buổi — nên ghép lịch là phép giao tập hợp, không phải so khoảng thời gian.
- `application_events` lưu **lịch sử** trạng thái, không chỉ trạng thái hiện tại.

### Ghi chú thuyết trình

Cả hai bảng lịch dùng `dayOfWeek` 0–6 và `slot` gồm `MORNING`, `AFTERNOON`, `EVENING`. Chính vì hai bên cùng một tập giá trị nên việc so khớp trở thành một câu truy vấn, không phải một thuật toán.

Hồ sơ sinh viên và doanh nghiệp tách khỏi bảng tài khoản đăng nhập — một tài khoản một vai, dữ liệu hồ sơ không lẫn vào nhau.

### Hình minh họa

ERD rút gọn, chỉ giữ các bảng trong bảng trên và quan hệ chính. Tô đậm đường `student_profiles → applications → jobs`. **Đừng** xuất ERD đầy đủ từ Prisma — quá dày, chiếu lên không đọc được.

---

## Slide 8: Ma trận lịch rảnh 7 × 3

### Nội dung trên slide

**Ví dụ: Sinh viên An ứng tuyển tại quán Sương Mai**

- Quán có **10 ca**, yêu cầu tối thiểu **5 ca/tuần**.
- An có **9 ô rảnh**, trong đó **8 ô khớp** với ca của quán.

| Buổi | T2 | T3 | T4 | T5 | T6 | T7 | CN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sáng | · | · | · | · | · | Q | ★ |
| Chiều | · | · | · | · | · | Q | ★ |
| Tối | ★ | ★ | ★ | ★ | ★ | ★ | A |

**★** khớp lịch · **Q** quán mở, An bận · **A** An rảnh, quán đóng · **·** cả hai không có lịch

**Khớp 8/10 ca. Yêu cầu tối thiểu 5 ⇒ An đủ điều kiện.**

### Ghi chú thuyết trình

Mỗi tuần 7 ngày × 3 buổi = lưới cố định 21 ô. Hệ thống lấy giao của hai tập ô.

Nói rõ **"đủ điều kiện" và "phù hợp" là hai câu hỏi khác nhau**: đủ điều kiện = có nhận nổi việc này không; phù hợp = hợp tới đâu. Kỹ năng tốt không bù được việc thiếu số ca tối thiểu — slide sau chấm điểm phù hợp.

### Hình minh họa

Ảnh chụp trang **Lịch rảnh của tôi** đặt cạnh bảng trên, để người xem thấy lưới thật trông thế nào. Tô màu ô ★ cho nổi.

---

## Slide 9: Điểm phù hợp (Match Score v1)

### Nội dung trên slide

| Tiêu chí | Trọng số | Ví dụ của An | Điểm thành phần |
| --- | --- | --- | --- |
| Ca làm | 50 % | Khớp 8/10 ca | 80 |
| Kỹ năng | 30 % | Đáp ứng 2/3 kỹ năng | 67 |
| Cam kết | 20 % | Có thể làm 3/6 tháng | 50 |

**Match Score = round(Σ trọng số × điểm / Σ trọng số)**

**round(0,5 × 80 + 0,3 × 67 + 0,2 × 50) = 70 điểm**

**An đủ điều kiện, đạt 70/100 điểm phù hợp.**

### Ghi chú thuyết trình

Điểm phù hợp **không phải xác suất trúng tuyển**. Nó là mức khớp giữa hồ sơ và yêu cầu tin.

Nếu bị hỏi "vì sao 50/30/20": chưa có dữ liệu chứng minh bộ trọng số này đúng hơn bộ khác. Đây là lựa chọn ban đầu, ghi rõ là `v1` và lưu kèm mỗi đơn để về sau đổi công thức vẫn so sánh được.

Nếu bị hỏi "tiêu chí thiếu dữ liệu thì sao": xem **Phụ lục A**.

### Hình minh họa

Biểu đồ cột ngang ba tiêu chí, mỗi cột dài theo điểm thành phần, kèm nhãn trọng số. Hoặc ảnh chụp phần chi tiết điểm trong đơn ứng tuyển.

---

## Slide 10: Đóng băng kết quả khi nộp đơn

### Nội dung trên slide

**Lúc xem việc** — chỉ ghép lịch, không lưu.
**Lúc nộp đơn** — chấm đủ ba tiêu chí và **lưu vào đơn**:

- Match Score và chi tiết từng tiêu chí.
- Ngưỡng số ca tối thiểu tại thời điểm đó.
- Đời công thức đã dùng (`v1`).

**Nhà tuyển dụng sửa yêu cầu sau đó không làm đổi điểm đã lưu.**

### Ghi chú thuyết trình

Đây là lý do: nếu tính lại mỗi lần mở đơn, một sinh viên nộp hôm nay với 80 điểm có thể thành 40 điểm tuần sau chỉ vì tin đổi yêu cầu — và không ai giải thích được tại sao. Giao diện phải nói rõ "tính theo lịch rảnh lúc bạn nộp đơn".

### Hình minh họa

Hai ảnh cạnh nhau: tỷ lệ khớp lịch trên trang tìm việc, và chi tiết điểm trong đơn ứng tuyển. Vẽ một mũi tên khoá giữa hai ảnh.

---

## Slide 11: Bảo mật và xác thực

### Nội dung trên slide

- **Mật khẩu:** băm bằng Argon2id.
- **Access Token:** JWT, hiệu lực 15 phút, lưu trong bộ nhớ trình duyệt.
- **Refresh Token:** hiệu lực 7 ngày, truyền qua cookie `httpOnly` và `Secure`.
- **Quản lý phiên:** lưu hash Refresh Token, xoay vòng và phát hiện tái sử dụng token.
- **Tài liệu xác minh:** lưu riêng tư trên Cloudinary, cấp URL tạm thời khi Admin cần xem.

### Ghi chú thuyết trình

Chỉ nói thông số khi bị hỏi: Argon2id 19 MiB, 2 vòng, parallelism 1; database lưu SHA-256 hash của Refresh Token, không lưu bản gốc.

Access token để trong bộ nhớ chứ không trong `localStorage` — `localStorage` bị JavaScript của bất kỳ script nào đọc được.

### Hình minh họa

Sơ đồ vòng đời token: đăng nhập → access 15 phút → hết hạn → refresh → access mới. Vẽ thành vòng tròn.

---

## Slide 12: Bảo vệ thông tin liên hệ

### Nội dung trên slide

**Contact Privacy Gate**

| Trạng thái đơn | Số điện thoại và email |
| --- | --- |
| PENDING — Chờ xử lý | Ẩn |
| VIEWED — Đã xem | Ẩn |
| SHORTLISTED — Mời phỏng vấn | **Mở** |
| ACCEPTED — Đã nhận | **Mở** |

**Chưa đủ điều kiện thì câu truy vấn không lấy các trường liên hệ.**

### Ghi chú thuyết trình

Điểm mấu chốt: backend **không trả về** dữ liệu, chứ không phải giao diện ẩn đi. Chỉ ẩn ở giao diện thì mở DevTools là đọc được nguyên trong response.

### Hình minh họa

Hai ảnh cùng một hồ sơ ứng viên: trước và sau khi chuyển sang SHORTLISTED. Khoanh đỏ vùng liên hệ. **Đây là ảnh thuyết phục nhất của cả bài** — chuẩn bị kỹ.

---

## Slide 13: Demo luồng sinh viên

### Nội dung trên slide

1. **Khai báo lịch rảnh** — chọn các buổi có thể đi làm và lưu.
2. **Tìm việc** — bật bộ lọc khớp lịch, xem tỷ lệ phù hợp theo ca.
3. **Ứng tuyển** — mở tin, nộp CV và gửi đơn.
4. **Theo dõi** — xem trạng thái đơn và chi tiết điểm đã lưu.

### Ghi chú thuyết trình

Chuẩn bị sẵn tài khoản sinh viên, lịch rảnh, tin tuyển dụng và CV mẫu. Đi đúng thứ tự trên để người xem theo dõi được một hành trình hoàn chỉnh.

Đăng ký, xác thực OTP và cập nhật hồ sơ **không demo** — nói một câu rồi bỏ qua, để dành thời gian cho phần ghép lịch.

### Hình minh họa

Ba ảnh chụp xếp ngang: Lịch rảnh của tôi → Tìm việc làm → Đơn ứng tuyển của tôi. Đánh số 1-2-3 lên ảnh.

---

## Slide 14: Demo luồng nhà tuyển dụng và Admin

### Nội dung trên slide

**Nhà tuyển dụng**

1. Đăng tin và **gửi duyệt** — tin ở trạng thái chờ, chưa lên sàn.
2. Xem danh sách ứng viên và chi tiết điểm phù hợp.
3. Chuyển đơn sang **SHORTLISTED** để mở thông tin liên hệ.
4. Cập nhật kết quả tuyển dụng.

**Admin**

1. Xem thống kê hệ thống.
2. Xác minh giấy tờ doanh nghiệp.
3. **Duyệt tin** — tin chuyển sang công khai.
4. Quản lý danh mục kỹ năng.

### Ghi chú thuyết trình

Sắp xếp demo theo **vòng đời một tin**: NTD gửi duyệt → Admin duyệt → tin hiện ở trang tìm việc → sinh viên nộp đơn → NTD shortlist. Như vậy hai vai nối vào nhau thay vì là hai đoạn rời.

Dừng lại ở bước trước và sau SHORTLISTED để minh họa quyền xem liên hệ.

Còn thời gian thì mở tài liệu xác minh bằng URL tạm thời, hoặc bật/tắt kỹ năng nổi bật. Khoá/mở tài khoản nói bằng lời, không cần demo.

### Hình minh họa

Sơ đồ vòng đời tin: `DRAFT → PENDING → OPEN` với hai icon người (NTD, Admin) đặt ở đúng mũi tên họ tác động. Kèm ảnh trang Danh sách ứng viên.

---

## Slide 15: Tổng kết

### Nội dung trên slide

**UniWork hỗ trợ tuyển dụng part-time phù hợp với lịch học.**

- Ghép lịch bằng ma trận **7 × 3**.
- Tách **điều kiện tối thiểu** và **điểm phù hợp**.
- Đóng băng kết quả đánh giá tại thời điểm ứng tuyển.
- Theo dõi quy trình tuyển dụng và bảo vệ thông tin liên hệ.
- Kiểm duyệt hai lớp trước khi tin lên sàn.

### Hình minh họa

Một ảnh giao diện tiêu biểu, hoặc logo UniWork trên nền sạch.

---

## Slide 16: Nice to have và hướng phát triển

### Nội dung trên slide

| Hạng mục mở rộng | Mục đích | Trạng thái |
| --- | --- | --- |
| **AI Chat** | Trợ lý hội thoại dùng Google Gemini | Đã có API, **đang làm giao diện** |
| **Scan CV** | Đọc và trích xuất thông tin từ CV | Chưa hoàn thành |
| **RabbitMQ** | Xử lý tác vụ nặng bằng hàng đợi | Chưa hoàn thành |

### Ghi chú thuyết trình

AI Chat **chưa có màn hình**. Nếu ai xin xem thì demo bằng dòng lệnh:

```powershell
pnpm --filter @uniwork/api thu-tro-ly "có việc pha chế nào ở Hà Nội không?"
```

Nó gọi Gemini thật, tra dữ liệu thật trong database và in câu trả lời ra terminal. Đừng hứa có giao diện.

Scan CV và RabbitMQ là hướng phát triển, chưa phải kết quả đã làm.

### Hình minh họa

Ba icon mờ (chưa làm xong) so với các icon đậm ở slide trước — cho thấy đây là phần mở rộng.

---

# Phụ lục — không trình chiếu

Dành cho phần hỏi đáp. Chuẩn bị sẵn nhưng để cuối file trình chiếu, chỉ mở khi được hỏi.

## Phụ lục A: Thiếu dữ liệu khác với không phù hợp

**0 = đã đánh giá, không khớp. `null` = chưa có dữ liệu để đánh giá.**

| Trường hợp | Cách xử lý |
| --- | --- |
| Tin không yêu cầu tiêu chí đó | Loại tiêu chí khỏi phép tính |
| Sinh viên chưa cung cấp dữ liệu | Loại khỏi phép tính và nhắc bổ sung |

Ví dụ An chưa khai thời gian cam kết:

- Gán 0 điểm cho tiêu chí đó → còn **60 điểm**.
- Loại tiêu chí chưa đo, chia lại theo tổng trọng số còn dùng được → **(0,5 × 80 + 0,3 × 67) / 0,8 ≈ 75 điểm**.

Hệ thống chọn cách thứ hai. Gán 0 là phạt sinh viên vì một thứ họ chưa khai, không phải vì họ không đáp ứng.

Hệ quả cho giao diện: chỗ nào hiện điểm cũng phải nói rõ **điểm tính trên mấy tiêu chí**, nếu không người xem tưởng đã chấm đủ.

## Phụ lục B: Hai hàm trong `packages/shared`

- `ghepLich()` — giao hai tập ô lịch, trả số ca khớp và cờ đủ điều kiện.
- `chamDiemPhuHop()` — chấm ba tiêu chí, trả điểm tổng kèm chi tiết từng thành phần.

Cả hai nằm ở `packages/shared/src/phu-hop.ts` nên frontend và backend dùng **cùng một bản**. Frontend hiện điểm lúc xem tin; backend chấm lại và lưu lúc nộp đơn. Không có hai bản dễ lệch nhau.
