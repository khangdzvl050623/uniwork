import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AvailabilitySlot, DayOfWeek } from '@uniwork/shared'
import { LuoiKhungGio } from './LuoiKhungGio'

/**
 * Test cho lưới khai lịch rảnh (T61).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO VIẾT TEST NÀY TRƯỚC KHI SỬA COMPONENT
 * ---------------------------------------------------------------------------
 * Lưới này đang chạy đúng trên trang lịch rảnh của sinh viên và sắp được dùng
 * lại cho phần chọn ca làm khi đăng tin. Gộp hai chỗ dùng vào một component là
 * việc đáng làm, nhưng nó đụng vào thứ đang hoạt động — mà toàn bộ hành vi tinh
 * tế ở đây (chế độ tô theo ô đầu, cảm ứng không kéo, thả chuột ngoài lưới) đều
 * KHÔNG có gì bảo vệ.
 *
 * Bộ test này chốt lại hành vi hiện tại để lần sửa sau có lưới an toàn. Viết
 * sau khi sửa thì nó chỉ mô tả kết quả đã có, không chứng minh được là chưa làm
 * hỏng gì.
 *
 * Dùng `fireEvent` thay vì `userEvent`: cần điều khiển chính xác `pointerType`
 * để phân biệt chuột với cảm ứng — đúng thứ quyết định có vào chế độ kéo hay
 * không.
 */

/** Bọc trong state thật vì đây là component được điều khiển hoàn toàn. */
function Bao({
  banDau = [],
  disabled,
  onChange,
  ngayChoPhep,
}: {
  banDau?: AvailabilitySlot[]
  disabled?: boolean
  onChange?: (slots: AvailabilitySlot[]) => void
  ngayChoPhep?: DayOfWeek[]
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(banDau)

  return (
    <LuoiKhungGio
      value={slots}
      disabled={disabled}
      ngayChoPhep={ngayChoPhep}
      onChange={(moi) => {
        setSlots(moi)
        onChange?.(moi)
      }}
    />
  )
}

/** Lấy ô theo nhãn trợ năng, đúng cách người dùng bàn phím tìm thấy nó. */
function o(thu: string, buoi: string) {
  return screen.getByRole('button', { name: `${thu} buổi ${buoi}` })
}

/** Bấm chuột vào một ô rồi thả — thao tác thường gặp nhất. */
function bam(el: HTMLElement) {
  fireEvent.pointerDown(el, { pointerType: 'mouse' })
  fireEvent.pointerUp(window)
}

describe('LuoiKhungGio — dựng lưới', () => {
  it('có đủ 21 ô: 7 ngày × 3 buổi', () => {
    render(<Bao />)
    expect(screen.getAllByRole('button')).toHaveLength(21)
  })

  it('cột xếp Thứ 2 trước, Chủ nhật cuối — đúng cách người Việt đọc lịch', () => {
    // Dữ liệu vẫn lưu 0 = Chủ nhật theo `Date.prototype.getDay()`; chỉ thứ tự
    // HIỂN THỊ là đảo. Nhầm hai chuyện này thì lịch lệch nguyên một cột.
    render(<Bao />)

    // Ô đầu hàng tiêu đề để trống — đó là cột nhãn buổi bên trái, không phải ngày.
    const cot = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter(Boolean)

    expect(cot).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
  })

  it('ô đã chọn mang aria-pressed để trình đọc màn hình biết', () => {
    render(<Bao banDau={[{ dayOfWeek: 2, slot: 'EVENING' }]} />)

    // Dùng `getAttribute` chứ không `toHaveAttribute`: dự án không cài
    // `@testing-library/jest-dom`, nên các matcher mở rộng đó không tồn tại.
    expect(o('T3', 'tối').getAttribute('aria-pressed')).toBe('true')
    expect(o('T3', 'sáng').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('LuoiKhungGio — bấm từng ô', () => {
  it('bấm ô trống thì thêm vào danh sách', () => {
    const onChange = vi.fn()
    render(<Bao onChange={onChange} />)

    bam(o('T3', 'tối'))

    // dayOfWeek 2 = Thứ 3 theo getDay(), dù nó nằm ở cột thứ hai trên màn hình.
    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 2, slot: 'EVENING' }])
  })

  it('bấm lại ô đã chọn thì bỏ chọn', () => {
    const onChange = vi.fn()
    render(<Bao banDau={[{ dayOfWeek: 2, slot: 'EVENING' }]} onChange={onChange} />)

    bam(o('T3', 'tối'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('giữ nguyên các ô khác khi bỏ chọn một ô', () => {
    const onChange = vi.fn()
    render(
      <Bao
        banDau={[
          { dayOfWeek: 2, slot: 'EVENING' },
          { dayOfWeek: 4, slot: 'MORNING' },
        ]}
        onChange={onChange}
      />,
    )

    bam(o('T3', 'tối'))

    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 4, slot: 'MORNING' }])
  })
})

/*
 * Chế độ tô quyết định bởi Ô ĐẦU TIÊN của vệt kéo.
 *
 * Đây là hành vi tinh tế nhất của component và cũng là thứ dễ bị "dọn dẹp" làm
 * hỏng nhất: nếu mỗi ô tự đảo trạng thái riêng thì kéo qua một vùng lẫn lộn sẽ
 * cho ra kết quả loang lổ không ai đoán trước được.
 */
describe('LuoiKhungGio — kéo chọn nhiều ô bằng chuột', () => {
  it('kéo từ ô TRỐNG thì bật hết cả vệt', () => {
    const onChange = vi.fn()
    render(<Bao onChange={onChange} />)

    fireEvent.pointerDown(o('T2', 'tối'), { pointerType: 'mouse' })
    fireEvent.pointerEnter(o('T3', 'tối'))
    fireEvent.pointerEnter(o('T4', 'tối'))
    fireEvent.pointerUp(window)

    expect(onChange).toHaveBeenLastCalledWith([
      { dayOfWeek: 1, slot: 'EVENING' },
      { dayOfWeek: 2, slot: 'EVENING' },
      { dayOfWeek: 3, slot: 'EVENING' },
    ])
  })

  it('kéo từ ô ĐÃ CHỌN thì tắt hết cả vệt', () => {
    const onChange = vi.fn()
    render(
      <Bao
        banDau={[
          { dayOfWeek: 1, slot: 'EVENING' },
          { dayOfWeek: 2, slot: 'EVENING' },
          { dayOfWeek: 3, slot: 'EVENING' },
        ]}
        onChange={onChange}
      />,
    )

    fireEvent.pointerDown(o('T2', 'tối'), { pointerType: 'mouse' })
    fireEvent.pointerEnter(o('T3', 'tối'))
    fireEvent.pointerEnter(o('T4', 'tối'))
    fireEvent.pointerUp(window)

    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('kéo qua vùng LẪN LỘN vẫn theo chế độ của ô đầu, không đảo từng ô', () => {
    // Bắt đầu từ ô trống → cả vệt phải BẬT, kể cả ô ở giữa vốn đã chọn sẵn.
    const onChange = vi.fn()
    render(<Bao banDau={[{ dayOfWeek: 2, slot: 'EVENING' }]} onChange={onChange} />)

    fireEvent.pointerDown(o('T2', 'tối'), { pointerType: 'mouse' })
    fireEvent.pointerEnter(o('T3', 'tối'))
    fireEvent.pointerEnter(o('T4', 'tối'))
    fireEvent.pointerUp(window)

    const cuoi = onChange.mock.lastCall?.[0] as AvailabilitySlot[]
    expect(cuoi).toHaveLength(3)
    // Ô giữa vẫn còn — không bị đảo thành tắt.
    expect(cuoi).toContainEqual({ dayOfWeek: 2, slot: 'EVENING' })
  })

  it('thả chuột NGOÀI lưới cũng kết thúc kéo', () => {
    /*
     * Người dùng hay kéo quá tay ra lề trang rồi mới thả. Không nghe `pointerup`
     * trên window thì lưới kẹt ở trạng thái "đang kéo": di chuột qua là ô tự
     * đổi dù không hề bấm nút nào.
     */
    const onChange = vi.fn()
    render(<Bao onChange={onChange} />)

    fireEvent.pointerDown(o('T2', 'tối'), { pointerType: 'mouse' })
    fireEvent.pointerUp(window)

    onChange.mockClear()
    fireEvent.pointerEnter(o('T3', 'tối'))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('LuoiKhungGio — cảm ứng', () => {
  it('chạm chỉ đổi ĐÚNG một ô, không vào chế độ kéo', () => {
    /*
     * Muốn kéo trên màn cảm ứng thì phải đặt `touch-action: none`, và làm vậy là
     * chặn luôn thao tác vuốt để cuộn trang ở ngay vùng lưới. Trên điện thoại,
     * lưới chiếm gần hết bề ngang — người dùng vuốt lên để đọc tiếp sẽ thấy
     * trang đứng im và vô tình tô đầy lịch.
     */
    const onChange = vi.fn()
    render(<Bao onChange={onChange} />)

    fireEvent.pointerDown(o('T2', 'tối'), { pointerType: 'touch' })
    // Ngón tay trượt qua ô kế bên — KHÔNG được tô theo.
    fireEvent.pointerEnter(o('T3', 'tối'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 1, slot: 'EVENING' }])
  })
})

describe('LuoiKhungGio — khoá lúc đang lưu', () => {
  it('disabled thì bấm không ăn', () => {
    const onChange = vi.fn()
    render(<Bao disabled onChange={onChange} />)

    bam(o('T3', 'tối'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled thì kéo cũng không ăn', () => {
    const onChange = vi.fn()
    render(<Bao disabled onChange={onChange} />)

    fireEvent.pointerDown(o('T2', 'tối'), { pointerType: 'mouse' })
    fireEvent.pointerEnter(o('T3', 'tối'))

    expect(onChange).not.toHaveBeenCalled()
  })
})

/*
 * Hai khả năng THÊM khi gộp hai lưới làm một. Phần trên của file này chốt hành
 * vi cũ (lịch rảnh sinh viên) và phải giữ nguyên xanh; phần dưới là thứ mới.
 */
describe('LuoiKhungGio — chế độ chỉ đọc (trang chi tiết tin)', () => {
  it('không truyền onChange thì mọi ô đều khoá', () => {
    render(<LuoiKhungGio value={[{ dayOfWeek: 2, slot: 'EVENING' }]} />)

    for (const nut of screen.getAllByRole('button')) {
      expect((nut as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('vẫn vẽ đúng ca làm dù không sửa được', () => {
    render(<LuoiKhungGio value={[{ dayOfWeek: 2, slot: 'EVENING' }]} />)

    expect(o('T3', 'tối').getAttribute('aria-pressed')).toBe('true')
    expect(o('T4', 'tối').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('LuoiKhungGio — lớp phủ đối chiếu hai lịch', () => {
  it('ô trong overlay được đánh dấu cho trình đọc màn hình', () => {
    // Trang chi tiết tin vẽ ca làm của TIN ở `value`, lịch rảnh của SINH VIÊN
    // đang xem ở `overlay` — nhìn phát biết mình có làm được ca nào không.
    render(
      <LuoiKhungGio value={[{ dayOfWeek: 2, slot: 'EVENING' }]} overlay={[{ dayOfWeek: 4, slot: 'MORNING' }]} />,
    )

    expect(screen.getByRole('button', { name: 'T5 buổi sáng (bạn rảnh)' })).toBeTruthy()
  })

  it('ô vừa là ca làm vừa nằm trong lịch rảnh vẫn giữ trạng thái đã chọn', () => {
    // Trùng nhau mới là tin tốt — không được làm nó nhạt đi thành "chỉ là overlay".
    render(
      <LuoiKhungGio value={[{ dayOfWeek: 2, slot: 'EVENING' }]} overlay={[{ dayOfWeek: 2, slot: 'EVENING' }]} />,
    )

    const nut = screen.getByRole('button', { name: 'T3 buổi tối (bạn rảnh)' })
    expect(nut.getAttribute('aria-pressed')).toBe('true')
  })

  it('overlay KHÔNG làm ô bấm được ở lưới đang sửa', () => {
    // Overlay chỉ là thông tin, không phải lựa chọn. Bấm vào ô overlay phải
    // hành xử y như ô trống bình thường.
    const onChange = vi.fn()
    render(<Bao onChange={onChange} />)

    bam(o('T5', 'sáng'))

    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 4, slot: 'MORNING' }])
  })
})


/*
 * Giới hạn thứ được chọn — sinh ra cho tin "một buổi".
 *
 * Việc diễn ra đúng một ngày cụ thể thì ca làm chỉ có thể rơi vào thứ của ngày
 * đó. Không khoá thì chọn được ca Thứ Hai cho một buổi tổ chức Thứ Tư — dữ liệu
 * tự mâu thuẫn, và tới Sprint 3 nó sẽ được gợi ý cho đúng những sinh viên KHÔNG
 * rảnh hôm ấy.
 */
describe('LuoiKhungGio — giới hạn thứ được chọn', () => {
  it('ô ngoài phạm vi bị khoá, ô trong phạm vi vẫn bấm được', () => {
    // dayOfWeek 3 = Thứ Tư, hiển thị là "T4".
    render(<Bao ngayChoPhep={[3]} />)

    expect((o('T4', 'tối') as HTMLButtonElement).disabled).toBe(false)
    expect((o('T2', 'tối') as HTMLButtonElement).disabled).toBe(true)
    expect((o('CN', 'sáng') as HTMLButtonElement).disabled).toBe(true)
  })

  it('bấm ô ngoài phạm vi thì KHÔNG đổi gì', () => {
    const onChange = vi.fn()
    render(<Bao ngayChoPhep={[3]} onChange={onChange} />)

    bam(o('T2', 'tối'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('bấm ô trong phạm vi vẫn chọn được bình thường', () => {
    const onChange = vi.fn()
    render(<Bao ngayChoPhep={[3]} onChange={onChange} />)

    bam(o('T4', 'tối'))

    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 3, slot: 'EVENING' }])
  })

  it('KÉO qua ô ngoài phạm vi thì ô đó không bị tô', () => {
    // Chế độ kéo phải tôn trọng giới hạn ở TỪNG ô, không chỉ ở ô bắt đầu.
    const onChange = vi.fn()
    render(<Bao ngayChoPhep={[3, 4]} onChange={onChange} />)

    fireEvent.pointerDown(o('T4', 'tối'), { pointerType: 'mouse' })
    fireEvent.pointerEnter(o('T5', 'tối'))
    // T6 (dayOfWeek 5) nằm ngoài phạm vi — kéo qua cũng không được tô.
    fireEvent.pointerEnter(o('T6', 'tối'))
    fireEvent.pointerUp(window)

    const cuoi = onChange.mock.lastCall?.[0] as AvailabilitySlot[]
    expect(cuoi.map((s) => s.dayOfWeek).sort()).toEqual([3, 4])
  })

  it('không truyền ngayChoPhep thì cả bảy thứ đều chọn được', () => {
    render(<Bao />)

    for (const nut of screen.getAllByRole('button')) {
      expect((nut as HTMLButtonElement).disabled).toBe(false)
    }
  })
})
