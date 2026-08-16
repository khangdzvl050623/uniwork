import { useEffect, useRef, useState } from 'react'

/**
 * Báo khi phần tử lọt vào khung nhìn lần đầu.
 *
 * Dùng IntersectionObserver chứ không phải listener `scroll`: trình duyệt tự
 * theo dõi ở tầng dưới và chỉ gọi lại đúng lúc cắt ngưỡng, thay vì bắt JavaScript
 * chạy và đo toạ độ ở mỗi khung hình cuộn.
 *
 * Cờ chỉ bật MỘT LẦN rồi observer tự ngắt. Hiệu ứng "hiện ra khi cuộn tới" mà
 * chạy lại mỗi lần cuộn qua sẽ thành nhấp nháy, và người dùng cuộn lên cuộn
 * xuống vài lượt là thấy phiền ngay.
 *
 * Trước đây Reveal và CountUp mỗi bên tự dựng observer riêng với logic y hệt.
 * Gom về một chỗ để sửa ngưỡng hay lề chỉ phải sửa một lần.
 */
export function useInView<T extends Element>({
  /** Bao nhiêu phần trăm phần tử phải lộ ra thì mới tính là đã thấy. */
  threshold = 0.15,
  /** Nới hoặc thu khung nhìn. Số âm khiến hiệu ứng chạy muộn hơn một chút. */
  rootMargin = '0px',
}: { threshold?: number; rootMargin?: string } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Người dùng bật giảm chuyển động thì bật cờ ngay, không cần đợi cuộn tới.
    //
    // Đây không chỉ là bỏ hiệu ứng cho gọn. Nhiều khối dùng cờ này để quyết định
    // trạng thái ĐẦU của mình — cột biểu đồ cao 0, lát biểu đồ tròn nằm ngoài
    // vòng. Nếu chỉ tắt transition mà cờ vẫn false thì những khối đó ở nguyên
    // trạng thái đầu, tức là người dùng nhìn thấy một biểu đồ trống trơn: mất
    // luôn nội dung chứ không phải mất hiệu ứng.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setInView(true)
        observer.disconnect()
      },
      { threshold, rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
    // threshold và rootMargin là số/chuỗi nên so sánh được theo giá trị. Nếu
    // nhận nguyên cả object options thì mỗi lần render lại là một object mới,
    // effect chạy lại và observer bị dựng đi dựng lại vô ích.
  }, [threshold, rootMargin])

  return [ref, inView] as const
}
