# 004 — Đo chi phí thật của `mix-blend-mode` trên vệt sáng hero

- **Status**: TODO (thí nghiệm, có cổng quyết định — không phải bản sửa)
- **Commit**: 720242b (nhánh `dev`)
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: đo trước; nếu quyết định đổi thì 2 file, ~8 dòng

## Problem

`.hero-blob` bật `mix-blend-mode: screen` cho **5 lớp**, lớp lớn nhất tới
736×736px, cả 5 đều đang chạy animation vô hạn:

```css
/* apps/web/src/index.css:89-94 — hiện tại */
.hero-blob {
  position: absolute;
  border-radius: 9999px;
  mix-blend-mode: screen;
  will-change: transform;
}
```

Về mặt cơ chế, đây là thứ duy nhất trong hero **chặn đường tắt của compositor**.
Một lớp chỉ đổi `transform` thì GPU dịch lớp đã vẽ sẵn, gần như miễn phí. Nhưng
lớp có chế độ hoà màu thì mỗi khung hình phải đọc lại vùng nền phía sau rồi
trộn — không dịch lớp suông được nữa.

**Nhưng đó mới là lý thuyết, chưa phải bằng chứng.** Số đo duy nhất đang có
(60fps, thấp nhất 55fps, GPU 120 MB) được lấy lúc máy đang thiếu bộ nhớ nghiêm
trọng — `Committed/Commit Limit` ở 96%, ổ C còn 3% (xem
`docs/moi-truong-may-dev.md`). Số đó không chứng minh được `mix-blend-mode` đắt,
mà cũng không chứng minh được nó rẻ. Máy giờ đã lành, nên đo lại được rồi.

Plan này **không giả định kết quả**. Nó là một phép đo có hai nhánh.

## Target

Một con số, rồi một quyết định.

### Nhánh A — nếu chênh lệch dưới 10%: giữ nguyên, đóng plan

Ghi con số đo được vào mục Kết quả bên dưới, đổi Status thành `DONE (giữ
nguyên)`, và **không sửa gì cả**. `screen` cho màu ở chỗ hai vệt chồng nhau đẹp
hơn hẳn cách trộn thường; đắt một chút thì vẫn đáng.

### Nhánh B — nếu chênh lệch từ 10% trở lên: bỏ blend, bù lại bằng độ đậm

```css
/* apps/web/src/index.css:89-94 — target nhánh B */
.hero-blob {
  position: absolute;
  border-radius: 9999px;
  /* Bỏ `mix-blend-mode: screen`: nó bắt compositor đọc lại nền để trộn màu mỗi
     khung hình, trên máy tầm trung đo được chậm hơn <N>%. Độ đục của từng vệt
     đã được nâng lên để bù phần sáng mất đi ở chỗ các vệt chồng nhau. */
  will-change: transform;
}
```

```tsx
// apps/web/src/components/HeroAurora.tsx:22-49 — target nhánh B
// Chỉ đổi giá trị alpha cuối trong mỗi `color`. Giữ nguyên box và motion.
const BLOBS = [
  { /* ... */ color: 'rgba(20,196,171,0.62)'  /* từ 0.52 */ },
  { /* ... */ color: 'rgba(34,211,238,0.50)'  /* từ 0.42 */ },
  { /* ... */ color: 'rgba(139,92,246,0.62)'  /* từ 0.52 */ },
  { /* ... */ color: 'rgba(244,114,182,0.41)' /* từ 0.34 */ },
  { /* ... */ color: 'rgba(251,191,36,0.36)'  /* từ 0.30 */ },
]
```

Các số alpha trên là **điểm khởi đầu** (tăng ~20%), không phải đáp án. Chúng
phải được chỉnh bằng mắt khi so ảnh chụp, và phải được Oxa duyệt trước khi
commit — đây là đổi diện mạo trang chủ, không phải đổi kỹ thuật thuần tuý.

## Repo conventions to follow

- Alpha viết trong `rgba()` với 2 chữ số thập phân, như
  `apps/web/src/components/HeroAurora.tsx:25`.
- Khi bỏ một thuộc tính vì lý do hiệu năng, **để lại chú thích nói vì sao bỏ**
  kèm con số đo được — repo đã làm vậy ở `apps/web/src/components/HeroAurora.tsx:5-16`
  (giải thích vì sao dùng gradient thay `filter: blur()`).
- Đo thì ghi ngày và điều kiện đo, như `docs/moi-truong-may-dev.md` đang làm.

## Steps

### Phần 1 — Đo (bắt buộc, làm trước)

1. **Chạy plan 001, 002, 003 trước.** Đo `mix-blend-mode` trong lúc quả cầu WebGL
   còn đang quay ngầm thì chỉ đo ra tiếng ồn.
2. Kiểm tra máy đủ khoẻ trước khi đo — nếu không, mọi số đều vô nghĩa:
   ```powershell
   Get-Counter '\Memory\Available MBytes', '\Memory\Committed Bytes', '\Memory\Commit Limit'
   ```
   Yêu cầu: `Available` > 2000 MB và `Committed/Limit` < 70%. Không đạt thì
   **dừng**, dọn máy theo `docs/moi-truong-may-dev.md` rồi quay lại.
3. Mở Edge, tắt **Efficiency mode** ở `edge://settings/system`.
4. Mở trang chủ, ở nguyên hero (không cuộn). DevTools → `Ctrl+Shift+P` →
   `Show Rendering` → bật **Frame Rendering Stats**.
5. Performance → **CPU throttling 6×** (máy Oxa giờ khoẻ nên không tự tái hiện
   được cảnh máy yếu; không throttle thì đo ra 60fps ở cả hai bên và không kết
   luận được gì). Ghi 10 giây. Chép lại **Painting** và **Rendering** (ms).
6. Trong tab Elements, chọn một `<span class="hero-blob ...">` → Styles → **bỏ
   tick** dòng `mix-blend-mode: screen`. Tick này áp cho cả 5 vệt vì cùng một
   quy tắc `.hero-blob`.
7. Ghi lại 10 giây nữa với đúng thiết lập đó. Chép lại hai con số.
8. Tính chênh lệch phần trăm của **Painting**.

### Phần 2 — Quyết định

9. Điền vào bảng Kết quả bên dưới.
10. Chênh lệch **< 10%** → nhánh A: đổi Status thành `DONE (giữ nguyên)`, xong.
11. Chênh lệch **≥ 10%** → nhánh B, tiếp bước 12.

### Phần 3 — Chỉ làm nếu vào nhánh B

12. Chụp màn hình hero **trước khi sửa**, lưu vào
    `plans/anh/004-truoc.png`.
13. Bỏ dòng `mix-blend-mode: screen` ở `apps/web/src/index.css:92`, thay bằng
    chú thích ở mục Target với `<N>` là con số thật đo được.
14. Nâng alpha trong `BLOBS` ở `apps/web/src/components/HeroAurora.tsx:22-49`.
15. Chụp lại, lưu `plans/anh/004-sau.png`, **đưa Oxa duyệt hai ảnh cạnh nhau
    trước khi commit**. Nếu Oxa thấy màu kém hơn, quay về nhánh A và ghi lại
    lý do — hiệu năng không phải lý do đủ để làm trang xấu đi.
16. Xem lại chú thích ở `apps/web/src/pages/Home.tsx:257-259`: nó giải thích
    `isolate` là để giữ `mix-blend-mode` không lan ra header. Bỏ blend rồi thì
    `isolate` có thể vẫn cần cho việc khác — **kiểm bằng cách bỏ thử và nhìn
    header**, đừng xoá theo phản xạ. Cập nhật chú thích cho khớp thực tế.

## Kết quả đo

Điền vào đây khi làm xong Phần 1. Để trống nghĩa là plan chưa chạy.

| | Painting (ms) | Rendering (ms) | Điều kiện |
| --- | --- | --- | --- |
| Có `mix-blend-mode` | | | Edge, CPU 6×, 10s, hero đứng yên |
| Bỏ `mix-blend-mode` | | | như trên |
| Chênh lệch | % | % | |

Ngày đo: ______  Máy: ______

## Boundaries

- **KHÔNG sửa gì ở Phần 1 và 2.** Bỏ tick trong DevTools là thay đổi tạm trong
  trình duyệt, không đụng file.
- **KHÔNG vào nhánh B** khi chưa có con số điền trong bảng Kết quả. Đây chính là
  cái bẫy đã mắc một lần: đổ lỗi cho `mix-blend-mode` trước khi đo.
- **KHÔNG đổi** `box`, `motion`, thứ tự vệt, hay bảng màu gốc (chỉ được đổi
  alpha, và chỉ ở nhánh B).
- **KHÔNG đụng** `will-change: transform` — nó đúng cho khối chạy animation liên
  tục.
- **KHÔNG bỏ `isolate`** ở `Home.tsx:261` mà chưa kiểm bước 16.
- **KHÔNG commit nhánh B** khi chưa có Oxa duyệt ảnh so sánh.

## Verification

**Nếu vào nhánh A:** không có gì để kiểm ngoài việc bảng Kết quả đã điền đủ và
Status đã đổi.

**Nếu vào nhánh B:**

```bash
pnpm --filter @uniwork/web typecheck   # kỳ vọng: thoát 0
pnpm --filter @uniwork/web lint        # kỳ vọng: thoát 0
pnpm --filter @uniwork/web test        # kỳ vọng: thoát 0
```

**Mắt kiểm:**

1. So `004-truoc.png` và `004-sau.png` cạnh nhau ở kích thước thật. Chỗ cần nhìn
   kỹ nhất là **vùng hai vệt chồng lên nhau** — đó là chỗ `screen` làm việc,
   cũng là chỗ mất nhiều nhất khi bỏ nó.
2. Kiểm tương phản chữ: tiêu đề trắng trên hero phải còn đọc rõ sau khi nâng
   alpha. Dùng DevTools → chọn thẻ chữ → Accessibility → Contrast, yêu cầu tối
   thiểu **4.5:1**.
3. Nhìn phần **tiếp giáp giữa header và hero**: không được xuất hiện đường viền
   hay mảng màu lạ (dấu hiệu `isolate` bị xoá nhầm ở bước 16).
4. Đo lại lần cuối đúng cách ở Phần 1 và xác nhận con số khớp với những gì đã
   ghi trong chú thích code.
5. Thu cửa sổ còn ~400px: trên điện thoại chỉ có 3 vệt (2 vệt còn lại
   `hidden sm:block`), kiểm xem màu có bị nhạt quá không.

**Done when:**

- Bảng Kết quả đã điền đủ số và ngày.
- Status đã đổi thành `DONE (giữ nguyên)` hoặc `DONE (đã bỏ blend)`.
- Nếu là nhánh B: Oxa đã duyệt ảnh so sánh, và con số trong chú thích code khớp
  với bảng Kết quả.
