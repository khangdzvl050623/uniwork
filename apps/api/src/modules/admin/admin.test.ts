import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  },
}))

const userFindMany = prisma.user.findMany as unknown as Mock
const userFindUnique = prisma.user.findUnique as unknown as Mock
const userUpdate = prisma.user.update as unknown as Mock

const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN' })
const studentToken = signAccessToken({ sub: 'u-1', role: 'STUDENT' })

const SINH_VIEN_ROW = {
  id: 'u-1',
  email: 'khang@sinhvien.edu.vn',
  role: 'STUDENT' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-08-01'),
  studentProfile: { fullName: 'Khang', university: 'PTIT', _count: { applications: 3 } },
  employerProfile: null,
}

const NTD_ROW = {
  id: 'u-2',
  email: 'tuyendung@corner.vn',
  role: 'EMPLOYER' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-08-02'),
  studentProfile: null,
  employerProfile: { companyName: 'The Corner Coffee' },
}

const ADMIN_ROW = {
  id: 'admin-1',
  email: 'admin@uniwork.dev',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-06-01'),
  studentProfile: null,
  employerProfile: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/nguoi-dung', () => {
  it('trả danh sách người dùng, đúng hình dạng cho cả ba vai', async () => {
    userFindMany.mockResolvedValue([SINH_VIEN_ROW, NTD_ROW, ADMIN_ROW])

    const res = await request(createApp())
      .get('/api/admin/nguoi-dung')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.users).toHaveLength(3)

    const sv = res.body.data.users.find((u: { email: string }) => u.email === SINH_VIEN_ROW.email)
    expect(sv).toMatchObject({
      displayName: 'Khang',
      school: 'PTIT',
      applicationCount: 3,
      status: 'ACTIVE',
    })

    const ntd = res.body.data.users.find((u: { email: string }) => u.email === NTD_ROW.email)
    expect(ntd).toMatchObject({ displayName: 'The Corner Coffee', school: null, applicationCount: 0 })
  })

  it('không đăng nhập thì 401', async () => {
    const res = await request(createApp()).get('/api/admin/nguoi-dung')
    expect(res.status).toBe(401)
  })

  it('sinh viên gọi vào thì 403, không phải admin nào cũng vào được', async () => {
    const res = await request(createApp())
      .get('/api/admin/nguoi-dung')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(403)
    expect(userFindMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/nguoi-dung/:id/trang-thai', () => {
  it('khoá một sinh viên: đổi status VÀ thu hồi refresh token đang sống', async () => {
    userFindUnique.mockResolvedValue({ role: 'STUDENT' })
    userUpdate.mockResolvedValue({ ...SINH_VIEN_ROW, status: 'SUSPENDED' })

    const res = await request(createApp())
      .put('/api/admin/nguoi-dung/u-1/trang-thai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('SUSPENDED')
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('mở khoá thì KHÔNG đụng tới refresh token — không có gì để thu hồi', async () => {
    userFindUnique.mockResolvedValue({ role: 'STUDENT' })
    userUpdate.mockResolvedValue({ ...SINH_VIEN_ROW, status: 'ACTIVE' })

    await request(createApp())
      .put('/api/admin/nguoi-dung/u-1/trang-thai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
  })

  it('không đổi được trạng thái của một tài khoản ADMIN khác', async () => {
    // Chặn ở đây để không ai tự khoá nhau (hoặc tự khoá chính mình) mà không
    // còn cách nào mở lại ngoài việc vào thẳng database.
    userFindUnique.mockResolvedValue({ role: 'ADMIN' })

    const res = await request(createApp())
      .put('/api/admin/nguoi-dung/admin-2/trang-thai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })

    expect(res.status).toBe(403)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('người dùng không tồn tại thì 404', async () => {
    userFindUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .put('/api/admin/nguoi-dung/khong-ton-tai/trang-thai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })

    expect(res.status).toBe(404)
  })

  it('giá trị status không hợp lệ bị chặn trước khi chạm database', async () => {
    const res = await request(createApp())
      .put('/api/admin/nguoi-dung/u-1/trang-thai')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'KHONG_HOP_LE' })

    expect(res.status).toBe(400)
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it('không phải admin thì không đổi được trạng thái ai cả', async () => {
    const res = await request(createApp())
      .put('/api/admin/nguoi-dung/u-1/trang-thai')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'SUSPENDED' })

    expect(res.status).toBe(403)
    expect(userUpdate).not.toHaveBeenCalled()
  })
})
