import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'

/**
 * Biểu đồ lượt ứng tuyển theo tuần: một đường vẽ dần và một hàng cột mọc lên
 * khi khối lọt vào khung nhìn.
 *
 * Nhận mảng số chứ không phải mảng đã tính sẵn chiều cao, và không giả định mảng
 * dài đúng 12 phần tử — service đếm sau này muốn trả 8 tuần hay 26 tuần đều vẽ
 * được, chỉ cần đưa mảng vào.
 */
export function MarketChart({
  weeklyApplications,
  changePercent,
}: {
  weeklyApplications: number[]
  /** Thay đổi so với tuần trước, phần trăm. Âm nghĩa là giảm. */
  changePercent: number
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 })

  const weeks = weeklyApplications.length
  const rising = changePercent >= 0

  // Quy mọi giá trị về thang 0–100 theo đỉnh của chính mảng đó. Nếu vẽ theo trị
  // tuyệt đối thì ngày service trả về số hàng nghìn, mọi cột sẽ vọt khỏi khung.
  const peak = Math.max(...weeklyApplications, 1)
  const scaled = weeklyApplications.map((v) => (v / peak) * 100)

  // Toạ độ cho đường gấp khúc, trong hệ 320×80 của viewBox. Chừa 10 đơn vị trên
  // cùng để đỉnh cao nhất không dính sát mép.
  const points = scaled
    .map((v, i) => `${(i * 320) / Math.max(weeks - 1, 1)},${80 - (v / 100) * 70}`)
    .join(' ')

  return (
    <div ref={ref} className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Lượt ứng tuyển {weeks} tuần gần nhất</span>
        <span className={cn('font-medium', rising ? 'text-brand-400' : 'text-rose-400')}>
          {rising ? '▲' : '▼'} {Math.abs(changePercent)}%
        </span>
      </div>

      <svg viewBox="0 0 320 80" className="mt-3 h-20 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14c4ab" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#14c4ab" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Mảng nền dưới đường: chỉ mờ dần hiện ra, và đợi đường vẽ gần xong mới
            bắt đầu. Hiện cùng lúc thì mảng màu che mất chuyển động vẽ đường. */}
        <polygon
          className="chart-area"
          fill="url(#lineFill)"
          points={`0,80 ${points} 320,80`}
          style={{ opacity: inView ? 1 : 0 }}
        />

        {/* pathLength="1" khai với trình duyệt rằng "coi như đường này dài đúng
            1 đơn vị". Nhờ đó dasharray/dashoffset chạy từ 1 về 0 là vẽ trọn
            đường, không cần đo chiều dài thật của đường gấp khúc bằng
            getTotalLength() — vốn phải đợi DOM dựng xong mới đo được. */}
        <polyline
          className="chart-line"
          fill="none"
          stroke="#14c4ab"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          points={points}
          style={{ strokeDashoffset: inView ? 0 : 1 }}
        />
      </svg>

      {/* Cột mọc lên bằng scaleY chứ không phải bằng cách tăng dần `height`.
          Đổi height bắt trình duyệt tính lại bố cục ở từng khung hình; transform
          thì bỏ qua cả bước bố cục lẫn bước vẽ nên chạy thẳng trên GPU. */}
      <div className="mt-5 flex h-24 items-end gap-1.5">
        {scaled.map((v, i) => (
          <div key={i} className="flex-1">
            <div
              className="chart-bar rounded-t bg-gradient-to-t from-brand-700 to-brand-400 hover:from-accent-600 hover:to-accent-400"
              style={{
                height: `${v}%`,
                transform: inView ? 'scaleY(1)' : 'scaleY(0)',
                transitionDelay: `${i * 45}ms`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        <span>Tuần 1</span>
        <span>Tuần {Math.ceil(weeks / 2)}</span>
        <span>Tuần {weeks}</span>
      </div>
    </div>
  )
}
