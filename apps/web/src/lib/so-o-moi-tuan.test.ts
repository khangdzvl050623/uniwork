import { describe, expect, it } from 'vitest'
import {
  SO_O_MOI_TUAN,
  TIME_SLOTS,
  updateAvailabilitySchema,
  createJobSchema,
} from '@uniwork/shared'

/**
 * Test cho mục 7: business logic KHÔNG được phụ thuộc vào việc có đúng 3 khung giờ.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO ĐÁNG CÓ TEST RIÊNG
 * ---------------------------------------------------------------------------
 * Con số 21 (= 7 × 3) từng được viết thẳng ở ba chỗ trong `validation.ts`. Thêm
 * một khung giờ thứ tư vào `TIME_SLOTS` thì cả ba lặng lẽ sai — lịch rảnh bị
 * cắt ở ô thứ 21, nhà tuyển dụng không khai nổi số khung thật của mình.
 *
 * Không có lỗi nào bắn ra, không có test nào đỏ: chỉ là một cái trần vô hình.
 * Nhóm test này chốt lại quan hệ đó để lần sau đổi `TIME_SLOTS` là biết ngay.
 */

/** Sinh đủ số ô một tuần có thể chứa, theo đúng `TIME_SLOTS` hiện tại. */
function moiOTrongTuan() {
  return Array.from({ length: 7 }).flatMap((_, day) =>
    TIME_SLOTS.map((slot) => ({ dayOfWeek: day as 0 | 1 | 2 | 3 | 4 | 5 | 6, slot })),
  )
}

describe('SO_O_MOI_TUAN suy ra từ TIME_SLOTS', () => {
  it('bằng 7 × số khung giờ, không phải hằng số rời', () => {
    expect(SO_O_MOI_TUAN).toBe(7 * TIME_SLOTS.length)
  })

  it('khớp đúng số ô sinh ra được từ lưới', () => {
    expect(moiOTrongTuan()).toHaveLength(SO_O_MOI_TUAN)
  })
})

describe('lịch rảnh: trần đi theo TIME_SLOTS', () => {
  it('khai TOÀN BỘ ô của tuần vẫn hợp lệ', () => {
    // Sinh viên rảnh cả tuần là chuyện có thật (nghỉ hè). Trần ghi cứng 21 mà
    // hệ thống lên 4 khung giờ thì họ bị chặn ở ô thứ 21 mà không hiểu vì sao.
    const r = updateAvailabilitySchema.safeParse({ slots: moiOTrongTuan() })
    expect(r.success).toBe(true)
  })

  it('vượt quá một ô thì bị chặn', () => {
    const qua = [...moiOTrongTuan(), { dayOfWeek: 0 as const, slot: TIME_SLOTS[0] }]
    expect(updateAvailabilitySchema.safeParse({ slots: qua }).success).toBe(false)
  })
})

describe('minShiftsPerWeek: trần đi theo TIME_SLOTS', () => {
  /** Tin RECURRING mở TOÀN BỘ khung của tuần. */
  const tinMoCaTuan = (minShiftsPerWeek: number) => ({
    title: 'Phục vụ quán cà phê ca tối',
    description:
      'Quán cà phê nhỏ khu trung tâm cần tuyển bạn phục vụ. Công việc gồm order, pha chế đồ uống cơ bản và giữ khu vực quầy gọn gàng.',
    requirements: [],
    benefits: [],
    city: 'TP.HCM',
    district: 'Quận 1',
    quantity: 2,
    salaryNegotiable: false,
    salaryMin: 25000,
    salaryMax: 30000,
    salaryUnit: 'HOUR' as const,
    scheduleType: 'RECURRING' as const,
    commitmentMonths: 3,
    minShiftsPerWeek,
    deadline: new Date(Date.now() + 30 * 864e5).toISOString(),
    shifts: moiOTrongTuan(),
    skillIds: [],
  })

  it('đòi nhận ĐÚNG BẰNG số khung mở trong tuần vẫn hợp lệ', () => {
    expect(createJobSchema.safeParse(tinMoCaTuan(SO_O_MOI_TUAN)).success).toBe(true)
  })

  it('đòi nhiều hơn số khung một tuần chứa được thì bị chặn', () => {
    expect(createJobSchema.safeParse(tinMoCaTuan(SO_O_MOI_TUAN + 1)).success).toBe(false)
  })
})
