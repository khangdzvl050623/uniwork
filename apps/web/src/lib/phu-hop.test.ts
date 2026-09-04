import { describe, expect, it } from 'vitest'
import { ghepLich, type AvailabilitySlot } from '@uniwork/shared'

/**
 * Test cho phép ghép lịch rảnh × ca làm.
 *
 * Hai ranh giới đáng bảo vệ nhất, cả hai đều hỏng ÂM THẦM nếu sai — không lỗi
 * nào bắn ra, giao diện vẫn vẽ đẹp:
 *
 * 1. `null` KHÁC `0`. Gộp lại là nói với sinh viên chưa khai lịch rằng mọi tin
 *    trên trang đều không hợp với họ.
 * 2. `eligible` KHÁC `matchScore`. Gộp lại thì hoặc mọi người đủ điều kiện đều
 *    thành 100% (mất khả năng phân biệt), hoặc người thừa sức nhận việc bị loại
 *    oan vì tin mở quá nhiều ca.
 */

const o = (dayOfWeek: number, slot: string) => ({ dayOfWeek, slot }) as AvailabilitySlot

const T2_SANG = o(1, 'MORNING')
const T3_TOI = o(2, 'EVENING')
const T5_TOI = o(4, 'EVENING')
const T7_SANG = o(6, 'MORNING')

describe('ghepLich — ranh giới null / đã đo', () => {
  it('chưa khai lịch rảnh (mảng rỗng) → null, KHÔNG phải 0', () => {
    const r = ghepLich([T3_TOI], [], 1)
    expect(r.matchScore).toBeNull()
    expect(r.eligible).toBeNull()
  })

  it('không có lịch rảnh (null / undefined) → null', () => {
    expect(ghepLich([T3_TOI], null, 1).matchScore).toBeNull()
    expect(ghepLich([T3_TOI], undefined, 1).eligible).toBeNull()
  })

  it('tin không có ca nào → null, không chia cho 0', () => {
    // Zod bắt buộc tin có ít nhất một ca nên trên lý thuyết không xảy ra. Trả 0
    // sẽ là "đã đo, không hợp" cho thứ chưa hề đo được.
    const r = ghepLich([], [T3_TOI], 1)
    expect(r.matchScore).toBeNull()
    expect(r.eligible).toBeNull()
    expect(r.totalJobShifts).toBe(0)
  })

  it('đã khai lịch nhưng không trùng ca nào → 0 THẬT và eligible false', () => {
    const r = ghepLich([T3_TOI], [T7_SANG], 1)
    expect(r.matchScore).toBe(0)
    expect(r.eligible).toBe(false)
  })
})

describe('ghepLich — eligible tách khỏi matchScore', () => {
  /** Tin mở 4 ca, chỉ cần nhận 2. */
  const CA_MO = [T2_SANG, T3_TOI, T5_TOI, T7_SANG]

  it('đủ ngưỡng dù điểm THẤP — đây là lý do hai khái niệm tách nhau', () => {
    // Trùng 2/4 ca = 50%, nghe như "tạm được". Nhưng tin chỉ cần 2 ca nên sinh
    // viên này NHẬN ĐƯỢC việc. Lấy điểm làm cổng vào sẽ loại oan họ.
    const r = ghepLich(CA_MO, [T2_SANG, T3_TOI], 2)
    expect(r.matchedShifts).toBe(2)
    expect(r.matchScore).toBe(50)
    expect(r.eligible).toBe(true)
  })

  it('KHÔNG đủ ngưỡng dù vẫn trùng vài ca', () => {
    // Trùng 1/4 = 25% và tin cần 3 ca → không nhận nổi. Chỉ hiện "25%" thì đọc
    // thành "hơi kém hợp", trong khi sự thật cứng hơn: không làm được.
    const r = ghepLich(CA_MO, [T2_SANG], 3)
    expect(r.matchScore).toBe(25)
    expect(r.eligible).toBe(false)
  })

  it('điểm KHÔNG bị chặn ở 100 khi trùng thừa ngưỡng', () => {
    // Nếu lấy matched/minShifts làm điểm thì đây sẽ là 200% rồi chặn còn 100%,
    // và mọi người đủ điều kiện đều hiện giống hệt nhau.
    const r = ghepLich(CA_MO, CA_MO, 2)
    expect(r.matchScore).toBe(100)
    expect(r.eligible).toBe(true)
  })

  it('hai sinh viên cùng đủ điều kiện vẫn PHÂN BIỆT được bằng điểm', () => {
    const it_ = ghepLich(CA_MO, [T2_SANG, T3_TOI], 2)
    const nhieu = ghepLich(CA_MO, [T2_SANG, T3_TOI, T5_TOI, T7_SANG], 2)

    expect(it_.eligible).toBe(true)
    expect(nhieu.eligible).toBe(true)
    expect(nhieu.matchScore).toBeGreaterThan(it_.matchScore!)
  })
})

describe('ghepLich — ngưỡng tối thiểu', () => {
  it('minShiftsPerWeek = null → cần ít nhất 1 ca', () => {
    // Tin không quy định số ca tối thiểu (ONE_TIME) thì trùng được một ca là
    // làm được. Để ngưỡng 0 sẽ khiến người không trùng ca nào cũng "đủ điều kiện".
    expect(ghepLich([T3_TOI], [T3_TOI], null).eligible).toBe(true)
    expect(ghepLich([T3_TOI], [T7_SANG], null).eligible).toBe(false)
  })

  it('minShiftsPerWeek = undefined cũng cần ít nhất 1 ca', () => {
    expect(ghepLich([T3_TOI], [T3_TOI]).eligible).toBe(true)
  })

  it('minShiftsPerWeek LỚN HƠN số ca mở → chặn trần ở số ca mở', () => {
    /*
     * Tin mở 2 ca mà đòi nhận 5 là lỗi nhập liệu, không phải yêu cầu khắt khe.
     * Không chặn trần thì tin đó không bao giờ `eligible` với BẤT KỲ ai — nó
     * biến mất khỏi mọi kết quả lọc, còn nhà tuyển dụng thấy tin mình vẫn `OPEN`
     * và không hiểu vì sao không ai ứng tuyển.
     *
     * `createJobSchema` đã chặn không cho tạo mới như vậy; dòng này lo cho dữ
     * liệu cũ tạo trước khi có luật đó.
     */
    const r = ghepLich([T3_TOI, T5_TOI], [T3_TOI, T5_TOI], 5)
    expect(r.eligible).toBe(true)
    expect(r.matchScore).toBe(100)
  })

  it('trùng đúng bằng ngưỡng là ĐỦ (>=, không phải >)', () => {
    expect(ghepLich([T2_SANG, T3_TOI, T5_TOI], [T2_SANG, T3_TOI], 2).eligible).toBe(true)
  })

  it('thiếu đúng một ca so với ngưỡng là KHÔNG đủ', () => {
    expect(ghepLich([T2_SANG, T3_TOI, T5_TOI], [T2_SANG], 2).eligible).toBe(false)
  })
})

describe('ghepLich — công thức điểm', () => {
  it('MẪU SỐ là số ca của TIN, không phải số ô rảnh của sinh viên', () => {
    /*
     * Câu hỏi đúng là "tôi phủ được bao nhiêu phần lịch của việc này", không
     * phải "việc này lấp được bao nhiêu phần thời gian rảnh của tôi".
     *
     * Lấy số ô rảnh làm mẫu số thì ra 33%, và hệ quả là ai càng rảnh nhiều càng
     * bị chấm thấp ở MỌI tin — đúng ngược với ý nghĩa cần có.
     */
    const r = ghepLich([T3_TOI], [T3_TOI, T5_TOI, T7_SANG], 1)
    expect(r.matchScore).toBe(100)
  })

  it('làm tròn 1/3 thành 33 và 2/3 thành 67', () => {
    expect(ghepLich([T2_SANG, T3_TOI, T5_TOI], [T2_SANG], 1).matchScore).toBe(33)
    expect(ghepLich([T2_SANG, T3_TOI, T5_TOI], [T2_SANG, T3_TOI], 1).matchScore).toBe(67)
  })

  it('cùng ngày khác buổi KHÔNG tính là trùng', () => {
    // Rảnh thứ 3 buổi sáng không có nghĩa là làm được ca thứ 3 buổi tối.
    expect(ghepLich([T3_TOI], [o(2, 'MORNING')], 1).matchScore).toBe(0)
  })

  it('cùng buổi khác ngày KHÔNG tính là trùng', () => {
    expect(ghepLich([T3_TOI], [o(3, 'EVENING')], 1).matchScore).toBe(0)
  })

  it('trả kèm matchedShifts và totalJobShifts để giao diện nói được "x/y ca"', () => {
    // Riêng phần trăm không cho biết quy mô: 50% của tin 2 ca khác hẳn 50% của
    // tin 20 ca.
    const r = ghepLich([T2_SANG, T3_TOI, T5_TOI, T7_SANG], [T2_SANG, T3_TOI], 2)
    expect(r.matchedShifts).toBe(2)
    expect(r.totalJobShifts).toBe(4)
  })
})
