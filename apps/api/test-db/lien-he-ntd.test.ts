import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { afterAll, expect, it, vi } from 'vitest'
import request from 'supertest'

// Chỉ giả lập việc gửi email; request, validation, service và Prisma đều thật.
vi.mock('../src/lib/mailer.js', () => ({
  sendMail: vi.fn(),
  applicationNotificationEmail: (subject: string, body: string) => ({ subject, html: body }),
}))

const db = new PrismaClient()
const userIds: string[] = []
let disconnectApp: (() => Promise<void>) | undefined

afterAll(async () => {
  try {
    // Chỉ dọn đúng các tài khoản do lần chạy này tạo; quan hệ được cascade.
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } })
  } finally {
    await db.$disconnect()
    await disconnectApp?.()
    vi.unstubAllEnvs()
  }
})

it('API lưu liên hệ thật và mở/đóng ở danh sách, chi tiết, rút đơn trên PostgreSQL local', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '')
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(url.hostname)
  // Không phụ thuộc cấu hình dịch vụ ngoài của máy chạy test: chỉ thử HTTP nội bộ.
  for (const [key, value] of Object.entries({
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-contact-secret-khong-dung-that-0123456789',
    CORS_ORIGIN: 'http://localhost:5173',
    APP_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:4000',
    MAIL_FROM: 'test@example.com',
    BREVO_API_KEY: 'test-key',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  }))
    vi.stubEnv(key, value)
  const { createApp } = await import('../src/app.js')
  const { signAccessToken } = await import('../src/lib/token.js')
  const { prisma } = await import('../src/lib/prisma.js')
  disconnectApp = () => prisma.$disconnect()
  const app = createApp()
  const suffix = randomUUID()
  const employer = await db.user.create({
    data: {
      email: `test-contact-ntd-${suffix}@example.test`,
      role: 'EMPLOYER',
      employerProfile: { create: { companyName: 'Cà phê kiểm thử' } },
    },
    include: { employerProfile: true },
  })
  userIds.push(employer.id)
  const student = await db.user.create({
    data: {
      email: `test-contact-sv-${suffix}@example.test`,
      role: 'STUDENT',
      studentProfile: { create: { fullName: 'Sinh viên kiểm thử' } },
    },
    include: { studentProfile: true },
  })
  userIds.push(student.id)
  const ntdToken = signAccessToken({ sub: employer.id, role: 'EMPLOYER' })
  const svToken = signAccessToken({ sub: student.id, role: 'STUDENT' })
  const update = (input: Record<string, unknown>) =>
    request(app)
      .put('/api/toi/ho-so-ntd')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ companyName: 'Cà phê kiểm thử', ...input })
  const readDb = () =>
    db.employerProfile.findUniqueOrThrow({
      where: { userId: employer.id },
      select: { phone: true, contactName: true },
    })

  expect(
    (await update({ phone: '0901 234 567', contactName: '  Lê Thị Sương  ', website: '' })).status,
  ).toBe(200)
  expect(await readDb()).toEqual({ phone: '0901234567', contactName: 'Lê Thị Sương' })
  expect((await update({ description: 'Sửa mô tả, giữ liên hệ' })).status).toBe(200)
  expect(await readDb()).toEqual({ phone: '0901234567', contactName: 'Lê Thị Sương' })

  const job = await db.job.create({
    data: {
      employerProfileId: employer.employerProfile!.id,
      title: 'Tin kiểm thử liên hệ',
      description: 'Chỉ dùng trong test',
      city: 'TP.HCM',
      district: 'Quận 1',
      requirements: [],
      benefits: [],
      salaryNegotiable: true,
      salaryUnit: 'HOUR',
      scheduleType: 'RECURRING',
      deadline: new Date('2027-01-01'),
    },
  })
  const application = await db.application.create({
    data: {
      jobId: job.id,
      studentProfileId: student.studentProfile!.id,
    },
  })
  for (const status of [
    'PENDING',
    'VIEWED',
    'SHORTLISTED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ] as const) {
    await db.application.update({ where: { id: application.id }, data: { status } })
    const list = await request(app)
      .get('/api/toi/don-ung-tuyen')
      .set('Authorization', `Bearer ${svToken}`)
    const detail = await request(app)
      .get(`/api/toi/don-ung-tuyen/${application.id}`)
      .set('Authorization', `Bearer ${svToken}`)
    expect(list.status).toBe(200)
    expect(detail.status).toBe(200)
    const expected = ['SHORTLISTED', 'ACCEPTED'].includes(status)
      ? { phone: '0901234567', contactName: 'Lê Thị Sương', email: employer.email }
      : null
    expect(list.body.data.applications[0].job.employer.contact).toEqual(expected)
    expect(detail.body.data.job.employer.contact).toEqual(expected)
  }
  await db.application.update({ where: { id: application.id }, data: { status: 'SHORTLISTED' } })
  const withdrawn = await request(app)
    .delete(`/api/toi/don-ung-tuyen/${application.id}`)
    .set('Authorization', `Bearer ${svToken}`)
  expect(withdrawn.status).toBe(200)
  expect(withdrawn.body.data.application.job.employer.contact).toBeNull()
  expect((await update({ phone: '', contactName: '' })).status).toBe(200)
  expect(await readDb()).toEqual({ phone: null, contactName: null })
})
