/**
 * Danh sách khu vực cho ô chọn địa điểm.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO ĐÂY LÀ DỮ LIỆU THẬT, KHÔNG PHẢI DỮ LIỆU GIẢ
 * ---------------------------------------------------------------------------
 * Trước đây hằng số này nằm chung trong `data/mock.ts` — file dựng để làm giao
 * diện trước khi có API, và đang được xoá dần khi từng màn hình nối API thật.
 * Nhưng danh sách quận thì KHÔNG phải dữ liệu giả: nó là cấu hình có thật, được
 * ghi thẳng vào cột `district` của tin tuyển dụng và dùng làm giá trị lọc.
 *
 * Để lẫn trong file mock thì tới lúc xoá file đó, danh sách này bị xoá theo và
 * hai form đăng tin lẫn bộ lọc cùng gãy.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CHƯA LẤY TỪ API
 * ---------------------------------------------------------------------------
 * Không có bảng `districts` trong schema, và cũng không nên có ở quy mô này:
 * danh sách chỉ vài dòng, gần như không đổi, và nếu để nhà tuyển dụng nhập tự
 * do thì "Quận 1", "quận 1", "Q1" sẽ thành ba khu vực khác nhau — đúng thứ làm
 * hỏng bộ lọc, cùng lý do danh mục kỹ năng phải do admin quản lý.
 *
 * Giá trị ở đây phải KHỚP CHÍNH XÁC chuỗi đang nằm trong database. Đổi một dòng
 * là mọi tin cũ mang giá trị cũ biến khỏi bộ lọc mà không báo lỗi gì.
 */
export const DISTRICTS = [
  'Quận 1',
  'Quận 3',
  'Quận 7',
  'Quận Bình Thạnh',
  'Quận Gò Vấp',
  'Quận Thủ Đức',
  'Làm từ xa',
]
