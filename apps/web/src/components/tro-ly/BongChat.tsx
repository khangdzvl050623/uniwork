import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { gioPhut } from '@/lib/gop-tin'
import type { TinNhanUI } from '@/hooks/useTroLy'

export type BienChat = 'sang' | 'quan-tri'

const BONG_CUA_TOI: Record<BienChat, string> = {
  sang: 'bg-gradient-to-r from-brand-600 to-teal-600 text-white shadow-2xs rounded-br-xs',
  'quan-tri': 'bg-dash-accent text-dash-accent-ink rounded-br-xs',
}

const BONG_CUA_HO: Record<BienChat, string> = {
  sang: 'border border-slate-200/90 bg-white text-slate-800 shadow-2xs rounded-bl-xs',
  'quan-tri': 'border border-dash-line bg-dash-raised text-dash-text rounded-bl-xs',
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
  hienGio = false,
}: {
  tin: TinNhanUI
  /** Tên hiển thị của người kia. Thiếu thì bong bóng của họ không có nhãn. */
  tenHo?: string
  bien?: BienChat
  /**
   * Hiện giờ dưới bong bóng.
   *
   * Do `danhDauThoiGian` quyết, KHÔNG phải component tự suy: nó chỉ bật ở tin
   * cuối của một chuỗi cùng người nói, mà quyết định đó cần nhìn cả tin kế
   * tiếp — thứ component này không có.
   */
  hienGio?: boolean
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
      {nhan && (
        <span className={cn('mb-1 flex items-center gap-1 px-1 text-xs font-medium', CHU_PHU[bien])}>
          {tin.vai === 'ai' && <Sparkles size={11} className="text-brand-600" aria-hidden="true" />}
          {nhan}
        </span>
      )}
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

      {hienGio && tin.luc && (
        <span className={cn('mt-0.5 px-1 text-[11px] tabular-nums', CHU_PHU[bien])}>
          {gioPhut(tin.luc)}
        </span>
      )}
    </div>
  )
}
