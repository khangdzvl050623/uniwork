import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { resetRateLimits } from '../../middlewares/rate-limit.js'
import { hashOtp } from './otp.service.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    oneTimeToken: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../../lib/mailer.js', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  passwordResetEmail: (code: string) => ({ subject: `${code} là mã`, html: `<b>${code}</b>` }),
  otpEmail: (code: string) => ({ subject: `${code} là mã`, html: `<b>${code}</b>` }),
}))

const userFindUnique = prisma.user.findUnique as unknown as Mock
const tokenFindFirst = prisma.oneTimeToken.findFirst as unknown as Mock
const tokenUpdate = prisma.oneTimeToken.update as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

const NGUOI_DUNG = { id: 'u-1', email: 'khang@sinhvien.edu.vn', status: 'ACTIVE' as const }
const MA_DUNG = '483920'

/** Mã còn sống, chưa ai nhập sai lần nào. */
function maHopLe(sua: Record<string, unknown> = {}) {
  return {
    id: 'ott-1',
    tokenHash: hashOtp('u-1', MA_DUNG),
    expiresAt: new Date(Date.now() + 60_000),
    failedAttempts: 0,
    ...sua,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimits()
  transaction.mockResolvedValue([])
})

describe('POST /api/auth/quen-mat-khau', () => {
  it('email có thật: tạo mã mới và huỷ mọi mã cũ trong CÙNG transaction', async () => {
    userFindUnique.mockResolvedValue(NGUOI_DUNG)

    const res = await request(createApp())
      .post('/api/auth/quen-mat-khau')
      .send({ email: NGUOI_DUNG.email })

    expect(res.status).toBe(200)
    expect(transaction).toHaveBeenCalledOnce()
    expect(prisma.oneTimeToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('email KHÔNG tồn tại: vẫn trả 200 với đúng thông điệp như khi có thật', async () => {
    /*
     * Đây là điều quan trọng nhất của endpoint này. Nó công khai, nên nếu trả
     * lời khác nhau cho "có tài khoản" và "không có" thì bất kỳ ai cũng dựng
     * được danh sách email đã đăng ký — nguyên liệu cho những đợt thử mật khẩu
     * về sau.
     */
    userFindUnique.mockResolvedValue(NGUOI_DUNG)
    const coThat = await request(createApp())
      .post('/api/auth/quen-mat-khau')
      .send({ email: NGUOI_DUNG.email })

    // Xoá dấu vết của lần gọi trên, để phần khẳng định bên dưới chỉ nói về
    // lần gọi với email không tồn tại.
    vi.clearAllMocks()
    transaction.mockResolvedValue([])
    resetRateLimits()

    userFindUnique.mockResolvedValue(null)
    const khongCo = await request(createApp())
      .post('/api/auth/quen-mat-khau')
      .send({ email: 'khong-ton-tai@example.com' })

    expect(khongCo.status).toBe(coThat.status)
    expect(khongCo.body.data.message).toBe(coThat.body.data.message)
    // Và tuyệt đối không gửi mail cho địa chỉ không có tài khoản.
    expect(prisma.oneTimeToken.create).not.toHaveBeenCalled()
  })

  it('tài khoản bị khoá thì không gửi mã', async () => {
    // Đặt lại mật khẩu cũng không vào được, gửi mã chỉ khiến họ tưởng sắp vào lại.
    userFindUnique.mockResolvedValue({ ...NGUOI_DUNG, status: 'SUSPENDED' })

    const res = await request(createApp())
      .post('/api/auth/quen-mat-khau')
      .send({ email: NGUOI_DUNG.email })

    expect(res.status).toBe(200)
    expect(prisma.oneTimeToken.create).not.toHaveBeenCalled()
  })

  it('quá 3 lần trong một giờ thì bị chặn', async () => {
    userFindUnique.mockResolvedValue(NGUOI_DUNG)
    const app = createApp()
    const body = { email: NGUOI_DUNG.email }

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/auth/quen-mat-khau').send(body)
      expect(res.status).toBe(200)
    }

    const chan = await request(app).post('/api/auth/quen-mat-khau').send(body)
    expect(chan.status).toBe(429)
    expect(chan.body.error.code).toBe('RATE_LIMITED')
  })
})

describe('POST /api/auth/dat-lai-mat-khau', () => {
  it('mã đúng: đổi mật khẩu VÀ thu hồi mọi phiên đang đăng nhập', async () => {
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe())

    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: NGUOI_DUNG.email,
      code: MA_DUNG,
      password: 'matkhaumoi123',
    })

    expect(res.status).toBe(200)

    /*
     * Thu hồi phiên là phần dễ quên nhất mà lại quan trọng nhất. Người ta bấm
     * "quên mật khẩu" thường vì nghi tài khoản đã bị người khác vào; đổi mật
     * khẩu mà để nguyên phiên cũ thì kẻ đó vẫn đang đăng nhập bình thường.
     */
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(transaction).toHaveBeenCalledOnce()
  })

  it('KHÔNG tự đăng nhập sau khi đổi — không trả token, không đặt cookie', async () => {
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe())

    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: NGUOI_DUNG.email,
      code: MA_DUNG,
      password: 'matkhaumoi123',
    })

    // Vừa thu hồi sạch phiên xong mà cấp ngay phiên mới thì mất phần lớn ý nghĩa.
    expect(JSON.stringify(res.body)).not.toContain('accessToken')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('mã sai thì tăng bộ đếm, chưa huỷ mã khi còn dưới ngưỡng', async () => {
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe({ failedAttempts: 1 }))

    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: NGUOI_DUNG.email,
      code: '000000',
      password: 'matkhaumoi123',
    })

    expect(res.status).toBe(400)
    expect(tokenUpdate).toHaveBeenCalledWith({
      where: { id: 'ott-1' },
      // Chưa có `usedAt` nghĩa là mã vẫn dùng được — người gõ nhầm một lần
      // không bị bắt xin mã mới.
      data: { failedAttempts: 2 },
    })
  })

  it('sai tới lần thứ 5 thì HUỶ mã luôn', async () => {
    /*
     * Huỷ thay vì khoá tạm: kẻ dò mất sạch tiến độ và phải bắt đầu lại với một
     * mã khác hẳn, còn người dùng thật chỉ cần bấm "gửi lại". Khoá tạm thì
     * ngược lại — kẻ dò chỉ việc chờ, người thật bị chặn ngoài tài khoản mình.
     */
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe({ failedAttempts: 4 }))

    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: NGUOI_DUNG.email,
      code: '000000',
      password: 'matkhaumoi123',
    })

    expect(res.status).toBe(400)
    expect(tokenUpdate).toHaveBeenCalledWith({
      where: { id: 'ott-1' },
      data: { failedAttempts: 5, usedAt: expect.any(Date) },
    })
  })

  it('mã hết hạn thì từ chối, không đụng tới mật khẩu', async () => {
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe({ expiresAt: new Date(Date.now() - 1000) }))

    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: NGUOI_DUNG.email,
      code: MA_DUNG,
      password: 'matkhaumoi123',
    })

    expect(res.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('sai mã, hết hạn, và email không tồn tại đều trả CÙNG một thông điệp', async () => {
    const messages: string[] = []

    // Ca 1: email không tồn tại
    userFindUnique.mockResolvedValue(null)
    messages.push(
      (
        await request(createApp())
          .post('/api/auth/dat-lai-mat-khau')
          .send({ email: 'a@b.com', code: MA_DUNG, password: 'matkhaumoi123' })
      ).body.error.message,
    )

    // Ca 2: sai mã
    resetRateLimits()
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe())
    messages.push(
      (
        await request(createApp())
          .post('/api/auth/dat-lai-mat-khau')
          .send({ email: 'a@b.com', code: '000000', password: 'matkhaumoi123' })
      ).body.error.message,
    )

    // Ca 3: mã hết hạn
    resetRateLimits()
    tokenFindFirst.mockResolvedValue(maHopLe({ expiresAt: new Date(0) }))
    messages.push(
      (
        await request(createApp())
          .post('/api/auth/dat-lai-mat-khau')
          .send({ email: 'a@b.com', code: MA_DUNG, password: 'matkhaumoi123' })
      ).body.error.message,
    )

    expect(new Set(messages).size).toBe(1)
  })

  it('mật khẩu mới yếu bị chặn trước khi chạm database', async () => {
    // Đang ĐẶT mật khẩu mới nên luật mật khẩu phải áp dụng đầy đủ — khác màn
    // đăng nhập, nơi cố ý không áp luật để không khoá người dùng cũ.
    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: NGUOI_DUNG.email,
      code: MA_DUNG,
      password: 'khongcoso',
    })

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('password')
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it('tài khoản chỉ đăng nhập Google (chưa có mật khẩu) vẫn đặt được mật khẩu', async () => {
    /*
     * Đây là lý do luồng này KHÔNG kiểm `passwordHash` có null hay không: nó
     * kiêm luôn việc đặt mật khẩu lần đầu cho tài khoản Google, thay cho một
     * endpoint riêng chỉ cần access token — thứ mà ai chiếm được phiên cũng
     * dùng được để cài một cửa hậu vĩnh viễn.
     */
    userFindUnique.mockResolvedValue({ id: 'u-1' })
    tokenFindFirst.mockResolvedValue(maHopLe())

    const res = await request(createApp()).post('/api/auth/dat-lai-mat-khau').send({
      email: 'chi-google@uniwork.dev',
      code: MA_DUNG,
      password: 'matkhaumoi123',
    })

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { passwordHash: expect.any(String) },
    })
  })
})
