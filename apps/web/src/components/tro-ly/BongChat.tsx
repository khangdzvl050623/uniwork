import { cn } from '@/lib/utils'
import type { TinNhanUI } from '@/hooks/useTroLy'

/**
 * Khu nào đang dựng bong bóng này.
 *
 * ===========================================================================
 * VÌ SAO PHẢI KHAI, KHÔNG TỰ ĐOÁN ĐƯỢC
 * ===========================================================================
 * Dự án có HAI bảng màu tách hẳn nhau (xem `index.css`): `slate-*`/`brand-*`
 * cho trang công khai, và `dash-*` cho khu quản trị — mà `dash-*` còn đổi theo
 * nút sáng/tối của riêng khu đó.
 *
 * Biến `--dash-*` chỉ tồn tại bên trong thẻ mang `data-dash-theme`. Dùng
 * `bg-dash-surface` ở trang công khai thì nó rơi về màu rỗng: bong bóng trong
 * suốt, chữ đen trên nền trắng, không lỗi nào bắn ra. Chiều ngược lại còn tệ
 * hơn — `bg-white` trong khu quản trị ở chế độ tối là một mảng trắng chói với
 * chữ trắng bên trong, không đọc được.
 */
export type BienChat = 'sang' | 'quan-tri'

const BONG_CUA_TOI: Record<BienChat, string> = {
  sang: 'bg-brand-600 text-white',
  'quan-tri': 'bg-dash-accent text-dash-accent-ink',
}

const BONG_CUA_HO: Record<BienChat, string> = {
  sang: 'border border-slate-200 bg-white text-slate-800',
  'quan-tri': 'border border-dash-line bg-dash-raised text-dash-text',
}

const CHU_PHU: Record<BienChat, string> = {
  sang: 'text-slate-500',
  'quan-tri': 'text-dash-muted',
}

const CON_TRO: Record<BienChat, string> = {
  sang: 'bg-slate-400',
  'quan-tri': 'bg-dash-muted',
}

/**
 * Một bong bóng tin nhắn.
 *
 * Hai luật về chữ, cả hai đều lấy từ hướng dẫn UX chứ không phải thẩm mỹ:
 *
 *   `max-w-prose` — dòng dài quá 75 ký tự thì mắt khó tìm lại đầu dòng sau.
 *   Câu trả lời của trợ lý thường 4–6 câu nên rất dễ tràn hết chiều rộng.
 *
 *   KHÔNG đặt chiều cao cố định. Chữ đang chảy ra nên chiều cao đổi liên tục;
 *   khoá chiều cao là cắt mất chữ ở mức thu phóng lớn hoặc khi người dùng đặt
 *   giãn dòng riêng.
 */
export function BongChat({
  tin,
  tenHo,
  bien = 'sang',
}: {
  tin: TinNhanUI
  /** Tên hiển thị của người kia. Thiếu thì bong bóng của họ không có nhãn. */
  tenHo?: string
  bien?: BienChat
}) {
  if (tin.vai === 'he-thong') {
    return <p className={cn('py-1 text-center text-xs', CHU_PHU[bien])}>{tin.noiDung}</p>
  }

  const cuaToi = tin.vai === 'toi'

  /*
   * Nhãn nhỏ phía trên bong bóng bên trái.
   *
   * Trong hộp thư của nhà tuyển dụng, một hội thoại có BA giọng: sinh viên,
   * trợ lý AI đã trả lời trước đó, và chính họ. Không gắn nhãn thì hai giọng
   * bên trái trông y hệt nhau, và nhà tuyển dụng đi trả lời một câu do máy
   * viết, tưởng là sinh viên hỏi.
   */
  const nhan = tin.vai === 'ai' ? 'Trợ lý AI' : tin.vai === 'ho' ? tenHo : undefined

  return (
    <div className={cn('flex flex-col', cuaToi ? 'items-end' : 'items-start')}>
      {nhan && <span className={cn('mb-0.5 px-1 text-xs', CHU_PHU[bien])}>{nhan}</span>}
      <div
        className={cn(
          'max-w-prose rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          // `whitespace-pre-wrap` giữ xuống dòng model tự đặt — nó hay liệt kê
          // mỗi tin một dòng, gộp lại thành một khối là mất hết cấu trúc.
          'whitespace-pre-wrap break-words',
          cuaToi ? BONG_CUA_TOI[bien] : BONG_CUA_HO[bien],
        )}
      >
        {tin.noiDung}
        {/*
         * Con trỏ nhấp nháy trong lúc chữ còn chảy. Đây là tín hiệu "chưa
         * xong" rẻ nhất — không chiếm chỗ, không đẩy layout, và biến mất ngay
         * khi có sự kiện `xong`.
         */}
        {tin.dangViet && (
          <span
            aria-hidden="true"
            className={cn(
              'ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse motion-reduce:animate-none',
              CON_TRO[bien],
            )}
          />
        )}
      </div>
    </div>
  )
}
