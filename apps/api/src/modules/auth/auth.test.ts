import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { hashPassword } from '../../lib/password.js'
import { hashToken, signAccessToken } from '../../lib/token.js'

/**
 * Giả lập Prisma, cùng lý do với skills.test.ts: CI không có Postgres chạy.
 *
 * Những gì test này KHÔNG bắt được: câu truy vấn sai cột, ràng buộc unique bị
 * vi phạm, transaction không rollback thật. Loại đó cần database thật và thuộc
 * về `test-db/`.
 *
 * Những gì nó BẮT được — và đó là phần quan trọng nhất của module này: luật
 * nghiệp vụ về token. Xoay vòng có đúng không, dùng lại token cũ có bị chặn
 * không, mật khẩu có lọt ra response không.
 */
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    // `$transaction` nhận hoặc một mảng lệnh, hoặc một callback. Service dùng cả
    // hai kiểu nên bản giả phải hiểu cả hai.
    $transaction: vi.fn(),
  },
}))

const userFindUnique = prisma.user.findUnique as unknown as Mock
const tokenFindUnique = prisma.refreshToken.findUnique as unknown as Mock
const tokenCreate = prisma.refreshToken.create as unknown as Mock
const tokenUpdateMany = prisma.refreshToken.updateMany as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

const HO_SO_RONG = { studentProfile: null, employerProfile: null }

const SINH_VIEN = {
  id: 'u-1',
  email: 'khang@sinhvien.edu.vn',
  role: 'STUDENT' as const,
  emailVerifiedAt: null,
  status: 'ACTIVE' as const,
  studentProfile: { fullName: 'Nguyễn Minh Khang' },
  employerProfile: null,
}

beforeEach(() => {
  vi.clearAllMocks()

  transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : arg,
  )
  tokenCreate.mockResolvedValue({})
  tokenUpdateMany.mockResolvedValue({ count: 0 })
})

/** Lấy giá trị cookie refresh token từ header Set-Cookie. */
function refreshCookieOf(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  return raw?.find((c) => c.startsWith('uniwork_rt='))
}

describe('POST /api/auth/dang-ky', () => {
  it('tạo tài khoản, trả 201 và KHÔNG để lộ mật khẩu hay refresh token trong body', async () => {
    userFindUnique.mockResolvedValue(null)
    ;(prisma.user.create as unknown as Mock).mockResolvedValue(SINH_VIEN)

    const res = await request(createApp()).post('/api/auth/dang-ky').send({
      email: 'khang@sinhvien.edu.vn',
      password: 'matkhau123',
      role: 'STUDENT',
      name: 'Nguyễn Minh Khang',
    })

    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.user.email).toBe('khang@sinhvien.edu.vn')
    expect(res.body.data.user.displayName).toBe('Nguyễn Minh Khang')

    // Ba thứ tuyệt đối không được có trong body. Kiểm bằng chuỗi JSON để bắt
    // được cả trường hợp chúng nằm lồng sâu trong một object con.
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('passwordHash')
    expect(body).not.toContain('refreshToken')
    expect(body).not.toContain('tokenHash')

    // Refresh token phải đi bằng cookie httpOnly, không phải body.
    const cookie = refreshCookieOf(res)
    expect(cookie).toBeDefined()
    expect(cookie).toContain('HttpOnly')
  })

  it('email trùng trả CONFLICT và không tạo bản ghi nào', async () => {
    userFindUnique.mockResolvedValue({ id: 'u-cu' })

    const res = await request(createApp()).post('/api/auth/dang-ky').send({
      email: 'khang@sinhvien.edu.vn',
      password: 'matkhau123',
      role: 'STUDENT',
      name: 'Nguyễn Minh Khang',
    })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('mật khẩu yếu bị chặn kèm lỗi gắn đúng vào trường password', async () => {
    const res = await request(createApp()).post('/api/auth/dang-ky').send({
      email: 'khang@sinhvien.edu.vn',
      password: 'abcdefgh', // đủ 8 ký tự nhưng không có chữ số
      role: 'STUDENT',
      name: 'Nguyễn Minh Khang',
    })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    // details phải chỉ đúng trường sai, để web gắn thông báo dưới đúng ô nhập.
    expect(res.body.error.details.password).toBeDefined()
  })

  it('không cho tự đăng ký vai trò ADMIN', async () => {
    const res = await request(createApp()).post('/api/auth/dang-ky').send({
      email: 'ke.xau@example.com',
      password: 'matkhau123',
      role: 'ADMIN',
      name: 'Kẻ xấu',
    })

    expect(res.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/dang-nhap', () => {
  it('đăng nhập đúng thì trả access token kèm hạn còn lại', async () => {
    userFindUnique.mockResolvedValue({
      ...SINH_VIEN,
      passwordHash: await hashPassword('matkhau123'),
    })

    const res = await request(createApp())
      .post('/api/auth/dang-nhap')
      .send({ email: 'khang@sinhvien.edu.vn', password: 'matkhau123' })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeTruthy()
    expect(res.body.data.expiresIn).toBe(900)
  })

  it('sai mật khẩu và email không tồn tại phải trả CÙNG một thông điệp', async () => {
    userFindUnique.mockResolvedValue({
      ...SINH_VIEN,
      passwordHash: await hashPassword('matkhau123'),
    })
    const saiMatKhau = await request(createApp())
      .post('/api/auth/dang-nhap')
      .send({ email: 'khang@sinhvien.edu.vn', password: 'sai-mat-khau-1' })

    userFindUnique.mockResolvedValue(null)
    const khongTonTai = await request(createApp())
      .post('/api/auth/dang-nhap')
      .send({ email: 'khong-ai@example.com', password: 'matkhau123' })

    // Khác thông điệp là biến form đăng nhập thành công cụ dò xem email nào đã
    // đăng ký. Test này khoá chặt điều đó.
    expect(saiMatKhau.status).toBe(401)
    expect(khongTonTai.status).toBe(401)
    expect(saiMatKhau.body.error.message).toBe(khongTonTai.body.error.message)
  })

  it('tài khoản bị khoá không đăng nhập được', async () => {
    userFindUnique.mockResolvedValue({
      ...SINH_VIEN,
      status: 'SUSPENDED',
      passwordHash: await hashPassword('matkhau123'),
    })

    const res = await request(createApp())
      .post('/api/auth/dang-nhap')
      .send({ email: 'khang@sinhvien.edu.vn', password: 'matkhau123' })

    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('khoá')
  })
})

describe('POST /api/auth/refresh — xoay vòng token', () => {
  it('token hợp lệ thì thu hồi bản cũ và cấp bản mới', async () => {
    tokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'u-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      user: SINH_VIEN,
    })

    const res = await request(createApp())
      .post('/api/auth/refresh')
      .set('Cookie', ['uniwork_rt=token-cu'])

    expect(res.status).toBe(200)
    // Hàng cũ được đánh dấu thu hồi, KHÔNG bị xoá — giữ lại mới phát hiện được
    // trường hợp nó bị đem ra dùng lại.
    expect(transaction).toHaveBeenCalled()
    // Cookie mới phải khác cookie cũ, nếu không thì "xoay vòng" chỉ là hình thức.
    expect(refreshCookieOf(res)).not.toContain('token-cu')
  })

  it('DÙNG LẠI token đã thu hồi thì huỷ TOÀN BỘ phiên của tài khoản đó', async () => {
    tokenFindUnique.mockResolvedValue({
      id: 'rt-cu',
      userId: 'u-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: new Date(), // đã thu hồi ở lần refresh trước
      user: SINH_VIEN,
    })

    const res = await request(createApp())
      .post('/api/auth/refresh')
      .set('Cookie', ['uniwork_rt=token-da-bi-trom'])

    expect(res.status).toBe(401)
    // Đây là hành vi quan trọng nhất của cả module: token đã thu hồi mà bị dùng
    // lại nghĩa là nó đã bị sao chép. Không biết ai là chủ thật, nên đăng xuất
    // tất cả. Thiếu bước này thì kẻ trộm dùng token vô thời hạn.
    expect(tokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('token đã hết hạn bị từ chối', async () => {
    tokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'u-1',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      user: SINH_VIEN,
    })

    const res = await request(createApp())
      .post('/api/auth/refresh')
      .set('Cookie', ['uniwork_rt=token-het-han'])

    expect(res.status).toBe(401)
  })

  it('không có cookie thì trả 401 chứ không sập', async () => {
    const res = await request(createApp()).post('/api/auth/refresh')
    expect(res.status).toBe(401)
    expect(tokenFindUnique).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/dang-xuat', () => {
  it('thu hồi token và xoá cookie', async () => {
    const res = await request(createApp())
      .post('/api/auth/dang-xuat')
      .set('Cookie', ['uniwork_rt=token-dang-dung'])

    expect(res.status).toBe(200)
    expect(tokenUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('token-dang-dung'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('không có cookie vẫn trả 200 — đăng xuất luôn phải thành công', async () => {
    const res = await request(createApp()).post('/api/auth/dang-xuat')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/auth/toi — requireAuth', () => {
  it('không có token trả 401', async () => {
    const res = await request(createApp()).get('/api/auth/toi')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('token rác trả 401 chứ không sập', async () => {
    const res = await request(createApp())
      .get('/api/auth/toi')
      .set('Authorization', 'Bearer khong-phai-jwt')

    expect(res.status).toBe(401)
  })

  it('token hợp lệ trả về hồ sơ, không kèm trường nhạy cảm', async () => {
    userFindUnique.mockResolvedValue({ ...SINH_VIEN, ...{ status: undefined } })

    const token = signAccessToken({ sub: 'u-1', role: 'STUDENT' })
    const res = await request(createApp())
      .get('/api/auth/toi')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('u-1')
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
  })

  it('cookie KHÔNG thay được header Authorization', async () => {
    // Xác thực bằng cookie là mở cửa cho CSRF: cookie tự động đi kèm mọi
    // request, kể cả request do trang khác kích hoạt.
    const token = signAccessToken({ sub: 'u-1', role: 'STUDENT' })
    const res = await request(createApp())
      .get('/api/auth/toi')
      .set('Cookie', [`uniwork_rt=${token}`])

    expect(res.status).toBe(401)
  })
})

describe('hồ sơ nhà tuyển dụng', () => {
  it('displayName lấy tên công ty thay vì họ tên', async () => {
    userFindUnique.mockResolvedValue({
      id: 'u-2',
      email: 'tuyendung@corner.vn',
      role: 'EMPLOYER',
      emailVerifiedAt: null,
      ...HO_SO_RONG,
      employerProfile: { companyName: 'The Corner Coffee' },
    })

    const token = signAccessToken({ sub: 'u-2', role: 'EMPLOYER' })
    const res = await request(createApp())
      .get('/api/auth/toi')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.displayName).toBe('The Corner Coffee')
  })
})
