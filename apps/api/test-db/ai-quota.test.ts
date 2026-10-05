import { PrismaClient } from '@prisma/client'
import {
  DangBanError,
  chotLuot,
  demLuotConLai,
  donLuotMoCoi,
  giuLuot,
} from '@uniwork/ai-runtime'
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

/*
 * ===========================================================================
 * LƯỢT MỒ CÔI — KHOÁ VĨNH VIỄN NẾU KHÔNG AI DỌN
 * ===========================================================================
 * Lượt nằm ở `RESERVED` suốt lúc model chạy. Process chết giữa chừng thì hàng
 * đó đứng nguyên trong chỉ mục `ai_turns_mot_luot_dang_chay`, và MỌI lần giữ
 * lượt sau đụng chỉ mục → 409 AI_BUSY. Không tự hết, không qua ngày.
 *
 * `reservedAt` có chỉ mục từ đầu nhưng không dòng code nào đọc nó, cho tới
 * `donLuotMoCoi`. Review 2026-10-05 tìm ra lỗ này; `thu-tro-ly.ts` đã phải tự
 * `deleteMany` lượt treo mới chạy lại được — bằng chứng nó đã xảy ra thật.
 */
describe('lượt mồ côi', () => {
  /** Giữ một lượt rồi lùi `reservedAt` về quá khứ — dựng lại cảnh process chết. */
  async function luotChet(phutTruoc: number, runnerId = 'p-da-chet') {
    const kq = await prisma.$transaction((tx) => giuLuot(tx, { ...thamSo(0), runnerId }))
    if (!kq.ok) throw new Error('không giữ được lượt dựng cảnh')
    await prisma.aiTurn.update({
      where: { id: kq.turnId },
      data: { reservedAt: new Date(Date.now() - phutTruoc * 60_000) },
    })
    return kq.turnId
  }

  const truocDay = (phut: number) => new Date(Date.now() - phut * 60_000)

  /* Ca này là toàn bộ lý do của cả describe: dựng đúng triệu chứng, rồi gỡ nó. */
  it('lượt treo chặn mọi lần hỏi sau — và dọn xong thì hỏi lại được', async () => {
    await luotChet(10)
    await expect(giuMotLuot(1)).rejects.toBeInstanceOf(DangBanError)

    expect(await donLuotMoCoi(prisma, { cuHon: truocDay(5) }, 'MO_COI')).toBe(1)

    const lai = await giuMotLuot(2)
    expect(lai.ok).toBe(true)
  })

  /*
   * Hoàn chứ không phạt: process chết là lỗi của ta. Kiểm trên BỘ ĐẾM, không
   * chỉ trên trạng thái lượt — một lượt REFUNDED mà `turnsRefunded` không tăng
   * thì người dùng vẫn mất lượt, chỉ là sổ ghi đẹp.
   */
  it('lượt mồ côi được HOÀN, và bộ đếm trả lại đúng một lượt', async () => {
    const id = await luotChet(10)
    const truoc = await demLuotConLai(prisma, userId, 'CHAT')

    await donLuotMoCoi(prisma, { cuHon: truocDay(5) }, 'MO_COI')

    const luot = await prisma.aiTurn.findUniqueOrThrow({ where: { id } })
    expect(luot.state).toBe('REFUNDED')
    expect(luot.errorCode).toBe('MO_COI')
    expect((await demLuotConLai(prisma, userId, 'CHAT')).conLai).toBe(truoc.conLai + 1)
  })

  /* Lượt CÒN TRẺ có thể đang chạy thật — dọn nhầm nó là hoàn một lượt đã tiêu token. */
  it('KHÔNG đụng lượt còn trẻ hơn ngưỡng', async () => {
    const id = await luotChet(1)

    expect(await donLuotMoCoi(prisma, { cuHon: truocDay(5) }, 'MO_COI')).toBe(0)
    expect((await prisma.aiTurn.findUniqueOrThrow({ where: { id } })).state).toBe('RESERVED')
  })

  /*
   * Luật 17: process sắp tắt chỉ dọn lượt CỦA MÌNH. Lúc có hai instance API,
   * lượt của instance kia đang chạy thật — dọn theo "mọi runner khác" là cắt
   * ngang nó.
   */
  it('dọn theo runnerId chỉ đụng lượt của đúng runner đó', async () => {
    const cuaToi = await luotChet(0, 'api-toi')

    const khac = await prisma.user.upsert({
      where: { email: 'quota-test-khac@test.local' },
      update: {},
      create: { email: 'quota-test-khac@test.local', role: 'STUDENT', passwordHash: null },
      select: { id: true },
    })
    await prisma.aiTurn.deleteMany({ where: { userId: khac.id } })
    await prisma.aiUsageDay.deleteMany({ where: { userId: khac.id } })
    const kqKhac = await prisma.$transaction((tx) =>
      giuLuot(tx, { ...thamSo(0), userId: khac.id, runnerId: 'api-khac' }),
    )
    if (!kqKhac.ok) throw new Error('không giữ được lượt của runner khác')

    expect(await donLuotMoCoi(prisma, { runnerId: 'api-toi' }, 'TAT_SERVER')).toBe(1)
    expect((await prisma.aiTurn.findUniqueOrThrow({ where: { id: cuaToi } })).state).toBe(
      'REFUNDED',
    )
    expect(
      (await prisma.aiTurn.findUniqueOrThrow({ where: { id: kqKhac.turnId } })).state,
    ).toBe('RESERVED')

    await prisma.aiTurn.deleteMany({ where: { userId: khac.id } })
    await prisma.aiUsageDay.deleteMany({ where: { userId: khac.id } })
  })

  /*
   * =====================================================================
   * CA ĐUA — SWEEPER VÀ PROCESS ĐANG CHỐT CÙNG MỘT LƯỢT
   * =====================================================================
   * Sweeper đọc thấy lượt `RESERVED`, đúng lúc process sống chốt nó. Cả
   * `hoanLuot` lẫn `chotLuot` ghi có điều kiện `state: 'RESERVED'`, nên đúng
   * MỘT bên thắng. Bên thua là sweeper thì nó phải im lặng bỏ qua — không ném,
   * và quan trọng hơn: bộ đếm không bị cộng cả `turnsUsed` lẫn `turnsRefunded`.
   */
  it('sweeper đua với chotLuot: đúng một bên thắng, bộ đếm không cộng đôi', async () => {
    for (let lan = 0; lan < 5; lan += 1) {
      await prisma.aiTurn.deleteMany({ where: { userId } })
      await prisma.aiUsageDay.deleteMany({ where: { userId } })
      const id = await luotChet(10)

      const kq = await Promise.allSettled([
        donLuotMoCoi(prisma, { cuHon: truocDay(5) }, 'MO_COI'),
        chotLuot(prisma, { turnId: id, state: 'SUCCEEDED' }),
      ])

      /* Sweeper KHÔNG BAO GIỜ được ném vì thua cuộc đua. */
      expect(kq[0]!.status, `lần ${lan}`).toBe('fulfilled')

      const ngay = await prisma.aiUsageDay.findFirstOrThrow({ where: { userId } })
      expect(ngay.turnsUsed + ngay.turnsRefunded, `lần ${lan}`).toBe(1)
    }
  })

  /*
   * Chỉ mục tách theo tính năng: lượt CHAT đang chạy không chặn quét CV. Hai
   * tính năng có hạn mức riêng, chạy bằng đường riêng — không có lý do gì để
   * dùng chung một ổ khoá.
   */
  it('lượt CHAT đang chạy KHÔNG chặn lượt CV_SCAN', async () => {
    await luotChet(0)
    const scan = await prisma.$transaction((tx) =>
      giuLuot(tx, { ...thamSo(1), feature: 'CV_SCAN' }),
    )
    expect(scan.ok).toBe(true)
  })
})
