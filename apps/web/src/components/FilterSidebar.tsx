import { CalendarCheck } from 'lucide-react'
import { SCHEDULE_TYPES, SCHEDULE_TYPE_LABELS, type ScheduleType } from '@uniwork/shared'
import { DISTRICTS } from '@/lib/khu-vuc'
import { cn } from '@/lib/utils'

interface Props {
  district?: string
  scheduleType?: ScheduleType
  onDoiDistrict: (v: string | undefined) => void
  onDoiScheduleType: (v: ScheduleType | undefined) => void
}

/**
 * Bộ lọc trang việc làm.
 *
 * ---------------------------------------------------------------------------
 * BỘ LỌC NÀO NỐI THẬT, BỘ LỌC NÀO CHƯA — VÀ VÌ SAO KHÔNG XOÁ CÁI CHƯA NỐI
 * ---------------------------------------------------------------------------
 * Sprint 2 chỉ có ba tiêu chí so sánh bằng ở API: `city`, `district`,
 * `scheduleType`. Bốn thứ còn lại — khớp lịch rảnh, mức lương, kỹ năng, cam kết
 * tối thiểu — thuộc Sprint 3.
 *
 * Giữ chúng trên màn hình ở trạng thái vô hiệu hoá kèm nhãn "Có ở Sprint 3",
 * không xoá: dựng lại từ đầu ở sprint sau là phí công hai lần, và giữ lại cũng
 * cho người dùng biết hệ thống đang đi về đâu.
 *
 * Nhưng vô hiệu hoá THẬT — trước đây các ô này là checkbox bấm được mà không
 * làm gì cả, tức là hứa với người dùng một thứ không tồn tại.
 */
function Section({
  title,
  children,
  sapCo,
}: {
  title: string
  children: React.ReactNode
  /** Đánh dấu phần thuộc sprint sau: làm mờ và chú thích rõ. */
  sapCo?: boolean
}) {
  return (
    <div className={cn('border-t border-slate-100 px-5 py-4', sapCo && 'opacity-50')}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {sapCo && <span className="text-[11px] text-slate-400">Có ở Sprint 3</span>}
      </div>
      {children}
    </div>
  )
}

export function FilterSidebar({
  district,
  scheduleType,
  onDoiDistrict,
  onDoiScheduleType,
}: Props) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Bộ lọc</h2>
        {(district || scheduleType) && (
          <button
            onClick={() => {
              onDoiDistrict(undefined)
              onDoiScheduleType(undefined)
            }}
            className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Xoá lọc
          </button>
        )}
      </div>

      {/* Bộ lọc lõi của UniWork — thứ các trang việc làm khác không có. Chưa nối
          được vì phép giao lịch rảnh × ca làm thuộc Sprint 3. */}
      <div className="mx-3 rounded-lg border border-slate-200 bg-slate-50 p-3 opacity-60">
        <label className="flex cursor-not-allowed items-start gap-2.5">
          <input type="checkbox" disabled className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <CalendarCheck size={15} />
              Chỉ hiện việc khớp lịch rảnh
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Lọc theo khung giờ bạn đã khai — có ở Sprint 3
            </span>
          </span>
        </label>
      </div>

      <Section title="Khu vực">
        <div className="space-y-2">
          {DISTRICTS.map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
            >
              {/*
                Radio chứ không phải checkbox: API nhận ĐÚNG MỘT `district`, so
                sánh bằng. Checkbox gợi ý chọn được nhiều quận — một lời hứa mà
                endpoint hiện tại không giữ được.
              */}
              <input
                type="radio"
                name="district"
                checked={district === d}
                onChange={() => onDoiDistrict(d)}
                className="h-4 w-4 accent-brand-600"
              />
              {d}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Loại thời gian">
        <div className="space-y-2">
          {SCHEDULE_TYPES.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
            >
              <input
                type="radio"
                name="scheduleType"
                checked={scheduleType === key}
                onChange={() => onDoiScheduleType(key)}
                className="h-4 w-4 accent-brand-600"
              />
              {SCHEDULE_TYPE_LABELS[key]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Mức lương theo giờ" sapCo>
        <input
          type="range"
          min={15000}
          max={60000}
          step={5000}
          disabled
          className="w-full accent-brand-600"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>15.000đ</span>
          <span>60.000đ</span>
        </div>
      </Section>

      <Section title="Cam kết tối thiểu" sapCo>
        <select
          disabled
          className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-600 outline-none"
        >
          <option>Không giới hạn</option>
        </select>
      </Section>
    </aside>
  )
}
