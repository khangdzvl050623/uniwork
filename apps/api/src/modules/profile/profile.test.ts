import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn(), update: vi.fn() },
    employerProfile: { findUnique: vi.fn(), update: vi.fn() },
    skill: { count: vi.fn() },
    studentSkill: { deleteMany: vi.fn(), createMany: vi.fn() },
    availability: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const userFindUnique = prisma.user.findUnique as unknown as Mock
const studentProfileFindUnique = prisma.studentProfile.findUnique as unknown as Mock
const studentProfileUpdate = prisma.studentProfile.update as unknown as Mock
const employerProfileFindUnique = prisma.employerProfile.findUnique as unknown as Mock
const employerProfileUpdate = prisma.employerProfile.update as unknown as Mock
const skillCount = prisma.skill.count as unknown as Mock
const availabilityFindMany = prisma.availability.findMany as unknown as Mock
const transaction = prisma.$transaction as unknown as Mock

const studentToken = signAccessToken({ sub: 'u-1', role: 'STUDENT' })
const employerToken = signAccessToken({ sub: 'u-2', role: 'EMPLOYER' })

const SINH_VIEN_FULL = {
  id: 'u-1',
  email: 'khang@sinhvien.edu.vn',
  role: 'STUDENT' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: new Date('2026-01-01'),
  createdAt: new Date('2025-12-01'),
  studentProfile: {
    fullName: 'Nguyễn Minh Khang',
    university: 'PTIT',
    major: 'CNTT',
    year: 3,
    bio: null,
    phone: null,
    cvUrl: null,
    expectedHourlyRate: 25000,
    skills: [{ skill: { id: 's-1', name: 'Pha chế', slug: 'pha-che' } }],
  },
  employerProfile: null,
}

const NTD_FULL = {
  id: 'u-2',
  email: 'tuyendung@corner.vn',
  role: 'EMPLOYER' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: null,
  createdAt: new Date('2025-12-01'),
  studentProfile: null,
  employerProfile: {
    companyName: 'The Corner Coffee',
    description: null,
    address: null,
    website: null,
    logoUrl: null,
    contactName: null,
    phone: null,
    verifiedAt: null,
  },
}

const STUDENT_PROFILE_ROW = {
  fullName: 'Nguyễn Minh Khang',
  university: 'PTIT',
  major: 'CNTT',
  year: 3,
  bio: null,
  phone: null,
  cvUrl: null,
  expectedHourlyRate: 25000,
  skills: [] as { skill: { id: string; name: string; slug: string } }[],
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : arg instanceof Function ? arg(prisma) : arg,
  )
})

describe('GET /api/toi (T51)', () => {
  it('không có token trả 401', async () => {
    const res = await request(createApp()).get('/api/toi')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('sinh viên: trả hồ sơ đầy đủ, không lộ trường nhạy cảm', async () => {
    userFindUnique.mockResolvedValue(SINH_VIEN_FULL)

    const res = await request(createApp())
      .get('/api/toi')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.studentProfile.university).toBe('PTIT')
    expect(res.body.data.employerProfile).toBeNull()
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
  })

  it('nhà tuyển dụng: displayName lấy tên công ty, employerProfile có verifiedAt null khi chưa duyệt', async () => {
    userFindUnique.mockResolvedValue(NTD_FULL)

    const res = await request(createApp())
      .get('/api/toi')
      .set('Authorization', `Bearer ${employerToken}`)

    expect(res.body.data.displayName).toBe('The Corner Coffee')
    expect(res.body.data.employerProfile.verifiedAt).toBeNull()
    expect(res.body.data.studentProfile).toBeNull()
  })
})

describe('PUT /api/toi/ho-so-sinh-vien (T52)', () => {
  it('nhà tuyển dụng gọi vào thì bị FORBIDDEN', async () => {
    const res = await request(createApp())
      .put('/api/toi/ho-so-sinh-vien')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ university: 'PTIT' })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(studentProfileUpdate).not.toHaveBeenCalled()
  })

  it('sinh viên sửa hồ sơ của chính mình thành công', async () => {
    studentProfileFindUnique.mockResolvedValue({ id: 'sp-1' })
    studentProfileUpdate.mockResolvedValue({ ...STUDENT_PROFILE_ROW, major: 'Kỹ thuật phần mềm' })

    const res = await request(createApp())
      .put('/api/toi/ho-so-sinh-vien')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ major: 'Kỹ thuật phần mềm' })

    expect(res.status).toBe(200)
    expect(res.body.data.major).toBe('Kỹ thuật phần mềm')
    expect(studentProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-1' } }),
    )
  })
})

describe('PUT /api/toi/ho-so-ntd (T53)', () => {
  it('NTD ở trạng thái PENDING vẫn sửa được hồ sơ', async () => {
    employerProfileFindUnique.mockResolvedValue({ id: 'ep-1' })
    employerProfileUpdate.mockResolvedValue({
      companyName: 'The Corner Coffee',
      description: 'Quán cà phê nhỏ gần trường',
      address: null,
      website: null,
      logoUrl: null,
      contactName: null,
      phone: null,
      verifiedAt: null, // vẫn PENDING
    })

    const res = await request(createApp())
      .put('/api/toi/ho-so-ntd')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ companyName: 'The Corner Coffee', description: 'Quán cà phê nhỏ gần trường' })

    expect(res.status).toBe(200)
    expect(res.body.data.verifiedAt).toBeNull()
    expect(res.body.data.description).toBe('Quán cà phê nhỏ gần trường')
  })

  it('sinh viên gọi vào thì bị FORBIDDEN', async () => {
    const res = await request(createApp())
      .put('/api/toi/ho-so-ntd')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ companyName: 'X' })

    expect(res.status).toBe(403)
  })
})

describe('PUT /api/toi/ky-nang (T54)', () => {
  it('gửi danh sách rỗng thì xoá hết, không tạo bản ghi mới', async () => {
    studentProfileFindUnique.mockResolvedValue({ id: 'sp-1' })
    userFindUnique.mockResolvedValue(SINH_VIEN_FULL)

    const res = await request(createApp())
      .put('/api/toi/ky-nang')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ skillIds: [] })

    expect(res.status).toBe(200)
    expect(prisma.studentSkill.deleteMany).toHaveBeenCalledWith({ where: { studentProfileId: 'sp-1' } })
    expect(prisma.studentSkill.createMany).not.toHaveBeenCalled()
  })

  it('kỹ năng không tồn tại trong danh mục thì trả 400, không đụng database', async () => {
    studentProfileFindUnique.mockResolvedValue({ id: 'sp-1' })
    skillCount.mockResolvedValue(1) // gửi 2 id, chỉ 1 tồn tại

    const res = await request(createApp())
      .put('/api/toi/ky-nang')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ skillIds: ['s-that', 's-gia'] })

    expect(res.status).toBe(400)
    expect(prisma.studentSkill.deleteMany).not.toHaveBeenCalled()
  })
})

describe('GET và PUT /api/toi/lich-ranh (T55)', () => {
  it('GET trả về danh sách ô đã lưu', async () => {
    studentProfileFindUnique.mockResolvedValue({ id: 'sp-1' })
    availabilityFindMany.mockResolvedValue([{ dayOfWeek: 1, slot: 'MORNING' }])

    const res = await request(createApp())
      .get('/api/toi/lich-ranh')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.slots).toEqual([{ dayOfWeek: 1, slot: 'MORNING' }])
  })

  it('ghi 21 ô (7 ngày × 3 buổi) chỉ mất một lần gọi', async () => {
    studentProfileFindUnique.mockResolvedValue({ id: 'sp-1' })
    const slots = Array.from({ length: 7 }, (_, day) =>
      (['MORNING', 'AFTERNOON', 'EVENING'] as const).map((slot) => ({ dayOfWeek: day, slot })),
    ).flat()
    availabilityFindMany.mockResolvedValue(slots)

    const res = await request(createApp())
      .put('/api/toi/lich-ranh')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slots })

    expect(res.status).toBe(200)
    expect(res.body.data.slots).toHaveLength(21)
    expect(transaction).toHaveBeenCalledOnce()
  })

  it('ô bị lặp lại trong payload thì trả 400 trước khi chạm database', async () => {
    studentProfileFindUnique.mockResolvedValue({ id: 'sp-1' })

    const res = await request(createApp())
      .put('/api/toi/lich-ranh')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        slots: [
          { dayOfWeek: 1, slot: 'MORNING' },
          { dayOfWeek: 1, slot: 'MORNING' },
        ],
      })

    expect(res.status).toBe(400)
    expect(prisma.availability.deleteMany).not.toHaveBeenCalled()
  })
})
