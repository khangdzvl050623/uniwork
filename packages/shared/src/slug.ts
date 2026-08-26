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

/**
 * Đường dẫn trang chi tiết tin: `phuc-vu-quan-ca-phe-ca-toi/demo-job-cafe-toi`.
 *
 * ---------------------------------------------------------------------------
 * SLUG CHỈ ĐỂ ĐỌC, ID MỚI LÀ THỨ TRA CỨU
 * ---------------------------------------------------------------------------
 * Slug đứng trước, id là MỘT ĐOẠN ĐƯỜNG DẪN RIÊNG phía sau. Cố ý không thêm
 * cột `slug` vào bảng `jobs` — ba vấn đề tự biến mất nhờ vậy:
 *
 * 1. TRÙNG TÊN — hai quán cùng đăng "Phục vụ quán cà phê" là chuyện thường.
 *    Slug là cột `@unique` thì tin thứ hai phải mang đuôi `-2`, và ai đó phải
 *    viết mã sinh đuôi đó cho đúng ngay cả khi hai request tới cùng lúc.
 * 2. SỬA TIÊU ĐỀ LÀM CHẾT LINK CŨ — nếu slug là thứ tra cứu thì đổi tên tin là
 *    mọi link đã chia sẻ trỏ vào hư vô. Ở đây đổi tên chỉ làm phần chữ khác đi,
 *    id vẫn nguyên nên link cũ vẫn mở đúng tin.
 * 3. MIGRATION — không cần cột mới, không cần lấp dữ liệu cho tin đã có.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TÁCH ĐOẠN BẰNG `/` CHỨ KHÔNG NỐI BẰNG `-`
 * ---------------------------------------------------------------------------
 * Bản đầu viết `${slug}-${id}` rồi lấy lại id bằng cách cắt theo dấu gạch cuối.
 * Lập luận khi đó: `cuid()` chỉ gồm chữ thường và chữ số nên không bao giờ chứa
 * dấu gạch. Lập luận ấy đúng — nhưng giả định NGẦM đằng sau nó thì sai: không
 * phải id nào trong bảng cũng là cuid.
 *
 * `prisma/seed.ts` đặt id cố định viết tay cho dữ liệu mẫu (`demo-job-cafe-toi`,
 * `demo-job-gia-su-toan`…) để lệnh seed chạy lại nhiều lần vẫn upsert đúng hàng
 * cũ. Những id đó CÓ dấu gạch, nên phép cắt trả về `toi` thay vì
 * `demo-job-cafe-toi` — 7 trên 9 tin thật trong database dẫn tới trang 404.
 * Toàn bộ unit test khi đó vẫn xanh, vì chúng chỉ thử với cuid.
 *
 * Dùng `/` thì không còn phép tách nào để mà sai: React Router đưa thẳng đoạn
 * cuối vào `params.id`. Không cần giả định gì về hình dạng id — bây giờ hay sau
 * này, dù ai thêm loại id nào vào bảng.
 *
 * Tiêu đề toàn ký tự lạ (hoặc rỗng) thì `taoSlug` trả chuỗi rỗng — khi đó trả
 * về id trần thay vì `/id` có gạch chéo thừa ở đầu.
 */
export function duongDanTin(job: { id: string; title: string }): string {
  const slug = taoSlug(job.title)
  return slug ? `${slug}/${job.id}` : job.id
}
