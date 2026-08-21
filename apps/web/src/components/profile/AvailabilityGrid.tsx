import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAY_LABELS,
  TIME_SLOTS,
  TIME_SLOT_LABELS,
  type AvailabilitySlot,
  type DayOfWeek,
  type TimeSlot,
} from '@uniwork/shared'
import { cn } from '@/lib/utils'

/** Thứ 2 → Chủ nhật, đúng cách người Việt đọc lịch (dữ liệu vẫn lưu 0 = CN). */
const THU_TU_NGAY: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]

const khoa = (day: DayOfWeek, slot: TimeSlot) => `${day}:${slot}`

interface Props {
  value: AvailabilitySlot[]
  onChange: (slots: AvailabilitySlot[]) => void
  disabled?: boolean
}

/**
 * Lưới 7 ngày × 3 buổi, kéo chuột chọn được cả vùng (T61).
 *
 * ---------------------------------------------------------------------------
 * CHẾ ĐỘ TÔ QUYẾT ĐỊNH BỞI Ô ĐẦU TIÊN
 * ---------------------------------------------------------------------------
 * Bắt đầu kéo từ ô TRỐNG thì cả vệt kéo qua đều được bật; bắt đầu từ ô ĐÃ CHỌN
 * thì cả vệt đều bị tắt. Đây là cách bảng tính và ứng dụng lịch vẫn làm, và nó
 * quan trọng hơn vẻ ngoài: nếu mỗi ô tự đảo trạng thái riêng thì kéo qua một
 * vùng lẫn lộn sẽ cho ra kết quả loang lổ không ai đoán trước được.
 *
 * ---------------------------------------------------------------------------
 * KÉO CHỈ BẬT CHO CHUỘT, KHÔNG BẬT CHO CẢM ỨNG
 * ---------------------------------------------------------------------------
 * Muốn kéo trên màn cảm ứng thì phải đặt `touch-action: none`, và làm vậy là
 * chặn luôn thao tác vuốt để cuộn trang ở ngay vùng lưới. Trên điện thoại,
 * lưới chiếm gần hết bề ngang màn hình — người dùng vuốt lên để đọc tiếp sẽ
 * thấy trang đứng im và vô tình tô đầy lịch.
 *
 * Đổi lại, trên cảm ứng chạm từng ô vẫn chọn được bình thường. Mất một tính
 * năng phụ còn hơn hỏng thao tác cuộn — thứ người dùng cần ở mọi trang.
 */
export function AvailabilityGrid({ value, onChange, disabled }: Props) {
  const daChon = new Set(value.map((s) => khoa(s.dayOfWeek, s.slot)))

  // `null` = không kéo. `true` = đang tô bật, `false` = đang tô tắt.
  const cheDoTo = useRef<boolean | null>(null)
  const [dangKeo, setDangKeo] = useState(false)

  const ketThucKeo = useCallback(() => {
    cheDoTo.current = null
    setDangKeo(false)
  }, [])

  /*
   * Nghe `pointerup` trên cả window, không phải trên từng ô.
   *
   * Người dùng hay thả chuột ở ngoài lưới — kéo quá tay ra lề trang chẳng hạn.
   * Chỉ nghe trên ô thì sự kiện đó không bao giờ tới, và lưới kẹt ở trạng thái
   * "đang kéo": di chuột qua là ô tự đổi dù không hề bấm nút nào.
   */
  useEffect(() => {
    if (!dangKeo) return
    window.addEventListener('pointerup', ketThucKeo)
    window.addEventListener('pointercancel', ketThucKeo)
    return () => {
      window.removeEventListener('pointerup', ketThucKeo)
      window.removeEventListener('pointercancel', ketThucKeo)
    }
  }, [dangKeo, ketThucKeo])

  function dat(day: DayOfWeek, slot: TimeSlot, bat: boolean) {
    const k = khoa(day, slot)
    const dangCo = daChon.has(k)
    if (bat === dangCo) return

    onChange(
      bat
        ? [...value, { dayOfWeek: day, slot }]
        : value.filter((s) => khoa(s.dayOfWeek, s.slot) !== k),
    )
  }

  function batDauO(day: DayOfWeek, slot: TimeSlot, laCamUng: boolean) {
    if (disabled) return

    const bat = !daChon.has(khoa(day, slot))
    dat(day, slot, bat)

    // Cảm ứng: chạm xong là xong, không vào chế độ kéo.
    if (laCamUng) return

    cheDoTo.current = bat
    setDangKeo(true)
  }

  function keoQuaO(day: DayOfWeek, slot: TimeSlot) {
    if (disabled || cheDoTo.current === null) return
    dat(day, slot, cheDoTo.current)
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[520px] border-separate border-spacing-1"
        // Đang kéo thì cấm bôi đen chữ, nếu không cả bảng bị bôi xanh trông như lỗi.
        style={{ userSelect: dangKeo ? 'none' : undefined }}
      >
        <thead>
          <tr>
            <th className="w-24" />
            {THU_TU_NGAY.map((d) => (
              <th key={d} scope="col" className="pb-1 text-xs font-semibold text-slate-500">
                {DAY_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {TIME_SLOTS.map((slot) => (
            <tr key={slot}>
              <th scope="row" className="pr-2 text-right align-middle font-normal">
                <div className="text-sm font-medium text-slate-700">
                  {TIME_SLOT_LABELS[slot].label}
                </div>
                <div className="text-[11px] text-slate-400">{TIME_SLOT_LABELS[slot].range}</div>
              </th>

              {THU_TU_NGAY.map((day) => {
                const on = daChon.has(khoa(day, slot))

                return (
                  <td key={day} className="p-0">
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={on}
                      aria-label={`${DAY_LABELS[day]} buổi ${TIME_SLOT_LABELS[slot].label.toLowerCase()}`}
                      onPointerDown={(e) => batDauO(day, slot, e.pointerType === 'touch')}
                      onPointerEnter={() => keoQuaO(day, slot)}
                      className={cn(
                        'h-11 w-full rounded-md border text-xs font-medium',
                        // Chỉ làm mượt màu, không đụng tới transform — ô đang
                        // được kéo qua phải đổi màu TỨC THÌ để vệt tô bám theo
                        // con trỏ, chậm một nhịp là cảm giác trôi tuột.
                        'transition-[background-color,border-color] duration-100 ease-out',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
                        on
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-transparent',
                        !disabled && !on && 'hover:border-brand-300 hover:bg-brand-50',
                        disabled && 'opacity-60',
                      )}
                    >
                      {on ? '✓' : '·'}
                    </button>
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
