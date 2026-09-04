import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'

/**
 * Kiểm cookie phiên ở chế độ PRODUCTION.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO PHẢI CÓ FILE RIÊNG CHO VIỆC NÀY
 * ---------------------------------------------------------------------------
 * Cả bộ test chạy với `NODE_ENV=test`, nên `isProduction` luôn `false` và nhánh
 * production của cookie KHÔNG BAO GIỜ được đi qua. Đúng chỗ đó từng có một lỗi
 * thật lên tới bản deploy: tên cookie mang tiền tố `__Host-` (bắt buộc
 * `Path=/`) trong khi path lại đặt `/api/auth`. Hai điều kiện loại trừ nhau nên
 * trình duyệt lặng lẽ vứt cookie.
 *
 * Không có thông báo lỗi nào ở bất kỳ đâu: server trả 200, log sạch, chỉ có
 * lời gọi /refresh ngay sau đó nhận 401 mà không ai hiểu vì sao. Loại lỗi này
 * chỉ có test mới bắt được, vì mắt người đọc code sẽ đọc lướt qua đúng như tôi
 * đã đọc lướt lúc viết nó.
 *
 * `vi.mock` phải chặn ngay ở tầng module: `isProduction` được tính đúng một lần
 * lúc nạp, không đổi được bằng cách gán `process.env` trong test.
 */
vi.mock('../../config/env.js', () => ({
  isProduction: true,
  corsOrigins: ['https://uniwork-web-theta.vercel.app'],
  APP_VERSION: '0.1.0',
  env: {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'test-access-secret-khong-dung-that-0123456789',
    ACCESS_TTL: '15m',
    REFRESH_TTL_DAYS: 7,
    APP_URL: 'https://uniwork-web-theta.vercel.app',
    API_URL: 'https://uniwork-api.onrender.com',
    BREVO_API_KEY: 'test-key',
    MAIL_FROM: 'test@example.com',
    CLOUDINARY_CLOUD_NAME: 'test',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
  },
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const { createApp } = await import('../../app.js')
const { prisma } = await import('../../lib/prisma.js')

const userFindUnique = prisma.user.findUnique as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

const SINH_VIEN = {
  id: 'u-1',
  email: 'khang@sinhvien.edu.vn',
  role: 'STUDENT' as const,
  emailVerifiedAt: null,
  status: 'ACTIVE' as const,
  studentProfile: { fullName: 'Khang' },
  employerProfile: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  userFindUnique.mockResolvedValue(null)
  transaction.mockImplementation(async (arg: unknown) =>
    arg instanceof Function ? arg(prisma) : arg,
  )
  ;(prisma.user.create as unknown as Mock).mockResolvedValue(SINH_VIEN)
})

/** Lấy header Set-Cookie của refresh token từ một lần đăng ký. */
async function layCookie(): Promise<string> {
  const res = await request(createApp()).post('/api/auth/dang-ky').send({
    email: 'khang@sinhvien.edu.vn',
    password: 'matkhau123',
    role: 'STUDENT',
    name: 'Khang',
  })

  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined
  const refresh = cookies?.find((c) => c.includes('uniwork_rt'))
  if (!refresh) throw new Error('Không tìm thấy cookie refresh trong response')
  return refresh
}

describe('cookie refresh ở production', () => {
  it('trình duyệt CHẤP NHẬN được cookie này (tiền tố khớp với các thuộc tính)', async () => {
    /*
     * Đây là ca chính. Luật của trình duyệt:
     *   __Host-  → bắt buộc Secure, Path=/ CHÍNH XÁC, và không có Domain
     *   __Secure-→ chỉ bắt buộc Secure
     *
     * Vi phạm thì cookie bị bỏ IM LẶNG. Test này diễn đạt đúng luật đó, nên nó
     * đỏ ngay nếu ai đó đổi tiền tố hoặc đổi path mà không đổi cái còn lại.
     */
    const cookie = await layCookie()

    if (cookie.startsWith('__Host-')) {
      expect(cookie, 'tiền tố __Host- bắt buộc Path=/').toMatch(/;\s*Path=\/(;|$)/i)
      expect(cookie, 'tiền tố __Host- cấm thuộc tính Domain').not.toMatch(/;\s*Domain=/i)
      expect(cookie).toMatch(/;\s*Secure/i)
      return
    }

    if (cookie.startsWith('__Secure-')) {
      expect(cookie, 'tiền tố __Secure- bắt buộc Secure').toMatch(/;\s*Secure/i)
      return
    }

    throw new Error(`Cookie ở production nên có tiền tố bảo vệ, đang là: ${cookie.split('=')[0]}`)
  })

  it('có Secure và SameSite=None để đi được giữa domain Vercel và Render', async () => {
    // Web ở vercel.app, api ở onrender.com — hai site khác nhau. Thiếu
    // SameSite=None thì trình duyệt không gửi cookie kèm request từ web, và
    // người dùng bị đăng xuất ngay sau khi vừa đăng nhập.
    const cookie = await layCookie()

    expect(cookie).toMatch(/;\s*Secure/i)
    expect(cookie).toMatch(/;\s*SameSite=None/i)
  })

  it('vẫn là httpOnly — JavaScript không đọc được refresh token', async () => {
    const cookie = await layCookie()
    expect(cookie).toMatch(/;\s*HttpOnly/i)
  })

  it('hạn cookie khớp với REFRESH_TTL_DAYS, không phải một số ghi cứng', async () => {
    // Lệch hai con số này là lỗi âm thầm: trình duyệt vẫn gửi cookie sau khi
    // token trong database đã hết hạn, và người dùng thấy mình "đang đăng nhập"
    // nhưng thao tác nào cũng 401.
    const cookie = await layCookie()
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1])

    expect(maxAge).toBe(7 * 24 * 60 * 60)
  })
})
