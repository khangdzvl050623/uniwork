import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'
import { resetRateLimits } from '../../middlewares/rate-limit.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    oneTimeToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

/**
 * Chặn gửi email thật trong test.
 *
 * Không mock thì mỗi lần chạy `pnpm test` là gọi mạng tới Brevo — chậm, hỏng
 * khi mất mạng, và đốt hạn mức 300 email/ngày bằng thư chẳng ai đọc.
 */
vi.mock('../../lib/mailer.js', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  otpEmail: (code: string) => ({ subject: `${code} là mã`, html: `<b>${code}</b>` }),
}))

const userFindUnique = prisma.user.findUnique as unknown as Mock
const tokenFindUnique = prisma.oneTimeToken.findUnique as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

const CHUA_XAC_THUC = { id: 'u-1', email: 'khang@sinhvien.edu.vn', emailVerifiedAt: null }
const token = signAccessToken({ sub: 'u-1', role: 'STUDENT' })

beforeEach(() => {
  vi.clearAllMocks()
  // Bộ đếm giới hạn tần suất nằm trong bộ nhớ nên nó sống xuyên qua các ca test.
  // Không xoá thì ca sau bị chặn bởi số lần gọi của ca trước.
  resetRateLimits()
  transaction.mockResolvedValue([])
})

describe('POST /api/auth/gui-otp', () => {
  it('tạo mã mới và huỷ mọi mã cũ chưa dùng', async () => {
    userFindUnique.mockResolvedValue(CHUA_XAC_THUC)

    const res = await request(createApp())
      .post('/api/auth/gui-otp')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // Cả hai thao tác phải nằm trong CÙNG một transaction: huỷ mã cũ mà không
    // tạo được mã mới thì người dùng kẹt hoàn toàn.
    expect(transaction).toHaveBeenCalledOnce()
    expect(prisma.oneTimeToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', type: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
    expect(prisma.oneTimeToken.create).toHaveBeenCalled()
  })

  it('mã gồm đúng 6 chữ số, kể cả khi bắt đầu bằng số 0', async () => {
    userFindUnique.mockResolvedValue(CHUA_XAC_THUC)

    // Gọi vài lần để có mẫu; padStart bị quên thì sớm muộn cũng lòi ra mã ngắn.
    for (let i = 0; i < 5; i++) {
      resetRateLimits()
      const res = await request(createApp())
        .post('/api/auth/gui-otp')
        .set('Authorization', `Bearer ${token}`)
      expect(res.body.data.devCode).toMatch(/^\d{6}$/)
    }
  })

  it('email đã xác thực rồi thì trả CONFLICT', async () => {
    userFindUnique.mockResolvedValue({ ...CHUA_XAC_THUC, emailVerifiedAt: new Date() })

    const res = await request(createApp())
      .post('/api/auth/gui-otp')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
    expect(prisma.oneTimeToken.create).not.toHaveBeenCalled()
  })

  it('chưa đăng nhập thì không gọi được', async () => {
    const res = await request(createApp()).post('/api/auth/gui-otp')

    expect(res.status).toBe(401)
    // Điều đang khoá: endpoint KHÔNG nhận email trong body. Nếu nhận thì nó vừa
    // là công cụ dò email có trong hệ thống, vừa là máy gửi thư rác miễn phí.
    expect(userFindUnique).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/xac-thuc-email', () => {
  const hopLe = {
    id: 'ott-1',
    userId: 'u-1',
    type: 'EMAIL_VERIFICATION' as const,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
  }

  it('mã đúng thì ghi mốc xác thực và đánh dấu mã đã dùng', async () => {
    tokenFindUnique.mockResolvedValue(hopLe)
    userFindUnique.mockResolvedValue({
      id: 'u-1',
      email: 'khang@sinhvien.edu.vn',
      role: 'STUDENT',
      emailVerifiedAt: new Date(),
      studentProfile: { fullName: 'Khang' },
      employerProfile: null,
    })

    const res = await request(createApp())
      .post('/api/auth/xac-thuc-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.data.emailVerifiedAt).not.toBeNull()
    expect(transaction).toHaveBeenCalledOnce()
  })

  it('mã đã dùng rồi thì từ chối', async () => {
    tokenFindUnique.mockResolvedValue({ ...hopLe, usedAt: new Date() })

    const res = await request(createApp())
      .post('/api/auth/xac-thuc-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })

    expect(res.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('mã hết hạn thì từ chối', async () => {
    tokenFindUnique.mockResolvedValue({ ...hopLe, expiresAt: new Date(Date.now() - 1000) })

    const res = await request(createApp())
      .post('/api/auth/xac-thuc-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })

    expect(res.status).toBe(400)
  })

  it('sai mã, mã hết hạn và mã đã dùng đều trả CÙNG một thông điệp', async () => {
    const messages: string[] = []

    for (const state of [
      null,
      { ...hopLe, usedAt: new Date() },
      { ...hopLe, expiresAt: new Date(0) },
    ]) {
      tokenFindUnique.mockResolvedValue(state)
      const res = await request(createApp())
        .post('/api/auth/xac-thuc-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: '123456' })
      messages.push(res.body.error.message)
    }

    // Phân biệt ba ca này là chỉ đường cho người đi dò: "mã đã dùng" xác nhận
    // rằng mã đó từng đúng.
    expect(new Set(messages).size).toBe(1)
  })

  it('mã không phải 6 chữ số bị chặn trước khi chạm database', async () => {
    const res = await request(createApp())
      .post('/api/auth/xac-thuc-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'abcdef' })

    expect(res.status).toBe(400)
    expect(tokenFindUnique).not.toHaveBeenCalled()
  })
})

describe('giới hạn tần suất (T43)', () => {
  it('quá 10 lần đăng nhập sai thì trả RATE_LIMITED kèm Retry-After', async () => {
    userFindUnique.mockResolvedValue(null)
    const app = createApp()
    const body = { email: 'ke.do@example.com', password: 'thu-mat-khau-1' }

    // 10 lần đầu vẫn được xử lý bình thường (và trả 401 vì sai mật khẩu).
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/auth/dang-nhap').send(body)
      expect(res.status).toBe(401)
    }

    const chan = await request(app).post('/api/auth/dang-nhap').send(body)

    expect(chan.status).toBe(429)
    expect(chan.body.error.code).toBe('RATE_LIMITED')
    // Header chuẩn để phía web biết chờ bao lâu thay vì thử lại mù quáng.
    expect(Number(chan.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('đổi hoa thường trong email KHÔNG né được giới hạn', async () => {
    userFindUnique.mockResolvedValue(null)
    const app = createApp()

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/dang-nhap')
        .send({ email: 'a@x.com', password: 'sai12345' })
    }

    // Cùng một email, chỉ khác kiểu chữ. Không hạ về chữ thường lúc dựng khoá
    // thì đây là hai bộ đếm riêng và giới hạn thành vô dụng.
    const res = await request(app)
      .post('/api/auth/dang-nhap')
      .send({ email: 'A@X.com', password: 'sai12345' })

    expect(res.status).toBe(429)
  })

  it('hai endpoint khác nhau đếm riêng', async () => {
    userFindUnique.mockResolvedValue(null)
    const app = createApp()

    for (let i = 0; i < 11; i++) {
      await request(app)
        .post('/api/auth/dang-nhap')
        .send({ email: 'b@x.com', password: 'sai12345' })
    }

    // /dang-nhap đã bị khoá, nhưng /gui-otp phải còn dùng được — dò mật khẩu ở
    // một chỗ không nên làm chết luôn chức năng khác.
    userFindUnique.mockResolvedValue(CHUA_XAC_THUC)
    const otp = await request(app).post('/api/auth/gui-otp').set('Authorization', `Bearer ${token}`)

    expect(otp.status).toBe(200)
  })
})
