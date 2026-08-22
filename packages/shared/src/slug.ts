/**
 * Sinh slug từ tên tiếng Việt: "Pha chế cơ bản" → "pha-che-co-ban".
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO NẰM Ở `shared` CHỨ KHÔNG PHẢI TRONG `apps/api`
 * ---------------------------------------------------------------------------
 * Slug do SERVER sinh — client không gửi lên, đó là quy ước cố định. Nhưng màn
 * hình thêm kỹ năng của admin có ô xem trước slug ngay lúc gõ tên, để người
 * nhập biết URL lọc sẽ ra sao trước khi bấm Thêm.
 *
 * Nếu mỗi phía giữ một bản riêng thì chúng sẽ lệch nhau — và cái lệch đó biểu
 * hiện ra thành một ô xem trước NÓI DỐI: hiện `dau-bep` nhưng server lưu
 * `-u-bp`. Dùng chung một hàm là cách duy nhất đảm bảo ô xem trước luôn đúng
 * bằng thứ thật sự được ghi xuống.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG DÙNG MỖI `normalize('NFD')`
 * ---------------------------------------------------------------------------
 * Cách thường thấy trên mạng là tách dấu bằng NFD rồi xoá các ký tự tổ hợp:
 *
 *   ten.normalize('NFD').replace(/[̀-ͯ]/g, '')
 *
 * Nó xử lý đúng "ế" → "e" vì "ế" là "e" cộng hai dấu tổ hợp. Nhưng nó KHÔNG xử
 * lý được `đ`: trong Unicode `đ` là một CHỮ CÁI riêng của bảng chữ cái tiếng
 * Việt, không phải "d" cộng dấu gạch. NFD để nguyên nó.
 *
 * Bỏ sót chỗ này thì "Đầu bếp" ra slug `-u-bp` — ký tự `đ` rơi vào nhánh xoá
 * mọi thứ không phải a-z ở dưới. Lỗi im lặng, chỉ lộ ra khi có kỹ năng bắt đầu
 * bằng chữ Đ.
 */
export function taoSlug(ten: string): string {
  return ten
    .normalize('NFD')
    // Xoá dấu thanh và dấu mũ đã bị NFD tách rời.
    .replace(/[̀-ͯ]/g, '')
    // Hai dòng riêng cho đ/Đ — NFD không đụng tới chúng, xem giải thích trên.
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    // Mọi thứ còn lại không phải chữ/số thành dấu gạch: khoảng trắng, dấu câu,
    // và cả ký tự lạ lọt vào lúc dán từ Word.
    .replace(/[^a-z0-9]+/g, '-')
    // Gộp gạch liên tiếp và cắt gạch ở hai đầu, để " Pha chế! " không ra
    // "-pha-che-".
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
