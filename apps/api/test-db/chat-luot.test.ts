import { PrismaClient } from '@prisma/client'
import {
  APICallError,
  _datLaiMach,
  aiConfig,
  chotLuot,
  ghiLoi,
  hoanLuot,
  ngayVN,
} from '@uniwork/ai-runtime'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/lib/errors.js'
import { batDauLuot, ghiTraLoi, layLichSu, moLuong } from '../src/modules/chat/chat.service.js'

/**
 * Một lượt hỏi trợ lý — chạy trên PostgreSQL THẬT.
 *
 * VÌ SAO KHÔNG NẰM Ở LÀN `vitest` THƯỜNG:
 *
 * Mọi khẳng định trong file này là về TÍNH NGUYÊN TỬ, và mock Prisma không có
 * khái niệm đó. Mock sẽ trả về đúng thứ ta bảo nó trả, nên test vẫn xanh kể cả
 * khi transaction bị bỏ hẳn, khi chỉ mục một phần không tồn tại, hay khi câu
 * UPDATE có điều kiện thiếu mất mệnh đề WHERE.
 *
 * Bốn thứ chỉ database mới biết:
 *   1. `prisma.$transaction` rollback cả ba việc khi một việc hỏng
 *   2. chỉ mục UNIQUE MỘT PHẦN `ai_turns_mot_luot_dang_chay`
 *   3. `@@unique([sessionId, clientMessageId])` — chống gửi trùng
 *   4. `UPDATE ... WHERE state = 'AI_ACTIVE' AND activeAiRunId = $id` trả 0 hàng
 *
 * Chạy: pnpm --filter @uniwork/api test:db
 */

const prisma = new PrismaClient()
const TRAN = aiConfig.chatTurnsPerDay
const NGAY = new Date(`${ngayVN()}T00:00:00.000Z`)

let userId: string
let sessionId: string


/*
 * Vô hiệu lượt AI đang chạy — ĐÚNG như mọi chuyển đổi thật sẽ làm.
 *
 * ===========================================================================
 * KHÔNG CÒN CÁCH "ĐỔI TRẠNG THÁI PHIÊN" ĐỂ HUỶ LƯỢT
 * ===========================================================================
 * Bản trước chuyển chính luồng trợ lý sang `WAITING_EMPLOYER` để dựng cảnh
 * "câu trả lời tới muộn". Giờ luồng trợ lý không rời `AI_ACTIVE` được nữa —
 * CHECK `chat_trang_thai_theo_kenh` cấm, và đó là điều làm nó vĩnh viễn.
 *
 * Cơ chế chặn câu trả lời muộn thì KHÔNG đổi: `ghiTraLoi` đòi `activeAiRunId`
 * khớp. Nên test dựng cảnh bằng chính cái cờ ấy, không đi vòng qua `state`.
 */
async function voHieuLuot() {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { activeAiRunId: null },
  })
}

async function dungDuLieu() {
  const u = await prisma.user.upsert({
    where: { email: 'chat-luot@test.local' },
    update: {},
    create: { email: 'chat-luot@test.local', role: 'STUDENT', passwordHash: null },
    select: { id: true },
  })
  const hs = await prisma.studentProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: { userId: u.id, fullName: 'Người Thử Nghiệm' },
    select: { id: true },
  })
  /*
   * Dọn MỌI luồng phụ của tài khoản này, trước khi dựng luồng chính.
   *
   * Ca kiểm luồng hỗ trợ tạo rồi xoá luồng của nó ở dòng cuối. Ca đó đỏ thì
   * dòng xoá không chạy, luồng ở lại, và lần chạy sau đụng chỉ mục
   * `chat_mot_luong_ho_tro` ngay ở bước tạo — lỗi hiện ra ở chỗ không liên
   * quan gì tới thứ đang hỏng. Đã dính đúng cảnh này ở đây, và hai lần trước ở
   * `chat-handoff` / `chat-ho-tro`.
   */
  const phu = await prisma.chatSession.findMany({
    where: { ownerUserId: u.id, clientSessionId: { not: 'cs-chat-luot' } },
    select: { id: true },
  })
  if (phu.length > 0) {
    const ids = phu.map((x) => x.id)
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.chatSession.deleteMany({ where: { id: { in: ids } } })
  }

  const p = await prisma.chatSession.upsert({
    where: { ownerUserId_clientSessionId: { ownerUserId: u.id, clientSessionId: 'cs-chat-luot' } },
    update: {
      state: 'AI_ACTIVE',
      messageSeq: 0,
      activeAiRunId: null,
      employerVisibleFromSeq: null,
      handoffEmployerProfileId: null,
      jobId: null,
    },
    create: {
      kind: 'AI_STUDENT',
      ownerUserId: u.id,
      clientSessionId: 'cs-chat-luot',
      studentProfileId: hs.id,
    },
    select: { id: true },
  })
  return { userId: u.id, sessionId: p.id }
}

const hoi = (clientMessageId: string, noiDung = 'có việc pha chế không') =>
  batDauLuot({ userId, role: 'STUDENT', sessionId, clientMessageId, noiDung, runnerId: 'p-test' })

const demTin = () => prisma.chatMessage.count({ where: { sessionId } })
const layNgay = () =>
  prisma.aiUsageDay.findUnique({
    where: { userId_day_feature: { userId, day: NGAY, feature: 'CHAT' } },
    select: { turnsReserved: true, turnsUsed: true, turnsRefunded: true },
  })

async function don() {
  await prisma.chatMessage.deleteMany({ where: { sessionId } })
  await prisma.chatSession.updateMany({
    where: { id: sessionId },
    data: {
      state: 'AI_ACTIVE',
      messageSeq: 0,
      activeAiRunId: null,
      employerVisibleFromSeq: null,
      handoffEmployerProfileId: null,
      jobId: null,
    },
  })
  await prisma.aiTurn.deleteMany({ where: { userId } })
  await prisma.aiUsageDay.deleteMany({ where: { userId } })
}

beforeEach(async () => {
  ;({ userId, sessionId } = await dungDuLieu())
  await don()
})

afterAll(async () => {
  await don()
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('batDauLuot — ba việc, một transaction', () => {
  it('giữ lượt, tạo AiTurn RESERVED và ghi câu hỏi ở seq 1', async () => {
    const kq = await hoi('cm-1')
    expect(kq).toMatchObject({ loai: 'moi', seqCauHoi: 1, conLai: TRAN - 1 })

    const turn = await prisma.aiTurn.findFirstOrThrow({ where: { userId } })
    expect(turn.state).toBe('RESERVED')
    expect(turn.sessionId).toBe(sessionId)

    const tin = await prisma.chatMessage.findFirstOrThrow({ where: { sessionId } })
    expect(tin).toMatchObject({ seq: 1, senderType: 'STUDENT', clientMessageId: 'cm-1' })
  })

  it('đặt activeAiRunId bằng đúng lượt vừa giữ', async () => {
    const kq = await hoi('cm-1')
    const p = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(p.activeAiRunId).toBe(kq.loai === 'moi' ? kq.turnId : null)
  })

  /*
   * ---------------------------------------------------------------------
   * CA QUAN TRỌNG NHẤT FILE NÀY
   * ---------------------------------------------------------------------
   * Người dùng mở hai tab. Tab thứ hai nhận AI_BUSY — một lỗi hoàn toàn vô hại.
   * Nếu ba việc không chung một transaction thì bộ đếm ĐÃ CỘNG trước khi
   * `INSERT AiTurn` đụng chỉ mục một phần, và lượt đó mất luôn. Lặp năm lần là
   * hết quota mà chưa hỏi được câu nào.
   */
  it('lượt thứ hai khi lượt một chưa xong → AI_BUSY, và KHÔNG mất lượt', async () => {
    await hoi('cm-1')
    const truoc = await layNgay()

    await expect(hoi('cm-2')).rejects.toMatchObject({ code: 'AI_BUSY', status: 409 })

    expect(await layNgay()).toEqual(truoc)
    expect(await demTin()).toBe(1)
  })

  it('hết lượt trong ngày → AI_QUOTA_EXCEEDED, không ghi tin nào', async () => {
    await prisma.aiUsageDay.create({
      data: { userId, day: NGAY, feature: 'CHAT', turnsReserved: TRAN, turnsUsed: TRAN },
    })

    await expect(hoi('cm-1')).rejects.toMatchObject({ code: 'AI_QUOTA_EXCEEDED', status: 429 })
    expect(await demTin()).toBe(0)
    expect(await prisma.aiTurn.count({ where: { userId } })).toBe(0)
  })

  it('lỗi hết lượt là AppError, không phải lỗi Prisma lọt ra ngoài', async () => {
    await prisma.aiUsageDay.create({
      data: { userId, day: NGAY, feature: 'CHAT', turnsReserved: TRAN },
    })
    await expect(hoi('cm-1')).rejects.toBeInstanceOf(AppError)
  })

  /*
   * Mạng chập chờn, trình duyệt gửi lại cùng một tin. Đây KHÔNG phải lỗi: trả
   * câu trả lời đã có. Gọi model lần hai là tính tiền hai lần cho một câu hỏi,
   * và tệ hơn — trả ra một câu trả lời KHÁC cho cùng một tin nhắn.
   */
  it('gửi lại cùng clientMessageId → trả lời cũ, không tin thứ hai, không trừ lượt', async () => {
    const dau = await hoi('cm-1')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')
    await ghiTraLoi(sessionId, dau.turnId, 'Mình tìm được 3 tin.')
    await chotLuot(prisma, { turnId: dau.turnId, state: 'SUCCEEDED' })
    const truoc = await layNgay()

    const lai = await hoi('cm-1')

    expect(lai).toEqual({ loai: 'gui-lai', traLoiCu: 'Mình tìm được 3 tin.' })
    expect(await demTin()).toBe(2)
    expect(await layNgay()).toEqual(truoc)
  })

  /*
   * THỨ TỰ HAI KHOÁ, và nó không hiển nhiên.
   *
   * `giuLuot` chạy TRƯỚC khi ghi tin, nên khi lượt đầu còn dang dở thì chỉ mục
   * một phần bắn trước và người gửi lại nhận AI_BUSY chứ KHÔNG nhận câu trả lời
   * cũ. Đúng: lúc đó chưa có câu trả lời nào để trả.
   *
   * Hệ quả cho phía web: gặp AI_BUSY thì chờ rồi thử lại, đừng đổi
   * `clientMessageId` — đổi id là mất đường nhận lại câu trả lời cũ và sẽ tốn
   * thêm một lượt thật.
   */
  it('gửi lại khi lượt đầu CHƯA chốt thì nhận AI_BUSY, không phải trả lời cũ', async () => {
    await hoi('cm-1')
    await expect(hoi('cm-1')).rejects.toMatchObject({ code: 'AI_BUSY' })
  })

  /*
   * =======================================================================
   * LUỒNG KHÔNG CÓ TRỢ LÝ BỊ TỪ CHỐI — VÀ KHÔNG TỐN LƯỢT NÀO
   * =======================================================================
   * Review 2026-10-05: `batDauLuot` từng chỉ kiểm `state`, không kiểm `kind`.
   * Một luồng `AI_SUPPORT` chưa xin hỗ trợ đang ở `AI_ACTIVE`, nên gọi
   * `/tro-ly/hoi` với nó là có AI trả lời ngay trong kênh hỗ trợ — trái thẳng
   * thiết kế. Lớp chặn duy nhất khi đó là tool tự từ chối, sau khi đã giữ lượt
   * và đã gọi model.
   *
   * Hai khẳng định: bị từ chối, VÀ không có `AiTurn` nào được ghi lại.
   *
   * Vế thứ hai canh việc cổng chặn trượt RA KHỎI `batDauLuot` — về `chayLuot`
   * hay về tool như bản cũ. Ở đó transaction giữ lượt đã commit, nên lượt bị
   * trừ thật dù yêu cầu bị từ chối.
   *
   * Nó KHÔNG canh việc đổi chỗ cổng chặn bên trong cùng transaction: đặt sau
   * `giuLuot` thì rollback vẫn trả lượt lại, và vế này vẫn xanh. Ban đầu tôi
   * viết sai ở đây — đột biến "dời cổng xuống sau giuLuot" chỉ làm đỏ một ca,
   * vì đúng lý do đó.
   *
   * Dựng cả hai trạng thái của luồng hỗ trợ: `AI_ACTIVE` là đúng cái lỗ, còn
   * `WAITING_ADMIN` canh cổng chặn đứng TRƯỚC kiểm tra trạng thái — đổi thứ tự
   * thì luồng đó nhận 409 thay vì 400, và ca này đỏ.
   */
  it.each(['AI_ACTIVE', 'WAITING_ADMIN'] as const)(
    'luồng hỗ trợ (%s) không chạy được trợ lý, và không giữ lượt',
    async (state) => {
      const hoTro = await prisma.chatSession.create({
        data: {
          kind: 'AI_SUPPORT',
          ownerUserId: userId,
          clientSessionId: 'luong:ho-tro',
          state,
          handoffRequestedAt: state === 'WAITING_ADMIN' ? new Date() : null,
        },
        select: { id: true },
      })
      const truoc = await prisma.aiTurn.count({ where: { userId } })

      await expect(
        batDauLuot({
          userId,
          role: 'STUDENT',
          sessionId: hoTro.id,
          clientMessageId: 'cm-ho-tro',
          noiDung: 'x',
          runnerId: 'p-test',
        }),
      ).rejects.toMatchObject({ status: 400 })

      expect(await prisma.aiTurn.count({ where: { userId } })).toBe(truoc)
      expect(await prisma.chatMessage.count({ where: { sessionId: hoTro.id } })).toBe(0)

      await prisma.chatSession.delete({ where: { id: hoTro.id } })
    },
  )

  /*
   * Luồng `AI_EMPLOYER` hợp lệ về schema nhưng chưa có trợ lý nào. Mở được thì
   * nó nằm trong "Hội thoại của tôi" như một luồng chết. Chặn ngay lúc mở.
   */
  it('chưa có trợ lý nhà tuyển dụng thì không mở được luồng AI_EMPLOYER', async () => {
    const ntd = await prisma.user.upsert({
      where: { email: 'chat-luot-ntd-tro-ly@test.local' },
      update: {},
      create: { email: 'chat-luot-ntd-tro-ly@test.local', role: 'EMPLOYER', passwordHash: null },
      select: { id: true },
    })

    await expect(moLuong(ntd.id, 'EMPLOYER', 'AI_EMPLOYER')).rejects.toMatchObject({ status: 400 })
    expect(await prisma.chatSession.count({ where: { ownerUserId: ntd.id } })).toBe(0)
  })

  /*
   * Mạch ngắt mở = nhà cung cấp đang lỗi liên tiếp. Từ chối NGAY — trước khi
   * giữ lượt. Cho đi tiếp thì người dùng giữ một lượt, chờ một vòng gọi model,
   * nhận lỗi, rồi mới được hoàn: tốn thời gian của họ và tốn ngân sách chung
   * để có đúng câu trả lời ta đã biết trước.
   *
   * Khẳng định trên số `AiTurn`, không chỉ trên mã lỗi: mã 503 đúng mà vẫn ghi
   * lượt thì đó là chặn SAU khi giữ lượt, đúng thứ cần tránh.
   */
  it('mạch ngắt mở thì từ chối 503 và KHÔNG giữ lượt nào', async () => {
    const loi = new APICallError({
      message: 'Resource has been exhausted',
      url: 'https://generativelanguage.googleapis.com',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    })
    for (let i = 0; i < aiConfig.circuitFailures; i += 1) ghiLoi(loi, false)

    try {
      const truoc = await prisma.aiTurn.count({ where: { userId } })
      await expect(hoi('cm-mach-mo')).rejects.toMatchObject({
        code: 'AI_UNAVAILABLE',
        status: 503,
      })
      expect(await prisma.aiTurn.count({ where: { userId } })).toBe(truoc)
    } finally {
      _datLaiMach()
    }
  })

  it('người khác không mở được phiên của mình, và nhận 404 chứ không 403', async () => {
    await expect(
      batDauLuot({
        userId: 'user-khong-ton-tai',
        role: 'STUDENT',
        sessionId,
        clientMessageId: 'cm-1',
        noiDung: 'x',
        runnerId: 'p-test',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })
})

describe('ghiTraLoi — ghi CÓ ĐIỀU KIỆN', () => {
  it('ghi bình thường ở seq kế tiếp và xoá cờ đang chạy', async () => {
    const dau = await hoi('cm-1')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')

    expect(await ghiTraLoi(sessionId, dau.turnId, 'Có 3 tin bạn nhé')).toEqual({ ghi: true, seq: 2 })

    const p = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(p.activeAiRunId).toBeNull()
    expect(p.messageSeq).toBe(2)
  })

  /*
   * Người dùng bấm "nhắn nhà tuyển dụng" giữa lúc model đang viết. Lớp chủ động
   * (abort) có thể lỡ — message tới trễ, hoặc stream sắp xong. Lớp này là lớp
   * CHẮC CHẮN ĐÚNG, và nó phải đứng một mình được.
   */
  it('lượt bị vô hiệu giữa chừng → BỎ câu trả lời', async () => {
    const dau = await hoi('cm-1')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')
    await voHieuLuot()

    expect(await ghiTraLoi(sessionId, dau.turnId, 'câu trả lời muộn')).toEqual({ ghi: false })
    expect(await demTin()).toBe(1)
  })

  it('lượt khác đang chạy → BỎ câu trả lời của lượt cũ', async () => {
    await hoi('cm-1')
    expect(await ghiTraLoi(sessionId, 'turn-cu-nao-do', 'câu trả lời lạc')).toEqual({ ghi: false })
    expect(await demTin()).toBe(1)
  })

  it('không tăng messageSeq khi bỏ câu trả lời', async () => {
    const dau = await hoi('cm-1')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')
    await voHieuLuot()
    await ghiTraLoi(sessionId, dau.turnId, 'muộn')
    const p = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(p.messageSeq).toBe(1)
  })
})

describe('chốt và hoàn lượt', () => {
  it('chốt SUCCEEDED thì cộng turnsUsed, không cộng turnsRefunded', async () => {
    const dau = await hoi('cm-1')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')

    await chotLuot(prisma, { turnId: dau.turnId, state: 'SUCCEEDED', inputTokens: 120, outputTokens: 80 })

    expect(await layNgay()).toMatchObject({ turnsReserved: 1, turnsUsed: 1, turnsRefunded: 0 })
    const t = await prisma.aiTurn.findUniqueOrThrow({ where: { id: dau.turnId } })
    expect(t).toMatchObject({ state: 'SUCCEEDED', inputTokens: 120, outputTokens: 80 })
    expect(t.settledAt).not.toBeNull()
  })

  it('chốt rồi thì hỏi tiếp được ngay — chỉ mục một phần đã nhả', async () => {
    const dau = await hoi('cm-1')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')
    await chotLuot(prisma, { turnId: dau.turnId, state: 'SUCCEEDED' })
    await ghiTraLoi(sessionId, dau.turnId, 'xong')

    await expect(hoi('cm-2')).resolves.toMatchObject({ loai: 'moi' })
  })

  it('hoàn lượt thì lượt đó dùng lại được', async () => {
    await prisma.aiUsageDay.create({
      data: { userId, day: NGAY, feature: 'CHAT', turnsReserved: TRAN },
    })
    const t = await prisma.aiTurn.create({
      data: {
        userId,
        feature: 'CHAT',
        runnerId: 'p-test',
        quotaDay: NGAY,
        modelId: 'm',
        promptVersion: 'v',
      },
      select: { id: true },
    })

    await hoanLuot(prisma, t.id, 'PROVIDER_ERROR')

    expect(await layNgay()).toMatchObject({ turnsReserved: TRAN, turnsRefunded: 1 })
    await expect(hoi('cm-1')).resolves.toMatchObject({ loai: 'moi' })
  })

  /*
   * ---------------------------------------------------------------------
   * LƯỢT GIỮ LÚC 23:58, HOÀN LÚC 00:03
   * ---------------------------------------------------------------------
   * Tính theo `ngayVN(now())` là cộng turnsRefunded vào bucket NGÀY MAI — hôm
   * sau người dùng tự nhiên có sáu lượt, còn hôm nay vẫn hết. Nên phải cộng vào
   * `quotaDay` CHÉP TRONG LƯỢT.
   */
  it('hoàn vào đúng ngày đã giữ, không phải hôm nay', async () => {
    const homQua = new Date(NGAY.getTime() - 86_400_000)
    await prisma.aiUsageDay.create({
      data: { userId, day: homQua, feature: 'CHAT', turnsReserved: 3 },
    })
    const t = await prisma.aiTurn.create({
      data: {
        userId,
        feature: 'CHAT',
        runnerId: 'p-test',
        quotaDay: homQua,
        modelId: 'm',
        promptVersion: 'v',
      },
      select: { id: true },
    })

    await hoanLuot(prisma, t.id, 'PROVIDER_ERROR')

    const cu = await prisma.aiUsageDay.findUniqueOrThrow({
      where: { userId_day_feature: { userId, day: homQua, feature: 'CHAT' } },
    })
    expect(cu.turnsRefunded).toBe(1)
    expect(await layNgay()).toBeNull()
  })
})

describe('layLichSu', () => {
  it('trả theo thứ tự seq tăng dần, đúng vai user/assistant', async () => {
    const dau = await hoi('cm-1', 'câu một')
    if (dau.loai !== 'moi') throw new Error('mong đợi lượt mới')
    await ghiTraLoi(sessionId, dau.turnId, 'trả lời một')

    expect(await layLichSu(sessionId)).toEqual([
      { role: 'user', content: 'câu một' },
      { role: 'assistant', content: 'trả lời một' },
    ])
  })

  /*
   * Tin SYSTEM ("Nhà tuyển dụng đã tiếp nhận") không phải lượt nói của ai. Nhét
   * nó vào vai 'user' là để model tưởng người dùng vừa nói câu đó.
   */
  it('bỏ tin hệ thống', async () => {
    await hoi('cm-1', 'câu một')
    await prisma.chatMessage.create({
      data: { sessionId, seq: 99, senderType: 'SYSTEM', body: 'Nhà tuyển dụng đã tiếp nhận' },
    })
    const ls = await layLichSu(sessionId)
    expect(ls.map((m) => m.content)).toEqual(['câu một'])
  })

  it('chỉ lấy cửa sổ gần nhất, không gửi cả hội thoại', async () => {
    const n = aiConfig.historyMessages
    await prisma.chatMessage.createMany({
      data: Array.from({ length: n + 5 }, (_, i) => ({
        sessionId,
        seq: i + 1,
        senderType: 'STUDENT' as const,
        body: `tin ${i + 1}`,
      })),
    })
    const ls = await layLichSu(sessionId)
    expect(ls).toHaveLength(n)
    expect(ls[0]!.content).toBe('tin 6')
    expect(ls.at(-1)!.content).toBe(`tin ${n + 5}`)
  })
})
