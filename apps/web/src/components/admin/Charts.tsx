import { useInView } from '@/hooks/useInView'
import { useTween, useTweenArray } from '@/hooks/useTween'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Bộ biểu đồ của khu quản trị.
 *
 * ---------------------------------------------------------------------------
 * Nguyên tắc chuyển động dùng chung cho cả file
 * ---------------------------------------------------------------------------
 * Có hai loại chuyển động ở đây và chúng KHÔNG được lẫn vào nhau:
 *
 * 1. Vào trang (chạy đúng một lần) — đường vẽ dần từ trái sang, vòng tròn quét
 *    từ 0, thanh chạy từ 0. Mục đích là giải thích: mắt đọc được hình dạng dữ
 *    liệu trong lúc nó đang được vẽ ra. ~900ms, chấp nhận được vì chỉ một lần.
 *
 * 2. Đổi bộ lọc 7 ngày / 30 ngày / 90 ngày — số liệu BIẾN HÌNH từ bộ cũ sang bộ
 *    mới, không vẽ lại từ đầu. Đây là thao tác người dùng làm hàng chục lần mỗi
 *    buổi; bắt xem lại hoạt ảnh vào trang mỗi lần bấm thì đến lần thứ ba đã thấy
 *    phiền. 300ms, vừa đủ để mắt bám theo được là hình đang đổi chứ không phải
 *    nhảy cóc.
 *
 * Cách tách hai loại: hoạt ảnh vào trang gắn vào `stroke-dashoffset` bằng
 * transition của CSS và chỉ kích một lần khi khối lọt vào khung nhìn. Phần biến
 * hình nằm ở chính các con số, do useTweenArray nội suy. Hai cơ chế độc lập nên
 * đổi bộ lọc không bao giờ làm hoạt ảnh vẽ đường chạy lại.
 */

/** Thời lượng biến hình khi đổi bộ lọc hoặc đổi tab. */
const MORPH_MS = 300

/* ------------------------------------------------------------------ đường - */

interface Line {
  label: string
  color: string
  values: number[]
}

export function TrendChart({ lines, labels }: { lines: Line[]; labels: string[] }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 })

  return (
    <div ref={ref}>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {lines.map((line) => (
          <span key={line.label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
            <span className="text-dash-muted">{line.label}</span>
          </span>
        ))}
      </div>

      <svg viewBox="0 0 600 200" className="h-52 w-full" preserveAspectRatio="none">
        <defs>
          {lines.map((line, i) => (
            <linearGradient key={line.label} id={`trendFill${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={line.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={line.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Bốn đường kẻ ngang mờ. Không có nhãn trục: ở cỡ này nhãn chỉ làm rối,
            con số chính xác đã nằm ở các ô KPI phía trên. */}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            x2="600"
            y1={40 + i * 45}
            y2={40 + i * 45}
            stroke="currentColor"
            strokeWidth="1"
            className="text-dash-line"
          />
        ))}

        {lines.map((line, i) => (
          <TrendLine key={line.label} line={line} index={i} inView={inView} />
        ))}
      </svg>

      <div className="text-dash-muted mt-2 flex justify-between text-[10px]">
        <span>{labels[0]}</span>
        <span>{labels[Math.floor(labels.length / 2)]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  )
}

function TrendLine({ line, index, inView }: { line: Line; index: number; inView: boolean }) {
  const values = useTweenArray(line.values, MORPH_MS)

  // Quy về thang 0–100 theo đỉnh của chính chuỗi này. Vẽ theo trị tuyệt đối thì
  // ngày service trả về số hàng nghìn là đường vọt khỏi khung.
  const peak = Math.max(...values, 1)
  const points = values
    .map((v, i) => `${(i * 600) / Math.max(values.length - 1, 1)},${190 - (v / peak) * 165}`)
    .join(' ')

  return (
    <>
      <polygon fill={`url(#trendFill${index})`} points={`0,200 ${points} 600,200`} opacity={0.9} />
      {/* pathLength="1" khai "coi như đường này dài đúng 1 đơn vị", bất kể chiều
          dài thật. Nhờ vậy dashoffset chạy từ 1 về 0 là vẽ trọn đường mà không
          phải đo bằng getTotalLength() — vốn chỉ đo được sau khi DOM dựng xong,
          tức là muộn hơn lúc cần một khung hình. */}
      <polyline
        className="chart-line"
        fill="none"
        stroke={line.color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        points={points}
        style={{
          strokeDashoffset: inView ? 0 : 1,
          // Lệch nhau 140ms giữa hai đường, để mắt đọc ra là hai chuỗi riêng
          // biệt thay vì một mảng màu cùng bò ra một lúc.
          transitionDelay: `${index * 140}ms`,
        }}
      />
    </>
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
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1
  const totalShown = useTween(total, 900)

  // Điểm bắt đầu dồn dần của từng lát, tính theo phần trăm chu vi.
  let offset = 0
  const arcs = slices.map((s) => {
    const share = (s.value / total) * 100
    const arc = { ...s, share, offset }
    offset += share
    return arc
  })

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
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              className="chart-arc"
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={arc.color}
              strokeWidth="11"
              strokeLinecap="butt"
              pathLength={100}
              // Lát vẽ dài `share`, phần còn lại của vòng để trống.
              strokeDasharray={`${arc.share} ${100 - arc.share}`}
              // Chưa vào khung nhìn thì đẩy lát ra khỏi chỗ của nó, nên vòng
              // tròn quét dần từ 0 lên khi cuộn tới.
              style={{ strokeDashoffset: inView ? -arc.offset : 100 }}
            />
          ))}
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-xl font-bold tabular-nums">
              {formatNumber(Math.round(totalShown))}
            </div>
            <div className="text-dash-muted text-[11px]">{centerLabel}</div>
          </div>
        </div>
      </div>

      <ul className="min-w-0 space-y-2.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="text-dash-muted min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {Math.round((s.value / total) * 100)}%
            </span>
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
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-dash-muted min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">
          <strong className="font-semibold">{formatNumber(current)}</strong>
          <span className="text-dash-muted"> / {formatNumber(target)}</span>
        </span>
      </div>

      <div className="bg-dash-raised mt-2 h-2 overflow-hidden rounded-full">
        {/* Chạy bằng scaleX chứ không phải tăng dần `width`. Đổi width bắt trình
            duyệt tính lại bố cục ở mỗi khung hình; transform bỏ qua cả bước bố
            cục lẫn bước vẽ nên chạy thẳng trên GPU. transform-origin phải là
            `left`, mặc định `center` sẽ khiến thanh nở ra từ giữa về hai phía. */}
        <div
          className="chart-bar-h h-full rounded-full"
          style={{
            background: color,
            transform: `scaleX(${inView ? percent / 100 : 0})`,
          }}
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

  const points = data
    .map((v, i) => `${(i * 100) / Math.max(data.length - 1, 1)},${28 - ((v - low) / span) * 24}`)
    .join(' ')

  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none">
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
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
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
