import { describe, expect, it } from 'vitest'
import {
  chamDiemPhuHop,
  duNguongCa,
  soThangTronVen,
  tinhDoPhu,
  tongHopDiem,
  type AvailabilitySlot,
  type DauVaoChamDiem,
  studentProfileSchema,
  type ThanhPhan,
} from '@uniwork/shared'

/**
 * Test cho điểm phù hợp tổng hợp của Sprint 4.
 *
 * Ba ranh giới đáng bảo vệ nhất — cả ba đều hỏng ÂM THẦM, không lỗi nào bắn ra
 * và con số vẫn trông hợp lý:
 *
 * 1. CỔNG khác ĐIỂM. Trộn lại thì 100% kỹ năng bù được cho việc không có mặt
 *    lúc quán cần người.
 * 2. `null` khác `0`. Chưa khai khác đã khai mà không khớp.
 * 3. KHÔNG ÁP DỤNG khác THIẾU DỮ LIỆU. Cả hai cùng cho `null` nhưng mẫu số độ
 *    phủ chỉ loại cái đầu — nhầm là bêu hồ sơ hoàn chỉnh thành thiếu.
 */

const o = (dayOfWeek: number, slot: string) => ({ dayOfWeek, slot }) as AvailabilitySlot

const T2_SANG = o(1, 'MORNING')
const T3_TOI = o(2, 'EVENING')
const T5_TOI = o(4, 'EVENING')
const T7_SANG = o(6, 'MORNING')

const tp = (score: number | null, weight: number, vangVi?: ThanhPhan['vangVi']): ThanhPhan =>
  vangVi ? { score, weight, vangVi } : { score, weight }

/* ====================================================== tongHopDiem ==== */

describe('tongHopDiem — chuẩn hoá lại khi thiếu thành phần', () => {
  it('đủ ba thành phần → trung bình có trọng số bình thường', () => {
    const d = tongHopDiem({
      shifts: tp(80, 0.5),
      skills: tp(60, 0.3),
      commitment: tp(50, 0.2),
    })
    // 80×0.5 + 60×0.3 + 50×0.2 = 40 + 18 + 10 = 68
    expect(d).toBe(68)
  })

  it('thiếu 1 thành phần → chia lại theo tổng trọng số CÒN LẠI, không chia cho 1', () => {
    const d = tongHopDiem({
      shifts: tp(80, 0.5),
      skills: tp(60, 0.3),
      commitment: tp(null, 0.2, 'THIEU_DU_LIEU'),
    })
    // (80×0.5 + 60×0.3) / 0.8 = 58 / 0.8 = 72.5 → 73. Khớp ví dụ 2 của tài liệu.
    expect(d).toBe(73)
    // Quên chuẩn hoá thì ra 58 — vẫn là số hợp lý, không ai phát hiện.
    expect(d).not.toBe(58)
  })

  it('thiếu 2 thành phần → còn lại một mình thì điểm CHÍNH LÀ nó', () => {
    const d = tongHopDiem({
      shifts: tp(null, 0.5, 'THIEU_DU_LIEU'),
      skills: tp(60, 0.3),
      commitment: tp(null, 0.2, 'KHONG_AP_DUNG'),
    })
    expect(d).toBe(60)
  })

  it('thiếu cả ba → null, KHÔNG phải 0', () => {
    const d = tongHopDiem({
      shifts: tp(null, 0.5, 'THIEU_DU_LIEU'),
      skills: tp(null, 0.3, 'KHONG_AP_DUNG'),
      commitment: tp(null, 0.2, 'KHONG_AP_DUNG'),
    })
    expect(d).toBeNull()
  })

  it('tổng trọng số bằng 0 → null, không chia cho 0', () => {
    expect(tongHopDiem({ a: tp(80, 0), b: tp(60, 0) })).toBeNull()
  })

  it('điểm 0 THẬT vẫn được tính, không bị nhầm là thiếu', () => {
    // Đây là chỗ `filter(c => c.score !== null)` khác hẳn `filter(c => c.score)`.
    const d = tongHopDiem({ shifts: tp(0, 0.5), skills: tp(100, 0.5) })
    expect(d).toBe(50)
  })

  it('không phụ thuộc số lượng thành phần — thêm tiêu chí thứ tư vẫn đúng', () => {
    const d = tongHopDiem({
      a: tp(100, 0.4),
      b: tp(null, 0.3, 'KHONG_AP_DUNG'),
      c: tp(50, 0.2),
      d: tp(null, 0.1, 'THIEU_DU_LIEU'),
    })
    // (100×0.4 + 50×0.2) / 0.6 = 50 / 0.6 = 83.3 → 83
    expect(d).toBe(83)
  })
})

/* ========================================================= tinhDoPhu ==== */

describe('tinhDoPhu — mẫu số loại KHÔNG ÁP DỤNG, giữ THIẾU DỮ LIỆU', () => {
  it('ví dụ 1 — tin không có kỹ năng lẫn cam kết → 1/1, KHÔNG phải 1/3', () => {
    const dp = tinhDoPhu({
      shifts: tp(100, 0.5),
      skills: tp(null, 0.3, 'KHONG_AP_DUNG'),
      commitment: tp(null, 0.2, 'KHONG_AP_DUNG'),
    })
    expect(dp).toEqual({ apDung: 1, doDuoc: 1 })
    // Bằng nhau → giao diện im lặng. Ra 1/3 nghĩa là mẫu số đang cứng bằng 3.
    expect(dp.apDung).toBe(dp.doDuoc)
  })

  it('ví dụ 2 — thiếu availableUntil → 2/3, có nhắc sinh viên', () => {
    const dp = tinhDoPhu({
      shifts: tp(80, 0.5),
      skills: tp(60, 0.3),
      commitment: tp(null, 0.2, 'THIEU_DU_LIEU'),
    })
    expect(dp).toEqual({ apDung: 3, doDuoc: 2 })
  })

  it('ví dụ 3 — thiếu cả lịch lẫn cam kết → 1/3', () => {
    const dp = tinhDoPhu({
      shifts: tp(null, 0.5, 'THIEU_DU_LIEU'),
      skills: tp(60, 0.3),
      commitment: tp(null, 0.2, 'THIEU_DU_LIEU'),
    })
    expect(dp).toEqual({ apDung: 3, doDuoc: 1 })
  })

  it('hai hồ sơ CÙNG 100 điểm nhưng phân biệt được từ dữ liệu', () => {
    const daDu = {
      shifts: tp(100, 0.5),
      skills: tp(null, 0.3, 'KHONG_AP_DUNG'),
      commitment: tp(null, 0.2, 'KHONG_AP_DUNG'),
    }
    const khaiThieu = {
      shifts: tp(null, 0.5, 'THIEU_DU_LIEU'),
      skills: tp(100, 0.3),
      commitment: tp(null, 0.2, 'THIEU_DU_LIEU'),
    }

    expect(tongHopDiem(daDu)).toBe(100)
    expect(tongHopDiem(khaiThieu)).toBe(100)

    // Cùng con số, khác hẳn ý nghĩa — và độ phủ nói ra được điều đó.
    expect(tinhDoPhu(daDu)).toEqual({ apDung: 1, doDuoc: 1 })
    expect(tinhDoPhu(khaiThieu)).toEqual({ apDung: 3, doDuoc: 1 })
  })
})

/* ======================================================== duNguongCa ==== */

describe('duNguongCa — cổng, tách hẳn khỏi điểm', () => {
  it('đủ ngưỡng', () => {
    expect(duNguongCa(8, 5)).toBe(true)
    expect(duNguongCa(5, 5)).toBe(true)
  })

  it('thiếu ngưỡng', () => {
    expect(duNguongCa(4, 5)).toBe(false)
  })

  it('không nhìn tới điểm số nào — chỉ hai con số ca', () => {
    // Cùng matched/required thì kết quả không đổi dù điểm tổng thế nào.
    expect(duNguongCa(1, 3)).toBe(false)
  })
})

/* ==================================================== soThangTronVen ==== */

describe('soThangTronVen — đếm theo lịch, không chia cho 30 ngày', () => {
  it('01/09 → 30/11 cho 2, không phải 3 (chưa trọn tháng thứ ba)', () => {
    expect(soThangTronVen(new Date(2026, 8, 1), new Date(2026, 10, 30))).toBe(2)
  })

  it('01/09 → 01/12 cho 3', () => {
    expect(soThangTronVen(new Date(2026, 8, 1), new Date(2026, 11, 1))).toBe(3)
  })

  it('vắt qua năm', () => {
    expect(soThangTronVen(new Date(2026, 10, 15), new Date(2027, 1, 15))).toBe(3)
  })

  it('mốc kết thúc trước mốc bắt đầu → 0, không âm', () => {
    expect(soThangTronVen(new Date(2026, 8, 1), new Date(2026, 5, 1))).toBe(0)
  })
})

/* ==================================================== chamDiemPhuHop ==== */

const NEN: DauVaoChamDiem = {
  caLam: [T2_SANG, T3_TOI, T5_TOI, T7_SANG],
  minShiftsPerWeek: 2,
  kyNangTin: ['sk-pha-che', 'sk-giao-tiep'],
  commitmentMonths: 6,
  mocBatDau: new Date(2026, 8, 1),
  lichRanh: [T2_SANG, T3_TOI],
  kyNangSinhVien: ['sk-giao-tiep'],
  availableUntil: new Date(2027, 2, 1),
}

describe('chamDiemPhuHop — ba thành phần', () => {
  it('trường hợp đầy đủ: ba thành phần đều đo được, độ phủ 3/3', () => {
    const r = chamDiemPhuHop(NEN)

    expect(r.shifts).toMatchObject({ matched: 2, total: 4, required: 2, score: 50 })
    expect(r.skills).toMatchObject({ matched: 1, total: 2, score: 50 })
    expect(r.commitment).toMatchObject({ months: 6, required: 6, score: 100 })
    expect(r.coverage).toEqual({ apDung: 3, doDuoc: 3 })
    // 50×0.5 + 50×0.3 + 100×0.2 = 25 + 15 + 20 = 60
    expect(r.finalScore).toBe(60)
    expect(r.eligible).toBe(true)
  })

  it('CỔNG không bị điểm kéo lên: 100% kỹ năng nhưng không đủ ca → eligible false', () => {
    const r = chamDiemPhuHop({
      ...NEN,
      minShiftsPerWeek: 3,
      lichRanh: [T2_SANG],
      kyNangSinhVien: ['sk-pha-che', 'sk-giao-tiep'],
    })

    expect(r.skills.score).toBe(100)
    expect(r.finalScore).toBeGreaterThan(50)
    // Điểm cao nhưng vẫn KHÔNG đủ điều kiện — đây là lý do hai hàm phải tách.
    expect(r.eligible).toBe(false)
  })

  it('tin không yêu cầu kỹ năng → KHÔNG ÁP DỤNG, không phải 100', () => {
    const r = chamDiemPhuHop({ ...NEN, kyNangTin: [] })

    expect(r.skills.score).toBeNull()
    expect(r.skills.vangVi).toBe('KHONG_AP_DUNG')
    expect(r.coverage.apDung).toBe(2)
  })

  it('tin ONE_TIME không có cam kết → KHÔNG ÁP DỤNG', () => {
    const r = chamDiemPhuHop({ ...NEN, commitmentMonths: null })

    expect(r.commitment.score).toBeNull()
    expect(r.commitment.vangVi).toBe('KHONG_AP_DUNG')
    expect(r.commitment.required).toBeNull()
  })

  it('sinh viên chưa khai lịch rảnh → THIẾU DỮ LIỆU, eligible null chứ không false', () => {
    const r = chamDiemPhuHop({ ...NEN, lichRanh: null })

    expect(r.shifts.score).toBeNull()
    expect(r.shifts.vangVi).toBe('THIEU_DU_LIEU')
    // `false` sẽ là khẳng định "đã đo, bạn không nhận nổi" về thứ chưa hề đo.
    expect(r.eligible).toBeNull()
    expect(r.coverage).toEqual({ apDung: 3, doDuoc: 2 })
  })

  it('sinh viên chưa khai kỹ năng → THIẾU DỮ LIỆU, không phải 0', () => {
    const r = chamDiemPhuHop({ ...NEN, kyNangSinhVien: [] })

    expect(r.skills.score).toBeNull()
    expect(r.skills.vangVi).toBe('THIEU_DU_LIEU')
  })

  it('khai lịch nhưng không trùng ca nào → 0 THẬT, eligible false', () => {
    const r = chamDiemPhuHop({ ...NEN, lichRanh: [o(3, 'AFTERNOON')] })

    expect(r.shifts.score).toBe(0)
    expect(r.shifts.vangVi).toBeUndefined()
    expect(r.eligible).toBe(false)
    expect(r.coverage.doDuoc).toBe(3)
  })

  it('cam kết tính THEO PHẦN, không nhị phân', () => {
    // Còn 4 tháng trên yêu cầu 6 → 67, không phải 0.
    const r = chamDiemPhuHop({ ...NEN, availableUntil: new Date(2027, 0, 1) })
    expect(r.commitment).toMatchObject({ months: 4, required: 6, score: 67 })
  })

  it('cam kết vượt yêu cầu → chặn trần ở 100, không phải 150', () => {
    const r = chamDiemPhuHop({ ...NEN, availableUntil: new Date(2027, 8, 1) })
    expect(r.commitment.score).toBe(100)
  })

  it('availableUntil đã qua mốc bắt đầu → 0 ĐÃ ĐO, khác hẳn chưa khai', () => {
    const r = chamDiemPhuHop({ ...NEN, availableUntil: new Date(2026, 5, 1) })

    expect(r.commitment.months).toBe(0)
    expect(r.commitment.score).toBe(0)
    expect(r.commitment.vangVi).toBeUndefined()
    expect(r.coverage.doDuoc).toBe(3)
  })

  it('ví dụ 1 của tài liệu — tin phát tờ rơi: 100 điểm trên 1/1 tiêu chí', () => {
    const r = chamDiemPhuHop({
      caLam: [T2_SANG, T3_TOI],
      minShiftsPerWeek: null,
      kyNangTin: [],
      commitmentMonths: null,
      mocBatDau: new Date(2026, 8, 1),
      lichRanh: [T2_SANG, T3_TOI],
      kyNangSinhVien: [],
      availableUntil: null,
    })

    expect(r.finalScore).toBe(100)
    expect(r.coverage).toEqual({ apDung: 1, doDuoc: 1 })
    expect(r.eligible).toBe(true)
  })

  it('required đóng băng theo ngưỡng ĐÃ CHUẨN HOÁ, không phải cột thô', () => {
    // Tin mở 2 ca nhưng đòi tối thiểu 5 — lỗi nhập liệu. Ngưỡng chặn trần ở 2,
    // nếu không thì không ai đủ điều kiện và NTD không hiểu vì sao.
    const r = chamDiemPhuHop({ ...NEN, caLam: [T2_SANG, T3_TOI], minShiftsPerWeek: 5 })
    expect(r.shifts.required).toBe(2)
    expect(r.eligible).toBe(true)
  })

  it('tin không có ca nào → KHÔNG ÁP DỤNG, không chia cho 0', () => {
    const r = chamDiemPhuHop({ ...NEN, caLam: [] })

    expect(r.shifts.score).toBeNull()
    expect(r.shifts.vangVi).toBe('KHONG_AP_DUNG')
    expect(r.eligible).toBeNull()
    expect(r.coverage.apDung).toBe(2)
  })

  it('hàm THUẦN — gọi hai lần cùng dữ liệu ra cùng kết quả', () => {
    expect(chamDiemPhuHop(NEN)).toEqual(chamDiemPhuHop(NEN))
  })
})

/* ====================================================== số điện thoại ==== */

describe('studentProfileSchema.phone — chuẩn hoá và ranh giới undefined/null', () => {
  const doc = (phone: unknown) => studentProfileSchema.safeParse({ phone })

  it('bỏ dấu cách, chấm và gạch — hai cách gõ ra CÙNG một chuỗi lưu', () => {
    expect(doc('0901 234 567').data?.phone).toBe('0901234567')
    expect(doc('0901.234.567').data?.phone).toBe('0901234567')
    expect(doc('090-123-4567').data?.phone).toBe('0901234567')
  })

  it('nhận tiền tố +84', () => {
    expect(doc('+84 901 234 567').data?.phone).toBe('+84901234567')
  })

  it('KHÔNG gửi trường → undefined, để Prisma bỏ qua chứ không xoá số đang có', () => {
    const r = studentProfileSchema.safeParse({})
    expect(r.success).toBe(true)
    expect(r.data?.phone).toBeUndefined()
    // Ép undefined thành null ở đây sẽ XOÁ TRẮNG số mỗi lần client gửi thiếu
    // trường — lỗi im lặng, chỉ lộ ra khi có người đi tìm số mà không thấy.
    expect(r.data?.phone).not.toBeNull()
  })

  it('gửi null hoặc chuỗi rỗng → null, đó mới là lệnh XOÁ', () => {
    expect(doc(null).data?.phone).toBeNull()
    expect(doc('').data?.phone).toBeNull()
  })

  it('gõ thiếu số hoặc dán nhầm chữ → báo lỗi đọc được', () => {
    expect(doc('0901').success).toBe(false)
    expect(doc('goi cho toi nhe').success).toBe(false)
    expect(doc('1901234567').success).toBe(false) // không bắt đầu bằng 0 hay +84
  })
})

/* ========================================= availableUntil, lương mong muốn == */

describe('studentProfileSchema — hai cột từng CHẾT của Sprint 0', () => {
  const doc = (v: Record<string, unknown>) => studentProfileSchema.safeParse(v)

  it('availableUntil nhận YYYY-MM-DD từ <input type="date">', () => {
    const r = doc({ availableUntil: '2027-06-30' })
    expect(r.success).toBe(true)
    expect(r.data?.availableUntil).toBeInstanceOf(Date)
  })

  it('ô ngày để trống → null, KHÔNG phải Invalid Date', () => {
    // `new Date('')` ra Invalid Date và form sẽ báo lỗi cho một ô người dùng
    // CỐ Ý không điền — cùng lớp lỗi `ngayTuyChon` sinh ra để chặn.
    expect(doc({ availableUntil: '' }).data?.availableUntil).toBeNull()
    expect(doc({ availableUntil: null }).data?.availableUntil).toBeNull()
  })

  it('không gửi ô ngày → undefined, Prisma bỏ qua chứ không xoá', () => {
    expect(doc({}).data?.availableUntil).toBeUndefined()
  })

  it('lương mong muốn: nhận số nguyên, chặn số vô lý và số âm', () => {
    expect(doc({ expectedHourlyRate: 30000 }).success).toBe(true)
    expect(doc({ expectedHourlyRate: 0 }).success).toBe(true)
    // Gõ thừa một số 0 — 3 triệu/giờ không phải việc part-time.
    expect(doc({ expectedHourlyRate: 3_000_000 }).success).toBe(false)
    expect(doc({ expectedHourlyRate: -1 }).success).toBe(false)
    expect(doc({ expectedHourlyRate: 30.5 }).success).toBe(false)
  })
})
