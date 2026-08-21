import { useState } from 'react'
import { useInView } from '@/hooks/useInView'
import { useTween, useTweenArray, useTweenMatrix } from '@/hooks/useTween'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Bộ biểu đồ của khu quản trị.
 *
 * ---------------------------------------------------------------------------
 * MÀU: luôn dùng `var(--dash-*)`, KHÔNG dùng `var(--color-dash-*)`
 * ---------------------------------------------------------------------------
 * Đây từng là một lỗi thật làm mọi đường biểu đồ biến mất ở chế độ tối, nên ghi
 * lại để không ai đi vào lại.
 *
 * Tailwind sinh ra `--color-dash-accent: var(--dash-accent)` và đặt nó ở `:root`.
 * Còn `--dash-accent` thì khai ở `[data-dash-theme='dark']`, tức là một thẻ CON
 * của `:root`. Biến CSS được giải ngay tại nơi nó được khai: `--color-dash-accent`
 * giải ở `:root`, chỗ đó `--dash-accent` chưa tồn tại, nên nó ra giá trị rỗng —
 * và các thẻ con thừa kế đúng cái rỗng đó, không phải công thức để giải lại.
 *
 * Vì vậy `stroke="var(--color-dash-accent)"` cho ra nét trong suốt, còn class
 * `text-dash-accent` lại đúng: `@theme inline` nhét thẳng `var(--dash-accent)`
 * vào lớp tiện ích, và nó được giải tại chính thẻ đang dùng — nơi đã thừa kế
 * được biến từ thẻ bọc.
 *
 * Quy tắc: mọi màu truyền qua `style` hoặc thuộc tính SVG phải là `var(--dash-*)`.
 *
 * ---------------------------------------------------------------------------
 * CHUYỂN ĐỘNG: ba loại, tách hẳn
 * ---------------------------------------------------------------------------
 * 1. Vào trang (1 lần): đường vẽ dần, vòng tròn quét từ 0, thanh chạy từ 0.
 *    ~900ms — mục đích giải thích, mắt đọc được hình dạng dữ liệu khi nó hiện ra.
 * 2. Đổi bộ lọc: số liệu BIẾN HÌNH sang bộ mới, 300ms. Thao tác này làm hàng
 *    chục lần mỗi buổi nên không được phát lại hoạt ảnh vào trang.
 * 3. Rê chuột: con trỏ dọc bám theo, 110ms. Đây là phản hồi trực tiếp cho cử
 *    động của tay — chậm hơn nữa là thấy độ trễ ngay.
 */

/** Thời lượng biến hình khi đổi bộ lọc hoặc đổi tab. */
const MORPH_MS = 300

/* ------------------------------------------------------------------ đường - */

interface Line {
  label: string
  color: string
  values: number[]
}

const VB_W = 600
const VB_H = 200
/** Chừa trên/dưới để đỉnh cao nhất không dính mép và đáy còn chỗ cho vùng tô. */
const PAD_TOP = 18
const PAD_BOTTOM = 12

export function TrendChart({ lines, labels }: { lines: Line[]; labels: string[] }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 })
  const [hover, setHover] = useState<number | null>(null)

  // Tween cả hai chuỗi trong MỘT lời gọi. Chi tiết vì sao không gọi lồng trong
  // vòng lặp nằm ở phần chú thích của useTweenMatrix.
  const series = useTweenMatrix(
    lines.map((l) => l.values),
    MORPH_MS,
  )

  const count = series[0]?.length ?? 0
  // Đỉnh tính chung cho MỌI chuỗi, không phải riêng từng chuỗi. Mỗi chuỗi tự
  // chuẩn hoá theo đỉnh của mình thì hai đường cao bằng nhau trên màn hình dù
  // giá trị thật chênh nhau vài lần — biểu đồ nói dối một cách rất khó phát hiện.
  const peak = Math.max(...series.flat(), 1)

  const xAt = (i: number) => (i * VB_W) / Math.max(count - 1, 1)
  const yAt = (v: number) => VB_H - PAD_BOTTOM - (v / peak) * (VB_H - PAD_TOP - PAD_BOTTOM)

  /**
   * Đổi toạ độ chuột thành chỉ số điểm gần nhất.
   *
   * Tính theo tỉ lệ bề rộng chứ không đọc toạ độ trong hệ SVG: khung vẽ dùng
   * `preserveAspectRatio="none"` nên nó bị kéo giãn, và một đơn vị viewBox không
   * còn tương ứng một pixel. Tỉ lệ thì phép kéo giãn không làm sai được.
   */
  function pointerToIndex(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    if (!box.width) return null
    const ratio = (e.clientX - box.left) / box.width
    return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))))
  }

  const hoverPct = hover === null ? 0 : (hover / Math.max(count - 1, 1)) * 100

  return (
    <div ref={ref}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {lines.map((line) => (
            <span key={line.label} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
              <span className="text-dash-muted">{line.label}</span>
            </span>
          ))}
        </div>
        <span className="text-dash-muted text-[11px] tabular-nums">
          Đỉnh {formatNumber(Math.round(peak))}
        </span>
      </div>

      {/* Khối bắt chuột bọc ngoài khung vẽ. Con trỏ dọc và thẻ chú giải là phần
          tử HTML định vị theo phần trăm chứ không nằm trong SVG — nhờ vậy chúng
          không bị phép kéo giãn của viewBox làm méo chữ. */}
      <div
        className="relative"
        onPointerMove={(e) => setHover(pointerToIndex(e))}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-52 w-full" preserveAspectRatio="none">
          <defs>
            {lines.map((line, i) => (
              <linearGradient key={line.label} id={`trendFill${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={line.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1="0"
              x2={VB_W}
              y1={PAD_TOP + t * (VB_H - PAD_TOP - PAD_BOTTOM)}
              y2={PAD_TOP + t * (VB_H - PAD_TOP - PAD_BOTTOM)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-dash-muted"
              strokeOpacity={0.16}
            />
          ))}

          {series.map((values, i) => {
            const points = values.map((v, x) => `${xAt(x)},${yAt(v)}`).join(' ')
            return (
              <g key={lines[i].label}>
                <polygon
                  fill={`url(#trendFill${i})`}
                  points={`0,${VB_H} ${points} ${VB_W},${VB_H}`}
                />
                {/* pathLength="1" khai "coi như đường này dài đúng 1 đơn vị", bất
                    kể chiều dài thật. Nhờ vậy dashoffset chạy từ 1 về 0 là vẽ
                    trọn đường mà không phải đo bằng getTotalLength() — vốn chỉ
                    đo được sau khi DOM dựng xong. */}
                <polyline
                  className="chart-line"
                  fill="none"
                  stroke={lines[i].color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  pathLength={1}
                  strokeDasharray="1"
                  points={points}
                  style={{
                    strokeDashoffset: inView ? 0 : 1,
                    transitionDelay: `${i * 140}ms`,
                  }}
                />
              </g>
            )
          })}
        </svg>

        {/* ------------------------------------------------------ con trỏ dọc */}
        <div
          aria-hidden
          className={cn(
            'chart-cursor pointer-events-none absolute inset-y-0 w-px',
            hover === null && 'opacity-0',
          )}
          style={{
            left: `${hoverPct}%`,
            background: 'var(--dash-muted)',
            opacity: hover === null ? 0 : 0.45,
          }}
        />

        {hover !== null &&
          series.map((values, i) => (
            <span
              key={lines[i].label}
              aria-hidden
              className="chart-cursor pointer-events-none absolute h-2.5 w-2.5 rounded-full"
              style={{
                left: `${hoverPct}%`,
                top: `${(yAt(values[hover]) / VB_H) * 100}%`,
                marginLeft: -5,
                marginTop: -5,
                background: lines[i].color,
                boxShadow: '0 0 0 3px var(--dash-surface)',
              }}
            />
          ))}

        {hover !== null && (
          <div
            className="chart-tip border-dash-line bg-dash-raised pointer-events-none absolute top-1 z-10 rounded-lg border px-3 py-2 shadow-lg"
            style={{
              left: `${hoverPct}%`,
              // Sát mép trái thì neo bên phải con trỏ, sát mép phải thì ngược
              // lại. Không có bước này thì thẻ chú giải bị cắt cụt ở hai đầu.
              transform: `translateX(${hoverPct < 18 ? '4px' : hoverPct > 82 ? 'calc(-100% - 4px)' : '-50%'})`,
            }}
          >
            <p className="text-dash-muted mb-1.5 text-[11px] whitespace-nowrap">
              {labels[hover] ?? `#${hover + 1}`}
            </p>
            {series.map((values, i) => (
              <p key={lines[i].label} className="flex items-center gap-2 text-xs whitespace-nowrap">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: lines[i].color }}
                />
                <span className="text-dash-muted">{lines[i].label}</span>
                <strong className="ml-auto font-semibold tabular-nums">
                  {formatNumber(Math.round(values[hover]))}
                </strong>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="text-dash-muted mt-2 flex justify-between text-[10px]">
        <span>{labels[0]}</span>
        <span>{labels[Math.floor(labels.length / 2)]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- tròn - */

export function DonutChart({
  slices,
  centerLabel,
}: {
  slices: { label: string; value: number; color: string }[]
  centerLabel: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 })
  const [hover, setHover] = useState<number | null>(null)

  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1
  const totalShown = useTween(total, 900)

  let offset = 0
  const arcs = slices.map((s) => {
    const share = (s.value / total) * 100
    const arc = { ...s, share, offset }
    offset += share
    return arc
  })

  const focused = hover === null ? null : slices[hover]

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-center gap-7">
      <div className="relative h-44 w-44 shrink-0">
        {/* -90° để lát đầu tiên bắt đầu từ đỉnh vòng tròn. Mặc định SVG bắt đầu
            từ cạnh phải, đọc rất phản trực giác với biểu đồ tròn. */}
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="currentColor"
            strokeWidth="11"
            className="text-dash-raised"
          />
          {arcs.map((arc, i) => (
            <circle
              key={arc.label}
              className="chart-arc cursor-pointer"
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={arc.color}
              // Lát đang trỏ tới dày lên 2 đơn vị. Dày lên chứ không sáng lên:
              // đổi độ sáng thì lát nào cũng phải đủ tối lúc bình thường để có
              // chỗ mà sáng, còn đổi bề dày thì màu giữ nguyên độ tương phản.
              strokeWidth={hover === i ? 13 : 11}
              strokeLinecap="butt"
              pathLength={100}
              strokeDasharray={`${arc.share} ${100 - arc.share}`}
              style={{
                strokeDashoffset: inView ? -arc.offset : 100,
                opacity: hover === null || hover === i ? 1 : 0.35,
              }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div
              className="text-xl font-bold tabular-nums"
              style={focused ? { color: focused.color } : undefined}
            >
              {formatNumber(Math.round(focused ? focused.value : totalShown))}
            </div>
            <div className="text-dash-muted max-w-[6.5rem] text-[11px] leading-tight">
              {focused ? focused.label : centerLabel}
            </div>
          </div>
        </div>
      </div>

      <ul className="min-w-0 space-y-1">
        {slices.map((s, i) => (
          <li key={s.label}>
            {/* Chú giải cũng bấm/rê được, không chỉ có vòng tròn. Ô chú giải rộng
                hơn lát nhiều nên với chuột nó là đích dễ trúng hơn hẳn. */}
            <button
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm',
                'transition-[background-color,opacity] duration-150',
                hover !== null && hover !== i && 'opacity-45',
                'hover:bg-dash-raised',
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="text-dash-muted min-w-0 flex-1 truncate">{s.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {Math.round((s.value / total) * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ thanh - */

export function ProgressRow({
  label,
  current,
  target,
  color,
}: {
  label: string
  current: number
  target: number
  color: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.4 })
  const percent = Math.min((current / Math.max(target, 1)) * 100, 100)

  return (
    <div ref={ref} className="group">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-dash-muted min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">
          <strong className="font-semibold">{formatNumber(current)}</strong>
          <span className="text-dash-muted"> / {formatNumber(target)}</span>
          <span className="text-dash-muted ml-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {Math.round(percent)}%
          </span>
        </span>
      </div>

      <div className="bg-dash-raised mt-2 h-2 overflow-hidden rounded-full">
        {/* Chạy bằng scaleX chứ không phải tăng dần `width`. Đổi width bắt trình
            duyệt tính lại bố cục ở mỗi khung hình; transform bỏ qua cả bước bố
            cục lẫn bước vẽ nên chạy thẳng trên GPU. transform-origin phải đặt
            tay là `left`, mặc định `center` khiến thanh nở ra từ giữa. */}
        <div
          className="chart-bar-h h-full rounded-full"
          style={{ background: color, transform: `scaleX(${inView ? percent / 100 : 0})` }}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- sparkline - */

/** Biểu đồ tí hon dưới đáy ô KPI. Không trục, không nhãn — chỉ để đọc dáng. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const data = useTweenArray(values, MORPH_MS)
  const peak = Math.max(...data, 1)
  const low = Math.min(...data, 0)
  const span = Math.max(peak - low, 1)

  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`
  const points = data
    .map((v, i) => `${(i * 100) / Math.max(data.length - 1, 1)},${28 - ((v - low) / span) * 24}`)
    .join(' ')

  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${id})`} points={`0,30 ${points} 100,30`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------- phụ -- */

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'wait' | 'bad'
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        tone === 'ok' && 'bg-dash-ok/12 text-dash-ok',
        tone === 'wait' && 'bg-dash-wait/12 text-dash-wait',
        tone === 'bad' && 'bg-dash-bad/12 text-dash-bad',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
