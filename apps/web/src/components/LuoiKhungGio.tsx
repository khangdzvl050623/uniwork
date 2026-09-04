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
  /**
   * Bỏ trống là lưới CHỈ ĐỌC — dùng ở trang chi tiết tin, nơi ca làm chỉ để
   * xem chứ không sửa được.
   */
  onChange?: (slots: AvailabilitySlot[]) => void
  disabled?: boolean
  /**
   * Ô viền nhạt vẽ chồng lên, KHÔNG bấm được.
   *
   * Dùng để đối chiếu hai lịch với nhau: trang chi tiết tin vẽ ca làm của tin ở
   * `value` và lịch rảnh của sinh viên đang xem ở đây, nên nhìn phát biết mình
   * có làm được ca nào không mà không phải nhớ lịch của chính mình.
   */
  overlay?: AvailabilitySlot[]
  /** Nhãn cho trình đọc màn hình, vì lưới này giờ dùng ở ba màn hình khác nhau. */
  ariaLabel?: string
  /**
   * Giới hạn những thứ được chọn. Bỏ trống là cho chọn cả bảy.
   *
   * Sinh ra cho tin "một buổi": việc diễn ra đúng một ngày cụ thể, nên ca làm
   * chỉ có thể rơi vào thứ của ngày đó. Không khoá thì người dùng chọn được ca
   * Thứ Hai cho một buổi tổ chức Thứ Tư — dữ liệu tự mâu thuẫn, và tới Sprint 3
   * nó sẽ được gợi ý cho đúng những sinh viên KHÔNG rảnh hôm ấy.
   *
   * Đây là lớp hướng dẫn; luật thật nằm ở `createJobSchema`.
   */
  ngayChoPhep?: DayOfWeek[]
}

/**
 * Lưới 7 ngày × 3 khung giờ — dùng chung cho lịch rảnh sinh viên VÀ khung giờ
 * tin cần người.
 *
 * `TimeSlot` là khung khai báo CHUẨN HOÁ để hai bên ghép lịch, không phải giờ
 * vào ca của doanh nghiệp — xem `TIME_SLOTS` phía shared. Mọi câu chữ quanh
 * lưới này phải nói đúng như vậy.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO MỘT COMPONENT CHO CẢ HAI
 * ---------------------------------------------------------------------------
 * `Availability` (lịch rảnh sinh viên) và `job_shifts` (ca làm của tin) cố ý có
 * cùng bộ cột `(dayOfWeek, slot)` — đó là thứ làm phép ghép lịch ở Sprint 3 trở
 * thành một câu JOIN thay vì một thuật toán so khoảng thời gian.
 *
 * Trước đây phía web có HAI lưới riêng cho hai chỗ dùng: một cái đọc kiểu từ
 * `@uniwork/shared` (chữ hoa `'MORNING'`), một cái tự khai kiểu trong file mock
 * (chữ thường `'morning'`). Hệ quả là mỗi lần nối API phải viết một lớp dịch
 * hoa↔thường, và bản mock không có tính năng kéo chọn nhiều ô — nhà tuyển dụng
 * đăng tin ca tối 6 ngày phải bấm 6 lần trong khi sinh viên kéo một phát xong.
 *
 * Gộp lại thì hết cả hai chuyện, và hình dạng dữ liệu phía web khớp luôn với
 * hình dạng trong database.
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
export function LuoiKhungGio({
  value,
  onChange,
  disabled,
  overlay,
  ariaLabel,
  ngayChoPhep,
}: Props) {
  const daChon = new Set(value.map((s) => khoa(s.dayOfWeek, s.slot)))
  const oPhu = new Set((overlay ?? []).map((s) => khoa(s.dayOfWeek, s.slot)))

  // Không truyền `onChange` nghĩa là lưới chỉ để xem. Gộp luôn vào `disabled`
  // thay vì rải hai điều kiện khắp nơi bên dưới.
  const khoaTuongTac = disabled || !onChange

  const choPhep = (day: DayOfWeek) => !ngayChoPhep || ngayChoPhep.includes(day)

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
    if (!onChange) return

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
    if (khoaTuongTac || !choPhep(day)) return

    const bat = !daChon.has(khoa(day, slot))
    dat(day, slot, bat)

    // Cảm ứng: chạm xong là xong, không vào chế độ kéo.
    if (laCamUng) return

    cheDoTo.current = bat
    setDangKeo(true)
  }

  function keoQuaO(day: DayOfWeek, slot: TimeSlot) {
    if (khoaTuongTac || !choPhep(day) || cheDoTo.current === null) return
    dat(day, slot, cheDoTo.current)
  }

  return (
    <div className="overflow-x-auto">
      <table
        aria-label={ariaLabel}
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
                {/*
                  Khoảng giờ là RANH GIỚI CỦA KHUNG, không phải giờ vào ca.

                  Đứng một mình ngay dưới chữ "Sáng" thì nó đọc thành "ca sáng
                  bắt đầu 6h, kéo 6 tiếng". Thêm dấu ngã ở đầu để mắt nhận ra
                  đây là một khoảng ước chừng, và chỗ nào dùng lưới này cũng có
                  một câu nói rõ bên ngoài (xem `JobDetail`, `PostJob`).
                */}
                <div className="text-[11px] text-slate-400">
                  ~{TIME_SLOT_LABELS[slot].range}
                </div>
              </th>

              {THU_TU_NGAY.map((day) => {
                const on = daChon.has(khoa(day, slot))
                const phu = oPhu.has(khoa(day, slot))
                const ngoaiPhamVi = !choPhep(day)

                return (
                  <td key={day} className="p-0">
                    <button
                      type="button"
                      disabled={khoaTuongTac || ngoaiPhamVi}
                      aria-pressed={on}
                      aria-label={`${DAY_LABELS[day]} buổi ${TIME_SLOT_LABELS[slot].label.toLowerCase()}${
                        phu ? ' (bạn rảnh)' : ''
                      }`}
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
                        /*
                         * Ô "bạn rảnh" mà tin KHÔNG có ca: viền đứt nhạt, không
                         * tô nền. Tô nền thì mắt đọc nhầm thành đã chọn, mà đây
                         * chỉ là thông tin đối chiếu.
                         *
                         * Đặt sau nhánh `on` để ô vừa là ca làm vừa nằm trong
                         * lịch rảnh giữ nguyên màu đậm — trùng nhau mới là tin
                         * tốt, không nên làm nó nhạt đi.
                         */
                        phu && !on && 'border-dashed border-brand-400 bg-brand-50/60',
                        !khoaTuongTac && !ngoaiPhamVi && !on && 'hover:border-brand-300 hover:bg-brand-50',
                        khoaTuongTac && 'opacity-60',
                        // Ô ngoài phạm vi mờ hẳn và gạch chéo nhẹ, để mắt thấy
                        // ngay là cả cột đó không dùng được — khác với ô trống
                        // bình thường chỉ là chưa chọn.
                        ngoaiPhamVi && 'cursor-not-allowed bg-slate-100 opacity-40',
                        // Chỉ để xem thì con trỏ không nên gợi ý là bấm được.
                        !onChange && 'cursor-default',
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
