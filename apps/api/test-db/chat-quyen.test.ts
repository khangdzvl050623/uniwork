import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { quyenTruyCapPhien } from '../src/modules/chat/chat.access.js'
import { guiTinNhan, layTinNhan } from '../src/modules/chat/chat.service.js'
import { moCursor } from '../src/modules/chat/cursor.js'

/**
 * Phân quyền luồng và tải bù bằng cursor — PostgreSQL thật.
 *
 * ===========================================================================
 * SAU KHI TÁCH LUỒNG, PHÂN QUYỀN ĐƠN GIẢN HẲN — VÀ ĐÓ LÀ ĐIỀU ĐÁNG CANH
 * ===========================================================================
 * Không còn `docTuSeq` và `chiTinChiaSe`. Ai vào được luồng thì đọc trọn luồng,
 * vì một luồng chỉ chứa trao đổi với ĐÚNG một đối tượng.
 *
 * Nên thứ phải canh chuyển từ "cắt đúng chỗ chưa" sang "vào đúng luồng chưa".
 * Cái sau mạnh hơn: cắt sai là rò vài câu, vào sai luồng là rò cả cuộc trò
 * chuyện — nhưng nó cũng dễ canh hơn nhiều, vì chỉ có một câu hỏi.
 *
 * Chạy: pnpm --filter @uniwork/api test:db
 */

const prisma = new PrismaClient()

let sv: { id: string; role: 'STUDENT' }
let ntd: { id: string; role: 'EMPLOYER' }
let ngoai: { id: string; role: 'EMPLOYER' }
let quan: { id: string; role: 'ADMIN' }
let employerProfileId: string
let jobId: string
/** Luồng trợ lý của sinh viên. */
let luongAi: string
/** Luồng với nhà tuyển dụng `ntd`. */
let luongNTD: string

async function taoUser(email: string, role: 'STUDENT' | 'EMPLOYER' | 'ADMIN') {
  const u = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role, passwordHash: null },
    select: { id: true },
  })
  return { id: u.id, role }
}

async function dungDuLieu() {
  sv = (await taoUser('quyen-sv@test.local', 'STUDENT')) as typeof sv
  ntd = (await taoUser('quyen-ntd@test.local', 'EMPLOYER')) as typeof ntd
  ngoai = (await taoUser('quyen-ntd-khac@test.local', 'EMPLOYER')) as typeof ngoai
  quan = (await taoUser('quyen-admin@test.local', 'ADMIN')) as typeof quan

  const hsSv = await prisma.studentProfile.upsert({
    where: { userId: sv.id },
    update: {},
    create: { userId: sv.id, fullName: 'Sinh Viên Thử' },
    select: { id: true },
  })
  const hsNtd = await prisma.employerProfile.upsert({
    where: { userId: ntd.id },
    update: {},
    create: { userId: ntd.id, companyName: 'Quán Quyền' },
    select: { id: true },
  })
  await prisma.employerProfile.upsert({
    where: { userId: ngoai.id },
    update: {},
    create: { userId: ngoai.id, companyName: 'Quán Ngoài' },
    select: { id: true },
  })
  employerProfileId = hsNtd.id

  const j =
    (await prisma.job.findFirst({ where: { employerProfileId }, select: { id: true } })) ??
    (await prisma.job.create({
      data: {
        employerProfileId,
        title: 'Tin cho test quyền',
        description: 'x',
        city: 'Hà Nội',
        district: 'Cầu Giấy',
        salaryUnit: 'HOUR',
        // CHECK `jobs_salary_check` của Sprint 2: hoặc thoả thuận, hoặc có đủ
        // min/max. Không có cửa thứ ba.
        salaryNegotiable: true,
        scheduleType: 'RECURRING',
        deadline: new Date(Date.now() + 30 * 86_400_000),
        status: 'DRAFT',
      },
      select: { id: true },
    }))
  jobId = j.id

  /* Dọn mọi luồng của sinh viên — chỉ mục khoá theo người, không theo khoá chuỗi. */
  const cu = await prisma.chatSession.findMany({
    where: { ownerUserId: sv.id },
    select: { id: true },
  })
  if (cu.length > 0) {
    const ids = cu.map((c) => c.id)
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.chatSession.deleteMany({ where: { id: { in: ids } } })
  }

  luongAi = (
    await prisma.chatSession.create({
      data: {
        kind: 'AI_STUDENT',
        ownerUserId: sv.id,
        clientSessionId: 'luong:tro-ly',
        studentProfileId: hsSv.id,
      },
      select: { id: true },
    })
  ).id

  luongNTD = (
    await prisma.chatSession.create({
      data: {
        kind: 'NTD',
        ownerUserId: sv.id,
        clientSessionId: `luong:ntd:${employerProfileId}`,
        studentProfileId: hsSv.id,
        handoffEmployerProfileId: employerProfileId,
        jobId,
        state: 'WAITING_EMPLOYER',
        handoffRequestedAt: new Date(),
      },
      select: { id: true },
    })
  ).id
}

/** Nhồi tin thẳng vào database — nhanh hơn và dựng được đúng hình dạng cần. */
async function nhoiTin(
  sessionId: string,
  ds: { senderType: 'STUDENT' | 'EMPLOYER' | 'AI'; body: string }[],
) {
  const bd = await prisma.chatSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { messageSeq: true },
  })
  await prisma.chatMessage.createMany({
    data: ds.map((t, i) => ({
      sessionId,
      seq: bd.messageSeq + i + 1,
      senderType: t.senderType,
      body: t.body,
    })),
  })
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { messageSeq: bd.messageSeq + ds.length },
  })
}

const datTrangThai = (id: string, state: 'WAITING_EMPLOYER' | 'HUMAN_ACTIVE' | 'CLOSED') =>
  prisma.chatSession.update({ where: { id }, data: { state } })

beforeEach(dungDuLieu)

afterAll(async () => {
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('quyenTruyCapPhien', () => {
  it('chủ luồng vào phòng của chủ', async () => {
    const q = await quyenTruyCapPhien(sv, luongAi)
    expect(q?.vai).toBe('CHU')
    expect(q?.phong).toBe(`hoi-thoai:${luongAi}:chu`)
  })

  /*
   * =====================================================================
   * NHÀ TUYỂN DỤNG KHÔNG VỚI ĐƯỢC VÀO LUỒNG TRỢ LÝ — DÙ LÀ LUỒNG CỦA
   * CHÍNH SINH VIÊN ĐANG NÓI CHUYỆN VỚI HỌ
   * =====================================================================
   * Đây là ca thay thế cho cả bộ `docTuSeq` / `chiTinChiaSe` cũ. Trước kia
   * hai cuộc trò chuyện nằm chung một hàng nên phải cắt; giờ chúng là hai
   * hàng, và câu hỏi rút về đúng một: có vào được hàng kia không.
   */
  it('NTD KHÔNG đọc được luồng trợ lý của sinh viên', async () => {
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')
    expect(await quyenTruyCapPhien(ntd, luongAi)).toBeNull()
  })

  it('NTD đọc được luồng của chính mình, từ seq 1', async () => {
    const q = await quyenTruyCapPhien(ntd, luongNTD)
    expect(q?.vai).toBe('NTD_NHAN_HANDOFF')
    expect(q?.phong).toBe(`hoi-thoai:${luongNTD}:ntd`)
  })

  it('NTD KHÁC không đọc được, dù cũng là vai EMPLOYER', async () => {
    expect(await quyenTruyCapPhien(ngoai, luongNTD)).toBeNull()
  })

  /*
   * Hội thoại với nhà tuyển dụng là trao đổi riêng giữa hai người. Admin chỉ
   * đọc được kênh HỖ TRỢ, nơi người dùng chủ động mở ra để xin giúp.
   */
  it('ADMIN cũng không đọc được luồng NTD lẫn luồng trợ lý', async () => {
    expect(await quyenTruyCapPhien(quan, luongNTD)).toBeNull()
    expect(await quyenTruyCapPhien(quan, luongAi)).toBeNull()
  })

  it('luồng không tồn tại trả null, không ném', async () => {
    expect(await quyenTruyCapPhien(sv, 'khong-co-that')).toBeNull()
  })

  /*
   * ---------------------------------------------------------------------
   * ĐỌC VÀ GỬI LÀ HAI CÂU HỎI, KHÔNG PHẢI MỘT
   * ---------------------------------------------------------------------
   * Luồng đóng lại thì nhà tuyển dụng vẫn phải mở xem lại được — lịch sử
   * không biến mất. Nhưng họ không gửi thêm được vào đó.
   *
   * Gộp hai câu hỏi vào một cờ là chỗ bản thiết kế đầu tự mâu thuẫn.
   */
  it('luồng đã đóng: NTD vẫn ĐỌC được, nhưng không GỬI được', async () => {
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')
    expect((await quyenTruyCapPhien(ntd, luongNTD))?.duocGui).toBe(true)

    await datTrangThai(luongNTD, 'CLOSED')
    const q = await quyenTruyCapPhien(ntd, luongNTD)
    expect(q?.vai).toBe('NTD_NHAN_HANDOFF')
    expect(q?.duocGui).toBe(false)
  })

  /* Luồng trợ lý KHÔNG BAO GIỜ cho gửi qua socket — chữ đi bằng SSE. */
  it('luồng trợ lý không bao giờ cho gửi tin người', async () => {
    expect((await quyenTruyCapPhien(sv, luongAi))?.duocGui).toBe(false)
  })

  it('chủ luồng NTD cũng chỉ gửi được khi HUMAN_ACTIVE', async () => {
    expect((await quyenTruyCapPhien(sv, luongNTD))?.duocGui).toBe(false)
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')
    expect((await quyenTruyCapPhien(sv, luongNTD))?.duocGui).toBe(true)
  })
})

describe('layTinNhan — cursor', () => {
  it('chủ luồng thấy đủ mọi tin', async () => {
    await nhoiTin(luongAi, [
      { senderType: 'STUDENT', body: 'hỏi AI' },
      { senderType: 'AI', body: 'AI trả lời' },
    ])
    const bu = await layTinNhan(sv, luongAi)
    expect(bu.tinNhan.map((t) => t.body)).toEqual(['hỏi AI', 'AI trả lời'])
  })

  /*
   * =====================================================================
   * NTD ĐỌC TRỌN LUỒNG — KHÔNG CÒN DÃY seq THỦNG LỖ
   * =====================================================================
   * Bản trước một hàng chứa cả đoạn hỏi AI riêng lẫn đoạn nhắn NTD, nên màn
   * hình nhà tuyển dụng nhận seq 3, rồi 6 — và từ con số đó client không
   * phân biệt được "4,5 riêng tư" với "4,5 rớt mạng".
   *
   * Giờ luồng NTD chỉ chứa trao đổi giữa hai người, nên dãy seq LIỀN. Đó là
   * một tính chất, không phải chuyện tình cờ: nó đáng được khẳng định.
   */
  it('NTD thấy trọn luồng, dãy seq liền không thủng lỗ', async () => {
    await nhoiTin(luongNTD, [
      { senderType: 'STUDENT', body: 'chào anh' },
      { senderType: 'EMPLOYER', body: 'chào em' },
      { senderType: 'STUDENT', body: 'em hỏi thêm ạ' },
    ])

    const bu = await layTinNhan(ntd, luongNTD)
    expect(bu.tinNhan.map((t) => t.body)).toEqual(['chào anh', 'chào em', 'em hỏi thêm ạ'])
    expect(bu.tinNhan.map((t) => t.seq)).toEqual([1, 2, 3])
  })

  /*
   * Đoạn sinh viên hỏi riêng trợ lý nằm ở luồng KHÁC, nên không có cách nào
   * lọt vào đây. Ca này canh chính điều đó bằng dữ liệu thật ở cả hai luồng.
   */
  it('tin ở luồng trợ lý không lọt sang luồng NTD', async () => {
    await nhoiTin(luongAi, [{ senderType: 'STUDENT', body: 'bí mật của em' }])
    await nhoiTin(luongNTD, [{ senderType: 'STUDENT', body: 'chào anh' }])

    const bu = await layTinNhan(ntd, luongNTD)
    expect(bu.tinNhan.map((t) => t.body)).toEqual(['chào anh'])
    expect(JSON.stringify(bu)).not.toContain('bí mật')
  })

  it('cursor không bao giờ lùi, kể cả khi gọi lại ngay', async () => {
    await nhoiTin(luongAi, [{ senderType: 'STUDENT', body: 'a' }])
    const lan1 = await layTinNhan(sv, luongAi)
    const lan2 = await layTinNhan(sv, luongAi, lan1.cursor)
    expect(moCursor(lan2.cursor)).toBeGreaterThanOrEqual(moCursor(lan1.cursor))
    expect(lan2.tinNhan).toEqual([])
  })

  it('cursor rác thì tải lại từ đầu, không ném', async () => {
    await nhoiTin(luongAi, [{ senderType: 'STUDENT', body: 'a' }])
    const bu = await layTinNhan(sv, luongAi, 'rác!!!')
    expect(bu.tinNhan).toHaveLength(1)
  })

  it('người ngoài nhận 404', async () => {
    await expect(layTinNhan(ngoai, luongNTD)).rejects.toMatchObject({ status: 404 })
  })
})

describe('guiTinNhan', () => {
  it('chưa HUMAN_ACTIVE thì không gửi được', async () => {
    await expect(guiTinNhan(sv, luongNTD, 'cm-0123456789', 'chào')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('HUMAN_ACTIVE thì ghi tin ở seq kế tiếp', async () => {
    await nhoiTin(luongNTD, [{ senderType: 'STUDENT', body: 'a' }])
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')

    const kq = await guiTinNhan(ntd, luongNTD, 'cm-0123456789', 'anh nhận em nhé')
    expect(kq.message).toMatchObject({ seq: 2, senderType: 'EMPLOYER' })
    expect(kq.daCo).toBe(false)
  })

  it('gửi lại cùng clientMessageId → trả tin cũ, KHÔNG tạo tin thứ hai', async () => {
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')
    const lan1 = await guiTinNhan(sv, luongNTD, 'cm-0123456789', 'chào anh')
    const lan2 = await guiTinNhan(sv, luongNTD, 'cm-0123456789', 'chào anh')

    expect(lan2.daCo).toBe(true)
    expect(lan2.message.id).toBe(lan1.message.id)
    expect(await prisma.chatMessage.count({ where: { sessionId: luongNTD } })).toBe(1)
  })

  /*
   * Gửi lại KHÔNG được tăng `messageSeq`. Transaction rollback lo việc đó —
   * nhưng nếu ai đó tách phép increment ra ngoài transaction thì mỗi lần thử
   * lại sẽ đục một lỗ trong dãy seq, và lỗ đó là lỗ THẬT: không tin nào mang
   * số ấy, nên client tải bù mãi không đầy.
   */
  it('gửi lại không đục lỗ trong dãy seq', async () => {
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')
    await guiTinNhan(sv, luongNTD, 'cm-0123456789', 'chào anh')
    await guiTinNhan(sv, luongNTD, 'cm-0123456789', 'chào anh')
    await guiTinNhan(sv, luongNTD, 'cm-9876543210', 'em hỏi thêm')

    const p = await prisma.chatSession.findUniqueOrThrow({ where: { id: luongNTD } })
    expect(p.messageSeq).toBe(2)
    const seqs = await prisma.chatMessage.findMany({
      where: { sessionId: luongNTD },
      orderBy: { seq: 'asc' },
      select: { seq: true },
    })
    expect(seqs.map((t) => t.seq)).toEqual([1, 2])
  })

  it('người ngoài nhận 404 chứ không 403', async () => {
    await datTrangThai(luongNTD, 'HUMAN_ACTIVE')
    await expect(
      guiTinNhan(ngoai, luongNTD, 'cm-0123456789', 'chen vào'),
    ).rejects.toMatchObject({ status: 404 })
  })
})
