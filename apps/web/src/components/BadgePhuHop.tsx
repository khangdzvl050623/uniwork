import { CalendarCheck, CalendarX } from 'lucide-react'
import { NGUONG_PHU_HOP, type PublicJobSummary } from '@uniwork/shared'
import { cn } from '@/lib/utils'

interface Props {
  job: Pick<PublicJobSummary, 'matchScore' | 'eligible' | 'matchedShifts' | 'totalJobShifts'>
  /** Bản to dùng ở cột phải trang chi tiết. Mặc định là chip nhỏ trên thẻ tin. */
  to?: boolean
}

/**
 * Badge kết quả ghép lịch.
 *
 * ---------------------------------------------------------------------------
 * `null` THÌ KHÔNG VẼ GÌ CẢ — QUYẾT ĐỊNH CÓ CHỦ ĐÍCH
 * ---------------------------------------------------------------------------
 * `matchScore === null` nghĩa là chưa đo được: khách chưa đăng nhập, nhà tuyển
 * dụng đang xem, hoặc sinh viên chưa khai lịch rảnh.
 *
 * Cách làm sai thứ nhất là hiện "0%" — nói với người dùng rằng tin này không
 * hợp với họ, trong khi sự thật là hệ thống chưa biết gì về họ.
 *
 * Cách làm sai thứ hai là hiện "Khai lịch rảnh để xem độ phù hợp" trên TỪNG
 * thẻ. Trang việc làm vẽ tới 100 thẻ — lời mời đó lặp lại 100 lần trở thành
 * tiếng ồn, và nó đẩy nội dung thật (lương, khu vực, ca làm) xuống dưới. Lời
 * mời khai lịch xuất hiện ĐÚNG MỘT LẦN ở đầu trang danh sách (`JobList`).
 *
 * ---------------------------------------------------------------------------
 * KHÔNG ĐỦ ĐIỀU KIỆN THÌ NÓI THẲNG, KHÔNG CHỈ HIỆN MỘT CON SỐ THẤP
 * ---------------------------------------------------------------------------
 * Tin mở 20 ca cần tối thiểu 5, bạn rảnh 3 ca → 15%. Con số đó một mình đọc
 * thành "hơi kém hợp", trong khi sự thật cứng hơn nhiều: **bạn không nhận được
 * việc này**. Hai chuyện khác nhau nên hình dạng badge cũng phải khác nhau —
 * `eligible: false` đổi luôn icon và câu chữ, không chỉ đổi màu.
 */
export function BadgePhuHop({ job, to }: Props) {
  const { matchScore, eligible, matchedShifts, totalJobShifts } = job

  if (matchScore === null) return null

  const bac =
    eligible === false
      ? 'khong-du'
      : matchScore >= NGUONG_PHU_HOP.cao
        ? 'cao'
        : matchScore >= NGUONG_PHU_HOP.vua
          ? 'vua'
          : 'thap'

  const soCa = `${matchedShifts}/${totalJobShifts} ca`

  return (
    <span
      // Trình đọc màn hình nhận câu đầy đủ; mắt thường chỉ cần con số. Không có
      // dòng này thì người dùng bàn phím nghe thấy "40%" trơ trọi giữa thẻ tin
      // và không biết 40% của cái gì.
      aria-label={
        eligible === false
          ? `Không đủ điều kiện: bạn chỉ rảnh ${soCa} của tin này`
          : `Khớp ${matchScore}% ca làm với lịch rảnh của bạn, ${soCa}`
      }
      title={
        eligible === false
          ? `Bạn rảnh ${soCa} — chưa đạt số ca tối thiểu tin này yêu cầu`
          : `Bạn rảnh ${soCa} nhà tuyển dụng mở`
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold tabular-nums',
        // `transition-colors` chứ không `transition-all`: badge đổi màu khi
        // người dùng sửa lịch rảnh và danh sách tải lại. Chỉ màu cần mượt, còn
        // kích thước thì đổi tức thì mới không làm cả thẻ tin nhấp nhô.
        'transition-colors duration-150 ease-out',
        to ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-[11px]',
        bac === 'cao' && 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
        bac === 'vua' && 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
        // Dưới 40% nhưng VẪN nhận được việc: màu trung tính, KHÔNG dùng đỏ. Đỏ
        // đọc thành "lỗi"; đây chỉ là một tin ít trùng lịch, không có gì sai cả.
        bac === 'thap' && 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200',
        // Không đủ điều kiện mới là thông tin cần cảnh báo thật.
        bac === 'khong-du' && 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
      )}
    >
      {bac === 'khong-du' ? (
        <>
          <CalendarX size={to ? 15 : 12} aria-hidden />
          {to ? `Chưa đủ số ca — bạn rảnh ${soCa}` : 'Chưa đủ ca'}
        </>
      ) : (
        <>
          <CalendarCheck size={to ? 15 : 12} aria-hidden />
          {matchScore}%
          {to && ` khớp lịch — ${soCa}`}
        </>
      )}
    </span>
  )
}
