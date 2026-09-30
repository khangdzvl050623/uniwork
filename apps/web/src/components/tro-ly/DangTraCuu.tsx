import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

/**
 * Chỉ báo "đang tra cứu" — thay cho spinner trần.
 *
 * ===========================================================================
 * VÌ SAO KHÔNG PHẢI MỘT CÁI SPINNER
 * ===========================================================================
 * Đo thật 2026-09-28: độ trễ Gemini free tier chia hai cụm — hoặc ~1 giây,
 * hoặc **15–25 giây** — và không liên quan tới kích thước prompt hay số tool.
 * Một lượt bốn bước rơi cụm chậm là gần 100 giây.
 *
 * Spinner quay 25 giây không nói được gì ngoài "hệ thống chưa chết". Người
 * dùng không biết còn bao lâu, không biết đang làm gì, và bắt đầu bấm lại.
 *
 * Nên chỉ báo này nói HAI điều spinner không nói được:
 *   1. **Đang làm gì** — tên tool dịch sang câu tiếng Việt người đọc hiểu.
 *   2. **Đã chờ bao lâu** — đếm giây, và sau 8 giây thì nói rõ là bình thường.
 *
 * Đây là thông tin thật, không phải thanh tiến trình giả. Ta KHÔNG biết còn
 * bao lâu nữa, nên không vẽ một thanh chạy tới 90 % rồi đứng — thứ đó làm mất
 * niềm tin nhanh hơn là không có gì.
 */

/**
 * Tên tool → câu người đọc hiểu.
 *
 * Model gọi `xemDonUngTuyenCuaToi`; người dùng cần đọc "đang xem đơn ứng tuyển
 * của bạn". Thiếu bảng này thì chỉ báo hiện tên hàm ra màn hình.
 */
const NHAN_TOOL: Record<string, string> = {
  timViecLam: 'Đang tìm việc phù hợp',
  xemChiTietViec: 'Đang mở chi tiết tin',
  xemLichRanhCuaToi: 'Đang xem lịch rảnh của bạn',
  xemHoSoCuaToi: 'Đang xem hồ sơ của bạn',
  xemDonUngTuyenCuaToi: 'Đang xem đơn ứng tuyển của bạn',
  xemTinDaLuu: 'Đang xem tin bạn đã lưu',
  danhMucKyNang: 'Đang tra danh mục kỹ năng',
  huongDanSuDung: 'Đang tra hướng dẫn sử dụng',
  deNghiChuyenNhaTuyenDung: 'Đang chuẩn bị lời đề nghị',
}

/** Sau ngần này giây thì nói rõ chờ lâu là bình thường, đừng bấm lại. */
const GIAY_TRAN_AN = 8

export function DangTraCuu({ tool }: { tool: string | null }) {
  const [giay, setGiay] = useState(0)

  useEffect(() => {
    const dem = setInterval(() => setGiay((s) => s + 1), 1000)
    return () => clearInterval(dem)
  }, [])

  const nhan = tool === null ? 'Trợ lý đang soạn câu trả lời' : (NHAN_TOOL[tool] ?? 'Đang tra cứu')

  return (
    <div
      /*
       * `role="status"` + `aria-atomic` để trình đọc màn hình đọc TRỌN một câu
       * có nghĩa mỗi lần đổi, thay vì đọc rời từng con số giây. Không đặt
       * `aria-live="assertive"` — nó cắt ngang mọi thứ người dùng đang nghe,
       * mà đây chỉ là tin phụ.
       */
      role="status"
      aria-atomic="true"
      aria-busy="true"
      className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3"
    >
      <Search size={16} className="shrink-0 text-brand-600" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-800">
          {nhan}
          {/*
           * Ba chấm nhấp nháy lệch pha. `motion-reduce` tắt hẳn — người bật
           * "giảm chuyển động" thường bật vì chuyển động gây khó chịu thật,
           * không phải vì thẩm mỹ.
           */}
          <span aria-hidden="true">
            {[0, 150, 300].map((tre) => (
              <span
                key={tre}
                className="animate-pulse motion-reduce:animate-none"
                style={{ animationDelay: `${tre}ms` }}
              >
                .
              </span>
            ))}
          </span>
        </p>

        {giay >= GIAY_TRAN_AN && (
          <p className="mt-0.5 text-xs text-brand-700/80">
            Đã chờ {giay} giây. Máy chủ AI đang bận, việc này có thể mất 15–30 giây — bạn không cần
            gửi lại.
          </p>
        )}
      </div>
    </div>
  )
}
