import { useEffect, useRef, type ReactNode } from 'react'
import createGlobe from 'cobe'
import { cn } from '@/lib/utils'

/**
 * Quả địa cầu WebGL, dựng trên cobe.
 *
 * Lấy về bằng `npx uilayouts@latest add globe`. Bản gốc của uilayouts viết cho
 * Next.js nên ở đây có sửa lại vài chỗ:
 *
 * - Bỏ `'use client'` (dự án này là Vite, không có React Server Components).
 * - Bản gốc gắn listener `resize` mà không gỡ, và cũng không dựng lại quả cầu
 *   khi kích thước đổi — nên đổi bề rộng cửa sổ là hình bị méo. Ở đây dùng
 *   ResizeObserver và dựng lại đúng lúc cần.
 * - Bản gốc không huỷ quả cầu cũ trước khi tạo cái mới, nên mỗi lần dựng lại là
 *   rò một ngữ cảnh WebGL. Trình duyệt chỉ cho phép một số lượng hữu hạn, đủ
 *   nhiều lần sẽ tắt hẳn ngữ cảnh cũ nhất và quả cầu biến mất.
 *
 * Vòng quay vẫn chạy bằng requestAnimationFrame + `globe.update()` như bản gốc,
 * vì cobe v2 chỉ để lộ đúng `update()` và `destroy()` — không có callback theo
 * khung hình để móc vào.
 * - Thêm phần tôn trọng `prefers-reduced-motion`: quả cầu đứng yên chứ không
 *   biến mất, người dùng vẫn thấy đủ hình.
 *
 * Không dùng `markers`. Ban đầu có chấm đánh dấu mấy thành phố lớn, nhưng cobe
 * vẽ chúng thành đốm tròn đặc nằm đè lên bề mặt, và ở cỡ này chúng đọc ra thành
 * vết bẩn chứ không ra điểm trên bản đồ. Bỏ hẳn thay vì thu nhỏ: một chi tiết
 * chỉ "đỡ xấu" khi bị thu nhỏ thì vốn dĩ không nên có.
 */

export function Earth({ className, children }: { className?: string; children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let phi = 0
    let width = 0
    let globe: ReturnType<typeof createGlobe> | null = null
    let frame = 0

    const build = () => {
      const next = canvas.offsetWidth
      // Bề rộng 0 nghĩa là khối chưa được dựng xong. Gọi cobe lúc này sẽ tạo một
      // canvas rỗng và không bao giờ tự sửa, nên thà không dựng rồi để
      // ResizeObserver gọi lại khi có kích thước thật.
      if (!next || next === width) return
      width = next

      // Huỷ trước khi tạo mới. Mỗi quả cầu giữ một ngữ cảnh WebGL, mà trình
      // duyệt chỉ cho phép chừng 16 cái cùng lúc — không dọn thì kéo giãn cửa
      // sổ vài chục lần là cái cũ nhất bị thu hồi và canvas trắng bóc.
      globe?.destroy()
      globe = createGlobe(canvas, {
        devicePixelRatio: 2,
        width: width * 2,
        height: width * 2,
        phi,
        theta: 0.26,
        dark: 1,
        diffuse: 1.3,
        // Quả cầu ăn gần hết khung vẽ. Dưới 1 thì nó lọt thỏm giữa một vùng
        // trống lớn và trông như hình minh hoạ bị đặt nhầm chỗ.
        scale: 1.15,
        mapSamples: 22_000,
        mapBrightness: 6.2,
        baseColor: [0.07, 0.46, 0.42],
        markerColor: [0.07, 0.46, 0.42],
        glowColor: [0.09, 0.68, 0.61],
        opacity: 1,
        offset: [0, 0],
        markers: [],
      })
    }

    // Dựng lại khi kích thước đổi. cobe khoá kích thước canvas ngay lúc tạo nên
    // không có cách nào chỉnh sau, buộc phải huỷ rồi tạo mới.
    const observer = new ResizeObserver(build)
    observer.observe(canvas)
    build()

    // Người bật giảm chuyển động thì quả cầu đứng yên: vẫn thấy đủ Trái Đất và
    // các điểm đánh dấu, chỉ không quay. Không dựng vòng lặp luôn, thay vì dựng
    // rồi cộng 0 vào phi mỗi khung hình.
    if (!reduceMotion) {
      const spin = () => {
        phi += 0.0032
        globe?.update({ phi })
        frame = requestAnimationFrame(spin)
      }
      frame = requestAnimationFrame(spin)
    }

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      globe?.destroy()
    }
  }, [])

  return (
    <div className={cn('relative mx-auto w-full max-w-[620px]', className)}>
      {/* Quầng sáng phía sau, tách quả cầu khỏi nền tối. Không có nó thì rìa quả
          cầu chìm dần vào nền và cả khối trông như một vệt mờ. Đứng yên hoàn
          toàn nên trình duyệt chỉ vẽ đúng một lần. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(20,196,171,0.22) 0%, rgba(20,196,171,0.07) 42%, transparent 68%)',
        }}
      />

      <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: '1' }} aria-hidden />

      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  )
}
