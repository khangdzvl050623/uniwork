import { PrismaClient } from '@prisma/client'
import { DangBanError, giuLuot, demLuotConLai } from '@uniwork/ai-runtime'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * Hạn mức AI — chạy trên PostgreSQL THẬT, không mock.
 *
 * VÌ SAO KHÔNG NẰM Ở LÀN `vitest` THƯỜNG:
 *
 * Hai thứ được kiểm ở đây đều là ràng buộc của database, và mock Prisma không
 * biết chúng tồn tại:
 *
 *   1. `INSERT ... ON CONFLICT ... DO UPDATE WHERE` — phép cộng nguyên tử. Mock
 *      sẽ trả về bất cứ thứ gì ta bảo nó trả, nên test sẽ xanh kể cả khi câu
 *      SQL sai hoàn toàn.
 *   2. Chỉ mục UNIQUE MỘT PHẦN `ai_turns_mot_luot_dang_chay` — viết tay trong
 *      migration, không có trong schema.prisma. Prisma Client không hề biết nó.
 *
 * Chạy: pnpm --filter @uniwork/api test:db
 */

const prisma = new PrismaClient()
const TRAN_CHAT = 5 // = AI_CHAT_TURNS_PER_DAY mặc định

let userId: string

async function dungUserThu() {
  const u = await prisma.user.upsert({
    where: { email: 'quota-test@test.local' },
    update: {},
    create: { email: 'quota-test@test.local', role: 'STUDENT', passwordHash: null },
    select: { id: true },
  })
  return u.id
}

const thamSo = (i: number) => ({
  userId,
  feature: 'CHAT' as const,
  runnerId: `p-${i}`,
  modelId: 'test-model',
  promptVersion: 'v1',
})

/** Mỗi lần giữ lượt là một transaction riêng — đúng như luồng thật. */
function giuMotLuot(i: number) {
  return prisma.$transaction((tx) => giuLuot(tx, thamSo(i)))
}

beforeEach(async () => {
  userId = await dungUserThu()
  await prisma.aiTurn.deleteMany({ where: { userId } })
  await prisma.aiUsageDay.deleteMany({ where: { userId } })
})

afterAll(async () => {
  await prisma.aiTurn.deleteMany({ where: { userId } })
  await prisma.aiUsageDay.deleteMany({ where: { userId } })
  await prisma.$disconnect()
})

describe('giuLuot — phép cộng nguyên tử', () => {
  it('SÁU request song song trên hạn mức NĂM thì đúng năm cái qua', async () => {
    // Chốt từng lượt ngay sau khi giữ, nếu không thì chỉ mục "một lượt đang
    // chạy" sẽ chặn từ cái thứ hai và ta không đo được hạn mức ngày.
    const ketQua: Array<'ok' | 'het' | 'ban'> = []

    await Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        try {
          const kq = await prisma.$transaction(async (tx) => {
            const r = await giuLuot(tx, thamSo(i))
            if (r.ok) await tx.aiTurn.update({ where: { id: r.turnId }, data: { state: 'SUCCEEDED' } })
            return r
          })
          ketQua.push(kq.ok ? 'ok' : 'het')
        } catch (e) {
          ketQua.push(e instanceof DangBanError ? 'ban' : 'het')
        }
      }),
    )

    // Giá trị kỳ vọng đến từ ĐỊNH NGHĨA hạn mức (5), không phải từ việc chạy
    // code rồi chép số ra.
    expect(ketQua.filter((x) => x === 'ok')).toHaveLength(TRAN_CHAT)

    const so = await prisma.aiUsageDay.findFirstOrThrow({ where: { userId } })
    expect(so.turnsReserved).toBe(TRAN_CHAT)
  })

  it('bộ đếm KHÔNG vượt trần dù gọi thêm', async () => {
    for (let i = 0; i < TRAN_CHAT; i++) {
      const kq = await giuMotLuot(i)
      expect(kq.ok).toBe(true)
      if (kq.ok) await prisma.aiTurn.update({ where: { id: kq.turnId }, data: { state: 'SUCCEEDED' } })
    }

    const themMot = await giuMotLuot(99)
    expect(themMot).toEqual({ ok: false, ly: 'HET_LUOT', conLai: 0 })

    const so = await prisma.aiUsageDay.findFirstOrThrow({ where: { userId } })
    expect(so.turnsReserved).toBe(TRAN_CHAT) // KHÔNG phải 6
  })

  it('hoàn lượt rồi xin lại thì được', async () => {
    const dau = await giuMotLuot(0)
    expect(dau.ok).toBe(true)
    if (!dau.ok) return

    await prisma.$transaction([
      prisma.aiTurn.update({ where: { id: dau.turnId }, data: { state: 'REFUNDED' } }),
      prisma.aiUsageDay.updateMany({
        where: { userId },
        data: { turnsUsed: { increment: 1 }, turnsRefunded: { increment: 1 } },
      }),
    ])

    // reserved=1, refunded=1 ⇒ đã dùng 0 ⇒ còn nguyên 5.
    const { conLai } = await demLuotConLai(prisma, userId, 'CHAT')
    expect(conLai).toBe(TRAN_CHAT)
  })
})

describe('chỉ mục một phần — mỗi tài khoản một lượt đang chạy', () => {
  it('lượt thứ hai khi lượt đầu chưa chốt thì ném DangBanError', async () => {
    const dau = await giuMotLuot(0)
    expect(dau.ok).toBe(true)

    await expect(giuMotLuot(1)).rejects.toBeInstanceOf(DangBanError)
  })

  it('DangBanError KHÔNG làm mất lượt — transaction đã rollback', async () => {
    await giuMotLuot(0)
    const truoc = await prisma.aiUsageDay.findFirstOrThrow({ where: { userId } })

    await expect(giuMotLuot(1)).rejects.toBeInstanceOf(DangBanError)

    const sau = await prisma.aiUsageDay.findFirstOrThrow({ where: { userId } })
    expect(sau.turnsReserved).toBe(truoc.turnsReserved) // đúng 1, không phải 2
  })

  it('chốt lượt đầu rồi thì xin được lượt mới', async () => {
    const dau = await giuMotLuot(0)
    if (!dau.ok) throw new Error('lượt đầu phải thành công')
    await prisma.aiTurn.update({ where: { id: dau.turnId }, data: { state: 'SUCCEEDED' } })

    const sau = await giuMotLuot(1)
    expect(sau.ok).toBe(true)
  })
})
