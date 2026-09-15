# Kế hoạch cải thiện hiệu năng animation — web

Mục tiêu: **giữ nguyên toàn bộ animation hiện có, và mở đường để thêm nữa**, mà
vẫn chạy được trên máy tầm trung.

Không plan nào trong này bỏ bớt hay làm nhạt animation. Tất cả đều đi theo một
nguyên tắc:

> Chi phí phải tỉ lệ với **những gì đang hiện trên màn hình**, không tỉ lệ với
> **tổng số animation có trong trang**.

Khảo sát gốc chạy tại commit `720242b` (nhánh `dev`), ngày 2026-09-12.

## Danh sách

| # | Plan | Mức | Phạm vi | Status |
| --- | --- | --- | --- | --- |
| 001 | [Dừng animation khi khối nằm ngoài khung nhìn](001-dung-animation-ngoai-khung-nhin.md) | HIGH | 1 hook + 1 khối CSS + 5 chỗ gắn | TODO |
| 002 | [Quả cầu WebGL chỉ quay khi đã cuộn tới](002-earth-chi-quay-khi-thay.md) | HIGH | 1 file | TODO |
| 003 | [Bỏ qua vẽ phần chưa cuộn tới](003-bo-qua-ve-phan-chua-cuon-toi.md) | MEDIUM | 1 khối CSS + 11 class | TODO |
| 004 | [Đo chi phí thật của `mix-blend-mode`](004-do-chi-phi-mix-blend-mode.md) | MEDIUM | thí nghiệm, có cổng quyết định | TODO |

## Thứ tự chạy

**002 → 001 → 003 → 004**

- **002 trước** vì nó rẻ nhất (một file, không hạ tầng gì) mà lời nhất: quả cầu
  WebGL đang quay 60fps từ giây đầu mở trang cho một khối nằm ở dòng 900.
- **001 tiếp**, vì nó dựng cái hook `useOnScreen` mà về sau mọi animation mới
  đều dùng lại.
- **003 sau 001** — không bắt buộc về kỹ thuật, nhưng làm sau thì đo được sạch:
  001 đã tắt phần chuyển động ngoài màn hình rồi, con số của 003 mới phản ánh
  đúng chi phí layout/paint.
- **004 cuối cùng**, và **chỉ sau khi ba plan kia xong**. Đo `mix-blend-mode`
  trong lúc quả cầu còn quay ngầm thì chỉ đo ra tiếng ồn.

## Phụ thuộc

- **001 → 003**: cả hai đụng vào `<section>` ở `Home.tsx:758`. Không xung đột
  (001 thêm props, 003 thêm class), nhưng làm 003 trước thì lúc làm 001 phải tự
  hoà hai bên vào một thẻ.
- **002 → 003**: 003 **cố tình bỏ qua** section chứa `<Earth>` (dòng 870), vì
  `content-visibility` có thể làm `canvas.offsetWidth` trả về 0 và quả cầu không
  bao giờ dựng được. Chỉ tính lại chuyện đó sau khi 002 xong và đã kiểm thật.
- **001, 002, 003 → 004**: bắt buộc, xem mục Thứ tự chạy.

Không plan nào phụ thuộc vào API, migration hay công việc của DEV2.

## Quy tắc cho animation thêm về sau

Đây mới là phần quan trọng nhất. Ba plan đầu dọn cái đang có; quy tắc dưới đây
giữ cho nó không nặng lại.

1. **Ngân sách tính theo số chuyển động chạy CÙNG LÚC trên một màn hình, không
   theo tổng số trong trang.** Trần đề nghị: **3–5** thứ chuyển động liên tục
   cùng lúc. Theo cách này, thêm 50 animation nữa vào trang cũng không đắt hơn
   hiện tại — vì không bao giờ có quá 5 cái chạy một lượt.

2. **Mọi `animation-iteration-count: infinite` phải nằm trong một khối có
   `useOnScreen`.** Không có ngoại lệ. Animation chạy một lần rồi thôi (`reveal`,
   `hero-rise`, `cell-pop`) thì không cần — chúng tự kết thúc.

3. **Chỉ animate `transform` và `opacity`.** Repo đang tuân thủ tuyệt đối, giữ
   như vậy. `width`, `height`, `top`, `left`, `margin`, `padding` kéo theo cả
   layout lẫn paint. `transition: all` luôn là lỗi.

4. **Bất cứ thứ gì dùng `requestAnimationFrame` phải tự tắt khi ra khỏi khung
   nhìn** — xem `Earth.tsx` sau plan 002 làm mẫu.

5. **`mix-blend-mode`, `backdrop-filter` và `filter: blur()` là hàng đắt.** Được
   dùng, nhưng phải đo trước và sau, và ghi con số vào chú thích. Xem plan 004
   làm mẫu cách đo.

6. **Tôn trọng `prefers-reduced-motion`.** Repo đã làm rất tốt ở
   `apps/web/src/index.css:517-626` — nguyên tắc là bỏ phần DI CHUYỂN, giữ phần
   hiện dần, và không bao giờ để nội dung biến mất.

7. **Đo trên máy giả yếu, không phải máy thật của mình.** Edge DevTools →
   Performance → **CPU throttling 6×**, và tắt Efficiency mode ở
   `edge://settings/system`. Máy khoẻ không tái hiện được cảnh máy yếu.

8. **Máy đang thiếu RAM hay hết đĩa thì mọi số đo đều vô nghĩa.** Kiểm trước
   theo `docs/moi-truong-may-dev.md`. Đã mất một buổi vì bỏ qua bước này.

## Ghi chú

Những plan này chỉ mô tả việc cần làm; chúng không sửa code. Muốn chạy plan nào
thì mở file đó ra và làm theo mục Steps, hoặc giao cho một agent — mỗi plan được
viết để đọc độc lập, không cần biết gì về cuộc trao đổi sinh ra nó.

Làm xong plan nào thì đổi Status ở bảng trên và trong đầu file plan đó.
