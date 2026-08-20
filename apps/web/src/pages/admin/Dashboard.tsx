import { useState } from 'react'
import { Building2, ClipboardCheck, GraduationCap, Users } from 'lucide-react'
import { SCHEDULE_TYPES, STATS_RANGES, type StatsRange } from '@uniwork/shared'
import { DonutChart, ProgressRow, StatusBadge, TrendChart } from '@/components/admin/Charts'
import { KpiCard } from '@/components/admin/KpiCard'
import { useAdminStats } from '@/hooks/useAdminStats'
import { SCHEDULE_TYPE_LABELS } from '@/data/mock'
import { cn, formatDate } from '@/lib/utils'

const RANGE_LABELS: Record<StatsRange, string> = {
  '7d': '7 ngày',
  '30d': '30 ngày',
  '90d': '90 ngày',
  '1y': '1 năm',
}

/** Một màu cho một loại dữ liệu, không lặp giữa các biểu đồ trên cùng trang. */
const COLORS = {
  accent: 'var(--dash-accent)',
  teal: 'var(--dash-teal)',
  blue: 'var(--dash-blue)',
  violet: 'var(--dash-violet)',
  orange: 'var(--dash-orange)',
}

const SCHEDULE_COLORS: Record<(typeof SCHEDULE_TYPES)[number], string> = {
  RECURRING: COLORS.teal,
  ONE_TIME: COLORS.violet,
  SEASONAL: COLORS.orange,
}

/** Hàng chờ duyệt gần nhất. Sẽ thay bằng dữ liệu thật ở bước dựng trang duyệt tin. */
const QUEUE = [
  {
    name: 'The Corner Coffee',
    title: 'Phục vụ quán cà phê ca tối',
    at: '12 phút trước',
    state: 'wait',
  },
  {
    name: 'Sao Việt Event',
    title: 'Nhân viên hỗ trợ sự kiện âm nhạc',
    at: '38 phút trước',
    state: 'wait',
  },
  {
    name: 'DataLine Việt Nam',
    title: 'Cộng tác viên nhập liệu online',
    at: '2 giờ trước',
    state: 'ok',
  },
  {
    name: 'Anh ngữ Sunrise',
    title: 'Trợ giảng lớp tiếng Anh thiếu nhi',
    at: '3 giờ trước',
    state: 'bad',
  },
  {
    name: 'Siêu thị Minh Phát',
    title: 'Nhân viên bán hàng thời vụ Tết',
    at: '5 giờ trước',
    state: 'wait',
  },
] as const

const STATE_TEXT = { ok: 'Đã duyệt', wait: 'Chờ duyệt', bad: 'Từ chối' } as const

/**
 * Màu nền avatar suy ra từ tên.
 *
 * Cộng mã ký tự rồi chia lấy dư — cùng một tên luôn ra cùng một màu, ở mọi trang
 * và sau mọi lần tải lại. Dùng Math.random thì mỗi lần vẽ lại là một màu khác,
 * và avatar mất luôn tác dụng nhận diện vốn là lý do nó tồn tại.
 */
const AVATAR_COLORS = [COLORS.teal, COLORS.blue, COLORS.violet, COLORS.orange, COLORS.accent]

function avatarColor(name: string) {
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function AdminDashboard() {
  const [range, setRange] = useState<StatsRange>('30d')
  const stats = useAdminStats(range)

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ đầu trang */}
      <div className="dash-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Bảng điều khiển</h1>
          <p className="text-dash-muted mt-1 text-sm">
            Số liệu tính tới {formatDate(stats.computedAt)}
          </p>
        </div>

        {/* Bộ lọc khoảng thời gian. Đổi mục ở đây làm mọi biểu đồ bên dưới biến
            hình sang bộ số mới, không vẽ lại từ đầu. */}
        <div
          role="tablist"
          aria-label="Khoảng thời gian"
          className="border-dash-line bg-dash-surface flex gap-0.5 rounded-lg border p-1"
        >
          {STATS_RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150',
                range === r
                  ? 'bg-dash-accent/12 text-dash-accent'
                  : 'text-dash-muted hover:text-dash-text',
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ KPI */}
      <div
        className="dash-in grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        style={{ animationDelay: '60ms' }}
      >
        <KpiCard
          label="Tin chờ duyệt"
          metric={stats.pendingJobs}
          icon={ClipboardCheck}
          color={COLORS.orange}
          invertTone
        />
        <KpiCard
          label="Doanh nghiệp chờ xác minh"
          metric={stats.pendingEmployers}
          icon={Building2}
          color={COLORS.violet}
          invertTone
        />
        <KpiCard
          label="Sinh viên"
          metric={stats.students}
          icon={GraduationCap}
          color={COLORS.accent}
        />
        <KpiCard label="Nhà tuyển dụng" metric={stats.employers} icon={Users} color={COLORS.blue} />
      </div>

      {/* -------------------------------------------------------------- biểu đồ */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="dash-card dash-card-hover p-5">
          <h2 className="font-semibold">Tin đăng và lượt ứng tuyển</h2>
          <p className="text-dash-muted mt-1 mb-5 text-sm">
            Theo {RANGE_LABELS[range].toLowerCase()} gần nhất
          </p>

          <TrendChart
            labels={stats.trend.labels}
            lines={[
              { label: 'Tin đăng mới', color: COLORS.accent, values: stats.trend.newJobs },
              { label: 'Lượt ứng tuyển', color: COLORS.blue, values: stats.trend.applications },
            ]}
          />
        </section>

        <section className="dash-card dash-card-hover p-5">
          <h2 className="font-semibold">Phân bố theo kiểu ca làm</h2>
          <p className="text-dash-muted mt-1 mb-6 text-sm">Trên toàn bộ tin đang mở</p>

          <DonutChart
            centerLabel="tin đang mở"
            slices={stats.scheduleMix.map((s) => ({
              label: SCHEDULE_TYPE_LABELS[s.type],
              value: s.count,
              color: SCHEDULE_COLORS[s.type],
            }))}
          />
        </section>
      </div>

      {/* ------------------------------------------------- chỉ tiêu + hàng chờ */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <section className="dash-card dash-card-hover p-5">
          <h2 className="font-semibold">Chỉ tiêu duyệt trong kỳ</h2>
          <p className="text-dash-muted mt-1 mb-6 text-sm">Đã xử lý trên mục tiêu đặt ra</p>

          <div className="space-y-5">
            {stats.reviewGoals.map((goal, i) => (
              <ProgressRow
                key={goal.label}
                label={goal.label}
                current={goal.current}
                target={goal.target}
                color={[COLORS.accent, COLORS.teal, COLORS.blue][i % 3]}
              />
            ))}
          </div>
        </section>

        <section className="dash-card dash-card-hover p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Hàng chờ duyệt gần nhất</h2>
              <p className="text-dash-muted mt-1 text-sm">Tin mới gửi lên, chưa xử lý</p>
            </div>
            <button className="text-dash-accent shrink-0 text-sm font-medium hover:underline">
              Xem tất cả
            </button>
          </div>

          {/* -mx-5 kéo hàng ra sát mép card, nên vệt sáng khi rê chuột chạy hết
              bề ngang thay vì dừng lại cách mép một khoảng padding. */}
          <div className="-mx-5">
            {QUEUE.map((row) => (
              <div
                key={row.title}
                className="hover:bg-dash-raised flex items-center gap-3 px-5 py-3 transition-colors duration-150"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ background: `${avatarColor(row.name)}26`, color: avatarColor(row.name) }}
                >
                  {row.name.slice(0, 1)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <p className="text-dash-muted truncate text-xs">
                    {row.name} · {row.at}
                  </p>
                </div>

                <StatusBadge tone={row.state}>{STATE_TEXT[row.state]}</StatusBadge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
