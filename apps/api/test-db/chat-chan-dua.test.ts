import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ntdChuDongTraoDoi } from '../src/modules/chat/handoff.service.js'

/**
 * Khe đua giữa "sinh viên bấm chặn" và "nhà tuyển dụng bấm Nhắn tin".
 *
 * ===========================================================================
 * VÌ SAO CẦN FILE RIÊNG VÀ MỘT CÚ GIẢ
 * ===========================================================================
 * `ntdChuDongTraoDoi` kiểm "đã chặn chưa" HAI lần: một lần sớm, và một lần
 * trong transaction SAU câu UPDATE mở luồng. Lần thứ hai chỉ có tác dụng khi
 * lệnh chặn commit đúng vào khe giữa hai lần — test tuần tự không bao giờ lọt
 * vào khe đó, nên bỏ lần kiểm thứ hai đi mà mọi ca ở `chat-handoff` vẫn xanh
 * (đã thử: đột biến sống sót).
 *
 * Cách tái hiện TẤT ĐỊNH: lần gọi `daChan` ĐẦU TIÊN trả "chưa chặn" — đúng như
 * lúc nó được đọc trước khi sinh viên bấm — còn từ lần thứ hai đọc database
 * thật, nơi hàng chặn ĐÃ có. Không phụ thuộc may rủi về thời gian.
 *
 * Tách file vì `vi.mock` áp cho cả file — không được làm sai `daChan` của các
 * ca còn lại.
 */

let lanGoi = 0
vi.mock('../src/modules/chat/chan-ntd.service.js', async (goc) => {
  const that = await goc<typeof import('../src/modules/chat/chan-ntd.service.js')>()
  return {
    ...that,
    daChan: vi.fn(async (...thamSo: Parameters<typeof that.daChan>) => {
      lanGoi += 1
      return lanGoi === 1 ? false : that.daChan(...thamSo)
    }),
  }
})

const prisma = new PrismaClient()

let svId: string
let ntd: { id: string; role: 'EMPLOYER' }
let employerProfileId: string
let donId: string

beforeEach(async () => {
  lanGoi = 0

  const sv = await prisma.user.upsert({
    where: { email: 'chan-dua-sv@test.local' },
    update: {},
    create: { email: 'chan-dua-sv@test.local', role: 'STUDENT', passwordHash: null },
    select: { id: true },
  })
  svId = sv.id
  const hs = await prisma.studentProfile.upsert({
    where: { userId: sv.id },
    update: {},
    create: { userId: sv.id, fullName: 'Trần Thị Bình' },
    select: { id: true },
  })

  const u = await prisma.user.upsert({
    where: { email: 'chan-dua-ntd@test.local' },
    update: {},
    create: { email: 'chan-dua-ntd@test.local', role: 'EMPLOYER', passwordHash: null },
    select: { id: true },
  })
  ntd = { id: u.id, role: 'EMPLOYER' }
  const ep = await prisma.employerProfile.upsert({
    where: { userId: u.id },
    update: { verifiedAt: new Date() },
    create: { userId: u.id, companyName: 'Quán Đua', verifiedAt: new Date() },
    select: { id: true },
  })
  employerProfileId = ep.id

  const job =
    (await prisma.job.findFirst({ where: { employerProfileId }, select: { id: true } })) ??
    (await prisma.job.create({
      data: {
        employerProfileId,
        title: 'Tin của Quán Đua',
        description: 'Mô tả đủ dài cho ràng buộc của bảng Job.',
        city: 'Hà Nội',
        district: 'Cầu Giấy',
        salaryUnit: 'HOUR',
        salaryNegotiable: true,
        scheduleType: 'RECURRING',
        deadline: new Date(Date.now() + 30 * 86_400_000),
        status: 'OPEN',
        publishedAt: new Date(),
      },
      select: { id: true },
    }))

  /* Dọn sạch mọi thứ của sinh viên này trước mỗi ca — không dọn ở cuối ca. */
  const cu = await prisma.chatSession.findMany({ where: { ownerUserId: svId }, select: { id: true } })
  await prisma.chatMessage.deleteMany({ where: { sessionId: { in: cu.map((c) => c.id) } } })
  await prisma.chatSession.deleteMany({ where: { ownerUserId: svId } })
  await prisma.employerBlock.deleteMany({ where: { studentUserId: svId } })
  await prisma.application.deleteMany({ where: { studentProfileId: hs.id } })
  await prisma.notification.deleteMany({ where: { userId: svId } })

  donId = (
    await prisma.application.create({
      data: { jobId: job.id, studentProfileId: hs.id, status: 'PENDING' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('chặn đúng lúc nhà tuyển dụng bấm Nhắn tin', () => {
  it('lệnh chặn lọt vào khe sau lần kiểm sớm → vẫn bị từ chối, luồng KHÔNG mở', async () => {
    /* Sinh viên đã chặn — nhưng lần kiểm sớm "đọc" trước khi hàng này có. */
    await prisma.employerBlock.create({ data: { studentUserId: svId, employerProfileId } })

    await expect(ntdChuDongTraoDoi(ntd, donId)).rejects.toMatchObject({ status: 403 })

    expect(lanGoi).toBe(2) // đúng là lần kiểm THỨ HAI đã chặn
    const luong = await prisma.chatSession.findFirst({ where: { ownerUserId: svId, kind: 'NTD' } })
    expect(luong?.state).not.toBe('HUMAN_ACTIVE')
    expect(await prisma.notification.count({ where: { userId: svId } })).toBe(0)
  })
})
