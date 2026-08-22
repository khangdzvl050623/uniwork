import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'
import { resetRateLimits } from '../../middlewares/rate-limit.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    employerProfile: { findUnique: vi.fn() },
    skill: { count: vi.fn() },
    job: { create: vi.fn() },
  },
}))

const ntdFindUnique = prisma.employerProfile.findUnique as unknown as Mock
const skillCount = prisma.skill.count as unknown as Mock
const jobCreate = prisma.job.create as unknown as Mock

const ntdToken = signAccessToken({ sub: 'u-ntd', role: 'EMPLOYER' })
const svToken = signAccessToken({ sub: 'u-sv', role: 'STUDENT' })

/** Ngày trong tương lai, tính từ lúc chạy test — không ghi cứng để test không mục theo thời gian. */
function saoNgay(soNgay: number): string {
  return new Date(Date.now() + soNgay * 24 * 60 * 60 * 1000).toISOString()
}

/** Tin RECURRING hợp lệ. Mọi ca test dưới đây sửa từ đây ra. */
function tinHopLe(ghiDe: Record<string, unknown> = {}) {
  return {
    title: 'Phục vụ quán cà phê ca tối',
    description:
      'Quán cà phê nhỏ khu trung tâm cần tuyển bạn phục vụ ca tối. Công việc gồm order, pha chế đồ uống cơ bản và giữ khu vực quầy gọn gàng.',
    requirements: ['Sinh viên năm 1 đến năm 4'],
    benefits: ['Được đào tạo pha chế'],
    city: 'TP.HCM',
    district: 'Quận 1',
    quantity: 2,
    salaryNegotiable: false,
    salaryMin: 25000,
    salaryMax: 30000,
    salaryUnit: 'HOUR',
    scheduleType: 'RECURRING',
    commitmentMonths: 3,
    minShiftsPerWeek: 3,
    deadline: saoNgay(30),
    shifts: [
      { dayOfWeek: 2, slot: 'EVENING' },
      { dayOfWeek: 4, slot: 'EVENING' },
    ],
    skillIds: ['sk-1'],
    ...ghiDe,
  }
}

/** Hàng Prisma trả về sau khi tạo, đúng hình dạng `CHON_JOB`. */
const HANG_JOB = {
  id: 'job-1',
  title: 'Phục vụ quán cà phê ca tối',
  description: 'Mô tả dài đủ 50 ký tự trở lên cho qua kiểm tra của Zod nhé.',
  requirements: ['Sinh viên năm 1 đến năm 4'],
  benefits: ['Được đào tạo pha chế'],
  city: 'TP.HCM',
  district: 'Quận 1',
  quantity: 2,
  salaryNegotiable: false,
  salaryMin: 25000,
  salaryMax: 30000,
  salaryUnit: 'HOUR' as const,
  scheduleType: 'RECURRING' as const,
  commitmentMonths: 3,
  minShiftsPerWeek: 3,
  startDate: null,
  endDate: null,
  workDate: null,
  deadline: new Date('2026-09-30'),
  status: 'DRAFT' as const,
  rejectionReason: null,
  publishedAt: null,
  closedAt: null,
  viewCount: 0,
  createdAt: new Date('2026-08-22'),
  updatedAt: new Date('2026-08-22'),
  shifts: [{ dayOfWeek: 2, slot: 'EVENING' as const }],
  skills: [{ skill: { id: 'sk-1', name: 'Pha chế', slug: 'pha-che' } }],
}

/** Gửi một request tạo tin với thân đã cho. */
function guiTaoTin(body: object, token = ntdToken) {
  return request(createApp())
    .post('/api/ntd/tin-tuyen-dung')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Bộ đếm rate limit sống trong bộ nhớ module, không tự reset giữa các ca test
  // — không xoá thì ca thứ 21 trở đi đỏ vì 429 chứ không phải vì lỗi thật.
  resetRateLimits()

  ntdFindUnique.mockResolvedValue({ id: 'ep-1', verifiedAt: new Date('2026-08-01') })
  skillCount.mockResolvedValue(1)
  jobCreate.mockResolvedValue(HANG_JOB)
})

describe('POST /api/ntd/tin-tuyen-dung — tạo tin', () => {
  it('tạo được tin hợp lệ, LUÔN ở trạng thái DRAFT', async () => {
    const res = await guiTaoTin(tinHopLe())

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')

    // `status` không nằm trong `data` gửi xuống Prisma: nó dùng giá trị mặc định
    // của schema. Cho client tự đặt OPEN là bỏ qua toàn bộ khâu duyệt.
    const dataGhi = jobCreate.mock.calls[0][0].data as Record<string, unknown>
    expect(dataGhi).not.toHaveProperty('status')
    expect(dataGhi.employerProfileId).toBe('ep-1')
  })

  it('ghi ca làm và kỹ năng lồng trong cùng một lệnh create', async () => {
    // Prisma tự bọc transaction cho bản ghi con lồng nhau, nên không thể còn lại
    // một tin không có ca làm nào khi nửa chừng lỗi.
    await guiTaoTin(tinHopLe())

    const dataGhi = jobCreate.mock.calls[0][0].data as {
      shifts: { create: unknown[] }
      skills: { create: unknown[] }
    }
    expect(dataGhi.shifts.create).toEqual([
      { dayOfWeek: 2, slot: 'EVENING' },
      { dayOfWeek: 4, slot: 'EVENING' },
    ])
    expect(dataGhi.skills.create).toEqual([{ skillId: 'sk-1' }])
  })

  it('sinh viên không tạo được tin', async () => {
    const res = await guiTaoTin(tinHopLe(), svToken)

    expect(res.status).toBe(403)
    expect(jobCreate).not.toHaveBeenCalled()
  })

  it('chưa đăng nhập thì 401', async () => {
    const res = await request(createApp()).post('/api/ntd/tin-tuyen-dung').send(tinHopLe())
    expect(res.status).toBe(401)
  })

  it('NTD chưa xác minh VẪN tạo được tin nháp', async () => {
    // Đúng theo BRD: "lưu nháp được, gửi duyệt thì 403". Chặn ngay từ bước soạn
    // thảo chỉ khiến họ không có gì làm trong lúc chờ admin duyệt giấy tờ.
    ntdFindUnique.mockResolvedValue({ id: 'ep-1', verifiedAt: null })

    const res = await guiTaoTin(tinHopLe())
    expect(res.status).toBe(201)
  })

  it('kỹ năng không có thật thì 400, không ghi tin', async () => {
    skillCount.mockResolvedValue(0)

    const res = await guiTaoTin(tinHopLe({ skillIds: ['khong-ton-tai'] }))

    expect(res.status).toBe(400)
    expect(jobCreate).not.toHaveBeenCalled()
  })
})

/*
 * Bảng luật lịch — đối chiếu TỪNG DÒNG với CHECK `jobs_schedule_fields_check`.
 *
 * |            | commitmentMonths | startDate | endDate  | workDate | minShiftsPerWeek |
 * |------------|------------------|-----------|----------|----------|------------------|
 * | RECURRING  | tuỳ chọn         | tuỳ chọn  | CẤM      | CẤM      | tuỳ chọn         |
 * | SEASONAL   | CẤM              | BẮT BUỘC  | BẮT BUỘC | CẤM      | tuỳ chọn         |
 * | ONE_TIME   | CẤM              | CẤM       | CẤM      | BẮT BUỘC | CẤM              |
 *
 * Zod phải nói ĐÚNG Y HỆT luật này. Nới hơn thì người dùng nhận lỗi 500 bí ẩn
 * từ Postgres; siết hơn thì chặn oan dữ liệu database vẫn chấp nhận. Vì vậy test
 * ở đây đi hết cả hai chiều — cái gì phải cho qua và cái gì phải chặn.
 */
describe('luật lịch phải khớp CHECK jobs_schedule_fields_check', () => {
  it('RECURRING: bỏ trống cam kết và ngày bắt đầu vẫn hợp lệ', async () => {
    // "Chỉ cấm cái MÂU THUẪN, không cấm cái chưa khai" — có việc định kỳ không
    // đòi cam kết gì cả ("rảnh buổi nào làm buổi đó").
    const res = await guiTaoTin(
      tinHopLe({ commitmentMonths: null, startDate: null, minShiftsPerWeek: null }),
    )
    expect(res.status).toBe(201)
  })

  it('RECURRING: có endDate thì bị chặn', async () => {
    const res = await guiTaoTin(tinHopLe({ endDate: saoNgay(60) }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('endDate')
    expect(jobCreate).not.toHaveBeenCalled()
  })

  it('RECURRING: có workDate thì bị chặn', async () => {
    const res = await guiTaoTin(tinHopLe({ workDate: saoNgay(10) }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('workDate')
  })

  it('SEASONAL: đủ ngày bắt đầu và kết thúc thì hợp lệ', async () => {
    const res = await guiTaoTin(
      tinHopLe({
        scheduleType: 'SEASONAL',
        commitmentMonths: null,
        startDate: saoNgay(10),
        endDate: saoNgay(20),
      }),
    )
    expect(res.status).toBe(201)
  })

  it('SEASONAL: thiếu ngày kết thúc thì bị chặn', async () => {
    const res = await guiTaoTin(
      tinHopLe({ scheduleType: 'SEASONAL', commitmentMonths: null, startDate: saoNgay(10) }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('endDate')
  })

  it('SEASONAL: mang commitmentMonths thì bị chặn', async () => {
    // Quyết định của BA: tin Tết gói gọn 10 ngày mà mang "cam kết 1 tháng" thì
    // hai trường nói hai chuyện khác nhau, người viết giao diện không biết tin
    // cái nào.
    const res = await guiTaoTin(
      tinHopLe({
        scheduleType: 'SEASONAL',
        commitmentMonths: 2,
        startDate: saoNgay(10),
        endDate: saoNgay(20),
      }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('commitmentMonths')
  })

  it('SEASONAL: ngày kết thúc trước ngày bắt đầu thì bị chặn', async () => {
    const res = await guiTaoTin(
      tinHopLe({
        scheduleType: 'SEASONAL',
        commitmentMonths: null,
        startDate: saoNgay(20),
        endDate: saoNgay(10),
      }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('endDate')
  })

  it('ONE_TIME: chỉ cần workDate là hợp lệ', async () => {
    const res = await guiTaoTin(
      tinHopLe({
        scheduleType: 'ONE_TIME',
        commitmentMonths: null,
        minShiftsPerWeek: null,
        workDate: saoNgay(7),
      }),
    )
    expect(res.status).toBe(201)
  })

  it('ONE_TIME: thiếu workDate thì bị chặn', async () => {
    const res = await guiTaoTin(
      tinHopLe({ scheduleType: 'ONE_TIME', commitmentMonths: null, minShiftsPerWeek: null }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('workDate')
  })

  it('ONE_TIME: mang minShiftsPerWeek thì bị chặn', async () => {
    // Việc chỉ diễn ra một buổi thì "số ca tối thiểu mỗi tuần" vô nghĩa.
    const res = await guiTaoTin(
      tinHopLe({
        scheduleType: 'ONE_TIME',
        commitmentMonths: null,
        minShiftsPerWeek: 3,
        workDate: saoNgay(7),
      }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('minShiftsPerWeek')
  })
})

/*
 * Lương — đối chiếu với CHECK `jobs_salary_check`:
 *   (negotiable = true  AND min IS NULL AND max IS NULL)
 *   OR
 *   (negotiable = false AND min IS NOT NULL AND max IS NOT NULL AND max >= min)
 */
describe('luật lương phải khớp CHECK jobs_salary_check', () => {
  it('thoả thuận và không ghi số nào thì hợp lệ', async () => {
    const res = await guiTaoTin(
      tinHopLe({ salaryNegotiable: true, salaryMin: null, salaryMax: null }),
    )
    expect(res.status).toBe(201)
  })

  it('thoả thuận NHƯNG vẫn ghi số thì bị chặn', async () => {
    // Đây đúng là kiểu dữ liệu nửa vời làm bộ lọc lương trả về kết quả không ai
    // giải thích được.
    const res = await guiTaoTin(tinHopLe({ salaryNegotiable: true, salaryMin: 25000 }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('salaryMin')
  })

  it('không thoả thuận mà thiếu lương tối đa thì bị chặn', async () => {
    const res = await guiTaoTin(tinHopLe({ salaryMax: null }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('salaryMax')
  })

  it('lương tối đa nhỏ hơn tối thiểu thì bị chặn', async () => {
    const res = await guiTaoTin(tinHopLe({ salaryMin: 40000, salaryMax: 30000 }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('salaryMax')
  })

  it('salaryUnit vẫn bắt buộc kể cả khi thoả thuận', async () => {
    // "Thoả thuận theo giờ" khác "thoả thuận theo tháng" — sinh viên cần biết
    // mình đang mặc cả trên đơn vị nào.
    const res = await guiTaoTin(
      tinHopLe({
        salaryNegotiable: true,
        salaryMin: null,
        salaryMax: null,
        salaryUnit: undefined,
      }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('salaryUnit')
  })

  it('server ép null khi thoả thuận, không tin vào input', async () => {
    await guiTaoTin(tinHopLe({ salaryNegotiable: true, salaryMin: null, salaryMax: null }))

    const dataGhi = jobCreate.mock.calls[0][0].data as Record<string, unknown>
    expect(dataGhi.salaryMin).toBeNull()
    expect(dataGhi.salaryMax).toBeNull()
  })
})

describe('ca làm và kỹ năng', () => {
  it('không có ca làm nào thì bị chặn — mất luôn tính năng lọc theo lịch', async () => {
    const res = await guiTaoTin(tinHopLe({ shifts: [] }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('shifts')
    expect(jobCreate).not.toHaveBeenCalled()
  })

  it('dayOfWeek ngoài 0–6 bị chặn, khớp CHECK job_shifts_day_of_week_check', async () => {
    const res = await guiTaoTin(tinHopLe({ shifts: [{ dayOfWeek: 7, slot: 'EVENING' }] }))

    expect(res.status).toBe(400)
    expect(jobCreate).not.toHaveBeenCalled()
  })

  it('ca làm trùng nhau bị chặn trước khi vỡ ở @@unique', async () => {
    const res = await guiTaoTin(
      tinHopLe({
        shifts: [
          { dayOfWeek: 2, slot: 'EVENING' },
          { dayOfWeek: 2, slot: 'EVENING' },
        ],
      }),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('shifts')
  })

  it('kỹ năng trùng bị chặn trước khi vỡ ở @@id', async () => {
    const res = await guiTaoTin(tinHopLe({ skillIds: ['sk-1', 'sk-1'] }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('skillIds')
  })

  it('không chọn kỹ năng nào vẫn hợp lệ', async () => {
    // Kỹ năng là phần bổ sung để lọc, không phải thông tin bắt buộc của tin.
    skillCount.mockResolvedValue(0)

    const res = await guiTaoTin(tinHopLe({ skillIds: [] }))
    expect(res.status).toBe(201)
  })
})

describe('hạn nhận hồ sơ', () => {
  it('hạn ở quá khứ thì bị chặn', async () => {
    const res = await guiTaoTin(tinHopLe({ deadline: saoNgay(-1) }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('deadline')
  })

  it('chuỗi ngày rác bị chặn, không lọt xuống Prisma', async () => {
    const res = await guiTaoTin(tinHopLe({ deadline: 'hôm nào đó' }))

    expect(res.status).toBe(400)
    expect(jobCreate).not.toHaveBeenCalled()
  })
})

describe('chống tạo tin dồn dập', () => {
  it('quá 20 tin trong một giờ thì trả RATE_LIMITED', async () => {
    /*
     * Bảo vệ chính ở đây là chống double-submit và retry loop của chính giao
     * diện mình, không phải chống kẻ tấn công — tạo tin đòi vai EMPLOYER, mà
     * đăng ký NTD phải qua OTP email nên không ẩn danh.
     */
    const app = createApp()
    const gui = () =>
      request(app)
        .post('/api/ntd/tin-tuyen-dung')
        .set('Authorization', `Bearer ${ntdToken}`)
        .send(tinHopLe())

    for (let i = 0; i < 20; i += 1) {
      const res = await gui()
      expect(res.status).toBe(201)
    }

    const res = await gui()
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
  })
})
