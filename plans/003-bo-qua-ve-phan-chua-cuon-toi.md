# 003 — Bỏ qua layout và paint cho các section chưa cuộn tới

- **Status**: TODO
- **Commit**: 720242b (nhánh `dev`)
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 khối CSS (~12 dòng) + 11 chỗ thêm class vào `Home.tsx`

## Problem

`apps/web/src/pages/Home.tsx` dài 975 dòng, chia làm **14 `<section>`**. Khi mở
trang, trình duyệt phải tính layout và vẽ **toàn bộ** 14 section đó, kể cả 13
cái người dùng chưa cuộn tới. Trên máy tầm trung, đây là khoản trả trước rất lớn
ngay lúc trang vừa mở — đúng thời điểm nhạy cảm nhất, khi người dùng đang chờ
nhìn thấy hero.

Đây không phải lỗi animation. Nhưng nó cùng một gốc với plan 001 và 002: trang
đang **trả tiền cho những gì không ai đang nhìn**.

Danh sách section tại commit trên (`grep -n "<section" apps/web/src/pages/Home.tsx`):

| Dòng | Nội dung | Áp dụng? |
| --- | --- | --- |
| 261 | hero | **Không** — luôn ở trên màn hình |
| 410 | khối ngay dưới hero | **Không** — có thể lộ một phần ngay khi tải |
| 471 | | Có |
| 538 | | Có |
| 545 | | Có |
| 606 | biểu đồ thị trường | Có |
| 657 | | Có |
| 696 | | Có |
| 758 | công cụ (có `pulse-ring`) | Có |
| 801 | | Có |
| 870 | video + quả cầu WebGL | **Không** — xem mục Boundaries |
| 912 | | Có |
| 936 | báo chí (marquee) | Có |
| 955 | CTA nhà tuyển dụng | Có |

## Target

### Thêm vào `apps/web/src/index.css`, ngay sau khối `data-offscreen` của plan 001

```css
/* --------------------------------- hoãn vẽ phần chưa cuộn tới ---- */

/* Bảo trình duyệt bỏ qua cả layout lẫn paint cho khối nằm xa khung nhìn. Khác
   `display: none` ở chỗ nội dung vẫn tìm được bằng Ctrl+F và vẫn có trong cây
   trợ năng — trình duyệt chỉ hoãn phần VẼ lại cho tới khi sắp cần.

   `contain-intrinsic-size` là phần bắt buộc đi kèm, không phải tuỳ chọn: khối
   bị hoãn mà không khai báo kích thước thì bị coi như cao 0, thanh cuộn sẽ co
   giãn nhảy nhót suốt lúc cuộn. Từ khoá `auto` bảo trình duyệt nhớ chiều cao
   thật sau lần vẽ đầu tiên, nên con số 600px chỉ cần đúng cỡ chứ không cần
   chính xác. */
.defer-paint {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;
}
```

### Cách dùng trong `Home.tsx`

```tsx
// dòng 471 — từ
<section className="mx-auto mt-5 max-w-[1180px] px-4">
// thành
<section className="defer-paint mx-auto mt-5 max-w-[1180px] px-4">
```

Với section đã mang props của plan 001 thì chỉ thêm class, không đụng props:

```tsx
// dòng 758 — từ (sau khi plan 001 đã xong)
<section {...toolsProps} className="mt-12 bg-brand-50 px-4 py-12">
// thành
<section {...toolsProps} className="defer-paint mt-12 bg-brand-50 px-4 py-12">
```

## Repo conventions to follow

- Class CSS đặt tên tiếng Anh, kebab-case: `.hero-blob`, `.card-lift`,
  `.pattern-dots`, `.scroll-x` ở `apps/web/src/index.css`.
- Class tiện ích tự viết đặt **trước** các class Tailwind trong `className`, như
  `apps/web/src/pages/Home.tsx:261` đang làm với `hero-sky`.
- Chú thích CSS viết tiếng Việt và giải thích **vì sao** — mẫu tốt:
  `apps/web/src/index.css:517-521` (giải thích "giảm chuyển động" nghĩa là bỏ
  phần di chuyển chứ không bỏ sạch animation).

## Steps

1. **`apps/web/src/index.css`** — thêm khối `.defer-paint` ở mục Target. Đặt nó
   ngay sau khối `[data-offscreen]` của plan 001, hoặc nếu plan 001 chưa làm thì
   đặt ngay trước `@media (prefers-reduced-motion: reduce)` ở dòng 522.
2. **`apps/web/src/pages/Home.tsx`** — thêm `defer-paint` vào đầu `className`
   của đúng **11** section ở các dòng: 471, 538, 545, 606, 657, 696, 758, 801,
   912, 936, 955.
3. Không thêm vào dòng 261, 410 và 870. Lý do ở bảng trên và mục Boundaries.

## Boundaries

- **KHÔNG áp dụng cho section ở dòng 870.** Section này chứa `<Earth>`, mà
  `Earth.tsx:46` đọc `canvas.offsetWidth` để quyết định dựng WebGL. Trong một
  khối đang bị hoãn vẽ, số đo đó có thể trả về 0 và quả cầu không bao giờ được
  dựng. Có thể tính lại sau khi plan 002 xong và đã kiểm thật, nhưng **không làm
  trong plan này**.
- **KHÔNG áp dụng cho hero (261)** — nó luôn hiển thị nên chỉ tổ thêm việc cho
  trình duyệt.
- **KHÔNG đổi markup, thứ tự section, hay bất kỳ class Tailwind nào đang có.**
  Chỉ thêm đúng một class vào đầu chuỗi.
- **KHÔNG áp dụng cho trang khác** trong plan này. Trang chủ là trang dài nhất
  và là nơi đo được rõ nhất; các trang khác tính sau khi có số liệu.
- **KHÔNG thêm `contain: strict` hay `will-change`** ở đâu cả.
- Nếu số dòng lệch so với bảng trên (đã có người sửa `Home.tsx` sau `720242b`),
  **DỪNG và báo lại** — đừng đoán section nào là section nào.

## Verification

**Máy kiểm:**

```bash
pnpm --filter @uniwork/web typecheck   # kỳ vọng: thoát 0
pnpm --filter @uniwork/web lint        # kỳ vọng: thoát 0
pnpm --filter @uniwork/web test        # kỳ vọng: thoát 0
pnpm --filter @uniwork/web build       # kỳ vọng: thoát 0
```

**Mắt kiểm** — Edge, tắt **Efficiency mode** trước:

1. **Đo trước khi sửa** để có mốc so sánh: Performance → CPU throttling **6×** →
   tải lại trang → ghi con số **Rendering** và **Painting** trong vòng tròn tổng
   kết. Ghi ra giấy. Không có mốc thì không kết luận được gì.
2. Sửa xong đo lại đúng cách đó. Kỳ vọng: cả hai giảm. Nếu **không giảm**, ghi
   lại con số thật và báo — đừng tự thêm section vào cho đủ.
3. **Cuộn chậm từ đầu xuống đáy.** Thanh cuộn không được co giãn nhảy nhót, nội
   dung không được nhảy vị trí. Nếu có, tăng `contain-intrinsic-size` lên
   `auto 900px` rồi đo lại — đây là dấu hiệu 600px quá thấp so với section thật.
4. **Hiệu ứng `Reveal` vẫn phải chạy.** Cuộn tới từng section và xác nhận nội
   dung *hiện dần lên*, không phải đã nằm sẵn ở trạng thái cuối. Đây là rủi ro
   thật: `Reveal` dựa vào IntersectionObserver, mà khối đang bị hoãn vẽ thì
   observer không báo. Nếu thấy hiệu ứng mất, ghi lại section nào và báo.
5. **Ctrl+F một chữ nằm ở đáy trang** (ví dụ "Đăng tin ngay" ở dòng 966) →
   trình duyệt phải tìm ra và cuộn tới được.
6. **Bấm Tab liên tục** từ đầu trang xuống → tiêu điểm phải đi được tới các nút ở
   đáy, không bị kẹt.
7. Thu cửa sổ còn **~400px** bề ngang, cuộn lại một lượt → không lỗi bố cục.

**Done when:**

- Rendering + Painting lúc tải trang giảm so với mốc đo ở bước 1 (ghi lại cả hai
  con số vào phần mô tả commit).
- Cuộn từ đầu tới đáy không thấy thanh cuộn giật hay nội dung nhảy.
- Mọi hiệu ứng `Reveal` vẫn chạy như trước.
- Ctrl+F và Tab vẫn tới được nội dung ở đáy.
- Bốn lệnh ở mục Máy kiểm đều thoát 0.
