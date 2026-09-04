# Sprint 4 — Ứng tuyển & Thông báo

**Thời lượng:** 5 ngày làm việc (tuần 7) · **Nhóm:** 3 người

| Ký hiệu | Vai trò | Tên |
| --- | --- | --- |
| **DEV1** | Backend, hạ tầng, database, deploy API | Khang |
| **DEV2** | Frontend, CI, deploy web | Bảo |
| **BA** | Phân tích nghiệp vụ, viết tài liệu, wireframe | Quốc |

## Mục tiêu sprint

Mốc cuối tuần 7 trong timeline: **"Đi hết được một vòng tuyển dụng từ đăng tin tới nhận việc"**.

Đây là sprint làm cho sản phẩm **khép kín**. Trước nó, tin đăng lên rồi nằm đó — sinh viên xem được nhưng không làm gì được, nhà tuyển dụng không nhận được ai. Sau nó, cả hai phía đi hết được một vòng:

> Sinh viên tìm thấy tin → nộp đơn kèm CV và thư ngỏ → NTD xem danh sách ứng viên → mời phỏng vấn hoặc từ chối → **liên hệ mở ra** → NTD gọi cho ứng viên. Cả hai phía nhận thông báo trong app và qua email.

**Vòng khép kín dừng ở chỗ bàn giao liên hệ, không đi tới "nhận việc"** — chốt 2026-08-29, lý do ở mục ngay dưới.

Năm tính năng của sprint:

1. Sinh viên nộp đơn ứng tuyển
2. NTD xem danh sách ứng viên (**kèm che thông tin liên hệ**)
3. Đổi trạng thái đơn + lịch sử chuyển trạng thái
4. "Đơn của tôi" phía sinh viên
5. Thông báo trong app + email

> **Đổi so với bản kế hoạch đầu:** bản trước tách "che thông tin liên hệ" thành tính năng 5 riêng, xếp sau tính năng xem ứng viên. Nay **gộp vào tính năng 2** — lý do ở ngay trong mục đó, và nó không phải chuyện sắp xếp cho gọn.

## Cách chia việc lần này khác Sprint 3

Sprint 3 chia thẳng theo tính năng được vì **không cần migration nào** — mọi bảng đã có từ Sprint 0, mỗi tính năng chỉ thêm tham số vào endpoint sẵn có.

Sprint 4 không được như vậy: cần **hai bảng mới** và **ba cột mới** trên `Application`. Năm tính năng đều đụng cùng nhóm bảng đó, nên có đúng **một lớp nền chặn thật**. Nhưng chỉ một, và nó gói trong **nửa ngày**. Xong lớp đó thì năm tính năng chạy song song y như Sprint 3.

Phần lớn thứ tưởng là phụ thuộc thì đã có sẵn từ các sprint trước:

| Cần cho tính năng | Đã có sẵn ở |
| --- | --- |
| Bảng `Application` đủ cột `status`, `coverLetter`, `cvUrl`, `matchScore`, `statusChangedAt` | `schema.prisma` — có từ Sprint 0, **chưa endpoint nào chạm tới** |
| Chặn ứng tuyển hai lần ở tầng database | `@@unique([jobId, studentProfileId])` — đã khai sẵn |
| 6 trạng thái đơn | `enum ApplicationStatus` + `APPLICATION_STATUS_LABELS` trong `domain.ts` |
| Gửi email thật | `sendMail()` qua Brevo, đã chạy thật với hai mẫu `otpEmail` / `passwordResetEmail` |
| Ghép lịch + `eligible` | `ghepLich()` trong `packages/shared/src/phu-hop.ts` — làm ở Sprint 3 |
| Giao diện danh sách ứng viên | `pages/Applicants.tsx` (156 dòng) — **đã dựng, đang đọc `data/mock`** |
| **Đơn thật trong database để FE dựng màn hình** | `seed.ts:887` — đã tạo đơn ở 4 trạng thái `PENDING`/`VIEWED`/`SHORTLISTED`/`REJECTED` |

Dòng cuối là dòng quan trọng nhất, vì nó gỡ đúng thứ trông giống phụ thuộc nhất.

**Hai loại phụ thuộc, đừng gộp làm một:**

| Loại | Ví dụ trong sprint này | Chặn thật? |
| --- | --- | --- |
| **Dữ liệu lúc chạy** | "Chưa ai nộp đơn thì màn hình NTD không có gì để hiện" | **Không** — seed đã có đơn sẵn |
| **Mã nguồn** | Hai tính năng gọi chung một hàm, hoặc cần cùng một cột trong database | **Có** — nhưng gom hết vào lớp nền dưới đây |

FE **không cần** tính năng 1 chạy được mới dựng được màn hình của tính năng 2. Cái FE cần là **hàng trong bảng** và **hợp đồng API**, cả hai đều có trước khi endpoint đầu tiên viết xong.

## Lớp nền — thứ duy nhất chặn

Một PR, nửa ngày, DEV1 làm. Trước nó không ai bắt đầu được; sau nó không còn gì chặn ai.

| Việc | Vì sao phải nằm ở đây, không nằm trong một tính năng |
| --- | --- |
| Migration: bảng `ApplicationEvent`, bảng `Notification`, thêm `matchBreakdown` + `matchAlgoVersion` vào `Application` | 4/5 tính năng đọc hoặc ghi các bảng này. Chia migration ra từng tính năng là bốn lần sửa schema chồng lên nhau |
| Zod schema + kiểu TypeScript cho **cả 5 nhóm endpoint**, đặt trong `packages/shared` | FE cần **hợp đồng**, không cần cài đặt. Có kiểu là dựng được màn hình, gọi `curl` được, viết test được — trước khi controller tồn tại |
| `ghiSuKien()` — ghi `ApplicationEvent` trong cùng transaction với việc đổi `Application.status` | Dùng chung bởi tính năng 1 (ghi `PENDING` lúc nộp) và tính năng 3 (mọi lần chuyển sau đó). Để trong tính năng 3 thì tính năng 1 hoặc phải chờ, hoặc viết bản thứ hai rồi quên xoá |
| `seed.ts`: bổ sung đơn ở trạng thái `ACCEPTED` và `WITHDRAWN` (đang thiếu 2/6) | Mở khoá toàn bộ màn hình FE ngay lập tức. Thiếu hai trạng thái này thì hai nhánh giao diện không ai nhìn thấy cho tới lúc demo |

Hai thứ **không** cần chờ cả lớp nền — làm được ngay từ bây giờ, song song:

| Việc | Vì sao không cần chờ |
| --- | --- |
| `tongHopDiem()`, `duNguongCa()` + test | Hàm thuần trong `packages/shared`, không đụng database, không cần migration. Viết test trước cả khi có bảng |
| BA viết test case, sơ đồ trạng thái, kịch bản demo | Không phụ thuộc mã nguồn — như Sprint 3 |

## Bảng tính năng

| # | Tên | BE cần thêm | FE cần thêm | Vì sao độc lập |
| --- | --- | --- | --- | --- |
| 1 | Sinh viên nộp đơn | 1 endpoint `POST`, module mới `applications/` | Gỡ nút disabled ở `JobDetail`, modal thư ngỏ + chọn CV | Chỉ **ghi** vào `Application`. Không tính năng nào khác ghi vào bảng này lúc tạo đơn |
| 2 | NTD xem ứng viên + che liên hệ | 1 endpoint `GET`, mệnh đề `select` có điều kiện | Nối `Applicants.tsx` vào API thật, xoá `data/mock.ts` | Chỉ **đọc**. Chạy được ngay trên đơn của seed, không cần tính năng 1 |
| 3 | Đổi trạng thái + lịch sử | 1 endpoint `PUT`, dùng `ghiSuKien()` của lớp nền | Nút đổi trạng thái trong `Applicants.tsx` | Chỉ **sửa** `status`. Đọc và ghi ở hai tính năng khác không đụng cột này |
| 4 | "Đơn của tôi" | 2 endpoint `GET` + `DELETE` dưới `/toi` | Trang mới + timeline từ `ApplicationEvent` | Trang **mới hoàn toàn**, không sửa file nào của ai. Độc lập nhất trong năm |
| 5 | Thông báo | Bảng `Notification` + 3 endpoint + gọi `sendMail()` | Chuông trên header + dropdown | Module riêng. Chỗ nối duy nhất là **một lời gọi hàm** trong tính năng 1 và 3 |

Khác Sprint 3 ở một điểm đáng chú ý: **bốn tính năng 2–5 của Sprint 3 đều sửa chung `listPublicJobs` và `FilterSidebar.tsx`** nên dễ conflict. Sprint 4 thì mỗi tính năng gần như một file riêng — chỗ chạm nhau chỉ có hai:

- `Applicants.tsx` — tính năng 2 và 3 cùng sửa. Làm 2 trước, 3 sau, hoặc một người làm cả hai.
- `applications.service.ts` — tính năng 1 và 3 cùng gọi `ghiSuKien()`, nhưng gọi chứ không sửa.

Thứ tự dưới đây là **gợi ý để mỗi lần sửa file là một commit sạch**, không phải ràng buộc:

```
0. Lớp nền                       — bắt buộc trước, nửa ngày
1. Nộp đơn                       — mở khoá luồng chính, và là thứ demo được sớm nhất
2. NTD xem ứng viên + che liên hệ — chạy ngay trên đơn seed, không cần bước 1 xong
3. Đổi trạng thái + lịch sử       — sửa tiếp file vừa đụng ở bước 2
4. "Đơn của tôi"                  — trang mới, làm lúc nào cũng được
5. Thông báo                      — làm sau cùng vì nó GỌI hai tính năng trên;
                                    làm trước thì phải sửa lại chỗ nối hai lần
```

**Ràng buộc thứ tự thật sự chỉ có một:** tính năng 5 nối vào tính năng 1 và 3. Còn lại đổi thứ tự thoải mái.

---

## Điểm phù hợp — thiết kế đầy đủ

Phần dài nhất tài liệu này, vì nó là thứ khó sửa nhất sau khi đã có dữ liệu thật. Nó **thuộc lớp nền** (hàm thuần, viết được ngay), tách ra đây vì dài.

### Hợp nhất: một công thức, dùng ở cả hai nơi

Chốt 2026-08-27. Sprint 3 tính điểm **chỉ theo ca làm**. Sprint 4 mở rộng thành ba thành phần, và **danh sách việc làm công khai dùng chung đúng công thức đó**.

Không tách làm hai (`scheduleScore` cho danh sách, `matchScore` cho đơn): hai con số khác nhau cho cùng một cặp (sinh viên, tin) là thứ sẽ gây nhầm ở màn hình NTD — họ thấy đơn ghi 60% trong khi sinh viên đó nhớ trang việc làm ghi 80%, và không ai giải thích được.

### Con số tổng hợp là KHOÁ SẮP XẾP, không phải lời khẳng định

Đây là quyết định **sản phẩm**, không phải kỹ thuật, và nó quyết định cả giao diện.

"60%" nói gì với sinh viên? Không gì cả — họ không biết vì sao 60, cũng không biết làm gì để nó lên. Còn *"khớp 8/20 ca, 3/5 kỹ năng"* thì **hành động được**: thiếu kỹ năng nào thì đi học, thiếu ca nào thì cân nhắc lịch.

Nên:

| Dùng để | Hiện gì |
| --- | --- |
| Sắp xếp, lọc ở tầng SQL | Cột `matchScore` có index — **không hiện thẳng ra** |
| Nói cho người dùng | Chip breakdown: "8/20 ca · 3/5 kỹ năng" |

`BadgePhuHop` hiện tại đang hiện phần trăm **theo lịch** — đúng vì lúc đó điểm chỉ có một thành phần. Khi hợp nhất xong phải đổi sang chip breakdown, nếu không nó thành con số tổng hợp hiện thẳng, đúng cái vừa nói là không nên.

### Tách CỔNG ra khỏi ĐIỂM — hai loại logic, hai hàm riêng

Đây là điều dễ làm sai nhất, và sai thì không có biểu hiện gì.

```ts
// CỔNG — ràng buộc cứng. KHÔNG bao giờ tham gia phép trung bình.
function duNguongCa(matched: number, required: number): boolean

// ĐIỂM — trung bình có trọng số của các thành phần đo được.
function tongHopDiem(cac: Record<string, ThanhPhan>): number | null
```

**Vì sao phải tách:** trộn ràng buộc cứng vào trung bình có trọng số là **lỗi loại hình**. Tin cần tối thiểu 5 ca/tuần, sinh viên chỉ nhận nổi 1 — họ **không làm được việc đó**, chấm hết. Để 100% kỹ năng kéo điểm tổng lên 65% là nói rằng giỏi nghề bù được cho việc không có mặt lúc quán cần người. Không bù được.

Cụ thể trong code:

- Hai hàm ở hai chỗ, **không hàm nào gọi hàm kia**.
- `eligible` KHÔNG nằm trong `matchBreakdown` như một thành phần có `weight`.
- Chỗ sắp xếp gọi cả hai: `eligible` trước, `matchScore` sau — đúng như `listPublicJobs` đang làm.

### Hàm chuẩn hoá trọng số — tổng quát, chịu được nhiều thành phần thiếu cùng lúc

```ts
export interface ThanhPhan {
  /** `null` = KHÔNG TÍNH ĐƯỢC. Khác hẳn `0` (tính được, kết quả là không khớp). */
  score: number | null
  weight: number

  /**
   * Vì sao `score` là `null`. KHÔNG tham gia phép tính điểm — chỉ để đếm độ phủ
   * và nhắc đúng người. Xem mục "Độ phủ" bên dưới.
   */
  vangVi?: 'KHONG_AP_DUNG' | 'THIEU_DU_LIEU'
}

/**
 * Trung bình có trọng số, tự bỏ qua thành phần `null` và chuẩn hoá lại phần còn lại.
 *
 * Viết tổng quát chứ không xử lý từng nhánh `if`: hôm nay ba thành phần, mai
 * thêm khoảng cách địa lý và mức lương mong muốn là năm. Viết `if` cho từng tổ
 * hợp thiếu thì 5 thành phần đã là 31 nhánh, và nhánh nào sai cũng chỉ biểu
 * hiện thành một con số hơi lệch — không ai phát hiện ra.
 */
export function tongHopDiem(cac: Record<string, ThanhPhan>): number | null {
  const dungDuoc = Object.values(cac).filter((c) => c.score !== null)
  if (dungDuoc.length === 0) return null

  const tongTrongSo = dungDuoc.reduce((s, c) => s + c.weight, 0)
  if (tongTrongSo === 0) return null

  const tong = dungDuoc.reduce((s, c) => s + c.score! * c.weight, 0)
  return Math.round(tong / tongTrongSo)
}
```

Không thành phần nào đo được → `null`, **không phải 0**. Đúng nguyên tắc đã dùng xuyên suốt Sprint 3.

### `KHÔNG ÁP DỤNG` khác `THIẾU DỮ LIỆU` — cùng cho `null`, khác hẳn về ý nghĩa

Hai lý do rất khác nhau cùng dẫn tới `score: null`. Phép tính đối xử giống nhau, nhưng **giao diện và cách hiểu phải khác**, nếu không sẽ nhắc sai người.

| | KHÔNG ÁP DỤNG | THIẾU DỮ LIỆU |
| --- | --- | --- |
| Thuộc về | **TIN** — tiêu chí không tồn tại cho tin này | **SINH VIÊN** — chưa khai nên chưa đo được |
| Ví dụ | Tin không yêu cầu kỹ năng nào; tin `ONE_TIME` không có `commitmentMonths` | Sinh viên chưa khai lịch rảnh; chưa điền `availableUntil` |
| Ảnh hưởng tới ai | **Mọi ứng viên của tin đó, như nhau** | **Chỉ sinh viên đó** |
| Giao diện nói gì | Không nói gì — không có gì để nhắc | "Khai thêm X để điểm chính xác hơn" |
| Có nhắc người dùng? | Không | **Có** |

**Ví dụ 1 — không áp dụng.** Tin "Phát tờ rơi" yêu cầu 0 kỹ năng, là `ONE_TIME` nên không có cam kết:

```
skills:     score = null   (không áp dụng — tin không yêu cầu kỹ năng nào)
shifts:     score = 100, weight 0.5
commitment: score = null   (không áp dụng — ONE_TIME không có cam kết)
→ chỉ còn ca làm, chuẩn hoá 0.5/0.5 = 1.0  →  matchScore = 100
```

Không nhắc gì cả. Sinh viên đã khai đủ; chính cái tin không có tiêu chí đó.

**Ví dụ 2 — thiếu dữ liệu.** Tin đầy đủ ba tiêu chí, nhưng sinh viên chưa điền `availableUntil`:

```
skills:     score = 60,  weight 0.3
shifts:     score = 80,  weight 0.5
commitment: score = null (thiếu dữ liệu — chưa khai được làm tới bao giờ)
→ chuẩn hoá (0.3 + 0.5 = 0.8):  (60×0.3 + 80×0.5) / 0.8  =  72.5  →  73
```

Hiện kèm: *"Điểm tính trên 2/3 tiêu chí — khai thời gian làm được để chính xác hơn"*.

**Ví dụ 3 — thiếu cả hai.** Sinh viên chưa khai lịch rảnh lẫn `availableUntil`:

```
skills:     score = 60, weight 0.3
shifts:     score = null
commitment: score = null
→ chỉ còn kỹ năng, chuẩn hoá 0.3/0.3 = 1.0  →  matchScore = 60
```

Hàm tổng quát ở trên xử lý được ngay, không cần nhánh riêng.

### ⚠ Điểm thiếu thành phần KHÔNG so sánh được giữa các sinh viên

Ví dụ 3 lộ ra một chuyện phải nói rõ, vì nó thay đổi cách sắp xếp ở màn hình NTD.

Sinh viên A khai mỗi kỹ năng, khớp 60% → **60**.
Sinh viên B khai đủ ba thứ, khớp 80/70/60 → **72**.

A hiện điểm thấp hơn, nhưng nếu A cũng khai đủ thì chưa chắc. Tệ hơn: một sinh viên khai **đúng một** thứ và khớp hoàn hảo thứ đó sẽ được **100**, cao hơn mọi người khai đầy đủ.

Điểm mấu chốt: **con số phục vụ hai đối tượng khác nhau, và chỉ một trong hai là so sánh được.**

| Màn hình | Xếp hạng cái gì | Có so sánh được không |
| --- | --- | --- |
| Danh sách việc làm (sinh viên) | **Nhiều TIN, một sinh viên** | **Được** — cùng một người nên độ phủ như nhau |
| Danh sách ứng viên (NTD) | **Nhiều SINH VIÊN, một tin** | **KHÔNG** — mỗi người một độ phủ khác nhau |

Nên ở màn hình NTD (tính năng 2):

1. Sắp **`eligible` trước**, rồi mới tới điểm — như `listPublicJobs` đang làm.
2. Hiện **độ phủ** ngay cạnh điểm: *"tính trên 2/3 tiêu chí"*. Không hiện thì NTD so hai con số không so được với nhau.
3. Không bao giờ tự động loại theo điểm. Điểm là gợi ý thứ tự, quyết định là của NTD — đúng như đã chốt ở luật "cho nộp kèm cảnh báo" bên dưới.

### Độ phủ là một TRƯỜNG, và là HAI số chứ không phải một phân số

Ba mục trên đều nói "hiện độ phủ cạnh điểm" nhưng không nói nó nằm ở đâu. Để mỗi nơi tiêu thụ tự đếm lại từ `matchBreakdown` là cách hai màn hình đếm ra hai kết quả khác nhau mà không ai đối chiếu. **Nó phải là trường lưu sẵn, đóng băng cùng điểm.**

Cái bẫy nằm ở mẫu số. Viết `coverage = 1/3` với mẫu số cứng bằng 3 sẽ **phá chính ví dụ 1**: tin "Phát tờ rơi" không yêu cầu kỹ năng và không có cam kết, sinh viên khai đủ mọi thứ tin đó cần và được 100 — nhưng phân số kia ghi *"tính trên 1/3 tiêu chí"*, bêu một hồ sơ **hoàn chỉnh** là thiếu, rồi nhắc họ đi khai thứ chẳng ai hỏi.

Lý do rất thẳng: **một phân số gộp hai nguyên nhân khác hẳn nhau vào cùng một con số.** `KHÔNG ÁP DỤNG` thuộc về tin, `THIẾU DỮ LIỆU` thuộc về sinh viên — chính bảng ở trên đã tách hai thứ đó ra. Độ phủ phải giữ nguyên phép tách:

```ts
export interface DoPhu {
  /** Số tiêu chí TIN NÀY có yêu cầu. Loại `KHONG_AP_DUNG` khỏi mẫu số. */
  apDung: number
  /** Số tiêu chí đo được cho SINH VIÊN NÀY. */
  doDuoc: number
}

/** Hàm thứ ba, và cũng không gọi hai hàm kia. */
export function tinhDoPhu(cac: Record<string, ThanhPhan>): DoPhu {
  const tp = Object.values(cac)
  return {
    apDung: tp.filter((c) => c.vangVi !== 'KHONG_AP_DUNG').length,
    doDuoc: tp.filter((c) => c.score !== null).length,
  }
}
```

Ba ví dụ ở trên ra đúng thứ chúng cần:

| | `apDung` | `doDuoc` | Điểm | Giao diện nói gì |
| --- | --- | --- | --- | --- |
| Ví dụ 1 — tin không có kỹ năng lẫn cam kết | 1 | 1 | 100 | **Không nói gì** — đã đủ |
| Ví dụ 2 — thiếu `availableUntil` | 3 | 2 | 73 | "Tính trên 2/3 tiêu chí — khai thêm…" |
| Ví dụ 3 — thiếu cả lịch lẫn cam kết | 3 | 1 | 100 | "Tính trên 1/3 tiêu chí — khai thêm…" |

**Luật hiển thị chỉ có một dòng: `apDung === doDuoc` thì im lặng, khác thì hiện.** Không cần biết vì sao lệch — mẫu số đã tự loại phần không thuộc lỗi sinh viên.

Ví dụ 1 và ví dụ 3 cùng cho 100 điểm nhưng **không phải cùng một chuyện**, và giờ dữ liệu nói ra được điều đó: một cái `1/1`, một cái `1/3`.

**Ở màn hình NTD thì `apDung` là hằng số** — mọi ứng viên của cùng một tin chia chung mẫu số. Nên chênh lệch `doDuoc` giữa hai người là **thuần tuý ai khai đầy đủ hơn**, đúng con số cần đặt cạnh điểm để NTD hiểu vì sao người khai ít lại điểm cao.

**Độ phủ KHÔNG tham gia xếp hạng.** Vẫn sắp `eligible` → `matchScore`, độ phủ chỉ hiển thị. Nhân điểm với `doDuoc/apDung` để "phạt hồ sơ khai thiếu" nghe hợp lý nhưng là bịa ra một chiều chấm điểm thứ hai chưa có dữ liệu nào đỡ — và nó tự động loại ứng viên thay NTD, đúng thứ đã bác ở luật "cho nộp kèm cảnh báo". Đưa con số ra, để người quyết định.

### Trọng số

```ts
export const TRONG_SO_MAC_DINH = { shifts: 0.5, skills: 0.3, commitment: 0.2 } as const
```

**Vì sao ca làm nặng nhất, không phải 40/40/20 chia đều với kỹ năng:** trọng số phải nói đúng luận điểm của sản phẩm. UniWork tồn tại vì lọc theo lịch rảnh — thứ các trang tuyển dụng phổ thông không có. Còn kỹ năng cho việc part-time (phục vụ, thu ngân, phát tờ rơi) phần lớn **đào tạo được**; lịch học thì không. Để hai thứ ngang nhau là nói rằng chúng quan trọng như nhau, mâu thuẫn với chính lý do sản phẩm ra đời.

Cần nói thẳng: **chưa có dữ liệu nào chứng minh 0.5/0.3/0.2 đúng hơn 0.4/0.4/0.2.** Không con số nào đúng cho tới khi có hành vi người dùng thật. Tiêu chí chọn ở đây không phải "đúng" mà là "nói đúng thứ sản phẩm tự nhận về mình" — và đó là tiêu chí tốt nhất có được lúc chưa có dữ liệu.

`matchAlgoVersion` tồn tại chính để đổi bộ số này sau mà không làm hỏng ý nghĩa của những hàng đã ghi.

### Ba thành phần tính thế nào

```ts
// Ca làm — đã có sẵn từ Sprint 3, giữ nguyên công thức
shifts = matchedShifts / totalJobShifts × 100

// Kỹ năng — tin không yêu cầu kỹ năng nào thì KHÔNG ÁP DỤNG (null), không phải 100
skills = matchedSkills / requiredSkills × 100

// Cam kết — tính theo phần, không nhị phân
commitment = min(100, thangLamDuoc / job.commitmentMonths × 100)
```

**`thangLamDuoc` lấy từ đâu:** `StudentProfile.availableUntil` trừ `job.startDate` (hoặc `NOW()` nếu tin không có `startDate`). Cột này **đã tồn tại trong schema từ Sprint 0 nhưng chưa file nguồn nào dùng** — Sprint 4 là lần đầu nó có việc. Cần thêm ô nhập ở trang hồ sơ sinh viên.

**Vì sao tính theo phần chứ không nhị phân:** sinh viên cam kết được 2/3 tháng vẫn đáng để NTD cân nhắc — nhiều quán chấp nhận. Trả 0 tuyệt đối là để hệ thống từ chối thay nhà tuyển dụng, đúng thứ đã bác ở luật ứng tuyển.

**Chưa khai `availableUntil` → `null`, KHÔNG phải 0.** Phần lớn sinh viên sẽ để trống vì nó vốn là cột chết. Cho 0 là khẳng định "đã đo, bạn không cam kết được gì" về thứ chưa hỏi bao giờ.

### Đóng băng gì vào `Application`

```prisma
model Application {
  // ...
  /// 0–100, tổng hợp cuối. Có index để sắp xếp và lọc ở tầng SQL.
  matchScore Int?

  /// Chi tiết từng thành phần tại thời điểm nộp. Xem `MatchBreakdown`.
  matchBreakdown Json?

  /// "v1" — biết hàng này tính theo công thức nào.
  matchAlgoVersion String?
}
```

Cấu trúc `matchBreakdown`:

```json
{
  "shifts":     { "matched": 8, "total": 20, "required": 5, "score": 40, "weight": 0.5 },
  "skills":     { "matched": 3, "total": 5,  "score": 60, "weight": 0.3 },
  "commitment": { "score": null, "weight": 0.2, "vangVi": "KHONG_AP_DUNG" },
  "coverage":   { "apDung": 2, "doDuoc": 2 },
  "eligible": true,
  "finalScore": 48
}
```

**`required: 5` trong nhánh `shifts` là trường quan trọng nhất ở đây, và lý do rất cụ thể.**

`minShiftsPerWeek` **không** nằm trong `TRUONG_BAT_DUYET_LAI` — danh sách trường bắt duyệt lại chỉ có `title, description, city, district, quantity, salaryNegotiable, salaryMin, salaryMax, salaryUnit`. Nghĩa là nhà tuyển dụng **sửa ngưỡng tối thiểu lúc nào cũng được, không cần admin duyệt**.

Nếu không đóng băng: hôm nay sinh viên nộp đơn với 8/20 ca (ngưỡng 5 → đủ điều kiện), tuần sau NTD nâng ngưỡng lên 10 — tính lại thì đơn cũ thành "không đủ", **dù lúc nộp nó đủ**. Lịch sử bị viết lại sau lưng, và không ai nhận ra.

Đóng băng `required` thì `eligible` suy ra được từ `matched >= required` và **ổn định vĩnh viễn**. Đó là lý do không cần thêm cột `eligible` riêng — nhưng vẫn ghi `eligible` vào JSON cho dễ đọc.

**Vì sao JSON chứ không phải mỗi thành phần một cột:** thêm tiêu chí mới sau này (khoảng cách địa lý, mức lương mong muốn) không cần migration, chỉ đổi mã tính toán. Đổi lại JSON truy vấn chậm hơn cột số có index — nên `matchScore` vẫn là cột riêng để sắp xếp và lọc ở tầng SQL. Hai thứ phục vụ hai việc khác nhau.

**`matchAlgoVersion` là thứ làm JSON an toàn.** Không có nó, đổi công thức là làm hỏng ý nghĩa mọi hàng cũ mà không cách nào biết hàng nào tính theo đời nào. Có nó thì **v1 được phép thiếu**: ship `v1` với ba thành phần này, `v2` thêm khoảng cách, mỗi hàng tự khai mình thuộc đời nào.

### Hướng V2 — chưa làm, và chưa cần chuẩn bị gì

Ý tưởng: cho sinh viên tự đặt độ ưu tiên (kéo thanh trượt "ưu tiên lịch rảnh" ↔ "ưu tiên lương cao"), trọng số theo từng người thay vì cố định toàn hệ thống.

**Thiết kế trên đã sẵn sàng cho việc đó**, không cần thêm gì: `matchBreakdown` lưu `weight` của **từng** thành phần, nên điểm đóng băng vẫn giải thích được kể cả khi trọng số khác nhau giữa hai người.

**Cố ý KHÔNG tạo bảng `UserPreference` rỗng từ bây giờ**, theo đúng nguyên tắc đã ghi trong [brd-uoc-luong.md](brd-uoc-luong.md):

> *"bảng nào chưa có luồng nghiệp vụ ghi vào thì chưa tạo. Migration thêm bảng thì rẻ, còn bảng rỗng nằm trong schema nhiều tháng thì tới lúc dùng gần như chắc chắn sai hình dạng."*

Nguyên tắc đó đã đúng một lần: `notifications` hoãn từ Sprint 0, tới Sprint 4 mới tạo — và tạo với hình dạng biết chắc là đúng vì đã có luồng thật cần nó.

**Test của riêng phần này** (viết được ngay, không cần database): `tongHopDiem` với đủ 3 thành phần, thiếu 1, thiếu 2, thiếu cả 3 → `null`, tổng trọng số bằng 0 → `null`; phân biệt "không áp dụng" với "thiếu dữ liệu" cho ra cùng con số nhưng cờ nhắc nhở khác nhau; `duNguongCa` với `required` lớn hơn tổng số ca của tin; và ca **"100% kỹ năng nhưng không đủ ca"** — điểm cao mà `eligible = false`.

Riêng `tinhDoPhu`: ví dụ 1 ra `1/1` (**không** phải `1/3`), ví dụ 2 ra `2/3`, ví dụ 3 ra `1/3`; và hai hồ sơ cùng 100 điểm nhưng `1/1` với `1/3` phải phân biệt được từ dữ liệu, không phải từ cách hiển thị.

---

## Luật nghiệp vụ đã chốt

### Cho nộp đơn dù không đủ điều kiện — chỉ cảnh báo

Sinh viên chỉ nhận nổi 1/5 ca của tin cần tối thiểu 3 **vẫn nộp được**, kèm cảnh báo rõ trước khi bấm gửi.

Lý do: lịch rảnh là **bản khai có thể đã cũ** — sinh viên có thể vừa đổi thời khoá biểu mà chưa cập nhật. Chặn cứng là để hệ thống từ chối thay nhà tuyển dụng, trong khi NTD mới là người biết mình linh động tới đâu.

Hệ quả kỹ thuật: **"có đơn" KHÔNG hàm ý "đủ điều kiện"** — nên `eligible` phải được đóng băng, không suy ra được từ sự tồn tại của đơn.

### Chưa xác thực email thì không ứng tuyển được

Theo BRD: *"Đăng nhập được nhưng chặn ứng tuyển và đăng tin"*. Hiện **chưa endpoint nào kiểm `emailVerifiedAt`** — Sprint 4 là lần đầu áp luật này.

Áp cho cả hai phía:

| Vai | Chặn gì | Trạng thái |
| --- | --- | --- |
| Sinh viên chưa xác thực email | Ứng tuyển | **Mới**, nằm trong tính năng 1 |
| NTD chưa xác thực email | Gửi tin đi duyệt | **Mới**, sửa endpoint có sẵn của Sprint 2 |
| NTD chưa được admin duyệt giấy tờ (`verifiedAt`) | Gửi tin đi duyệt | Đã có từ T72 |

Trả `FORBIDDEN` kèm câu chỉ đường tới trang xác thực, không phải một câu 403 trống.

> Dòng giữa là việc **duy nhất** của sprint này đụng vào mã Sprint 2. Nó không thuộc tính năng nào ở trên — làm kèm lớp nền, một dòng `if` trong controller gửi tin đi duyệt.

### Che thông tin liên hệ

Số điện thoại và email sinh viên **chỉ mở từ `SHORTLISTED` trở lên**. Ở `PENDING` và `VIEWED`, NTD chỉ thấy hồ sơ, kỹ năng và CV.

> *"Không có quy tắc này thì app thành chỗ thu thập số điện thoại sinh viên — đúng cái vấn nạn mà dự án muốn giải quyết."* — README mục 5

Chi tiết kỹ thuật nằm trong tính năng 2, vì nó là **một phần của mệnh đề `select`**, không phải một bước làm sau.

---

## Tính năng 1 — Sinh viên nộp đơn

Bảng `Application` có từ Sprint 0, **chưa endpoint nào chạm tới**. Nút "Ứng tuyển ngay" ở [`JobDetail.tsx:276`](../apps/web/src/pages/JobDetail.tsx) đang `disabled` kèm dòng "Có ở Sprint 4" — đây là sprint gỡ nó.

**Endpoint** — đặt dưới `/toi`, **không** đặt dưới `/viec-lam`:

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| `POST` | `/api/toi/don-ung-tuyen` | Nộp đơn. `jobId` nằm trong body, không nằm trên đường dẫn |

**Vì sao không phải `POST /api/viec-lam/:id/ung-tuyen`** — trông tự nhiên hơn nhưng sai chỗ. `routes.ts` ghi rõ: `/viec-lam` là **endpoint duy nhất trong dự án không cần đăng nhập ngoài `/health`**. Nhét một route bắt đăng nhập vào đó là phá đúng tính chất mà dòng chú thích kia đang bảo vệ, và người đọc sau sẽ mất thời gian tự hỏi nhánh nào cần token nhánh nào không.

> ⚠ **Bẫy thứ tự mount, đã dẫm một lần ở Sprint 3.** `profileRoutes` gắn `requireAuth` cho **toàn bộ** nhánh `/toi`, nên `/toi/don-ung-tuyen` phải khai **trước** `/toi` trong `routes.ts` — y hệt lý do `/toi/tin-da-luu` đang nằm trên. Khai sau thì vẫn chạy đúng nhưng mỗi request xác thực hai lần.

**Module mới `modules/applications/`**, không nhét vào `modules/jobs/`. Khác với `SavedJob` ở Sprint 3 (nhét chung vì trả về `PublicJobSummary`, cùng bảng `Job`): `Application` có bảng riêng, luồng trạng thái riêng, và ba tính năng khác cùng dùng. Để chung `jobs.service.ts` thì file đó vượt 56KB hiện tại lên gần gấp rưỡi.

**Mã trả về:**

| Mã | Khi nào |
| --- | --- |
| `201` | Tạo đơn xong, trả về đơn kèm `matchScore` + `matchBreakdown` |
| `403` | Chưa xác thực email — câu trả lời phải **chỉ đường** tới trang xác thực |
| `404` | Tin không tồn tại |
| `409` | Đã nộp đơn cho tin này rồi |
| `409` | Tin không còn `OPEN` |
| `422` | Thư ngỏ quá dài / `cvUrl` không hợp lệ |

Hai ca `409` khác nhau nhưng `AppError` chỉ có một mã `CONFLICT`. **Không thêm hệ mã lỗi mới cho việc này** — FE hiện thẳng `message`, không phân nhánh theo mã. Cần phân nhánh thì mới tính tới, chưa cần thì đừng dựng.

**Ghi trong một transaction:** tạo `Application` + ghi `ApplicationEvent` đầu tiên (`status: PENDING`) + tạo `Notification` cho NTD. Tách ra thì có khoảnh khắc đơn tồn tại mà timeline khuyết bước đầu.

**Điểm phù hợp đóng băng tại đây** — tính một lần lúc nộp, ghi `matchScore` + `matchBreakdown` + `matchAlgoVersion`, **không bao giờ tính lại**. Lý do đầy đủ ở mục "Đóng băng gì vào `Application`".

**FE:** gỡ `disabled` ở `JobDetail`, mở modal gồm ô thư ngỏ và chọn CV (lấy từ hồ sơ, đã có `CvUpload`). Nếu `eligible === false` thì hiện cảnh báo **trong modal, trước nút gửi** — không chặn, đúng luật "cho nộp kèm cảnh báo". Nộp xong đổi nút thành "Đã nộp đơn" và trỏ sang trang "Đơn của tôi". Với khách và NTD thì **ẩn hẳn** nút, không hiện disabled — cùng lý do đã áp cho badge điểm phù hợp ở Sprint 3: disabled nghĩa là "chưa xong", ẩn nghĩa là "không áp dụng cho bạn".

**Test:** nộp lần hai cùng một tin → 409 (ràng buộc database chặn, không phải chỉ kiểm ở service); nộp vào tin `CLOSED`/`DRAFT`/`PENDING` → 409/404; chưa xác thực email → 403; nộp khi `eligible = false` → **thành công**, và `matchBreakdown.eligible === false`; `ApplicationEvent` đầu tiên được ghi cùng lúc; đổi `minShiftsPerWeek` của tin sau khi nộp → đơn cũ **giữ nguyên** `matchScore` và `required`.

**Xong nghĩa là:**

- [ ] Nộp hai lần bị chặn ở tầng **database**, chứng minh bằng test chạy hai `POST` song song
- [ ] `matchScore`, `matchBreakdown`, `matchAlgoVersion` đều có giá trị trong hàng vừa tạo
- [ ] `ApplicationEvent` `PENDING` tồn tại và cùng `createdAt` với đơn
- [ ] Sửa tin sau khi nộp không làm đổi con số nào của đơn cũ
- [ ] Khách mở trang chi tiết tin **không thấy** nút ứng tuyển

---

## Tính năng 2 — NTD xem ứng viên (kèm che thông tin liên hệ)

[`Applicants.tsx`](../apps/web/src/pages/Applicants.tsx) đã dựng xong giao diện 156 dòng nhưng đang đọc `@/data/mock` — **file mock cuối cùng của dự án**. Tính năng này nối nó vào API thật rồi xoá file đó.

**Endpoint:**

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| `GET` | `/api/ntd/tin-tuyen-dung/:id/ung-vien` | Danh sách ứng viên của một tin, có `?status=` và `?sort=` |

Mount vào `employerJobRoutes` đã có — cùng tiền tố, cùng luật "tin phải thuộc NTD đang đăng nhập".

### Che thông tin liên hệ không phải một bước làm sau

Bản kế hoạch đầu tách nó thành tính năng riêng, xếp sau tính năng này với ghi chú "làm trước khi deploy". Đó là cách nó bị quên: có một khoảng thời gian — dài ngắn tuỳ may rủi — mà endpoint tồn tại và đang **trả số điện thoại thật của sinh viên** cho mọi NTD.

Nó là **một phần của mệnh đề `select`**, viết cùng lúc với endpoint hoặc không viết:

```ts
const CHON_UNG_VIEN = (moLienHe: boolean) => ({
  id: true,
  status: true,
  matchScore: true,
  matchBreakdown: true,
  createdAt: true,
  studentProfile: {
    select: {
      fullName: true,
      school: true,
      skills: { select: { skill: { select: { name: true } } } },
      ...(moLienHe ? { phone: true, user: { select: { email: true } } } : {}),
    },
  },
})
```

**Lọc ở tầng `select`, không lọc ở giao diện.** Trả về rồi ẩn bằng CSS thì mở DevTools là thấy — đúng loại lỗi mà `CHON_JOB_PUBLIC` đã tránh ở Sprint 2 bằng cách khai `select` tường minh thay vì lấy cả bản ghi.

`moLienHe` bật từ `SHORTLISTED` trở lên (`SHORTLISTED`, `ACCEPTED`). Ở `PENDING`/`VIEWED`/`REJECTED`/`WITHDRAWN` thì tắt.

### Đơn đã rút vẫn nằm trong danh sách

Sinh viên rút đơn thì hàng `Application` **vẫn còn** (xem tính năng 4), nhưng còn phải quyết định NTD **thấy** nó thế nào — không quyết thì mỗi người viết một kiểu:

- Hiện trong danh sách với nhãn **"Đã rút"**, không lặng lẽ mất khỏi tab `ALL`. Bảng `ApplicationEvent` dựng ra để không ai gặp cảnh "timeline khuyết một bước không giải thích được"; để ứng viên biến mất khỏi màn hình NTD là đúng cảnh đó ở mức to hơn.
- **Không** nằm trong tab đang xử lý (`PENDING`/`VIEWED`/`SHORTLISTED`) — NTD không cần hành động gì với đơn đã rút.
- Thông tin liên hệ **đóng lại** kể cả khi đơn từng ở `SHORTLISTED`. NTD đã nhìn thấy số điện thoại rồi, đóng lại không lấy được ký ức đó về — nhưng hệ thống thì không có lý do gì tiếp tục phát nó ra sau khi sinh viên đã rút.

### Sắp xếp

`eligible` trước, `matchScore` sau — cùng hàm `hang()` mà `listPublicJobs` đang dùng. Và **hiện độ phủ cạnh điểm** (*"tính trên 2/3 tiêu chí"*), vì điểm giữa các sinh viên khác độ phủ thì không so được với nhau; lý do đầy đủ ở mục cảnh báo bên trên.

Suy `eligible` từ `matchBreakdown.shifts` đã đóng băng, **không** tính lại từ `minShiftsPerWeek` hiện tại của tin.

**FE:** thay `APPLICANTS` bằng `useQuery`, giữ nguyên tabs lọc theo trạng thái đã có. Ô số điện thoại/email hiện dạng khoá kèm câu *"Mở khi bạn đưa ứng viên vào vòng trong"* — hiện chỗ khoá chứ không giấu hẳn ô, để NTD biết thông tin đó tồn tại và biết cách mở. Xoá `data/mock.ts`.

**Test:** NTD A gọi tin của NTD B → **403** (không phải 404, không phải mảng rỗng — ba thứ đó nói ba chuyện khác nhau); tin không tồn tại → 404; response ở `PENDING`/`VIEWED` **không chứa** `phone` và `email` — assert trên JSON, không assert trên giao diện; response ở `SHORTLISTED` **có**; sắp xếp đẩy `eligible = false` xuống dưới dù điểm cao hơn.

**Xong nghĩa là:**

- [ ] `curl` với token NTD ở trạng thái `PENDING` — grep `phone` trong response **không ra gì**
- [ ] Test ownership có đủ ba ca: tin của mình, tin của NTD khác, tin không tồn tại
- [ ] `data/mock.ts` **đã xoá**, `grep -r "data/mock" apps/web/src` không còn kết quả
- [ ] Ứng viên `eligible = false` nằm dưới ứng viên `eligible = true` kể cả khi điểm cao hơn
- [ ] Độ phủ hiện cạnh điểm, không hiện điểm trần trụi

---

## Tính năng 3 — Đổi trạng thái + lịch sử đơn

**Endpoint:**

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| `PUT` | `/api/ntd/tin-tuyen-dung/:id/ung-vien/:applicationId/trang-thai` | Đổi trạng thái, kèm `note` tuỳ chọn |

### Bảng `ApplicationEvent`

`Application.status` chỉ cho biết trạng thái **hiện tại**. Muốn vẽ timeline *"Đã nộp → NTD đã xem → Kết quả"* kèm ngày ở từng bước thì phải ghi lại mỗi lần chuyển.

```prisma
model ApplicationEvent {
  id String @id @default(cuid())

  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  /// Trạng thái chuyển SANG. Hàng đầu tiên là PENDING lúc nộp đơn.
  status ApplicationStatus

  /// Ai gây ra thay đổi. Rút đơn là sinh viên, còn lại là NTD.
  actorUserId String?

  /// Lý do từ chối, ghi chú nội bộ của NTD.
  note String?

  createdAt DateTime @default(now())

  @@index([applicationId, createdAt])
  @@map("application_events")
}
```

Ghi trong **cùng transaction** với việc đổi `Application.status` và cập nhật `statusChangedAt`. Tách ra thì có khoảnh khắc trạng thái đã đổi mà lịch sử chưa ghi, và timeline khuyết một bước không ai giải thích được.

Migration bảng này nằm ở **lớp nền**, không nằm ở đây — vì tính năng 1 cũng ghi vào nó.

### Phạm vi: UniWork KHÔNG phải một ATS

Chốt 2026-08-29 sau khi thử trên trình duyệt và đối chiếu JobsGO.

Câu hỏi: *"nhận vào làm là phải cập nhật trên app hả? tôi tưởng app này là xem xét hồ sơ rồi từ chối CV hay chấp nhận CV thôi chứ."*

Đúng. Luồng chốt lại:

```
Sinh viên nộp → NTD đọc hồ sơ → mời phỏng vấn / từ chối → MỞ LIÊN HỆ → NTD gọi
                                                            └── ứng dụng dừng ở đây
```

**Vì sao bỏ `ACCEPTED`, kể cả dưới dạng "ghi sổ tuỳ tâm":** nó chỉ đúng khi nhà tuyển dụng nhớ quay lại bấm sau một sự kiện xảy ra **ngoài** ứng dụng. Phần lớn sẽ không. Một con số "đã nhận" đúng chừng một phần ba **tệ hơn không có**, vì người đọc coi nó là sự thật.

Đây đúng nguyên tắc `null ≠ 0` đã dùng xuyên suốt dự án, chỉ nâng lên tầng hệ thống: **đừng khẳng định thứ mình không đo được.** Cột `matchScore` không dám nói "0% hợp" khi chưa biết lịch rảnh; hệ thống cũng không nên nói "đã nhận 5 người" khi nó không hề chứng kiến việc đó.

**Nhưng `SHORTLISTED → REJECTED` thì GIỮ.** Bất đối xứng này là điểm quan trọng nhất của cả mục:

| Kết quả sau buổi gặp | Sinh viên có tự biết không? | Ứng dụng có cần ghi không? |
| --- | --- | --- |
| Được nhận | **Có** — họ đi làm buổi đầu | Không |
| Bị từ chối | **Không** — rất nhiều nơi im lặng luôn | **Có** |

Sinh viên chờ mãi một câu trả lời không bao giờ tới chính là vấn nạn dự án này sinh ra để giải. Nên đường ghi lại lời **từ chối** phải luôn mở, còn đường ghi lời **đồng ý** thì không cần.

**Không migration.** Giá trị `ACCEPTED` vẫn nằm trong enum — xoá một giá trị enum của Postgres là migration đụng mọi hàng để đổi lấy đúng một cái tên không ai gọi tới. Chỉ gỡ nó khỏi `CHUYEN_TRANG_THAI_HOP_LE.SHORTLISTED`; những hàng `ACCEPTED` có sẵn vẫn hiển thị bình thường.

Hệ quả nhỏ: `TRANG_THAI_DANG_XU_LY` bỏ `SHORTLISTED` — hồ sơ đã mở liên hệ thì UniWork hết việc với nó, không còn nằm trong "đang chờ bạn xử lý".

### `SHORTLISTED` nghĩa là "đã mời phỏng vấn"

Chốt 2026-08-29, sau khi kiểm thử trên trình duyệt và đối chiếu nghiệp vụ thật.

**Câu hỏi khơi ra:** giữa "Vào vòng trong" và "Đã nhận" không có thao tác nào ngoài việc NTD bấm nút. Vậy hai trạng thái đó khác nhau chỗ nào?

**Tra được gì:**

| Nguồn | Các bước |
| --- | --- |
| TopCV (nền tảng lớn nhất VN) | đã xem xét → **đã phỏng vấn** → đã từ chối / đã tuyển dụng |
| ATS quốc tế (Greenhouse, SAP) | Applied → In Review → **Interviewing** → Offer → Hired |
| Part-time VN (quán cà phê) | sàng lọc CV → **gọi hẹn** → một buổi gặp → nhận |

Cả ba đều có bước **PHỎNG VẤN** giữa "thích hồ sơ này" và "nhận người này". Không nguồn nào dùng "vào vòng trong" làm một trạng thái.

**Nhưng mô hình không sai — chỉ đặt tên sai.** `SHORTLISTED` chính là bước đó, vì nó là mốc **mở khoá số điện thoại**:

```
SHORTLISTED → NTD có số → gọi hẹn gặp (NGOÀI app) → ACCEPTED / REJECTED
```

Thao tác vẫn có, chỉ là nó xảy ra ngoài ứng dụng. Cái sai là giao diện không nói ra: bấm xong thì màn hình im lặng, không ai bảo nhà tuyển dụng rằng tới lượt họ gọi.

**Đã làm — sửa ngôn ngữ, không sửa bảng trạng thái:**

| Chỗ | Trước | Sau |
| --- | --- | --- |
| Huy hiệu trạng thái | "Vào vòng trong" | **"Đã mời phỏng vấn"** |
| Nút bấm | "Vào vòng trong" | **"Mời phỏng vấn"** |
| Sau khi bấm | *(không gì)* | *"Đã mở số điện thoại và email — gọi cho ứng viên để hẹn buổi gặp."* |
| Trang chi tiết tin | "…khi hồ sơ vào vòng trong" | "…khi họ mời bạn phỏng vấn" |

Tách `APPLICATION_ACTION_LABELS` khỏi `APPLICATION_STATUS_LABELS`: nút là **mệnh lệnh**, huy hiệu là **sự thật hiện tại**. Dùng chung một bảng thì hoặc nút đọc như lời kể, hoặc huy hiệu đọc như mệnh lệnh.

**Vì sao KHÔNG thêm trạng thái `INTERVIEW` riêng** (phương án đúng chuẩn TopCV hơn): với việc part-time chỉ có **một** buổi gặp, nên "mời phỏng vấn" và "đã phỏng vấn" gần như trùng nhau — thêm một cú bấm mà không thêm thông tin nào. Đổi lại là migration, đổi enum, đổi bảng chuyển, sửa test, ở tuần 7/8. Thứ hỏng là nhãn chứ không phải mô hình, nên sửa nhãn.

Giá trị enum trong database giữ nguyên `SHORTLISTED`: đổi tên enum trong Postgres là một migration đổi mọi hàng cũ để đúng được đúng một cái tên. Tên và nghĩa lệch nhau thì ghi chú thẳng vào `schema.prisma` và `domain.ts`.

**Hệ quả cố ý cần giữ:** không có đường `VIEWED → ACCEPTED`. **Không nhận được người mà mình chưa từng liên hệ** — chưa qua `SHORTLISTED` thì NTD còn chưa có số để báo tin.

### Chuyển trạng thái nào là hợp lệ

Cần chốt trước khi code, nếu không mỗi người hiểu một kiểu:

| Từ | Được chuyển sang |
| --- | --- |
| `PENDING` | `VIEWED`, `SHORTLISTED`, `REJECTED` |
| `VIEWED` | `SHORTLISTED`, `REJECTED` |
| `SHORTLISTED` | `ACCEPTED`, `REJECTED` |
| `ACCEPTED` | — (cuối) |
| `REJECTED` | — (cuối) |
| `WITHDRAWN` | — (cuối, và chỉ sinh viên đặt được) |

**NTD không đặt được `WITHDRAWN`, sinh viên không đặt được gì khác ngoài nó.** Kiểm ở service; chuyển sai trả `409` kèm câu nói rõ đang ở trạng thái nào.

**Không lùi trạng thái.** Từ `REJECTED` về `PENDING` là viết lại lịch sử, và sinh viên đã nhận thông báo từ chối rồi.

**FE:** nút đổi trạng thái trong `Applicants.tsx`, hiện đúng các bước hợp lệ từ trạng thái hiện tại (không hiện hết rồi báo lỗi khi bấm). Ô `note` bắt buộc khi `REJECTED` — không bắt buộc thì sinh viên nhận một câu từ chối trống rỗng.

**Test:** mỗi chuyển hợp lệ trong bảng trên; ít nhất ba chuyển **không** hợp lệ (`REJECTED → PENDING`, `ACCEPTED → REJECTED`, NTD đặt `WITHDRAWN`); NTD B đổi đơn của tin NTD A → 403; sau khi đổi, `ApplicationEvent` có đúng một hàng mới và `statusChangedAt` khớp `createdAt` của hàng đó.

**Xong nghĩa là:**

- [ ] Bảng chuyển trạng thái ở trên có test cho **cả ô hợp lệ lẫn ô không hợp lệ**
- [ ] Đổi trạng thái và ghi `ApplicationEvent` trong **một** transaction — chứng minh bằng test làm transaction lỗi giữa chừng, kiểm cả hai đều không ghi
- [ ] FE không hiện nút cho bước không hợp lệ
- [ ] `REJECTED` không gửi đi được nếu `note` trống

---

## Tính năng 4 — "Đơn của tôi"

Trang **chưa tồn tại**, không sửa file nào của ai. Độc lập nhất trong năm tính năng.

**Endpoint** — cùng nhánh `/toi/don-ung-tuyen` mà tính năng 1 đã mở:

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| `GET` | `/api/toi/don-ung-tuyen` | Danh sách đơn của chính mình, kèm dữ liệu tin (dùng lại `CHON_JOB_PUBLIC`) |
| `GET` | `/api/toi/don-ung-tuyen/:id` | Chi tiết một đơn + timeline từ `ApplicationEvent` |
| `DELETE` | `/api/toi/don-ung-tuyen/:id` | Rút đơn → `WITHDRAWN` |

**Rút đơn KHÔNG xoá hàng.** `DELETE` ở đây chỉ đặt `status = WITHDRAWN` và ghi một `ApplicationEvent`. Xoá cứng thì NTD đang xem danh sách ứng viên thấy một người biến mất không dấu vết, và `@@unique([jobId, studentProfileId])` sẽ cho phép nộp lại — thành ra rút rồi nộp lại vòng vòng.

**Chỉ rút được khi đơn chưa kết thúc** (`PENDING`, `VIEWED`, `SHORTLISTED`). Đơn `ACCEPTED` mà rút thì đó là chuyện phải nói với NTD, không phải một nút bấm — trả `409`.

**Timeline dựng từ `ApplicationEvent`, không dựng từ `status` hiện tại.** Đó là lý do bảng kia tồn tại; suy ngược timeline từ một trạng thái là bịa ra ngày tháng.

**FE:** trang mới `/don-ung-tuyen` trong menu sinh viên, mỗi đơn một thẻ gồm tin, trạng thái, timeline dọc. Hiện lại `matchBreakdown` **đã đóng băng** (không tính lại theo lịch rảnh hiện tại) — nếu lịch rảnh đã đổi từ lúc nộp thì ghi chú rõ *"tính theo lịch rảnh lúc bạn nộp đơn"*, nếu không sinh viên sẽ tưởng hệ thống tính sai.

**Test:** sinh viên A không thấy/rút được đơn của sinh viên B → 403; rút đơn `ACCEPTED` → 409; rút đơn xong hàng **vẫn còn** với `status = WITHDRAWN`; timeline trả về đúng thứ tự thời gian; đổi lịch rảnh sau khi nộp → `matchBreakdown` của đơn cũ không đổi.

**Xong nghĩa là:**

- [ ] `DELETE` không xoá hàng nào khỏi bảng — kiểm bằng đếm số hàng trước/sau
- [ ] Ownership có test cho cả `GET` chi tiết lẫn `DELETE`
- [ ] Timeline lấy từ `ApplicationEvent`, không suy từ `status`
- [ ] Trang hiện đúng ghi chú "tính theo lịch rảnh lúc nộp" khi lịch đã đổi

---

## Tính năng 5 — Thông báo

Làm sau cùng vì nó **gọi vào** tính năng 1 và 3. Làm trước thì phải quay lại sửa chỗ nối hai lần.

### Bảng `Notification`

```prisma
model Notification {
  id String @id @default(cuid())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  type  NotificationType
  title String
  body  String

  /// Đường dẫn bấm vào. Ví dụ /don-ung-tuyen hoặc /ntd/ung-vien?job=...
  link String?

  readAt DateTime?

  createdAt DateTime @default(now())

  /// Truy vấn xương sống: đếm chưa đọc của một người, sắp mới nhất trước.
  @@index([userId, readAt, createdAt])
  @@map("notifications")
}
```

**Endpoint:**

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| `GET` | `/api/toi/thong-bao` | Danh sách + số chưa đọc |
| `PUT` | `/api/toi/thong-bao/:id/da-doc` | Đánh dấu một cái đã đọc |
| `PUT` | `/api/toi/thong-bao/da-doc-het` | Đánh dấu tất cả |

### Giữ chuông in-app, không cắt

Bắt người dùng mở Gmail để biết đơn được duyệt là trải nghiệm kém hơn hẳn thấy ngay trong app. Email vẫn gửi song song — **hai kênh phục vụ hai lúc khác nhau**: chuông cho người đang mở app, email cho người đã đóng tab.

**Cách cập nhật chuông:** polling qua TanStack Query, **không** dùng WebSocket. Render free ngủ sau 15 phút và cắt kết nối liên tục — README đã ghi lý do này từ đầu.

```ts
useQuery({
  queryKey: ['thong-bao'],
  queryFn: layThongBao,
  refetchInterval: 60_000,
  refetchIntervalInBackground: false, // mặc định, nhưng khai rõ vì đây là dòng quan trọng nhất
})
```

**Chốt 60 giây, và `refetchIntervalInBackground` để `false`.**

Con số 60s dễ chấp nhận vì `refetchOnWindowFocus` (mặc định bật của TanStack Query) mới là thứ gánh phần lớn trải nghiệm: người dùng chuyển tab quay lại là fetch ngay. Polling chỉ lo trường hợp ngồi yên một chỗ nhìn màn hình — với thông báo tuyển dụng thì chậm 60 giây không ai nhận ra. Đây không phải ứng dụng chat.

**Dòng quan trọng hơn con số là `refetchIntervalInBackground: false`,** và nó dính thẳng tới rủi ro Render trong bảng dưới. Render free **ngủ sau 15 phút không có request**, mà cả sự cố 767/750 giờ vừa rồi là do có thứ gọi API ngoài giờ. Một tab bỏ quên qua đêm mà vẫn polling là đúng cái cron `*/10 0-16 * * *` vừa được sửa để tránh — chỉ khác là lần này không ai nghĩ ra để đi tắt. Để `false` thì tab ẩn ngừng hẳn, và số giờ chạy chỉ còn phụ thuộc lúc có người thật đang dùng.

Cả hai giá trị đặt thành hằng số dùng chung trong `packages/shared`, đừng để mỗi người tự chọn một số.

### Gửi email không được làm hỏng việc chính

`sendMail()` gọi ra Brevo qua mạng. Brevo chậm hoặc lỗi thì **không được** làm `POST /don-ung-tuyen` trả 500 — đơn đã ghi xong rồi.

Nên: ghi `Notification` **trong** transaction (cùng số phận với đơn), gửi email **ngoài** transaction và nuốt lỗi, chỉ ghi log. Chuông là nguồn sự thật, email là bản sao tiện lợi.

**Năm thông báo của sprint này:**

| Sự kiện | Ai nhận | Kênh |
| --- | --- | --- |
| Có đơn mới | NTD | Chuông + email |
| Đơn vào vòng trong (`SHORTLISTED`) | Sinh viên | Chuông + email |
| Được nhận (`ACCEPTED`) | Sinh viên | Chuông + email |
| Bị từ chối (`REJECTED`) | Sinh viên | Chuông + email, kèm `note` của NTD |
| **Ứng viên rút đơn (`WITHDRAWN`)** | **NTD** | **Chuông luôn; email chỉ khi đơn đang ở `SHORTLISTED`** |

`VIEWED` **không** gửi gì — NTD mở danh sách là đã xem, gửi thông báo cho mỗi lần mở là spam.

**Vì sao rút đơn chia hai mức, không phải một luật chung.** Rút ở `PENDING` là chuyện thường ngày và NTD chưa bỏ công gì — một dòng trong chuông là đủ, gửi email cho mọi lần rút thì hộp thư thành nơi không ai đọc nữa. Rút ở `SHORTLISTED` thì khác hẳn: NTD đã đọc hồ sơ, đã mở liên hệ, có thể đang xếp lịch phỏng vấn quanh người này. Không báo là để họ chờ một người sẽ không đến.

Ranh giới đặt đúng ở `SHORTLISTED` vì đó cũng là ngưỡng mở thông tin liên hệ — cùng một mốc "NTD đã đầu tư thời gian thật", dùng lại chứ không đặt thêm ngưỡng mới cho người đọc code phải nhớ.

**FE:** chuông trên header kèm chấm đỏ số chưa đọc, dropdown 10 cái mới nhất, bấm vào thì đánh dấu đã đọc và điều hướng theo `link`.

**Test:** nộp đơn → NTD có đúng **một** `Notification`; `sendMail` ném lỗi → đơn **vẫn** tạo thành công (mock `sendMail` reject trong test); đánh dấu đã đọc của người khác → 403; `VIEWED` không sinh thông báo; đếm chưa đọc đúng sau khi đọc từng cái và đọc hết.

**Xong nghĩa là:**

- [ ] Test có ca `sendMail` lỗi mà nghiệp vụ chính vẫn xong
- [ ] `Notification` ghi trong transaction cùng với đơn/đổi trạng thái
- [ ] `VIEWED` không sinh thông báo nào
- [ ] Chuông cập nhật bằng polling, **không** có `new WebSocket` ở đâu trong `apps/web`
- [ ] Đã thử trên bản deploy thật: nhận được **cả** chuông lẫn email

---

## BA — độc lập từ đầu, không đổi

| Việc | Kết quả cần đạt |
| --- | --- |
| Test case luồng ứng tuyển **hai phía** | Đủ ca âm: nộp hai lần, nộp tin đã đóng, NTD A xem ứng viên của NTD B, rút đơn đã được nhận |
| Sơ đồ trạng thái đơn | Vẽ đúng bảng chuyển trạng thái ở tính năng 3, kể cả các ô **không** được phép |
| Kiểm thử trên bản deploy thật | Bảng test case có cột kết quả thực tế |
| Chương 5 báo cáo | Sơ đồ trạng thái + giải thích công thức điểm phù hợp và vì sao con số không hiện thẳng |
| Kịch bản demo | Đi hết một vòng: đăng tin → duyệt → ứng tuyển → vào vòng trong → nhận |

## Tự kiểm trước khi coi một tính năng là xong

Áp dụng cho mọi tính năng ở trên — chạy hết trước khi commit, không phải trước khi cả sprint xong:

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` — kiểm bằng **exit code**, không phải bằng `grep` output
- [ ] Kiểu ở `packages/shared` đã cập nhật, gọi thử bằng `curl` thấy đúng
- [ ] ⚠ Mọi endpoint đụng tới một đơn đều kiểm **chủ sở hữu**: sinh viên chỉ thấy đơn mình, NTD chỉ thấy đơn vào tin mình. Ba ca: của mình / của người khác / không tồn tại — và ba mã trả về khác nhau
- [ ] ⚠ Thông tin liên hệ **không nằm trong response** khi đơn dưới `SHORTLISTED` — kiểm bằng `curl`, không kiểm bằng mắt trên giao diện
- [ ] Mọi thứ ghi kèm nhau nằm trong **cùng một transaction**: đơn + sự kiện + thông báo
- [ ] `matchScore` / `matchBreakdown` / `matchAlgoVersion` ghi **một lần lúc nộp**, không bao giờ tính lại
- [ ] Hàm cổng, hàm điểm và hàm độ phủ là **ba hàm riêng**, không hàm nào gọi hàm kia
- [ ] Độ phủ đóng băng trong `matchBreakdown`, không màn hình nào tự đếm lại
- [ ] `tinhDoPhu` ra `1/1` cho ví dụ 1 — ra `1/3` nghĩa là mẫu số đang cứng bằng 3, sai
- [ ] Test có ca âm — không chỉ "chạy đúng", còn phải có "chuyển trạng thái sai bị chặn" và "người khác gọi bị chặn"
- [ ] Đã thử trên bản deploy thật trước khi đánh dấu xong hẳn, không chỉ trên máy

## Rủi ro của riêng sprint này

| Rủi ro | Dấu hiệu sớm | Xử lý |
| --- | --- | --- |
| **Lớp nền kéo dài quá nửa ngày** — cả sprint chờ nó | Hết sáng ngày 1 mà migration chưa chạy được | Cắt phạm vi lớp nền xuống còn **migration + kiểu**; `ghiSuKien()` và seed bổ sung đẩy vào tính năng 1 |
| **Render free bị treo trở lại** | Dashboard báo gần 750 giờ | Đã sửa cron về khung 07:00–23:59. Kiểm số giờ giữa sprint, đừng đợi bị treo |
| Lộ thông tin liên hệ ở trạng thái thấp | BA test thấy SĐT trong response `PENDING` | Lọc ở `select` **cùng lúc** với việc viết endpoint, không phải bước sau; test kiểm **response**, không kiểm giao diện |
| Trộn cổng vào điểm | Sinh viên không nhận nổi ca vẫn xếp trên | Hai hàm riêng ngay từ đầu; test có ca "100% kỹ năng nhưng không đủ ca" |
| So điểm giữa hai sinh viên có độ phủ khác nhau | NTD thắc mắc vì sao người khai ít lại điểm cao | Hiện độ phủ cạnh điểm; sắp `eligible` trước |
| Mẫu số độ phủ để cứng bằng 3 | Tin không yêu cầu kỹ năng vẫn bị ghi "tính trên 1/3 tiêu chí" | `apDung` loại `KHONG_AP_DUNG` khỏi mẫu số; test ví dụ 1 phải ra `1/1` |
| Email Brevo lỗi làm hỏng luồng chính | Nộp đơn trả 500 dù đơn đã ghi | Gửi email **ngoài** transaction, nuốt lỗi, ghi log; test có ca `sendMail` reject |
| Tính năng 2 và 3 cùng sửa `Applicants.tsx` | Test của tính năng 2 hỏng sau khi làm tính năng 3 | Làm 2 xong hẳn rồi mới tới 3, hoặc một người làm cả hai. Chạy lại toàn bộ test của trang sau mỗi lần |
| Phạm vi: README ước tính sprint này **2 tuần**, ta có **1 tuần** | Hết ngày 3 mà chưa xong tính năng 3 | Cắt tính năng 5 xuống chỉ còn email (bỏ chuông), giữ luồng khép kín. **Không** cắt phần che liên hệ — đó là luật bảo vệ dữ liệu, và nay nó nằm trong tính năng 2 nên không cắt rời được nữa |
| `Applicants.tsx` còn đọc `data/mock` | — | Nối API xong phải **xoá `data/mock.ts`**, đây là file mock cuối cùng của dự án |

## Việc còn nợ, không thuộc sprint này

| Việc | Ghi ở đâu |
| --- | --- |
| Lịch rảnh có hạn dùng (`effectiveFrom`/`effectiveUntil`) | [lich-ranh-co-han-dung.md](lich-ranh-co-han-dung.md) — hoãn tới sau Sprint 4 |
| Sprint 3 tính năng 2 (full-text search) và 5 (phân trang) | [sprint-3.md](sprint-3.md) |
| Sprint 2 còn nợ: T75, T76, T86, T87, T88 | [sprint-2.md](sprint-2.md) |

> ⚠ `StudentProfile.availableUntil` và `availableFrom` **chồng lấn** với thiết kế hạn dùng lịch rảnh ở tài liệu trên. Sprint 4 là lần đầu hai cột đó được dùng thật — nên **đối chiếu lại trước khi xây phần hạn dùng**, rất có thể mức hồ sơ đã đủ và việc kia không cần làm nữa.
