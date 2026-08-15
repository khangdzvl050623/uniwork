import { useEffect, useRef, useState } from 'react'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Số chạy từ 0 lên giá trị đích khi cuộn tới.
 *
 * Chỉ chạy MỘT LẦN, lúc khối này lọt vào khung nhìn — dùng IntersectionObserver
 * giống Reveal, không gắn listener scroll. Chạy ngay khi trang vừa tải sẽ phí:
 * người dùng còn chưa nhìn tới thì số đã đếm xong.
 *
 * Hoạt ảnh chạy bằng requestAnimationFrame chứ không phải setInterval. Khác biệt
 * quan trọng: rAF đồng bộ với nhịp vẽ của trình duyệt nên số nhảy mượt, và tự
 * dừng khi người dùng chuyển sang tab khác thay vì chạy vô ích dưới nền.
 */
export function CountUp({
  to,
  duration = 1600,
  suffix = '',
  className,
}: {
  to: number
  /** Thời lượng chạy, tính bằng mili giây. */
  duration?: number
  /** Hậu tố dán sát sau số, ví dụ '+' hoặc '%'. */
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Người dùng bật giảm chuyển động trong hệ điều hành thì hiện thẳng kết quả.
    // Với họ, chữ số nhảy liên tục không phải là hiệu ứng đẹp mà là thứ gây khó chịu.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setValue(to)
      return
    }

    let frame = 0
    let startedAt = 0

    const step = (now: number) => {
      if (!startedAt) startedAt = now
      const progress = Math.min((now - startedAt) / duration, 1)

      // easeOutExpo: vọt nhanh lúc đầu rồi chậm dần về đích. Tuyến tính đều đều
      // trông như máy đang đếm; kiểu này giống một con số đang "chốt lại".
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      setValue(Math.round(to * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.4 },
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [to, duration])

  return (
    // tabular-nums bắt mọi chữ số rộng bằng nhau. Thiếu nó thì bề ngang con số
    // co giãn liên tục lúc đang chạy, kéo theo cả khối bên cạnh nhảy qua nhảy lại.
    <span ref={ref} className={cn('tabular-nums', className)}>
      {formatNumber(value)}
      {suffix}
    </span>
  )
}
