import type { ReactNode } from 'react'

/**
 * Băng chạy ngang vô tận. Nội dung được lặp 2 lần rồi dịch trái 50% nên
 * điểm nối trùng khít, không thấy khoảng trống.
 */
export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="marquee-wrap marquee-mask overflow-hidden">
      <div className="animate-marquee flex w-max gap-4">
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}
