import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    employerProfile: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    employerDocument: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const userFindMany = prisma.user.findMany as unknown as Mock
const userFindUnique = prisma.user.findUnique as unknown as Mock
const userUpdate = prisma.user.update as unknown as Mock
const ntdFindMany = prisma.employerProfile.findMany as unknown as Mock
const ntdFindUnique = prisma.employerProfile.findUnique as unknown as Mock
const ntdUpdate = prisma.employerProfile.update as unknown as Mock
const docFindUnique = prisma.employerDocument.findUnique as unknown as Mock
const docCount = prisma.employerDocument.count as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

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

/** Hồ sơ NTD đúng hình dạng `CHON_NTD`: 1 giấy tờ đã duyệt, 1 đang chờ, thiếu loại thứ ba. */
const NTD_PROFILE = {
  id: 'ep-1',
  companyName: 'The Corner Coffee',
  contactName: 'Nguyễn Liên',
  phone: '0900000000',
  address: '12 Nguyễn Huệ, Q1',
  website: null,
  verifiedAt: null,
  createdAt: new Date('2026-08-01'),
  user: { id: 'u-2', email: 'tuyendung@corner.vn', status: 'ACTIVE' as const },
  documents: [
    {
      type: 'BUSINESS_LICENSE' as const,
      status: 'APPROVED' as const,
      reviewNote: null,
      reviewedAt: new Date('2026-08-02'),
      createdAt: new Date('2026-08-01'),
    },
    {
      type: 'TAX_CODE' as const,
      status: 'PENDING' as const,
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date('2026-08-01'),
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockResolvedValue([])
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

describe('GET /api/admin/nha-tuyen-dung', () => {
  it('trả hồ sơ kèm giấy tờ; loại chưa nộp thì vắng mặt chứ không có hàng giả', async () => {
    ntdFindMany.mockResolvedValue([NTD_PROFILE])

    const res = await request(createApp())
      .get('/api/admin/nha-tuyen-dung')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)

    const ntd = res.body.data.employers[0]
    expect(ntd).toMatchObject({
      id: 'ep-1',
      // userId khác id — id là của EmployerProfile, userId mới dùng để khoá tài khoản.
      userId: 'u-2',
      companyName: 'The Corner Coffee',
      email: 'tuyendung@corner.vn',
      verifiedAt: null,
      accountStatus: 'ACTIVE',
    })

    expect(ntd.documents).toHaveLength(2)
    expect(ntd.documents.map((d: { type: string }) => d.type)).not.toContain('ID_CARD')
  })

  it('sinh viên gọi vào thì 403', async () => {
    const res = await request(createApp())
      .get('/api/admin/nha-tuyen-dung')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(403)
    expect(ntdFindMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/nha-tuyen-dung/:id/giay-to/:type', () => {
  it('duyệt một giấy tờ: ghi APPROVED và xoá lý do từ chối cũ', async () => {
    ntdFindUnique.mockResolvedValueOnce({ id: 'ep-1', verifiedAt: null })
    docFindUnique.mockResolvedValue({ id: 'doc-1' })
    ntdFindUnique.mockResolvedValueOnce(NTD_PROFILE)

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/giay-to/TAX_CODE')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })

    expect(res.status).toBe(200)

    const [ops] = transaction.mock.calls[0] as [unknown[]]
    // Chỉ một thao tác: hồ sơ chưa xác minh nên không có gì để gỡ.
    expect(ops).toHaveLength(1)
    expect(prisma.employerDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', reviewNote: null }),
      }),
    )
  })

  it('từ chối mà KHÔNG ghi lý do thì 400 — không được từ chối im lặng', async () => {
    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/giay-to/TAX_CODE')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' })

    expect(res.status).toBe(400)
    expect(res.body.error.details).toHaveProperty('reviewNote')
    expect(ntdFindUnique).not.toHaveBeenCalled()
  })

  it('từ chối giấy tờ của NTD ĐANG xác minh thì gỡ luôn xác minh', async () => {
    // Bất biến: "đã xác minh" kéo theo "cả ba giấy tờ đều đã duyệt". Bác một
    // giấy tờ mà giữ nguyên dấu xác minh là để lại một trạng thái vô nghĩa.
    ntdFindUnique.mockResolvedValueOnce({ id: 'ep-1', verifiedAt: new Date('2026-08-10') })
    docFindUnique.mockResolvedValue({ id: 'doc-1' })
    ntdFindUnique.mockResolvedValueOnce({ ...NTD_PROFILE, verifiedAt: null })

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/giay-to/BUSINESS_LICENSE')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED', reviewNote: 'Ảnh mờ, không đọc được số giấy phép' })

    expect(res.status).toBe(200)
    expect(res.body.data.verifiedAt).toBeNull()

    const [ops] = transaction.mock.calls[0] as [unknown[]]
    expect(ops).toHaveLength(2)
    expect(prisma.employerProfile.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: { verifiedAt: null },
    })
  })

  it('loại giấy tờ không có thật thì 400, chưa chạm database', async () => {
    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/giay-to/SO_HO_KHAU')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })

    expect(res.status).toBe(400)
    expect(ntdFindUnique).not.toHaveBeenCalled()
  })

  it('giấy tờ chưa được nộp thì 404', async () => {
    ntdFindUnique.mockResolvedValueOnce({ id: 'ep-1', verifiedAt: null })
    docFindUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/giay-to/ID_CARD')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })

    expect(res.status).toBe(404)
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/nha-tuyen-dung/:id/xac-minh', () => {
  it('chưa đủ ba giấy tờ đã duyệt thì KHÔNG xác minh được', async () => {
    ntdFindUnique.mockResolvedValueOnce({ id: 'ep-1', verifiedAt: null })
    docCount.mockResolvedValue(2)

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/xac-minh')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verified: true })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('3')
    expect(ntdUpdate).not.toHaveBeenCalled()
  })

  it('đủ ba giấy tờ đã duyệt thì đặt verifiedAt', async () => {
    ntdFindUnique.mockResolvedValueOnce({ id: 'ep-1', verifiedAt: null })
    docCount.mockResolvedValue(3)
    ntdFindUnique.mockResolvedValueOnce({ ...NTD_PROFILE, verifiedAt: new Date('2026-08-20') })

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/xac-minh')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verified: true })

    expect(res.status).toBe(200)
    expect(res.body.data.verifiedAt).not.toBeNull()
    expect(ntdUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: { verifiedAt: expect.any(Date) },
    })
  })

  it('thu hồi xác minh thì KHÔNG đòi điều kiện gì — đây là chế tài', async () => {
    ntdFindUnique.mockResolvedValueOnce({ id: 'ep-1', verifiedAt: new Date('2026-08-10') })
    ntdFindUnique.mockResolvedValueOnce({ ...NTD_PROFILE, verifiedAt: null })

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/xac-minh')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verified: false })

    expect(res.status).toBe(200)
    expect(res.body.data.verifiedAt).toBeNull()
    // Không đếm giấy tờ: gỡ xác minh phải làm được kể cả khi hồ sơ vẫn đủ giấy.
    expect(docCount).not.toHaveBeenCalled()
    expect(ntdUpdate).toHaveBeenCalledWith({ where: { id: 'ep-1' }, data: { verifiedAt: null } })
  })

  it('nhà tuyển dụng không tồn tại thì 404', async () => {
    ntdFindUnique.mockResolvedValueOnce(null)

    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/khong-co/xac-minh')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verified: false })

    expect(res.status).toBe(404)
    expect(ntdUpdate).not.toHaveBeenCalled()
  })

  it('sinh viên không xác minh được ai cả', async () => {
    const res = await request(createApp())
      .put('/api/admin/nha-tuyen-dung/ep-1/xac-minh')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ verified: true })

    expect(res.status).toBe(403)
    expect(ntdUpdate).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/nha-tuyen-dung/:id/giay-to/:type/xem', () => {
  it('trả URL ký có hạn, không phải địa chỉ công khai', async () => {
    docFindUnique.mockResolvedValue({
      cloudinaryPublicId: 'uniwork/documents/ep-1/ID_CARD',
      fileFormat: 'jpg',
    })

    const res = await request(createApp())
      .get('/api/admin/nha-tuyen-dung/ep-1/giay-to/ID_CARD/xem')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.url).toMatch(/^https:\/\//)
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now())

    /*
     * Điều đáng kiểm ở đây là ĐƯỜNG TRA CỨU, không phải hình dạng URL của
     * Cloudinary (thứ họ đổi lúc nào cũng được).
     *
     * Admin tra theo `employerProfileId` lấy từ URL. Hàm tương ứng bên
     * profile.service tra theo userId của chính người đang đăng nhập — đó là
     * ràng buộc giữ cho nhà tuyển dụng không xem được giấy tờ của nhau, và là
     * lý do hai hàm cố ý không dùng chung.
     */
    expect(docFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employerProfileId_type: { employerProfileId: 'ep-1', type: 'ID_CARD' } },
      }),
    )
  })

  it('chưa nộp thì 404', async () => {
    docFindUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .get('/api/admin/nha-tuyen-dung/ep-1/giay-to/ID_CARD/xem')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
  })
})
