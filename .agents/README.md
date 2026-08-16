# Skill cho trợ lý AI

Bộ hướng dẫn frontend dùng chung cho cả nhóm. Đây là **văn bản, không phải code** — không có script, không chạy gì, không vào bundle. Chúng chỉ định hình cách trợ lý AI làm việc khi ta nhờ nó dựng hoặc sửa giao diện.

## Máy mới cần làm gì

Thư mục `.agents/skills/` đã nằm sẵn trong repo, clone về là có. Nhưng mỗi công cụ AI đọc skill ở một đường dẫn khác nhau, nên cần tạo liên kết cho công cụ mình dùng:

```bash
npx skills add Leonxlnx/taste-skill
npx skills add emilkowalski/skill
```

Lệnh này tạo `.claude/skills/` (và thư mục tương ứng cho Cursor, Copilot...) trỏ ngược về `.agents/skills/`. Phần liên kết đó **không commit** — symlink qua git trên Windows hay lệch thành file text chứa đường dẫn.

Chạy xong nhớ khởi động lại phiên, vì danh sách skill chỉ nạp lúc mở phiên.

## `skills-lock.json`

Ghi hash SHA-256 của từng file. Cài lại mà nội dung upstream đã đổi thì lệch hash — biết ngay để đọc lại trước khi tin.

## Nhóm dùng mặc định cho UniWork

Đây là nhóm **tinh chỉnh** thứ đang có, không thay thế:

| Skill | Dùng khi |
|---|---|
| `emil-design-eng` | Chuẩn nền cho polish UI, component, chi tiết nhỏ |
| `animate`, `animation-vocabulary` | Dựng animation mới |
| `review-animations`, `improve-animations` | Rà lại animation đã có |
| `find-animation-opportunities` | Tìm chỗ nên có chuyển động mà đang thiếu |
| `pick-ui-library` | Chọn thư viện |
| `ask-sonner` | Toast |
| `prototype` | Dựng nhiều phương án cho một khối UI |

## Nhóm CHỈ dùng khi gọi tên cụ thể

`minimalist-ui` · `apple-design` · `industrial-brutalist-ui` · `high-end-visual-design` · `redesign-existing-projects` · `gpt-taste` · `stitch-design-taste` · `design-taste-frontend`

Bảy cái này **thay toàn bộ ngôn ngữ thiết kế** — font, spacing, shadow, bố cục. Giao diện UniWork dựng theo hướng TopCV; để chúng tự chạy là mất công đã bỏ ra. Chúng cũng mâu thuẫn lẫn nhau: không thể vừa brutalist vừa Apple.

## Không chạy được trong môi trường hiện tại

`brandkit` · `imagegen-frontend-web` · `imagegen-frontend-mobile` · `image-to-code`

Bốn cái này đòi công cụ sinh ảnh. `image-to-code` còn viết riêng cho Codex.

`full-output-enforcement` là skill ghi đè hành vi model, không phải kiến thức frontend — để yên.
