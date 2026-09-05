import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { sendMail } from '../../lib/mailer.js'
import { signAccessToken } from '../../lib/token.js'
import { resetRateLimits } from '../../middlewares/rate-limit.js'

/*
 * Mock phải phủ ĐỦ mọi bảng mà nghiệp vụ chạm tới.
 *
 * Thiếu `notification` hay `user` ở đây từng được "chữa" bằng cách thêm nhánh
 * thoát vào mã production — mã thật nhận trách nhiệm chiều mock. Đổi lại là một
 * cấu hình hỏng sẽ nuốt im lặng mọi thông báo. Mock thiếu thì sửa mock.
 */
vi.mock('../../lib/mailer.js', () => ({
  sendMail: vi.fn(),
  applicationNotificationEmail: (subject: string, body: string) => ({ subject, html: body }),
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    job: { findUnique: vi.fn() },
    application: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    applicationEvent: { create: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const svFindUnique = prisma.studentProfile.findUnique as unknown as Mock
const jobFindUnique = prisma.job.findUnique as unknown as Mock
const donCreate = prisma.application.create as unknown as Mock
const donFindFirst = prisma.application.findFirst as unknown as Mock
const donFindMany = prisma.application.findMany as unknown as Mock
const donUpdate = prisma.application.update as unknown as Mock
const mocCreate = prisma.applicationEvent.create as unknown as Mock
const thongBaoCreate = prisma.notification.create as unknown as Mock
const userFindUnique = prisma.user.findUnique as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock
const guiMail = sendMail as unknown as Mock

const svToken = signAccessToken({ sub: 'u-sv', role: 'STUDENT' })
const ntdToken = signAccessToken({ sub: 'u-ntd', role: 'EMPLOYER' })
const ntdKhacToken = signAccessToken({ sub: 'u-ntd-khac', role: 'EMPLOYER' })

const app = createApp()

const T2_SANG = { dayOfWeek: 1, slot: 'MORNING' as const }
const T3_TOI = { dayOfWeek: 2, slot: 'EVENING' as const }
const T5_TOI = { dayOfWeek: 4, slot: 'EVENING' as const }

/** Hồ sơ sinh viên đủ điều kiện nộp. Mọi ca test sửa từ đây ra. */
function hoSoSinhVien(ghiDe: Record<string, unknown> = {}) {
  return {
    id: 'sp-1',
    cvUrl: 'https://cdn/cv-cu.pdf',
    availableUntil: new Date('2027-06-01'),
    availabilities: [T2_SANG, T3_TOI],
    skills: [{ skillId: 'sk-giao-tiep' }],
    user: { emailVerifiedAt: new Date('2026-08-01') },
    ...ghiDe,
  }
}

/** Tin đang nhận hồ sơ. */
function tinMo(ghiDe: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    title: 'Phục vụ quán cà phê',
    status: 'OPEN',
    deadline: null,
    startDate: new Date('2026-09-01'),
    minShiftsPerWeek: 2,
    commitmentMonths: 6,
    shifts: [T2_SANG, T3_TOI, T5_TOI],
    skills: [{ skillId: 'sk-giao-tiep' }, { skillId: 'sk-pha-che' }],
    // `user.email` BẮT BUỘC có: thiếu nó thì nhánh gửi email không bao giờ chạy,
    // và ca test "email hỏng vẫn xong" sẽ xanh vì lý do sai — đã dẫm một lần,
    // chỉ lộ ra khi cố tình gỡ try/catch mà không ca nào đỏ.
    employerProfile: { userId: 'u-ntd', user: { email: 'ntd@uniwork.dev' } },
    ...ghiDe,
  }
}

/** Hàng `Application` như Prisma trả về. */
function hangDon(ghiDe: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    status: 'PENDING',
    coverLetter: null,
    cvUrl: 'https://cdn/cv-cu.pdf',
    matchScore: 60,
    matchBreakdown: { shifts: { matched: 2, total: 3, required: 2 }, eligible: true },
    matchAlgoVersion: 'v1',
    createdAt: new Date('2026-08-20T10:00:00Z'),
    statusChangedAt: null,
    ...ghiDe,
  }
}

function hoSoUngVien(ghiDe: Record<string, unknown> = {}) {
  return {
    id: 'sp-1',
    fullName: 'Nguyễn Minh Anh',
    university: 'ĐH Kinh tế TP.HCM',
    major: 'Marketing',
    year: 2,
    skills: [{ skill: { name: 'Giao tiếp' } }],
    ...ghiDe,
  }
}

/**
 * `$transaction` nhận CẢ HAI dạng trong module này: dạng callback (nộp đơn, đổi
 * trạng thái) và dạng mảng (đọc danh sách ứng viên). Mock phải phục vụ cả hai,
 * nếu không ca test đầu tiên dùng dạng còn lại sẽ hỏng một cách khó hiểu.
 */
function moDauTransaction() {
  transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as Promise<unknown>[]),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimits()
  moDauTransaction()
  mocCreate.mockResolvedValue({
    status: 'PENDING',
    note: null,
    createdAt: new Date('2026-08-20T10:00:00Z'),
  })
  thongBaoCreate.mockResolvedValue({
    id: 'tb-1',
    type: 'APPLICATION_SUBMITTED',
    title: 'Có ứng viên mới',
    body: '…',
    link: null,
    readAt: null,
    createdAt: new Date('2026-08-20T10:00:00Z'),
  })
  userFindUnique.mockResolvedValue({ email: 'sv@uniwork.dev' })
  guiMail.mockResolvedValue(undefined)
})

/* ==================================================================== */
/* Tính năng 1 — nộp đơn                                                 */
/* ==================================================================== */

describe('POST /api/toi/don-ung-tuyen', () => {
  it('nộp thành công: ghi điểm, breakdown và đời công thức', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo())
    donCreate.mockResolvedValue(hangDon())

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1', coverLetter: 'Em rất muốn làm ở quán mình.' })

    expect(res.status).toBe(201)
    expect(res.body.data.jobTitle).toBe('Phục vụ quán cà phê')

    const ghi = donCreate.mock.calls[0][0].data
    expect(ghi.matchAlgoVersion).toBe('v1')
    expect(ghi.matchScore).toEqual(expect.any(Number))
    // Ba thành phần + độ phủ, đóng băng ngay lúc nộp.
    expect(ghi.matchBreakdown).toMatchObject({
      shifts: { matched: 2, total: 3, required: 2 },
      skills: { matched: 1, total: 2 },
      coverage: { apDung: 3, doDuoc: 3 },
      eligible: true,
    })
  })

  it('ghi mốc PENDING trong CÙNG transaction với việc tạo đơn', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo())
    donCreate.mockResolvedValue(hangDon())

    await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(mocCreate).toHaveBeenCalledTimes(1)
    expect(mocCreate.mock.calls[0][0].data).toMatchObject({
      status: 'PENDING',
      actorUserId: 'u-sv',
    })
  })

  it('bỏ trống cvUrl thì lấy CV đang có trong hồ sơ', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo())
    donCreate.mockResolvedValue(hangDon())

    await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    expect(donCreate.mock.calls[0][0].data.cvUrl).toBe('https://cdn/cv-cu.pdf')
  })

  it('KHÔNG đủ điều kiện vẫn nộp được — chỉ cảnh báo, không chặn', async () => {
    // Tin cần tối thiểu 3 ca, sinh viên chỉ trùng 1.
    svFindUnique.mockResolvedValue(hoSoSinhVien({ availabilities: [T2_SANG] }))
    jobFindUnique.mockResolvedValue(tinMo({ minShiftsPerWeek: 3 }))
    donCreate.mockResolvedValue(hangDon())

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(201)
    // Nộp được, nhưng sự thật "không đủ ca" phải nằm trong dữ liệu đóng băng —
    // "có đơn" KHÔNG hàm ý "đủ điều kiện".
    expect(donCreate.mock.calls[0][0].data.matchBreakdown.eligible).toBe(false)
  })

  it('chưa xác thực email → 403 kèm câu CHỈ ĐƯỜNG', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien({ user: { emailVerifiedAt: null } }))

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(403)
    expect(res.body.error.message).toMatch(/xác thực email/i)
    // Không được chỉ nói "bị cấm" rồi bỏ mặc người dùng.
    expect(res.body.error.message).toMatch(/Hồ sơ/)
    expect(jobFindUnique).not.toHaveBeenCalled()
  })

  it('tin không tồn tại → 404', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'khong-co' })

    expect(res.status).toBe(404)
  })

  it('tin đã đóng → 409, KHÔNG phải 404 (tin có thật, chỉ là không nhận nữa)', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo({ status: 'CLOSED' }))

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(409)
    // Không lộ tin đang ở DRAFT/PENDING/CLOSED — quy trình nội bộ của NTD.
    expect(res.body.error.message).not.toMatch(/CLOSED|DRAFT|PENDING/)
  })

  it('quá hạn nộp → 409, nhưng CÒN NGUYÊN NGÀY hết hạn thì vẫn nộp được', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    donCreate.mockResolvedValue(hangDon())

    // Hạn là hôm nay: người ta hiểu "hạn 20/09" là hết ngày 20/09.
    jobFindUnique.mockResolvedValue(tinMo({ deadline: new Date() }))
    const conHan = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })
    expect(conHan.status).toBe(201)

    jobFindUnique.mockResolvedValue(
      tinMo({ deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }),
    )
    const hetHan = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })
    expect(hetHan.status).toBe(409)
    expect(hetHan.body.error.message).toMatch(/quá hạn/i)
  })

  it('nộp lần hai → 409, và chặn đến từ RÀNG BUỘC DATABASE', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo())
    donCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    // Không kiểm trước bằng findFirst rồi báo lỗi: hai request bấm cùng lúc đều
    // qua bước kiểm, chỉ `@@unique` chặn được.
    expect(res.status).toBe(409)
    expect(res.body.error.message).toMatch(/đã nộp đơn/i)
  })

  it('nhà tuyển dụng không nộp được đơn → 403 ở tầng route', async () => {
    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(403)
    expect(svFindUnique).not.toHaveBeenCalled()
  })

  it('khách chưa đăng nhập → 401', async () => {
    const res = await request(app).post('/api/toi/don-ung-tuyen').send({ jobId: 'job-1' })
    expect(res.status).toBe(401)
  })

  it('thiếu jobId → 400', async () => {
    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({})

    expect(res.status).toBe(400)
  })
})

/* ==================================================================== */
/* Tính năng 2 — NTD xem ứng viên + che liên hệ                           */
/* ==================================================================== */

describe('GET /api/ntd/tin-tuyen-dung/:id/ung-vien', () => {
  function mocKetQua(kin: unknown[], mo: unknown[], demStatus: string[]) {
    donFindMany
      .mockResolvedValueOnce(kin)
      .mockResolvedValueOnce(mo)
      .mockResolvedValueOnce(demStatus.map((status) => ({ status })))
  }

  it('đơn ở PENDING → response KHÔNG chứa phone và email', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    mocKetQua([{ ...hangDon(), studentProfile: hoSoUngVien() }], [], ['PENDING'])

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.applicants[0].contact).toBeNull()
    // Kiểm trên CHUỖI JSON thô, không kiểm trên object: đây là thứ thật sự đi
    // qua dây, và là thứ mở DevTools sẽ thấy.
    expect(JSON.stringify(res.body)).not.toMatch(/0\d{9}|@/)
  })

  it('đơn ở SHORTLISTED → có liên hệ, và nó đến từ CÂU TRUY VẤN KHÁC', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    mocKetQua(
      [],
      [
        {
          ...hangDon({ status: 'SHORTLISTED' }),
          studentProfile: {
            ...hoSoUngVien(),
            phone: '0901234567',
            user: { email: 'sv@uniwork.dev' },
          },
        },
      ],
      ['SHORTLISTED'],
    )

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.body.data.applicants[0].contact).toEqual({
      phone: '0901234567',
      email: 'sv@uniwork.dev',
    })

    // Câu truy vấn cho đơn CHƯA mở không được xin `phone` — dữ liệu phải không
    // rời khỏi database, chứ không phải rời rồi mới xoá trong JS.
    const selectKin = donFindMany.mock.calls[0][0].select.studentProfile.select
    expect(selectKin.phone).toBeUndefined()
    expect(selectKin.user).toBeUndefined()
  })

  it('đơn đã RÚT thì liên hệ đóng lại, dù từng ở SHORTLISTED', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    mocKetQua(
      [{ ...hangDon({ status: 'WITHDRAWN' }), studentProfile: hoSoUngVien() }],
      [],
      ['WITHDRAWN'],
    )

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.body.data.applicants[0].contact).toBeNull()
    // Vẫn hiện trong danh sách, không biến mất không dấu vết.
    expect(res.body.data.applicants).toHaveLength(1)
    expect(res.body.data.applicants[0].status).toBe('WITHDRAWN')
  })

  it('NTD khác gọi tin không phải của mình → 403, không phải 404, không phải mảng rỗng', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${ntdKhacToken}`)

    expect(res.status).toBe(403)
    expect(donFindMany).not.toHaveBeenCalled()
  })

  it('tin không tồn tại → 404 (khác hẳn tin của người khác)', async () => {
    jobFindUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/khong-co/ung-vien')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.status).toBe(404)
  })

  it('sinh viên không xem được danh sách ứng viên → 403', async () => {
    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${svToken}`)

    expect(res.status).toBe(403)
  })

  it('xếp eligible TRƯỚC, dù người không đủ điều kiện có điểm cao hơn', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    mocKetQua(
      [
        {
          ...hangDon({
            id: 'app-cao-nhung-thieu-ca',
            matchScore: 95,
            matchBreakdown: { eligible: false },
          }),
          studentProfile: hoSoUngVien(),
        },
        {
          ...hangDon({ id: 'app-du-dieu-kien', matchScore: 60, matchBreakdown: { eligible: true } }),
          studentProfile: hoSoUngVien(),
        },
      ],
      [],
      ['PENDING', 'PENDING'],
    )

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${ntdToken}`)

    // 95 điểm nhưng không nhận nổi ca thì vẫn đứng dưới — giỏi nghề không bù
    // được cho việc không có mặt lúc quán cần người.
    expect(res.body.data.applicants.map((a: { id: string }) => a.id)).toEqual([
      'app-du-dieu-kien',
      'app-cao-nhung-thieu-ca',
    ])
  })

  it('đếm theo trạng thái phủ đủ 6 giá trị, kể cả trạng thái không có đơn nào', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    mocKetQua([{ ...hangDon(), studentProfile: hoSoUngVien() }], [], [
      'PENDING',
      'PENDING',
      'REJECTED',
    ])

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien')
      .set('Authorization', `Bearer ${ntdToken}`)

    expect(res.body.data.demTheoTrangThai).toEqual({
      PENDING: 2,
      VIEWED: 0,
      SHORTLISTED: 0,
      ACCEPTED: 0,
      REJECTED: 1,
      WITHDRAWN: 0,
    })
  })

  it('lọc theo trạng thái KHÔNG làm đổi số trên tab', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    mocKetQua([], [], ['PENDING', 'REJECTED'])

    const res = await request(app)
      .get('/api/ntd/tin-tuyen-dung/job-1/ung-vien?status=SHORTLISTED')
      .set('Authorization', `Bearer ${ntdToken}`)

    // Câu đếm không mang mệnh đề lọc — bấm sang tab khác mà mọi tab kia tụt về 0
    // là lỗi người dùng nhìn thấy ngay.
    expect(donFindMany.mock.calls[2][0].where).toEqual({ jobId: 'job-1' })
    expect(res.body.data.demTheoTrangThai.PENDING).toBe(1)
  })
})

/* ==================================================================== */
/* Tính năng 3 — đổi trạng thái + lịch sử                                 */
/* ==================================================================== */

describe('PUT /api/ntd/tin-tuyen-dung/:id/ung-vien/:applicationId/trang-thai', () => {
  function tinCuaToi() {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
  }

  function doiTrangThai(body: Record<string, unknown>, token = ntdToken) {
    return request(app)
      .put('/api/ntd/tin-tuyen-dung/job-1/ung-vien/app-1/trang-thai')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
  }

  it('PENDING → SHORTLISTED: đổi trạng thái và ghi mốc trong CÙNG transaction', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'PENDING' })
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'SHORTLISTED' }),
      studentProfile: { ...hoSoUngVien(), phone: '0901234567', user: { email: 'sv@uniwork.dev' } },
    })
    mocCreate.mockResolvedValue({
      status: 'SHORTLISTED',
      note: null,
      createdAt: new Date('2026-08-21T09:00:00Z'),
    })

    const res = await doiTrangThai({ status: 'SHORTLISTED' })

    expect(res.status).toBe(200)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(mocCreate.mock.calls[0][0].data).toMatchObject({
      applicationId: 'app-1',
      status: 'SHORTLISTED',
      actorUserId: 'u-ntd',
    })
    // Liên hệ mở theo trạng thái MỚI — không bắt NTD tải lại trang mới thấy.
    expect(res.body.data.applicant.contact.phone).toBe('0901234567')
    expect(res.body.data.event.status).toBe('SHORTLISTED')
  })

  it('không LÙI được: REJECTED → PENDING là 409', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'REJECTED' })

    const res = await doiTrangThai({ status: 'PENDING' })

    expect(res.status).toBe(409)
    expect(donUpdate).not.toHaveBeenCalled()
    expect(mocCreate).not.toHaveBeenCalled()
  })

  it('SHORTLISTED → ACCEPTED bị CHẶN — ứng dụng dừng ở chỗ bàn giao liên hệ', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'SHORTLISTED' })

    const res = await doiTrangThai({ status: 'ACCEPTED' })

    // UniWork không phải ATS: việc tuyển thật xảy ra ngoài ứng dụng. Một cột
    // "đã nhận" chỉ đúng khi NTD nhớ quay lại bấm — đúng chừng một phần ba thì
    // tệ hơn không có.
    expect(res.status).toBe(409)
    expect(donUpdate).not.toHaveBeenCalled()
  })

  it('SHORTLISTED → REJECTED VẪN mở — để sinh viên biết kết quả sau buổi gặp', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'SHORTLISTED' })
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'REJECTED' }),
      studentProfile: hoSoUngVien(),
    })

    // Bất đối xứng có chủ đích: được nhận thì sinh viên tự biết (họ đi làm),
    // còn bị từ chối thì rất nhiều nơi im lặng luôn.
    const res = await doiTrangThai({ status: 'REJECTED', note: 'Bạn ấy nhận việc khác rồi' })
    expect(res.status).toBe(200)
  })

  it('trạng thái cuối không đổi được nữa: ACCEPTED → REJECTED là 409', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'ACCEPTED' })

    const res = await doiTrangThai({ status: 'REJECTED', note: 'Đổi ý' })

    expect(res.status).toBe(409)
    expect(res.body.error.message).toMatch(/trạng thái cuối/i)
  })

  it('bỏ qua VIEWED được: PENDING → SHORTLISTED thẳng', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'PENDING' })
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'SHORTLISTED' }),
      studentProfile: { ...hoSoUngVien(), phone: null, user: { email: 'sv@uniwork.dev' } },
    })

    expect((await doiTrangThai({ status: 'SHORTLISTED' })).status).toBe(200)
  })

  it('NTD KHÔNG rút đơn thay sinh viên được → 403', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'PENDING' })

    const res = await doiTrangThai({ status: 'WITHDRAWN' })

    expect(res.status).toBe(403)
    expect(res.body.error.message).toMatch(/sinh viên/i)
  })

  it('từ chối mà không có lý do → 400, chặn ở Zod', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'VIEWED' })

    const res = await doiTrangThai({ status: 'REJECTED' })

    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).toMatch(/lý do/i)
    expect(donUpdate).not.toHaveBeenCalled()
  })

  it('từ chối kèm lý do → 200, và lý do vào thẳng mốc lịch sử', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'VIEWED' })
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'REJECTED' }),
      studentProfile: hoSoUngVien(),
    })

    const res = await doiTrangThai({ status: 'REJECTED', note: 'Lịch rảnh chưa khớp ca tối' })

    expect(res.status).toBe(200)
    expect(mocCreate.mock.calls[0][0].data.note).toBe('Lịch rảnh chưa khớp ca tối')
    // Đơn bị từ chối thì liên hệ đóng lại.
    expect(res.body.data.applicant.contact).toBeNull()
  })

  it('đơn của tin NTD KHÁC → 403 ở bước kiểm tin', async () => {
    tinCuaToi()

    const res = await doiTrangThai({ status: 'VIEWED' }, ntdKhacToken)

    expect(res.status).toBe(403)
    expect(donFindFirst).not.toHaveBeenCalled()
  })

  it('applicationId không thuộc tin này → 404, và truy vấn có LỌC KÈM jobId', async () => {
    tinCuaToi()
    donFindFirst.mockResolvedValue(null)

    const res = await doiTrangThai({ status: 'VIEWED' })

    expect(res.status).toBe(404)
    // Không lọc kèm `jobId` thì NTD đổi được đơn của tin người khác chỉ bằng
    // cách ghép một applicationId đoán được vào jobId của mình.
    expect(donFindFirst.mock.calls[0][0].where).toEqual({ id: 'app-1', jobId: 'job-1' })
  })

  it('trạng thái không có trong enum → 400', async () => {
    tinCuaToi()

    expect((await doiTrangThai({ status: 'KHONG_CO_THAT' })).status).toBe(400)
  })
})

/* ==================================================================== */
/* Tính năng 4 — "Đơn của tôi"                                           */
/* ==================================================================== */

describe('GET/DELETE /api/toi/don-ung-tuyen', () => {
  function donCuaAi(userId: string, status = 'PENDING') {
    donFindFirst.mockResolvedValue({
      id: 'app-1',
      status,
      studentProfile: { userId },
      job: {
        id: 'job-1',
        title: 'Phục vụ quán cà phê',
        employerProfile: { userId: 'u-ntd', user: { email: 'ntd@uniwork.dev' } },
      },
    })
  }

  function rut() {
    return request(app)
      .delete('/api/toi/don-ung-tuyen/app-1')
      .set('Authorization', `Bearer ${svToken}`)
  }

  it('sinh viên A KHÔNG rút được đơn của sinh viên B → 403', async () => {
    donCuaAi('u-sv-khac')

    const res = await rut()

    expect(res.status).toBe(403)
    expect(donUpdate).not.toHaveBeenCalled()
  })

  it('rút đơn đã kết thúc → 409', async () => {
    for (const cuoi of ['ACCEPTED', 'REJECTED', 'WITHDRAWN']) {
      donCuaAi('u-sv', cuoi)
      expect((await rut()).status).toBe(409)
    }
    expect(donUpdate).not.toHaveBeenCalled()
  })

  it('rút đơn KHÔNG xoá hàng — chỉ đặt WITHDRAWN', async () => {
    donCuaAi('u-sv', 'SHORTLISTED')
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'WITHDRAWN' }),
      job: {
        id: 'job-1',
        title: 'Phục vụ quán cà phê',
        employerProfile: { companyName: 'Cà phê Sớm', verifiedAt: new Date() },
      },
      events: [],
    })

    const res = await rut()

    expect(res.status).toBe(200)
    expect(donUpdate.mock.calls[0][0].data.status).toBe('WITHDRAWN')
    // Xoá cứng thì NTD thấy một ứng viên biến mất không dấu vết, và ràng buộc
    // `@@unique` sẽ cho nộp lại — thành ra rút rồi nộp lại vòng vòng. Bằng chứng
    // hàng còn sống: mốc lịch sử ghi được, mà mốc thì trỏ khoá ngoại vào đơn.
    expect(mocCreate.mock.calls[0][0].data).toMatchObject({
      applicationId: 'app-1',
      status: 'WITHDRAWN',
      actorUserId: 'u-sv',
    })
  })

  it('rút từ SHORTLISTED → NTD nhận chuông VÀ email; rút từ PENDING chỉ chuông', async () => {
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'WITHDRAWN' }),
      job: {
        id: 'job-1',
        title: 'Phục vụ quán cà phê',
        employerProfile: { companyName: 'Cà phê Sớm', verifiedAt: null },
      },
      events: [],
    })

    donCuaAi('u-sv', 'PENDING')
    await rut()
    expect(thongBaoCreate).toHaveBeenCalledTimes(1)
    // NTD chưa bỏ công gì — email cho mọi lần rút thì hộp thư thành nơi không ai đọc.
    expect(guiMail).not.toHaveBeenCalled()

    vi.clearAllMocks()
    moDauTransaction()
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'WITHDRAWN' }),
      job: {
        id: 'job-1',
        title: 'Phục vụ quán cà phê',
        employerProfile: { companyName: 'Cà phê Sớm', verifiedAt: null },
      },
      events: [],
    })
    donCuaAi('u-sv', 'SHORTLISTED')
    await rut()
    // Đã đọc hồ sơ, đã mở liên hệ, có thể đang xếp lịch quanh người này.
    expect(guiMail).toHaveBeenCalledTimes(1)
  })
})

/* ==================================================================== */
/* Tính năng 5 — thông báo                                               */
/* ==================================================================== */

describe('thông báo', () => {
  it('nộp đơn → NTD nhận đúng MỘT thông báo, ghi trong cùng transaction', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo())
    donCreate.mockResolvedValue(hangDon())

    await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(thongBaoCreate).toHaveBeenCalledTimes(1)
    expect(thongBaoCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'u-ntd',
      type: 'APPLICATION_SUBMITTED',
      link: '/ntd/ung-vien?job=job-1',
    })
  })

  it('gửi email HỎNG thì nghiệp vụ chính VẪN xong', async () => {
    svFindUnique.mockResolvedValue(hoSoSinhVien())
    jobFindUnique.mockResolvedValue(tinMo())
    donCreate.mockResolvedValue(hangDon())
    guiMail.mockRejectedValue(new Error('Brevo 503'))

    const res = await request(app)
      .post('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-1' })

    // Đơn đã ghi xong rồi; Brevo chậm không được biến nó thành 500. Chuông là
    // nguồn sự thật, email chỉ là bản sao tiện lợi.
    expect(res.status).toBe(201)
    expect(thongBaoCreate).toHaveBeenCalledTimes(1)
  })

  it('VIEWED KHÔNG sinh thông báo — mở danh sách là đã xem, báo mỗi lần mở là spam', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'PENDING' })
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'VIEWED' }),
      studentProfile: { ...hoSoUngVien(), userId: 'u-sv' },
    })

    await request(app)
      .put('/api/ntd/tin-tuyen-dung/job-1/ung-vien/app-1/trang-thai')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ status: 'VIEWED' })

    expect(thongBaoCreate).not.toHaveBeenCalled()
    expect(guiMail).not.toHaveBeenCalled()
  })

  it('SHORTLISTED → sinh viên nhận cả chuông lẫn email', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Phục vụ quán cà phê',
      employerProfile: { userId: 'u-ntd' },
    })
    donFindFirst.mockResolvedValue({ id: 'app-1', status: 'PENDING' })
    donUpdate.mockResolvedValue({
      ...hangDon({ status: 'SHORTLISTED' }),
      studentProfile: {
        ...hoSoUngVien(),
        userId: 'u-sv',
        phone: '0901234567',
        user: { email: 'sv@uniwork.dev' },
      },
    })

    await request(app)
      .put('/api/ntd/tin-tuyen-dung/job-1/ung-vien/app-1/trang-thai')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ status: 'SHORTLISTED' })

    expect(thongBaoCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'u-sv',
      type: 'APPLICATION_STATUS_CHANGED',
      link: '/don-ung-tuyen',
    })
    expect(guiMail).toHaveBeenCalledTimes(1)
  })
})
