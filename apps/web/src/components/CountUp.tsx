import { useEffect, useState } from 'react'
import { useInView } from '@/hooks/useInView'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Số chạy từ 0 lên giá trị đích khi cuộn tới.
 *
 * Chỉ chạy MỘT LẦN, lúc khối này lọt vào khung nhìn. Chạy ngay khi trang vừa tải
 * sẽ phí: người dùng còn chưa nhìn tới thì số đã đếm xong.
 *
 * Hoạt ảnh chạy bằng requestAnimationFrame chứ không phải setInterval. Khác biệt
 * quan trọng: rAF đồng bộ với nhịp vẽ của trình duyệt nên số nhảy mượt, và tự
 * dừng khi người dùng chuyển sang tab khác thay vì chạy vô ích dưới nền.
 *
 * `to` đổi thì số đếm lại từ đầu. Điều này là chủ đích, vì tới ngày số liệu do
 * service đếm thật cung cấp, request về muộn hơn lúc dựng khung — số phải chạy
 * lên tới giá trị mới chứ không đứng im ở số cũ.
 */
export function CountUp({
  to,
  duration = 1600,
  prefix = '',
  suffix = '',
  className,
}: {
  to: number
  /** Thời lượng chạy, tính bằng mili giây. */
  duration?: number
  /** Tiền tố dán sát trước số, ví dụ '▲' hoặc '+'. */
  prefix?: string
  /** Hậu tố dán sát sau số, ví dụ '+' hoặc '%'. */
  suffix?: string
  className?: string
}) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.4 })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return

    // Người dùng bật giảm chuyển động trong hệ điều hành thì hiện thẳng kết quả.
    // Với họ, chữ số nhảy liên tục không phải là hiệu ứng đẹp mà là thứ gây khó chịu.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [inView, to, duration])

  return (
    // tabular-nums bắt mọi chữ số rộng bằng nhau. Thiếu nó thì bề ngang con số
    // co giãn liên tục lúc đang chạy, kéo theo cả khối bên cạnh nhảy qua nhảy lại.
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {formatNumber(value)}
      {suffix}
    </span>
  )
}
