import { DAY_LABELS, TIME_SLOTS, type Shift, type SlotId } from '@/data/mock'
import { cn } from '@/lib/utils'

/** Thứ 2 → Chủ nhật, đúng cách người Việt đọc lịch. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface Props {
  /** Ô được tô đậm: ca làm của tin, hoặc lịch rảnh đã chọn. */
  selected: Shift[]
  /** Ô có viền nhạt: lịch rảnh của sinh viên, dùng để đối chiếu với ca làm. */
  overlay?: Shift[]
  onToggle?: (day: number, slot: SlotId) => void
}

const has = (list: Shift[], day: number, slot: SlotId) =>
  list.some((s) => s.dayOfWeek === day && s.slot === slot)

export function ScheduleGrid({ selected, overlay, onToggle }: Props) {
  const editable = Boolean(onToggle)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-24" />
            {DAY_ORDER.map((d) => (
              <th key={d} className="pb-1 text-xs font-semibold text-slate-500">
                {DAY_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot) => (
            <tr key={slot.id}>
              <td className="pr-2 text-right align-middle">
                <div className="text-sm font-medium text-slate-700">{slot.label}</div>
                <div className="text-[11px] text-slate-400">{slot.range}</div>
              </td>
              {DAY_ORDER.map((day) => {
                const on = has(selected, day, slot.id)
                const free = overlay ? has(overlay, day, slot.id) : false
                const cellClass = cn(
                  'h-11 w-full rounded-md border text-xs font-medium transition-colors',
                  on
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : free
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-transparent',
                  editable && !on && 'hover:border-brand-300 hover:bg-brand-50',
                )
                const content = on ? '✓' : free ? 'rảnh' : '·'

                return (
                  <td key={day} className="p-0">
                    {editable ? (
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggle?.(day, slot.id)}
                        className={cellClass}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={cellClass}>{content}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ScheduleLegend({ withOverlay = false }: { withOverlay?: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-brand-600" /> Ca cần làm
      </span>
      {withOverlay && (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-50" /> Bạn đang
          rảnh
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-slate-200 bg-slate-50" /> Không có ca
      </span>
    </div>
  )
}
