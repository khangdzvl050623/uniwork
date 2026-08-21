/**
 * Thông tin dùng chung cho các trang văn bản pháp lý.
 *
 * Để riêng khỏi file component vì Vite không hot-reload được component nằm
 * cùng file với hằng số (quy tắc `react-refresh/only-export-components`).
 */

/**
 * Địa chỉ liên hệ hiện trên chính sách bảo mật và điều khoản.
 *
 * PHẢI là địa chỉ thật và đọc được: đây là nơi người dùng gửi yêu cầu xoá dữ
 * liệu, và Google cũng đọc trang chính sách khi xét ứng dụng OAuth. Địa chỉ
 * bịa (kiểu hotro@uniwork.vn ở footer) sẽ khiến những yêu cầu đó rơi vào hư
 * không.
 *
 * Đang dùng chính địa chỉ đứng tên gửi email của hệ thống — người dùng vốn đã
 * thấy nó trong mọi thư xác thực nhận được, nên không lộ thêm gì.
 * muon doi chi doi dung 1 dong o duoi
 */ 
export const LIEN_HE = 'n23dvcn027@student.ptithcm.edu.vn'

/** Ngày sửa nội dung văn bản gần nhất. Nhớ cập nhật khi sửa nội dung. */
export const NGAY_CAP_NHAT = '21/08/2026'
