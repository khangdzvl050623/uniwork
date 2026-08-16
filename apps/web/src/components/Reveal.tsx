import type { ReactNode } from 'react'
import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'

/**
 * Hiện dần nội dung khi cuộn tới. Tự tắt khi người dùng bật giảm chuyển động
 * trong hệ điều hành — phần đó xử lý ở index.css.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const [ref, visible] = useInView<HTMLDivElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
  })

  return (
    <div
      ref={ref}
      className={cn('reveal', visible && 'is-visible', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
