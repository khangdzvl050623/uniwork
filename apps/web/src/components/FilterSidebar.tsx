import { CalendarCheck } from 'lucide-react'
import { DISTRICTS, SCHEDULE_TYPE_LABELS, SKILLS, type ScheduleType } from '@/data/mock'

interface Props {
  onlyMatchingSchedule: boolean
  onToggleMatching: (value: boolean) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  )
}

export function FilterSidebar({ onlyMatchingSchedule, onToggleMatching }: Props) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white">
      <div className="px-5 py-4">
        <h2 className="font-semibold text-slate-900">Bộ lọc</h2>
      </div>

      {/* Bộ lọc lõi của UniWork — thứ các job board khác không có */}
      <div className="mx-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={onlyMatchingSchedule}
            onChange={(e) => onToggleMatching(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
              <CalendarCheck size={15} />
              Chỉ hiện việc khớp lịch rảnh
            </span>
            <span className="mt-0.5 block text-xs text-brand-700/80">
              Lọc theo khung giờ bạn đã khai trong học kỳ này
            </span>
          </span>
        </label>
      </div>

      <Section title="Khu vực">
        <div className="space-y-2">
          {DISTRICTS.slice(0, 5).map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
            >
              <input type="checkbox" className="h-4 w-4 accent-brand-600" />
              {d}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Loại thời gian">
        <div className="space-y-2">
          {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
            >
              <input type="checkbox" className="h-4 w-4 accent-brand-600" />
              {SCHEDULE_TYPE_LABELS[key]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Mức lương theo giờ">
        <input
          type="range"
          min={15000}
          max={60000}
          step={5000}
          className="w-full accent-brand-600"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>15.000đ</span>
          <span>60.000đ</span>
        </div>
      </Section>

      <Section title="Kỹ năng">
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.slice(0, 8).map((s) => (
            <button
              key={s}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cam kết tối thiểu">
        <select className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-600 outline-none">
          <option>Không giới hạn</option>
          <option>Dưới 1 tháng</option>
          <option>1 – 3 tháng</option>
          <option>Trên 3 tháng</option>
        </select>
      </Section>
    </aside>
  )
}
