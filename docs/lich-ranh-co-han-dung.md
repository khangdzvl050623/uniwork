# Lịch rảnh có hạn dùng — yêu cầu kỹ thuật

**Trạng thái:** đã chốt nghiệp vụ 2026-08-27, **hoãn thi công tới sau Sprint 4.**

**Vì sao hoãn:** hiện là tuần 6/8. Tuần 7 là Sprint 4 (Ứng tuyển & Thông báo) — thứ khép kín vòng tuyển dụng và chưa viết dòng nào; không có nó thì bản demo không đi hết được một vòng, mà đó mới là thứ hội đồng chấm. Việc này ước tính 1,5–2 ngày, làm trước Sprint 4 là đánh đổi sai thứ tự ưu tiên.

Ghi lại đầy đủ ở đây để lúc quay lại không phải hội ý lại từ đầu.

---

## Vấn đề

`Availability` hiện chỉ có `(studentProfileId, dayOfWeek, slot, createdAt)` — **không có khái niệm thời hạn**. Lịch rảnh khai một lần rồi sống mãi.

Sinh viên đổi thời khoá biểu mỗi kỳ, có tuần thi, có đợt thực tập, có nghỉ hè. Sau vài tháng, hệ thống vẫn chấm điểm phù hợp rất tự tin trên dữ liệu đã sai — và cả sinh viên lẫn nhà tuyển dụng đều bị lừa.

Hiện có 29 hàng của 4 sinh viên.

---

## Nghiệp vụ đã chốt

### 1. Khoảng hiệu lực

Đặt tên `effectiveFrom` / `effectiveUntil`, **không** dùng `validFrom`/`validUntil` — hệ thống sau này còn có khoảng thời gian của chính tin tuyển dụng, hai cặp tên phải phân biệt được nghĩa.

- `effectiveFrom` **bắt buộc**
- `effectiveUntil` **nullable** — `null` nghĩa là chưa xác định ngày kết thúc; giao diện hiện thành ô "Không xác định ngày kết thúc"

### 2. Lịch hết hạn KHÔNG tham gia ghép

Đây là điểm hai bên từng lệch nhau, đã thống nhất:

| | Domain | Giao diện |
| --- | --- | --- |
| Lịch hết hạn | `matchScore: null`, `eligible: null` | "Lịch rảnh của bạn hết hạn ngày dd/mm — cập nhật để xem độ phù hợp" |
| Đã khai, không trùng ca nào | `matchScore: 0`, `eligible: false` | "0% khớp lịch" |

**Vì sao `null` chứ không phải `0`** (chốt sau khi cân nhắc phương án trả `0`):

Lịch hết hạn nghĩa là *bản khai* hết hạn, **không** phải *sinh viên bận*. Họ có thể vẫn rảnh y nguyên, chỉ là chưa cập nhật. Trả `0` là khẳng định "đã đo, bạn không rảnh giờ này" về một thứ hệ thống không hề biết — đúng cùng lỗi mà quy ước `null ≠ 0` sinh ra để chặn, chỉ khác nguyên nhân.

Lo ngại "null làm sort/filter phức tạp" không còn đúng: chi phí đó **đã trả rồi**. Hàm sắp xếp trong `listPublicJobs` có `hang()` đẩy `null` xuống cuối, và bộ lọc đã trả 400 rõ ràng cho ca "chưa khai lịch". Lịch hết hạn dùng lại đúng hai cơ chế đó, thêm **0 dòng** xử lý null mới:

```
GET /api/viec-lam?matchAvailability=true
→ 400 "Lịch rảnh của bạn hết hạn ngày 31/08, cập nhật lại để lọc theo lịch"
```

### 3. Ghép theo THỜI ĐIỂM CÔNG VIỆC CẦN NGƯỜI, không phải `NOW()`

Điểm quan trọng nhất của lần hội ý này, và là thứ dễ bỏ sót nhất.

Có thật trong dữ liệu seed:

```
SEASONAL "Nhân viên bán hàng thời vụ Tết"
  làm việc: 2026-12-15 → 2027-01-20
  hạn nộp:  2026-12-10
```

Sinh viên khai lịch `2026-09-01 → 2026-11-30`, xem tin vào **tháng 10**: `NOW()` nằm trong hạn → hệ thống báo khớp 100%. Nhưng tới 15/12 khi quán cần người thì lịch đó đã hết. Cả hai bên cùng bị lừa.

Điều kiện đúng là **giao nhau giữa khoảng hiệu lực của lịch và khoảng làm việc của tin**:

| `scheduleType` | Khoảng làm việc của tin |
| --- | --- |
| `ONE_TIME` | đúng ngày `workDate` |
| `SEASONAL` | `startDate` → `endDate` |
| `RECURRING` | `max(NOW(), startDate)` → vô hạn |

Dữ liệu đã có sẵn — `startDate`, `endDate`, `workDate` đều nằm trên `Job`.

### 4. Không được có hai lịch cùng ô, chồng lấn thời gian

Composite unique **không** diễn đạt được ràng buộc này. Hai hàng cùng `(sinh viên, T2, MORNING)` với khoảng `2026-09-01→2027-01-15` và `2026-12-01→2027-03-15` là hai hàng khác nhau nên unique cho qua, nhưng chúng chồng lấn tháng 12–1.

**Ràng buộc phải nằm ở database, không chỉ ở service.** Kiểm ở service có race condition: hai request cùng lúc đều qua bước kiểm, đều insert, dữ liệu hỏng. Đây là nếp đã dùng xuyên suốt dự án — *kiểm ở service để có câu chữ dễ đọc, ràng buộc ở database mới là lớp chặn thật* (xem `Application.@@unique`, `jobs_salary_check`, `Skill onDelete: Restrict`).

Postgres làm được bằng **exclusion constraint**:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE availabilities ADD CONSTRAINT availabilities_khong_chong_lan
  EXCLUDE USING gist (
    "studentProfileId" WITH =,
    "dayOfWeek"        WITH =,
    slot               WITH =,
    daterange("effectiveFrom", "effectiveUntil", '[)') WITH &&
  );
```

> ⚠ **Đã kiểm:** `btree_gist` có sẵn trong Postgres 17 của `docker-compose` (v1.7, chưa cài). **Chưa kiểm trên Neon** — phải xác nhận trước khi viết migration, vì production chạy Neon.

---

## Việc phải làm

| # | Việc | Ghi chú |
| --- | --- | --- |
| 1 | Migration: thêm `effectiveFrom` (NOT NULL), `effectiveUntil` (nullable) | 29 hàng cũ: `effectiveFrom = createdAt`, `effectiveUntil = NULL` → giữ nguyên hành vi hiện tại, không phá dữ liệu |
| 2 | Bỏ `@@unique([studentProfileId, dayOfWeek, slot])` | Nó chặn oan việc khai cùng một ô cho hai kỳ khác nhau |
| 3 | Thêm exclusion constraint ở trên | Viết tay trong migration, Prisma không sinh được |
| 4 | Kiểm chồng lấn ở service trước khi ghi | Để có câu tiếng Việt dễ đọc; constraint vẫn là lớp chặn cuối |
| 5 | `layLichRanh` (`jobs.service.ts`) lọc theo khoảng làm việc của tin | Không phải `NOW()` — xem mục 3 |
| 6 | `layIdDuDieuKien` thêm điều kiện hiệu lực vào SQL | Nếu không thì bộ lọc dùng lịch hết hạn còn điểm thì không |
| 7 | `profile.service.ts` — quyết định "thay toàn bộ" nghĩa là gì | Hiện là `deleteMany` + `createMany`. Có hạn dùng thì xoá cả kỳ cũ hay chỉ kỳ hiện tại? **Cần chốt trước khi code** |
| 8 | Trang `/lich-ranh`: ô chọn khoảng ngày + ô "không xác định ngày kết thúc" | |
| 9 | `JobList`/`JobDetail`: cảnh báo khi lịch sắp/đã hết hạn | Khác hẳn thông báo "chưa khai lịch" |
| 10 | Cập nhật BRD | Chưa có mục nào nói về hạn lịch rảnh |

### Test cần có

- Lịch còn hiệu lực → ghép bình thường
- Lịch hết hạn → `matchScore: null`, không phải `0`
- Lịch hết hạn + bật lọc → 400 kèm ngày hết hạn
- Lịch hiệu lực `2026-09-01→2026-11-30` + tin SEASONAL làm `2026-12-15→2027-01-20` → **không** khớp, dù `NOW()` nằm trong hạn
- Tin `RECURRING` + lịch không có `effectiveUntil` → khớp
- Tin `ONE_TIME` với `workDate` nằm ngoài khoảng hiệu lực → không khớp
- Ghi hai lịch cùng ô, khoảng chồng lấn → bị chặn (kiểm cả tầng service lẫn tầng database)
- Ghi hai lịch cùng ô, khoảng **không** chồng lấn → được phép

---

## Hướng v2, chưa làm

### `AvailabilityPeriod` thay cho ngày trên từng hàng

```
Student
  └── AvailabilityPeriod (effectiveFrom, effectiveUntil)
        └── slots[]
```

Đẹp hơn: ngày nằm một chỗ, sửa hạn là sửa 1 hàng thay vì tối đa 21 hàng.

**Kèm một điều chỉnh so với bản hội ý:** nếu đã tách `Period` thì ràng buộc nên là **hai period không được chồng lấn nhau, chấm hết** — thay vì chồng lấn theo từng `(day, slot)`. Ràng buộc theo từng ô cho phép "rảnh T2 sáng kỳ 1, rảnh T4 tối kỳ 2 chồng lấn thời gian", về kỹ thuật hợp lệ nhưng **không sinh viên nào cần**, và nó làm constraint phức tạp hơn hẳn. Không chồng lấn ở mức period khớp đúng cách sinh viên nghĩ: *"lịch của tôi kỳ này"*.

Cố ý **không** dùng `semesterId`: sinh viên có thể rảnh `01/09→30/09` rồi `10/10→31/12`, hoặc nghỉ hai tuần giữa kỳ. Khoảng ngày linh hoạt hơn mô hình kỳ học.

### Độ phân giải khung giờ

Đã cân nhắc và **giữ 3 khung ở v1** — xem `TIME_SLOTS` trong `packages/shared/src/domain.ts`. Tóm tắt: vấn đề không nằm ở "3 hay 6 khung" mà ở chỗ khung giờ là **khung khai báo chuẩn hoá để ghép**, không phải giờ vào ca. Tăng lên 6 khung không giải quyết được gốc (ca thật dài 6–8 tiếng, ranh giới mỗi nơi một khác); muốn đúng hẳn phải chuyển sang `startTime`/`endTime`, và khi đó phép ghép, lưới khai lịch, validate lẫn ràng buộc đều phải dựng lại.
