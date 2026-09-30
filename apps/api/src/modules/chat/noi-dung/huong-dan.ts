/**
 * Nội dung hướng dẫn dùng sản phẩm — nhóm câu hỏi 3.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO VIẾT TAY CHỨ KHÔNG ĐỂ MODEL TỰ TRẢ LỜI
 * ---------------------------------------------------------------------------
 * Model không biết UniWork. Hỏi "làm sao khai lịch rảnh", nó sẽ mô tả một trang
 * cài đặt hợp lý, đúng kiểu mọi website đều có, và sai. Người dùng đi tìm nút
 * đó, không thấy, và kết luận sản phẩm hỏng.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO `chuDe` LÀ ENUM ĐÓNG
 * ---------------------------------------------------------------------------
 * Chuỗi tự do thì model xin `'doi-mat-khau'`, nhận `undefined`, rồi tự bịa một
 * quy trình. Enum đóng thì AI SDK từ chối ngay ở bước kiểm `inputSchema`, model
 * nhận lỗi và phải chọn lại trong danh sách có thật.
 *
 * ---------------------------------------------------------------------------
 * HAI CHỦ ĐỀ CỐ Ý CHƯA CÓ
 * ---------------------------------------------------------------------------
 * `quet-cv` và `nhan-tin-ntd` thuộc hai tính năng đang xây. Thêm vào đây trước
 * khi có nút thật là tự tay dựng ra ảo giác — khác gì để model bịa, chỉ là ta
 * bịa hộ. Thêm cùng lúc với tính năng.
 */

export const CHU_DE_HUONG_DAN = [
  'dang-ky',
  'xac-thuc-email',
  'cap-nhat-ho-so',
  'tai-cv',
  'khai-lich-ranh',
  'diem-phu-hop',
  'tim-viec',
  'luu-tin',
  'nop-don',
  'theo-doi-don',
  'dang-tin',
  'duyet-tin',
  'xem-ung-vien',
] as const

export type ChuDeHuongDan = (typeof CHU_DE_HUONG_DAN)[number]

/**
 * Mỗi mục là văn bản model đọc rồi diễn đạt lại, không phải câu trả lời cuối.
 * Nên viết theo lối "sự thật, ngắn", không phải lối "chào bạn, để làm việc này".
 */
export const HUONG_DAN: Record<ChuDeHuongDan, string> = {
  'dang-ky':
    'Vào trang /dang-ky, chọn vai Sinh viên hoặc Nhà tuyển dụng ngay từ đầu — vai này ' +
    'không đổi được sau khi tạo tài khoản. Có thể đăng ký bằng email và mật khẩu, hoặc ' +
    'bằng tài khoản Google.',

  'xac-thuc-email':
    'UniWork dùng MÃ OTP, không phải link trong email. Ở trang /xac-thuc-email bấm gửi ' +
    'mã, mở hộp thư, rồi nhập mã vào ô. Mã có hạn; hết hạn thì bấm gửi lại. Không thấy ' +
    'email thì kiểm tra thư rác.',

  'cap-nhat-ho-so':
    'Trang /ho-so. Sửa được trường, ngành, năm học, giới thiệu, mức lương mong muốn, ' +
    'ngày còn đi làm được, và danh sách kỹ năng. Hồ sơ càng đủ thì nhà tuyển dụng càng ' +
    'dễ đánh giá.',

  'tai-cv':
    'Trang /ho-so có mục tải CV. Nộp một file; lần tải sau thay thế file cũ. CV được ' +
    'gửi kèm mỗi đơn ứng tuyển.',

  'khai-lich-ranh':
    'Trang /lich-ranh. Một lưới 7 ngày × 3 khung (sáng, chiều, tối) — bấm vào ô để bật ' +
    'hoặc tắt. Đây là "tôi CÓ THỂ làm khung này", không phải giờ làm cố định; giờ cụ ' +
    'thể do hai bên chốt khi phỏng vấn. Lưu là thay toàn bộ lưới, không cộng dồn.',

  'diem-phu-hop':
    'Điểm phù hợp so ca làm của tin với lịch rảnh đã khai. Chưa khai lịch rảnh thì ' +
    'CHƯA ĐO ĐƯỢC — hiện dấu gạch chứ không phải 0 điểm. Khai ở /lich-ranh là điểm ' +
    'hiện ra ngay. "Nhận được việc" và "hợp tới đâu" là hai câu hỏi khác nhau: một tin ' +
    'có thể nhận được mà điểm vẫn thấp.',

  'tim-viec':
    'Trang /viec-lam. Lọc theo khu vực, mức lương, kiểu lịch, kỹ năng, và có tuỳ chọn ' +
    'chỉ hiện tin hợp lịch rảnh của mình. Sắp xếp theo mới đăng hoặc theo độ phù hợp.',

  'luu-tin':
    'Bấm biểu tượng lưu trên thẻ tin hoặc ở trang chi tiết tin. Danh sách nằm ở ' +
    '/tin-da-luu, có ghi rõ tin nào còn nhận hồ sơ.',

  'nop-don':
    'Mở tin ở /viec-lam, bấm ứng tuyển. Đơn mang theo CV và điểm phù hợp tại thời điểm ' +
    'nộp — điểm đó ĐÓNG BĂNG, đổi lịch rảnh sau này không làm nó tính lại.',

  'theo-doi-don':
    'Trang /don-ung-tuyen liệt kê mọi đơn kèm toàn bộ lịch sử trạng thái. Khi nhà tuyển ' +
    'dụng chuyển đơn sang vòng trong hoặc nhận, thông tin liên hệ của họ mới mở ra.',

  'dang-tin':
    'Trang /ntd/dang-tin. Tin lưu nháp trước, gửi duyệt sau. Quản trị viên duyệt thì ' +
    'tin mới lên sàn. Sửa một số trường quan trọng của tin đã duyệt sẽ đưa nó về hàng ' +
    'chờ duyệt lại.',

  'duyet-tin':
    'Việc của quản trị viên. Tin gửi lên nằm ở hàng chờ; duyệt thì tin mở công khai, từ ' +
    'chối thì tin quay về nháp kèm lý do để nhà tuyển dụng sửa và gửi lại.',

  'xem-ung-vien':
    'Trang /ntd/ung-vien, lọc theo tin và theo trạng thái đơn. Đổi trạng thái đơn ở ' +
    'ngay đó. Số điện thoại và email của ứng viên chỉ hiện sau khi đơn được chuyển sang ' +
    'vòng trong hoặc được nhận.',
}
