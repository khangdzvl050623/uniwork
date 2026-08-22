import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'
import { resetRateLimits } from '../../middlewares/rate-limit.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    employerProfile: { findUnique: vi.fn() },
    skill: { count: vi.fn() },
    job: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const ntdFindUnique = prisma.employerProfile.findUnique as unknown as Mock
const skillCount = prisma.skill.count as unknown as Mock
const jobCreate = prisma.job.create as unknown as Mock
const jobFindMany = prisma.job.findMany as unknown as Mock
const jobFindUnique = prisma.job.findUnique as unknown as Mock
const jobUpdate = prisma.job.update as unknown as Mock
const jobDelete = prisma.job.delete as unknown as Mock
const jobFindFirst = prisma.job.findFirst as unknown as Mock
const jobCount = prisma.job.count as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

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

/**
 * Hàng Prisma trả về, đúng hình dạng `CHON_JOB`.
 *
 * Các trường "nhạy cảm" (xem `TRUONG_BAT_DUYET_LAI`) CỐ Ý lấy thẳng từ
 * `tinHopLe()` thay vì gõ lại. Ở T70 có những ca test khẳng định "gửi đúng dữ
 * liệu cũ thì KHÔNG bắt duyệt lại" — nếu tin cũ và dữ liệu gửi lên gõ tay hai
 * nơi thì chỉ cần lệch một dấu câu trong `description` là ca test đó đỏ vì lý
 * do chẳng liên quan gì tới luật đang kiểm.
 */
const MAU = tinHopLe()

const HANG_JOB = {
  id: 'job-1',
  title: MAU.title,
  description: MAU.description,
  requirements: MAU.requirements,
  benefits: MAU.benefits,
  city: MAU.city,
  district: MAU.district,
  quantity: MAU.quantity,
  salaryNegotiable: MAU.salaryNegotiable,
  salaryMin: MAU.salaryMin,
  salaryMax: MAU.salaryMax,
  salaryUnit: MAU.salaryUnit,
  shifts: MAU.shifts,

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

/* ------------------------------------------------------------------ T69 -- */

describe('GET /api/ntd/tin-tuyen-dung — danh sách tin của chính mình', () => {
  it('chỉ lấy tin của đúng hồ sơ người gọi, đủ mọi trạng thái', async () => {
    jobFindMany.mockResolvedValue([HANG_JOB, { ...HANG_JOB, id: 'job-2', status: 'OPEN' }])

    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.jobs).toHaveLength(2)

    /*
     * Khoá chặt điều kiện lọc. Thiếu `where` này thì NTD nào cũng thấy tin của
     * mọi NTD khác — và đó là kiểu lỗi không có biểu hiện gì trên màn hình của
     * người đang thử, vì máy dev thường chỉ có một nhà tuyển dụng.
     */
    expect(jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employerProfileId: 'ep-1' } }),
    )
  })

  it('KHÔNG lọc theo status — tin nháp và tin bị từ chối vẫn phải thấy', async () => {
    // Chủ tin mà không thấy tin bị từ chối thì không ai sửa lại được nó.
    jobFindMany.mockResolvedValue([])

    await request(createApp())
      .get('/api/ntd/tin-tuyen-dung')
      .set('Authorization', `Bearer ${ntdToken}`)

    const where = jobFindMany.mock.calls[0][0].where as Record<string, unknown>
    expect(where).not.toHaveProperty('status')
  })

  it('chưa có tin nào thì trả mảng rỗng, không phải 404', async () => {
    jobFindMany.mockResolvedValue([])

    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.jobs).toEqual([])
  })

  it('sinh viên không xem được danh sách tin của NTD', async () => {
    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung')
      .set('Authorization', `Bearer ${svToken}`)

    expect(res.status).toBe(403)
    expect(jobFindMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/ntd/tin-tuyen-dung/:id — chi tiết tin của chính mình', () => {
  it('lấy được tin của mình', async () => {
    jobFindUnique.mockResolvedValue({ ...HANG_JOB, employerProfileId: 'ep-1' })

    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung/job-1')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('job-1')
    // Ca làm và kỹ năng đã được phẳng ra, web không phải đọc job.skills[].skill.
    expect(res.body.data.skills[0]).toEqual({ id: 'sk-1', name: 'Pha chế', slug: 'pha-che' })
    expect(res.body.data.shifts[0]).toEqual({ dayOfWeek: 2, slot: 'EVENING' })
  })

  it('XEM TIN CỦA NTD KHÁC thì 403', async () => {
    /*
     * Lỗ hổng nghiêm trọng nhất có thể có ở module này. `requireRole('EMPLOYER')`
     * chỉ trả lời "người này có phải nhà tuyển dụng không", KHÔNG trả lời "tin
     * này có phải của họ không". Thiếu bước hai thì đổi id trên URL là xem được
     * tin của bất kỳ ai.
     */
    jobFindUnique.mockResolvedValue({ ...HANG_JOB, employerProfileId: 'ep-KHAC' })

    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung/job-cua-nguoi-khac')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(403)
  })

  it('tin không tồn tại thì 404', async () => {
    jobFindUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung/khong-co')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(404)
  })

  it('sinh viên không xem được', async () => {
    const res = await request(createApp())
      .get('/api/ntd/tin-tuyen-dung/job-1')
      .set('Authorization', `Bearer ${svToken}`)

    expect(res.status).toBe(403)
    expect(jobFindUnique).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ T70 -- */

/** Gửi request sửa tin. Mặc định tin cũ là bản OPEN đã duyệt. */
function guiSuaTin(body: object, tinCu: Record<string, unknown> = {}, token = ntdToken) {
  jobFindUnique.mockResolvedValue({
    ...HANG_JOB,
    employerProfileId: 'ep-1',
    status: 'OPEN',
    ...tinCu,
  })
  jobUpdate.mockResolvedValue({ ...HANG_JOB, ...tinCu })

  return request(createApp())
    .put('/api/ntd/tin-tuyen-dung/job-1')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
}

/** Đọc `status` trong `data` gửi xuống Prisma. `undefined` = cố ý không đổi. */
function statusDaGhi(): unknown {
  return (jobUpdate.mock.calls[0][0].data as Record<string, unknown>).status
}

describe('PUT /api/ntd/tin-tuyen-dung/:id — sửa tin', () => {
  it('sửa được tin của mình', async () => {
    const res = await guiSuaTin(tinHopLe())
    expect(res.status).toBe(200)
    expect(jobUpdate).toHaveBeenCalled()
  })

  it('sửa tin của NTD khác thì 403', async () => {
    const res = await guiSuaTin(tinHopLe(), { employerProfileId: 'ep-KHAC' })

    expect(res.status).toBe(403)
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('sinh viên không sửa được', async () => {
    const res = await guiSuaTin(tinHopLe(), {}, svToken)

    expect(res.status).toBe(403)
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('luật lịch và lương vẫn áp dụng y hệt lúc tạo', async () => {
    // Dùng chung `baseJobSchema` nên không thể lệch — test này khoá điều đó lại.
    const res = await guiSuaTin(tinHopLe({ endDate: saoNgay(60) }))

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('endDate')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('thay TOÀN BỘ ca làm và kỹ năng, không tính phần thêm/bớt', async () => {
    await guiSuaTin(tinHopLe({ shifts: [{ dayOfWeek: 6, slot: 'MORNING' }] }))

    const data = jobUpdate.mock.calls[0][0].data as {
      shifts: { deleteMany: unknown; create: unknown[] }
      skills: { deleteMany: unknown; create: unknown[] }
    }
    // `deleteMany` + `create` lồng trong cùng một `update` được Prisma bọc chung
    // một transaction — không có khoảnh khắc nào tin tồn tại mà không có ca làm.
    expect(data.shifts.deleteMany).toEqual({})
    expect(data.shifts.create).toEqual([{ dayOfWeek: 6, slot: 'MORNING' }])
    expect(data.skills.deleteMany).toEqual({})
  })
})

describe('T70 — tin CLOSED không sửa được', () => {
  it('trả 409 kèm gợi ý đăng tin mới', async () => {
    /*
     * Cho sửa rồi đẩy về PENDING là hồi sinh một tin đã đóng, trong khi đơn ứng
     * tuyển cũ vẫn trỏ vào đúng tin đó — ứng viên bị từ chối đợt trước bỗng thấy
     * mình đang có đơn ở một tin "đang mở" với nội dung khác hẳn thứ họ đã nộp.
     */
    const res = await guiSuaTin(tinHopLe(), { status: 'CLOSED' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(res.body.error.message).toContain('đăng một tin mới')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('DRAFT và PENDING thì vẫn sửa được bình thường', async () => {
    // Hai trạng thái này chưa có ứng viên nào và vốn đang trong quá trình soạn.
    for (const status of ['DRAFT', 'PENDING'] as const) {
      vi.clearAllMocks()
      ntdFindUnique.mockResolvedValue({ id: 'ep-1', verifiedAt: new Date() })
      skillCount.mockResolvedValue(1)

      const res = await guiSuaTin(tinHopLe(), { status })
      expect(res.status).toBe(200)
    }
  })
})

/*
 * Danh sách trường bắt duyệt lại, chốt trong BRD:
 *   title · description · salaryMin · salaryMax · salaryNegotiable · salaryUnit
 *   · city · district · ca làm · quantity
 * KHÔNG bắt: benefits · requirements · skills
 */
describe('T70 — sửa gì thì tin quay về PENDING', () => {
  it('đổi mô tả trên tin OPEN thì về PENDING', async () => {
    /*
     * `description` là trường DEV1 thêm vào so với đề xuất gốc của BA. Tin lừa
     * đảo không đổi lương — nó đổi mô tả sau khi đã qua duyệt bằng một tin sạch.
     */
    await guiSuaTin(tinHopLe({ description: 'x'.repeat(60) }))
    expect(statusDaGhi()).toBe('PENDING')
  })

  it('đổi lương trên tin OPEN thì về PENDING', async () => {
    await guiSuaTin(tinHopLe({ salaryMin: 50000, salaryMax: 60000 }))
    expect(statusDaGhi()).toBe('PENDING')
  })

  it('đổi ĐƠN VỊ lương thì cũng về PENDING', async () => {
    // BRD quên trường này. Giữ nguyên hai con số mà đổi HOUR sang MONTH là biến
    // "25.000–30.000 mỗi giờ" thành "mỗi tháng" — cùng kiểu đánh tráo mà ba
    // trường lương kia đang được canh để chặn.
    await guiSuaTin(tinHopLe({ salaryUnit: 'MONTH' }))
    expect(statusDaGhi()).toBe('PENDING')
  })

  it('đổi ca làm thì về PENDING', async () => {
    await guiSuaTin(tinHopLe({ shifts: [{ dayOfWeek: 0, slot: 'MORNING' }] }))
    expect(statusDaGhi()).toBe('PENDING')
  })

  it('đổi địa điểm và số lượng thì về PENDING', async () => {
    await guiSuaTin(tinHopLe({ district: 'Quận 3', quantity: 10 }))
    expect(statusDaGhi()).toBe('PENDING')
  })

  it('CHỈ đổi benefits/requirements/skills thì GIỮ NGUYÊN OPEN', async () => {
    // Phần bổ sung chi tiết, rủi ro thấp. Bắt duyệt lại chỉ làm nghẽn hàng đợi
    // của admin mà không chặn thêm được tin xấu nào.
    await guiSuaTin(
      tinHopLe({
        benefits: ['Thưởng cuối tháng', 'Bao ăn ca'],
        requirements: ['Chăm chỉ'],
        skillIds: [],
      }),
    )
    expect(statusDaGhi()).toBeUndefined()
  })

  it('đảo THỨ TỰ ca làm không tính là đổi', async () => {
    // So sánh theo tập hợp, không theo thứ tự. Thiếu bước này thì kéo thả lại
    // lưới ca làm mà không đổi gì cũng đẩy tin về hàng đợi duyệt.
    await guiSuaTin(
      tinHopLe({
        shifts: [
          { dayOfWeek: 4, slot: 'EVENING' },
          { dayOfWeek: 2, slot: 'EVENING' },
        ],
      }),
      { shifts: [
        { dayOfWeek: 2, slot: 'EVENING' },
        { dayOfWeek: 4, slot: 'EVENING' },
      ] },
    )
    expect(statusDaGhi()).toBeUndefined()
  })

  it('tin DRAFT đổi lương vẫn ở DRAFT — không có gì để duyệt lại', async () => {
    await guiSuaTin(tinHopLe({ salaryMin: 99000, salaryMax: 99000 }), { status: 'DRAFT' })
    expect(statusDaGhi()).toBeUndefined()
  })

  it('giữ nguyên rejectionReason khi sửa — xoá ở bước gửi duyệt mới đúng lúc', async () => {
    // NTD đang sửa dở theo lý do bị từ chối; xoá ngay lúc lưu là lấy mất tờ ghi
    // chú khỏi tay họ giữa chừng.
    await guiSuaTin(tinHopLe(), { status: 'DRAFT', rejectionReason: 'Ảnh mờ' })

    const data = jobUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(data).not.toHaveProperty('rejectionReason')
  })
})

/* ------------------------------------------------------------------ T71 -- */

/** Gửi request xoá tin, với trạng thái tin cũ cho trước. */
function guiXoaTin(status: string, ghiDe: Record<string, unknown> = {}, token = ntdToken) {
  jobFindUnique.mockResolvedValue({
    ...HANG_JOB,
    employerProfileId: 'ep-1',
    status,
    ...ghiDe,
  })
  jobDelete.mockResolvedValue({ id: 'job-1' })

  return request(createApp())
    .delete('/api/ntd/tin-tuyen-dung/job-1')
    .set('Authorization', `Bearer ${token}`)
}

describe('DELETE /api/ntd/tin-tuyen-dung/:id — xoá tin', () => {
  it('xoá được tin DRAFT', async () => {
    const res = await guiXoaTin('DRAFT')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ id: 'job-1' })
    expect(jobDelete).toHaveBeenCalledWith({ where: { id: 'job-1' } })
  })

  it('xoá được tin PENDING — chưa từng công khai nên chưa thể có đơn nào', async () => {
    // Bắt NTD rút về DRAFT rồi mới cho xoá là thêm một bước mà không bảo vệ được
    // gì. Đúng nguyên tắc dùng xuyên suốt: chỉ cấm cái mâu thuẫn.
    const res = await guiXoaTin('PENDING')

    expect(res.status).toBe(200)
    expect(jobDelete).toHaveBeenCalled()
  })

  it('KHÔNG xoá được tin OPEN — đơn ứng tuyển sẽ bị cascade theo', async () => {
    /*
     * `Application.job` khai `onDelete: Cascade`. Xoá tin OPEN là xoá theo mọi
     * đơn của tin đó — sinh viên đang chờ kết quả mất sạch đơn khỏi danh sách,
     * không phải "bị từ chối" mà là biến mất không dấu vết. BRD Module 3 cấm
     * đúng điều này: "tin bị gỡ sau khi đã ứng tuyển → đơn giữ nguyên".
     */
    const res = await guiXoaTin('OPEN')

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('đóng tin')
    expect(jobDelete).not.toHaveBeenCalled()
  })

  it('KHÔNG xoá được tin CLOSED — mất luôn lịch sử đơn của đợt tuyển đã xong', async () => {
    const res = await guiXoaTin('CLOSED')

    expect(res.status).toBe(409)
    expect(jobDelete).not.toHaveBeenCalled()
  })

  it('xoá tin của NTD khác thì 403', async () => {
    const res = await guiXoaTin('DRAFT', { employerProfileId: 'ep-KHAC' })

    expect(res.status).toBe(403)
    expect(jobDelete).not.toHaveBeenCalled()
  })

  it('sinh viên không xoá được', async () => {
    const res = await guiXoaTin('DRAFT', {}, svToken)

    expect(res.status).toBe(403)
    expect(jobDelete).not.toHaveBeenCalled()
  })
})

describe('POST /api/ntd/tin-tuyen-dung/:id/dong — đóng tin', () => {
  function guiDongTin(status: string, ghiDe: Record<string, unknown> = {}, token = ntdToken) {
    jobFindUnique.mockResolvedValue({
      ...HANG_JOB,
      employerProfileId: 'ep-1',
      status,
      ...ghiDe,
    })
    jobUpdate.mockResolvedValue({ ...HANG_JOB, status: 'CLOSED', closedAt: new Date() })

    return request(createApp())
      .post('/api/ntd/tin-tuyen-dung/job-1/dong')
      .set('Authorization', `Bearer ${token}`)
  }

  it('đóng được tin OPEN, đặt luôn closedAt', async () => {
    // Đây là đường ĐÚNG để gỡ một tin đã duyệt xuống — thay cho việc xoá. Tin
    // rời trang công khai (T79 chỉ lọc OPEN) nhưng bản ghi và đơn vẫn nguyên.
    const res = await guiDongTin('OPEN')

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('CLOSED')
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CLOSED', closedAt: expect.any(Date) },
      }),
    )
  })

  it('tin đã CLOSED thì báo rõ là đã đóng rồi', async () => {
    const res = await guiDongTin('CLOSED')

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('đã đóng rồi')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('tin DRAFT/PENDING không có gì để đóng — hướng sang xoá hẳn', async () => {
    for (const status of ['DRAFT', 'PENDING'] as const) {
      vi.clearAllMocks()
      ntdFindUnique.mockResolvedValue({ id: 'ep-1', verifiedAt: new Date() })

      const res = await guiDongTin(status)
      expect(res.status).toBe(409)
      expect(res.body.error.message).toContain('xoá hẳn')
    }
  })

  it('đóng tin của NTD khác thì 403', async () => {
    const res = await guiDongTin('OPEN', { employerProfileId: 'ep-KHAC' })
    expect(res.status).toBe(403)
  })
})

/*
 * Đua giữa "NTD xoá tin" và "một request khác đang thao tác trên đúng tin đó".
 *
 * Mọi endpoint sửa/xoá đều có hình dạng "đọc kiểm tồn tại → rồi ghi", và giữa
 * hai câu truy vấn đó có một khe: request khác kịp xoá đúng hàng ấy. Prisma khi
 * đó ném P2025.
 *
 * Không bắt thì P2025 rơi xuống nhánh cuối của error-handler thành 500 — báo
 * "máy chủ hỏng" trong khi chuyện thật chỉ là dữ liệu vừa bị xoá. Lưới an toàn
 * nằm ở `middlewares/error-handler.ts`, nên MỌI endpoint cùng hình dạng đều
 * được bảo vệ, kể cả endpoint duyệt tin của admin sẽ viết ở T78.
 */
describe('đua: tin biến mất giữa lúc đang thao tác', () => {
  /** Đúng lỗi Prisma ném ra khi update/delete một hàng không còn tồn tại. */
  function loiHangDaBienMat() {
    return new Prisma.PrismaClientKnownRequestError('Record to update not found', {
      code: 'P2025',
      clientVersion: '6.19.3',
    })
  }

  it('SỬA tin vừa bị xoá mất → 404 rõ ràng, không phải 500', async () => {
    jobFindUnique.mockResolvedValue({ ...HANG_JOB, employerProfileId: 'ep-1', status: 'DRAFT' })
    jobUpdate.mockRejectedValue(loiHangDaBienMat())

    const res = await request(createApp())
      .put('/api/ntd/tin-tuyen-dung/job-1')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send(tinHopLe())

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('ĐÓNG tin vừa bị xoá mất → 404 rõ ràng', async () => {
    jobFindUnique.mockResolvedValue({ ...HANG_JOB, employerProfileId: 'ep-1', status: 'OPEN' })
    jobUpdate.mockRejectedValue(loiHangDaBienMat())

    const res = await request(createApp())
      .post('/api/ntd/tin-tuyen-dung/job-1/dong')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(404)
  })

  it('XOÁ một tin đã bị xoá trước đó → 404 rõ ràng', async () => {
    jobFindUnique.mockResolvedValue({ ...HANG_JOB, employerProfileId: 'ep-1', status: 'DRAFT' })
    jobDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record to delete does not exist', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
    )

    const res = await request(createApp())
      .delete('/api/ntd/tin-tuyen-dung/job-1')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(404)
  })
})

/* ------------------------------------------------------------------ T72 -- */

describe('POST /api/ntd/tin-tuyen-dung/:id/gui-duyet — gửi tin đi duyệt', () => {
  function guiDuyet(
    tinCu: Record<string, unknown> = {},
    hoSo: Record<string, unknown> = {},
    token = ntdToken,
  ) {
    ntdFindUnique.mockResolvedValue({
      id: 'ep-1',
      verifiedAt: new Date('2026-08-01'),
      ...hoSo,
    })
    jobFindUnique.mockResolvedValue({
      ...HANG_JOB,
      employerProfileId: 'ep-1',
      status: 'DRAFT',
      deadline: new Date(Date.now() + 30 * 864e5),
      ...tinCu,
    })
    jobUpdate.mockResolvedValue({ ...HANG_JOB, status: 'PENDING', rejectionReason: null })

    return request(createApp())
      .post('/api/ntd/tin-tuyen-dung/job-1/gui-duyet')
      .set('Authorization', `Bearer ${token}`)
  }

  it('DRAFT → PENDING khi NTD đã được xác minh', async () => {
    const res = await guiDuyet()

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('PENDING')
  })

  it('NTD CHƯA xác minh thì 403 — đây là chỗ verifiedAt thực sự có hiệu lực', async () => {
    /*
     * BRD chốt: "lưu nháp được, gửi duyệt thì 403". Soạn thảo thì mở, nhưng đưa
     * tin vào hàng đợi để lên trang công khai thì phải chứng minh được mình là
     * đơn vị tuyển dụng có thật.
     */
    const res = await guiDuyet({}, { verifiedAt: null })

    expect(res.status).toBe(403)
    expect(res.body.error.message).toContain('chưa được xác minh')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('xoá rejectionReason khi gửi lại — nhưng chỉ ở BƯỚC NÀY', async () => {
    // Trong lúc sửa, NTD vẫn cần đọc lý do để biết phải sửa gì (xem T70). Tới
    // khi họ chủ động gửi lại thì lý do cũ mới hết vai trò — giữ lại chỉ khiến
    // màn hình hiện "đã bị từ chối" cho một tin đang chờ duyệt.
    await guiDuyet({ rejectionReason: 'Mô tả có dấu hiệu thu phí trước' })

    const data = jobUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(data).toMatchObject({ status: 'PENDING', rejectionReason: null })
  })

  it('HẠN NHẬN HỒ SƠ đã qua thì chặn, dù Zod đã kiểm lúc tạo', async () => {
    /*
     * Không thừa: Zod kiểm `deadline` tại thời điểm TẠO/SỬA, còn gửi duyệt là
     * hành động riêng không mang thân request nào để mà kiểm. Một tin nháp soạn
     * hai tháng trước với hạn "30 ngày nữa" thì hôm nay hạn đã qua — gửi đi,
     * admin duyệt, và tin lên trang công khai với hạn nộp nằm ở quá khứ.
     */
    const res = await guiDuyet({ deadline: new Date(Date.now() - 864e5) })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('Hạn nhận hồ sơ')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('tin đang PENDING thì báo rõ là đã gửi rồi', async () => {
    const res = await guiDuyet({ status: 'PENDING' })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('đang chờ duyệt rồi')
  })

  it('tin đang OPEN thì báo rõ là đã duyệt rồi', async () => {
    const res = await guiDuyet({ status: 'OPEN' })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('đang hiển thị công khai')
  })

  it('tin CLOSED thì hướng sang đăng tin mới', async () => {
    const res = await guiDuyet({ status: 'CLOSED' })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('đăng một tin mới')
  })

  it('gửi duyệt tin của NTD khác thì 403', async () => {
    const res = await guiDuyet({ employerProfileId: 'ep-KHAC' })

    expect(res.status).toBe(403)
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('sinh viên không gửi duyệt được', async () => {
    const res = await guiDuyet({}, {}, svToken)

    expect(res.status).toBe(403)
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('gửi duyệt một tin vừa bị xoá mất → 404, không phải 500', async () => {
    ntdFindUnique.mockResolvedValue({ id: 'ep-1', verifiedAt: new Date() })
    jobFindUnique.mockResolvedValue({
      ...HANG_JOB,
      employerProfileId: 'ep-1',
      status: 'DRAFT',
      deadline: new Date(Date.now() + 864e5),
    })
    jobUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
    )

    const res = await request(createApp())
      .post('/api/ntd/tin-tuyen-dung/job-1/gui-duyet')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(404)
  })
})

/* ------------------------------------------------------------- T77–T78 -- */

const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN' })

/** Hàng Prisma cho nhánh admin: `CHON_JOB` cộng thông tin doanh nghiệp. */
const HANG_JOB_ADMIN = {
  ...HANG_JOB,
  employerProfile: {
    id: 'ep-1',
    companyName: 'Chuỗi cà phê Sương Mai',
    verifiedAt: new Date('2026-08-05'),
  },
}

describe('GET /api/admin/tin-tuyen-dung — hàng đợi duyệt', () => {
  it('mặc định chỉ lấy tin PENDING, sắp xếp tin chờ lâu nhất lên đầu', async () => {
    jobFindMany.mockResolvedValue([HANG_JOB_ADMIN])

    const res = await request(createApp())
      .get('/api/admin/tin-tuyen-dung')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        /*
         * TĂNG dần, khác mọi danh sách khác trong dự án. Đây là hàng đợi công
         * việc: tin chờ lâu nhất phải nổi lên đầu, nếu không thì tin gửi sớm bị
         * đẩy xuống mãi mỗi khi có tin mới — đúng kiểu để một nhà tuyển dụng
         * chờ vô hạn mà không ai nhận ra.
         */
        orderBy: { updatedAt: 'asc' },
      }),
    )
  })

  it('trả kèm thông tin doanh nghiệp để admin biết tin của ai', async () => {
    jobFindMany.mockResolvedValue([HANG_JOB_ADMIN])

    const res = await request(createApp())
      .get('/api/admin/tin-tuyen-dung')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.body.data.jobs[0].employer).toEqual({
      id: 'ep-1',
      companyName: 'Chuỗi cà phê Sương Mai',
      verifiedAt: '2026-08-05T00:00:00.000Z',
    })
    // Có đủ mô tả để phán đoán — nơi tin lừa đảo thật sự nằm.
    expect(res.body.data.jobs[0].description).toBeTruthy()
  })

  it('lọc được theo trạng thái khác', async () => {
    jobFindMany.mockResolvedValue([])

    await request(createApp())
      .get('/api/admin/tin-tuyen-dung?status=OPEN')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(jobFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'OPEN' } }))
  })

  it('trạng thái không có thật thì 400', async () => {
    const res = await request(createApp())
      .get('/api/admin/tin-tuyen-dung?status=KHONG_CO')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(jobFindMany).not.toHaveBeenCalled()
  })

  it('NTD không xem được hàng đợi duyệt', async () => {
    const res = await request(createApp())
      .get('/api/admin/tin-tuyen-dung')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(403)
    expect(jobFindMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/tin-tuyen-dung/:id/duyet', () => {
  function guiDuyetAdmin(body: object, tinCu: Record<string, unknown> = {}, token = adminToken) {
    jobFindUnique.mockResolvedValue({ status: 'PENDING', publishedAt: null, ...tinCu })
    jobUpdate.mockResolvedValue({ ...HANG_JOB_ADMIN, status: 'OPEN' })

    return request(createApp())
      .put('/api/admin/tin-tuyen-dung/job-1/duyet')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
  }

  it('duyệt: PENDING sang OPEN, đặt publishedAt', async () => {
    const res = await guiDuyetAdmin({ decision: 'APPROVE' })

    expect(res.status).toBe(200)
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'OPEN', publishedAt: expect.any(Date), rejectionReason: null },
      }),
    )
  })

  it('duyệt lại tin từng công khai thì GIỮ NGUYÊN publishedAt cũ', async () => {
    /*
     * `publishedAt` là "tin này lên sàn từ bao giờ", không phải "lần duyệt gần
     * nhất". Ghi đè mỗi lần duyệt sẽ khiến một tin đăng ba tháng trước trông
     * như vừa mới đăng, và người tìm việc mất cách phân biệt tin cũ với tin mới.
     */
    const mocCu = new Date('2026-07-01')
    await guiDuyetAdmin({ decision: 'APPROVE' }, { publishedAt: mocCu })

    const data = jobUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(data.publishedAt).toEqual(mocCu)
  })

  it('từ chối: PENDING sang DRAFT kèm lý do', async () => {
    // Về tay nhà tuyển dụng để sửa, không phải vứt vào một trạng thái chết.
    await guiDuyetAdmin({
      decision: 'REJECT',
      rejectionReason: 'Mô tả có dấu hiệu thu phí trước khi nhận việc',
    })

    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'DRAFT',
          rejectionReason: 'Mô tả có dấu hiệu thu phí trước khi nhận việc',
        },
      }),
    )
  })

  it('từ chối KHÔNG có lý do thì 400', async () => {
    const res = await guiDuyetAdmin({ decision: 'REJECT' })

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('rejectionReason')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('duyệt thì xoá lý do từ chối cũ', async () => {
    // Không để một tin đang OPEN vẫn đeo dòng "đã bị từ chối" từ vòng trước.
    await guiDuyetAdmin({ decision: 'APPROVE' }, { rejectionReason: 'Lý do cũ' })

    const data = jobUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(data.rejectionReason).toBeNull()
  })

  it('tin DRAFT chưa gửi thì không duyệt được', async () => {
    const res = await guiDuyetAdmin({ decision: 'APPROVE' }, { status: 'DRAFT' })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('chưa được gửi')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('tin OPEN thì không duyệt lại được', async () => {
    // Duyệt lại chỉ dời publishedAt và đẩy tin lên đầu danh sách công khai mà
    // không có lý do gì.
    const res = await guiDuyetAdmin({ decision: 'APPROVE' }, { status: 'OPEN' })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('đã được duyệt rồi')
  })

  it('tin CLOSED thì không duyệt được', async () => {
    const res = await guiDuyetAdmin({ decision: 'APPROVE' }, { status: 'CLOSED' })
    expect(res.status).toBe(409)
  })

  it('NTD không tự duyệt tin của mình được', async () => {
    const res = await guiDuyetAdmin({ decision: 'APPROVE' }, {}, ntdToken)

    expect(res.status).toBe(403)
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('sinh viên càng không duyệt được', async () => {
    const res = await guiDuyetAdmin({ decision: 'APPROVE' }, {}, svToken)
    expect(res.status).toBe(403)
  })
})

/*
 * ĐÚNG CA ĐUA ĐÃ ĐẶT RA Ở T71: nhà tuyển dụng xoá tin PENDING đúng lúc admin
 * đang duyệt nó. Cho xoá PENDING là quyết định có chủ đích (tin chưa từng công
 * khai nên chưa thể có đơn), nên tình huống này CHẮC CHẮN xảy ra — chỉ là hiếm.
 */
describe('đua: NTD xoá tin PENDING đúng lúc admin duyệt', () => {
  it('tin biến mất TRƯỚC khi admin đọc thì 404, không phải 500', async () => {
    jobFindUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .put('/api/admin/tin-tuyen-dung/job-1/duyet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('tin biến mất GIỮA lúc đọc và ghi thì vẫn 404 nhờ lưới an toàn P2025', async () => {
    /*
     * Khe hẹp nhất: admin đọc thấy tin PENDING, nhưng NTD xoá xong trước khi
     * lệnh update chạy. Không có nhánh Prisma trong error-handler thì đây là
     * một 500 — admin thấy "máy chủ hỏng" cho một chuyện hoàn toàn bình thường.
     */
    jobFindUnique.mockResolvedValue({ status: 'PENDING', publishedAt: null })
    jobUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
    )

    const res = await request(createApp())
      .put('/api/admin/tin-tuyen-dung/job-1/duyet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

/* ------------------------------------------------- T79–T80: công khai --- */

/** Hàng Prisma cho nhánh công khai — `CHON_JOB_PUBLIC`, không có status. */
const HANG_JOB_PUBLIC = {
  id: 'job-1',
  title: MAU.title,
  description: MAU.description,
  requirements: MAU.requirements,
  benefits: MAU.benefits,
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
  publishedAt: new Date('2026-08-10'),
  viewCount: 41,
  shifts: [{ dayOfWeek: 2, slot: 'EVENING' as const }],
  skills: [{ skill: { id: 'sk-1', name: 'Pha chế', slug: 'pha-che' } }],
  employerProfile: {
    companyName: 'Chuỗi cà phê Sương Mai',
    verifiedAt: new Date('2026-08-05'),
    address: '12 Nguyễn Thị Minh Khai, Quận 1',
    website: 'https://suongmai.example.com',
  },
}

describe('GET /api/viec-lam — danh sách công khai', () => {
  beforeEach(() => {
    transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  it('KHÔNG cần đăng nhập', async () => {
    // Người chưa đăng nhập phải xem được việc làm, nếu không thì trang chủ chẳng
    // có gì để xem và cũng không ai có lý do đăng ký.
    jobFindMany.mockResolvedValue([HANG_JOB_PUBLIC])
    jobCount.mockResolvedValue(1)

    const res = await request(createApp()).get('/api/viec-lam')

    expect(res.status).toBe(200)
    expect(res.body.data.jobs).toHaveLength(1)
  })

  it('CHỈ trả tin OPEN — đây là toàn bộ lớp bảo vệ của endpoint này', async () => {
    /*
     * Endpoint không đòi đăng nhập, nên điều kiện `status: 'OPEN'` không phải
     * một bộ lọc tiện tay: nó là thứ DUY NHẤT ngăn tin nháp và tin đang chờ
     * duyệt của mọi nhà tuyển dụng lọt ra ngoài.
     */
    jobFindMany.mockResolvedValue([])
    jobCount.mockResolvedValue(0)

    await request(createApp()).get('/api/viec-lam')

    const where = jobFindMany.mock.calls[0][0].where as Record<string, unknown>
    expect(where.status).toBe('OPEN')
  })

  it('người gọi KHÔNG ép được status khác qua query', async () => {
    // Nếu `status` lọt từ query vào `where`, mọi tin nháp của mọi NTD ra ngoài.
    jobFindMany.mockResolvedValue([])
    jobCount.mockResolvedValue(0)

    await request(createApp()).get('/api/viec-lam?status=DRAFT')

    const where = jobFindMany.mock.calls[0][0].where as Record<string, unknown>
    expect(where.status).toBe('OPEN')
  })

  it('KHÔNG lộ trường nội bộ: status, rejectionReason, closedAt', async () => {
    jobFindMany.mockResolvedValue([HANG_JOB_PUBLIC])
    jobCount.mockResolvedValue(1)

    const res = await request(createApp()).get('/api/viec-lam')
    const job = res.body.data.jobs[0]

    expect(job).not.toHaveProperty('status')
    expect(job).not.toHaveProperty('rejectionReason')
    expect(job).not.toHaveProperty('closedAt')
    expect(job).not.toHaveProperty('updatedAt')
  })

  it('xác minh doanh nghiệp trả về boolean, không phải mốc thời gian', async () => {
    jobFindMany.mockResolvedValue([HANG_JOB_PUBLIC])
    jobCount.mockResolvedValue(1)

    const res = await request(createApp()).get('/api/viec-lam')

    expect(res.body.data.jobs[0].employer).toEqual({
      companyName: 'Chuỗi cà phê Sương Mai',
      verified: true,
    })
  })

  it('lọc theo khu vực và loại thời gian', async () => {
    jobFindMany.mockResolvedValue([])
    jobCount.mockResolvedValue(0)

    await request(createApp()).get('/api/viec-lam?city=TP.HCM&district=Quận 1&scheduleType=SEASONAL')

    expect(jobFindMany.mock.calls[0][0].where).toEqual({
      status: 'OPEN',
      city: 'TP.HCM',
      district: 'Quận 1',
      scheduleType: 'SEASONAL',
    })
  })

  it('ô lọc để trống KHÔNG thành điều kiện "bằng chuỗi rỗng"', async () => {
    // Form gửi `?city=` khi người dùng chưa chọn gì. Không xử lý thì đó thành
    // điều kiện "tỉnh/thành đúng bằng chuỗi rỗng" và trả danh sách trống không
    // ai giải thích được.
    jobFindMany.mockResolvedValue([])
    jobCount.mockResolvedValue(0)

    await request(createApp()).get('/api/viec-lam?city=&district=')

    expect(jobFindMany.mock.calls[0][0].where).toEqual({ status: 'OPEN' })
  })

  it('chặn cứng 100 hàng, nhưng total vẫn là số thật', async () => {
    // Không phải phân trang — chỉ là chặn để endpoint không bao giờ dump cả
    // bảng. `total` cho giao diện biết mình đang xem một phần hay toàn bộ.
    jobFindMany.mockResolvedValue([HANG_JOB_PUBLIC])
    jobCount.mockResolvedValue(357)

    const res = await request(createApp()).get('/api/viec-lam')

    expect(jobFindMany.mock.calls[0][0].take).toBe(100)
    expect(res.body.data.total).toBe(357)
  })

  it('sắp xếp tin mới đăng lên đầu', async () => {
    jobFindMany.mockResolvedValue([])
    jobCount.mockResolvedValue(0)

    await request(createApp()).get('/api/viec-lam')

    expect(jobFindMany.mock.calls[0][0].orderBy).toEqual({ publishedAt: 'desc' })
  })

  it('scheduleType không có thật thì 400', async () => {
    const res = await request(createApp()).get('/api/viec-lam?scheduleType=KHONG_CO')

    expect(res.status).toBe(400)
    expect(jobFindMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/viec-lam/:id — chi tiết công khai', () => {
  it('xem được tin OPEN, và tăng lượt xem', async () => {
    jobFindFirst.mockResolvedValue(HANG_JOB_PUBLIC)
    jobUpdate.mockResolvedValue({})

    const res = await request(createApp()).get('/api/viec-lam/job-1')

    expect(res.status).toBe(200)
    expect(res.body.data.description).toBeTruthy()
    // Trả về con số ĐÃ cộng, đúng bằng thứ vừa ghi xuống database.
    expect(res.body.data.viewCount).toBe(42)
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { viewCount: { increment: 1 } },
    })
  })

  it('điều kiện OPEN nằm ngay trong câu truy vấn, không kiểm sau', async () => {
    /*
     * `findFirst({ id, status: 'OPEN' })` thay vì `findUnique(id)` rồi kiểm
     * trạng thái: không có nhánh nào lỡ tay trả về dữ liệu của tin chưa duyệt,
     * kể cả khi ai đó thêm code vào giữa.
     */
    jobFindFirst.mockResolvedValue(HANG_JOB_PUBLIC)
    jobUpdate.mockResolvedValue({})

    await request(createApp()).get('/api/viec-lam/job-1')

    expect(jobFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', status: 'OPEN' } }),
    )
  })

  it('tin chưa duyệt trả NOT_FOUND, không phải FORBIDDEN', async () => {
    // Với người ngoài, một tin chưa công khai thì đúng nghĩa là không tồn tại.
    // Trả 403 sẽ xác nhận "có tin ở id này" cho bất kỳ ai dò.
    jobFindFirst.mockResolvedValue(null)

    const res = await request(createApp()).get('/api/viec-lam/tin-nhap-cua-nguoi-khac')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('KHÔNG lộ trường nội bộ ở trang chi tiết', async () => {
    jobFindFirst.mockResolvedValue(HANG_JOB_PUBLIC)
    jobUpdate.mockResolvedValue({})

    const res = await request(createApp()).get('/api/viec-lam/job-1')

    expect(res.body.data).not.toHaveProperty('status')
    expect(res.body.data).not.toHaveProperty('rejectionReason')
    expect(res.body.data).not.toHaveProperty('closedAt')
  })
})
