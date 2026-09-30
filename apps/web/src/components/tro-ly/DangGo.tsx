import { cn } from '@/lib/utils'
import type { BienChat } from '@/components/tro-ly/BongChat'

/**
 * Ba chấm "đang gõ", đặt đúng chỗ bong bóng sắp hiện ra.
 *
 * ===========================================================================
 * VÌ SAO NÓ CHIẾM CHỖ THẬT, KHÔNG NỔI LƠ LỬNG
 * ===========================================================================
 * Đặt nó ở cuối danh sách, cùng kích thước một bong bóng ngắn. Khi tin thật
 * tới, nó biến mất và bong bóng thế vào — không có cú nhảy layout nào.
 *
 * Bản đặt nổi (absolute, overlay) thì lúc tin tới cả danh sách giật lên một
 * dòng, và trên màn hình nhỏ cú giật đó đủ để người đọc mất chỗ.
 *
 * ---------------------------------------------------------------------------
 * `motion-reduce` KHÔNG PHẢI TÙY CHỌN
 * ---------------------------------------------------------------------------
 * Ba chấm nảy liên tục là đúng loại chuyển động gây khó chịu cho người nhạy
 * cảm với chuyển động. Tắt animation thì ba chấm vẫn còn — thông tin không
 * mất, chỉ đứng yên.
 */
export function DangGo({ ten, bien = 'sang' }: { ten: string; bien?: BienChat }) {
  const mau =
    bien === 'sang'
      ? { chu: 'text-slate-500', nen: 'border border-slate-200 bg-white', cham: 'bg-slate-400' }
      : { chu: 'text-dash-muted', nen: 'border border-dash-line bg-dash-raised', cham: 'bg-dash-muted' }

  return (
    <div className="flex flex-col items-start">
      <span className={cn('mb-0.5 px-1 text-xs', mau.chu)}>{ten}</span>
      <div
        /*
         * `role="status"` chứ không `aria-live="assertive"`: trình đọc màn hình
         * thông báo khi rảnh, không cắt ngang câu đang đọc dở. "Đang gõ" không
         * đáng để ngắt lời ai.
         */
        role="status"
        className={cn('flex items-center gap-1 rounded-2xl px-4 py-3', mau.nen)}
      >
        <span className="sr-only">{ten} đang trả lời</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn('h-1.5 w-1.5 rounded-full', mau.cham, 'animate-bounce motion-reduce:animate-none')}
            /* Lệch pha để ba chấm nảy nối nhau chứ không nảy cùng lúc. */
            style={{ animationDelay: `${i * 140}ms`, animationDuration: '900ms' }}
          />
        ))}
      </div>
    </div>
  )
}
