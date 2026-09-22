# Nợ kỹ thuật

Việc đã biết là phải làm nhưng chưa làm. Mỗi mục: hỏng gì, ở đâu, làm sao sửa.

---

## 1. Ô search ở header admin là vỏ rỗng

**Trạng thái:** chưa làm · phát hiện 2026-09-22

### Hỏng gì

`SearchBox` trong [AdminLayout.tsx:348](../apps/web/src/components/layout/AdminLayout.tsx#L348) chỉ là giao diện. Cái `<input>` không có `value`, `onChange`, `name`, `onKeyDown`, và không nằm trong `<form>`. Gõ thì chữ hiện lên nhưng Enter không làm gì.

Tệ hơn: nó hiện `<kbd>⌘ K</kbd>` trong khi **không có listener `keydown` nào** trong file. Đang hứa một phím tắt không tồn tại — người dùng bấm thử rồi tưởng app đứng.

State duy nhất của component là `isMac`, và nó chỉ dùng để chọn hiện `⌘` hay `Ctrl`.

### Ai thấy nó

`SearchBox` gọi một lần ở `AdminLayout.tsx:284`. `AdminLayout` bọc:

- **ADMIN** — `/admin`, `/admin/duyet-tin`, `/admin/duyet-ntd`, `/admin/ky-nang`, `/admin/nguoi-dung`
- **EMPLOYER** — `/ntd/quan-ly`

Ba trang NTD còn lại (`/ntd/ho-so`, `/ntd/dang-tin`, `/ntd/ung-vien`) dùng `<Layout />` thường nên không có ô này.

### Cách sửa

| | Việc | Đánh giá |
| --- | --- | --- |
| **A** | Xoá `SearchBox` và lời gọi ở `:284` | **Nên làm.** Rẻ nhất, xoá ngay lời hứa sai |
| B | `Ctrl+K` điều hướng tới trang phù hợp rồi focus `Toolbar` ở đó | Được, nhưng vẫn không phải "tìm toàn cục" như placeholder nói |
| C | Search toàn cục thật: endpoint mới gộp tin + doanh nghiệp + người dùng | Việc lớn, và dính lỗ phân quyền dưới đây |

### Hai điều cần biết trước khi code

**Placeholder đang hứa vượt quyền.** Nó ghi *"Tìm tin đăng, doanh nghiệp, người dùng…"* nhưng NTD ở `/ntd/quan-ly` cũng đọc được dòng đó. NTD **không** được tìm người dùng. Chọn hướng C thì phải lọc kết quả theo vai, không chỉ sửa câu chữ.

**Search chạy được đã có sẵn, ở tầng trang.** Xem `Toolbar` với `value` / `onChange` — ví dụ [EmployerJobs.tsx:167](../apps/web/src/pages/admin/EmployerJobs.tsx#L167). Không thiếu hạ tầng; ô ở header là thứ vẽ ra rồi bỏ lại.

**Không có test nào phủ `AdminLayout`**, nên hướng A gần như không có rủi ro — nhưng cũng nghĩa là không có lưới đỡ nếu làm hỏng layout. Mở `/admin` và `/ntd/quan-ly` xem bằng mắt sau khi sửa.
