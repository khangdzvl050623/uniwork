import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { quyenTruyCapPhien } from '../src/modules/chat/chat.access.js'
import { guiTinNhan, layTinNhan } from '../src/modules/chat/chat.service.js'
import { moCursor } from '../src/modules/chat/cursor.js'

/**
 * Phân quyền hội thoại và tải bù bằng cursor — PostgreSQL thật.
 *
 * Thứ chỉ kiểm được ở đây: dãy `seq` THỦNG LỖ của vai NTD. Mock Prisma trả về
 * đúng thứ ta bảo nó trả, nên nó không dựng lại được tình huống "khoảng trống
 * này là đúng quyền, khoảng trống kia là mất tin" — mà đó chính là lý do cursor
 * tồn tại.
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
let sessionId: string

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

  const p = await prisma.chatSession.upsert({
    where: { ownerUserId_clientSessionId: { ownerUserId: sv.id, clientSessionId: 'cs-quyen' } },
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
      ownerUserId: sv.id,
      clientSessionId: 'cs-quyen',
      studentProfileId: hsSv.id,
    },
    select: { id: true },
  })
  sessionId = p.id
  await prisma.chatMessage.deleteMany({ where: { sessionId } })
}

/** Nhồi tin thẳng vào database — nhanh hơn và dựng được đúng hình dạng cần. */
async function nhoiTin(
  ds: { senderType: 'STUDENT' | 'EMPLOYER' | 'AI'; body: string; choNTD: boolean }[],
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
      visibleToEmployer: t.choNTD,
    })),
  })
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { messageSeq: bd.messageSeq + ds.length },
  })
}

async function chuyenSangNTD(tuSeq: number, state: 'WAITING_EMPLOYER' | 'HUMAN_ACTIVE') {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      state,
      handoffEmployerProfileId: employerProfileId,
      jobId,
      employerVisibleFromSeq: tuSeq,
      handoffRequestedAt: new Date(),
    },
  })
}

beforeEach(dungDuLieu)

afterAll(async () => {
  await prisma.chatMessage.deleteMany({ where: { sessionId } })
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('quyenTruyCapPhien', () => {
  it('chủ phiên đọc từ seq 1 và thấy mọi tin', async () => {
    const q = await quyenTruyCapPhien(sv, sessionId)
    expect(q).toMatchObject({ vai: 'CHU', docTuSeq: 1, chiTinChiaSe: false })
    expect(q?.phong).toBe(`hoi-thoai:${sessionId}:chu`)
  })

  it('chưa chuyển thì NTD không có quyền gì', async () => {
    expect(await quyenTruyCapPhien(ntd, sessionId)).toBeNull()
  })

  it('đã chuyển thì NTD đọc từ mốc, và chỉ tin đã chia sẻ', async () => {
    await nhoiTin([{ senderType: 'STUDENT', body: 'a', choNTD: false }])
    await chuyenSangNTD(1, 'WAITING_EMPLOYER')

    const q = await quyenTruyCapPhien(ntd, sessionId)
    expect(q).toMatchObject({ vai: 'NTD_NHAN_HANDOFF', docTuSeq: 1, chiTinChiaSe: true })
    expect(q?.phong).toBe(`hoi-thoai:${sessionId}:ntd`)
  })

  it('NTD KHÁC không đọc được, dù cũng là vai EMPLOYER', async () => {
    await chuyenSangNTD(1, 'HUMAN_ACTIVE')
    expect(await quyenTruyCapPhien(ngoai, sessionId)).toBeNull()
  })

  /*
   * Hội thoại là trao đổi riêng giữa hai người. Không có nhu cầu nghiệp vụ nào
   * bắt admin phải đọc được, và mở cửa đó là mở vĩnh viễn.
   */
  it('ADMIN cũng không đọc được', async () => {
    await chuyenSangNTD(1, 'HUMAN_ACTIVE')
    expect(await quyenTruyCapPhien(quan, sessionId)).toBeNull()
  })

  it('phiên không tồn tại trả null, không ném', async () => {
    expect(await quyenTruyCapPhien(sv, 'khong-co-that')).toBeNull()
  })

  /*
   * ---------------------------------------------------------------------
   * ĐỌC VÀ GỬI LÀ HAI CÂU HỎI, KHÔNG PHẢI MỘT
   * ---------------------------------------------------------------------
   * Sinh viên chuyển cho NTD ở seq 10, rồi bấm "quay lại AI" và hỏi riêng. Lúc
   * đó state về AI_ACTIVE. NTD vẫn phải mở lại xem được lịch sử đã chia sẻ —
   * nhưng KHÔNG được gửi tin vào.
   *
   * Gộp hai câu hỏi vào một cờ là chỗ bản thiết kế đầu tự mâu thuẫn.
   */
  it('quay lại AI: NTD vẫn ĐỌC được, nhưng không GỬI được', async () => {
    await nhoiTin([{ senderType: 'STUDENT', body: 'a', choNTD: true }])
    await chuyenSangNTD(1, 'HUMAN_ACTIVE')
    expect((await quyenTruyCapPhien(ntd, sessionId))?.duocGui).toBe(true)

    await prisma.chatSession.update({ where: { id: sessionId }, data: { state: 'AI_ACTIVE' } })
    const q = await quyenTruyCapPhien(ntd, sessionId)
    expect(q?.vai).toBe('NTD_NHAN_HANDOFF')
    expect(q?.docTuSeq).toBe(1)
    expect(q?.duocGui).toBe(false)
  })

  it('chủ phiên cũng chỉ gửi được khi HUMAN_ACTIVE', async () => {
    expect((await quyenTruyCapPhien(sv, sessionId))?.duocGui).toBe(false)
    await chuyenSangNTD(1, 'HUMAN_ACTIVE')
    expect((await quyenTruyCapPhien(sv, sessionId))?.duocGui).toBe(true)
  })
})

describe('layTinNhan — cursor', () => {
  it('chủ phiên thấy đủ mọi tin', async () => {
    await nhoiTin([
      { senderType: 'STUDENT', body: 'hỏi AI', choNTD: false },
      { senderType: 'AI', body: 'AI trả lời', choNTD: false },
    ])
    const bu = await layTinNhan(sv, sessionId)
    expect(bu.tinNhan.map((t) => t.body)).toEqual(['hỏi AI', 'AI trả lời'])
  })

  /*
   * =====================================================================
   * KỊCH BẢN LÀ LÝ DO CURSOR TỒN TẠI
   * =====================================================================
   *   seq 1,2  hỏi AI riêng            → trước mốc, NTD không thấy
   *   seq 3    nhắn NTD                → thấy
   *   seq 4,5  quay lại hỏi AI riêng   → sau mốc nhưng riêng tư, KHÔNG thấy
   *   seq 6    nhắn NTD tiếp           → thấy
   *
   * Màn hình NTD: 3, rồi 6. Từ con số seq, client không phân biệt được
   * "4,5 là riêng tư" với "4,5 rớt mạng".
   */
  it('NTD chỉ thấy tin đã chia sẻ, từ mốc trở đi', async () => {
    await nhoiTin([
      { senderType: 'STUDENT', body: 'hỏi AI 1', choNTD: false },
      { senderType: 'AI', body: 'AI 1', choNTD: false },
      { senderType: 'STUDENT', body: 'chào anh', choNTD: true },
      { senderType: 'STUDENT', body: 'hỏi AI 2', choNTD: false },
      { senderType: 'AI', body: 'AI 2', choNTD: false },
      { senderType: 'STUDENT', body: 'em hỏi thêm ạ', choNTD: true },
    ])
    await chuyenSangNTD(3, 'HUMAN_ACTIVE')

    const bu = await layTinNhan(ntd, sessionId)
    expect(bu.tinNhan.map((t) => t.body)).toEqual(['chào anh', 'em hỏi thêm ạ'])
    expect(bu.tinNhan.map((t) => t.seq)).toEqual([3, 6])
  })

  /*
   * ---------------------------------------------------------------------
   * CURSOR TIẾN KỂ CẢ KHI TRẢ VỀ MẢNG RỖNG
   * ---------------------------------------------------------------------
   * Đây là toàn bộ điểm của cursor. Nếu nó trả seq lớn nhất ĐÃ TRẢ thay vì seq
   * lớn nhất ĐÃ XÉT, thì NTD đứng sau 5 tin riêng tư sẽ nhận rỗng kèm cursor
   * đứng yên — và gọi lại mãi đúng khoảng đó, mỗi lần một truy vấn, vĩnh viễn.
   */
  it('mảng rỗng nhưng cursor vẫn TIẾN qua các tin riêng tư', async () => {
    await nhoiTin([{ senderType: 'STUDENT', body: 'chào anh', choNTD: true }])
    await chuyenSangNTD(1, 'HUMAN_ACTIVE')

    const lan1 = await layTinNhan(ntd, sessionId)
    expect(lan1.tinNhan).toHaveLength(1)

    await nhoiTin([
      { senderType: 'STUDENT', body: 'riêng 1', choNTD: false },
      { senderType: 'AI', body: 'riêng 2', choNTD: false },
      { senderType: 'STUDENT', body: 'riêng 3', choNTD: false },
    ])

    const lan2 = await layTinNhan(ntd, sessionId, lan1.cursor)
    expect(lan2.tinNhan).toEqual([])
    expect(moCursor(lan2.cursor)).toBeGreaterThan(moCursor(lan1.cursor))
    expect(moCursor(lan2.cursor)).toBe(4)
  })

  it('cursor không bao giờ lùi, kể cả khi gọi lại ngay', async () => {
    await nhoiTin([{ senderType: 'STUDENT', body: 'a', choNTD: true }])
    const lan1 = await layTinNhan(sv, sessionId)
    const lan2 = await layTinNhan(sv, sessionId, lan1.cursor)
    expect(moCursor(lan2.cursor)).toBeGreaterThanOrEqual(moCursor(lan1.cursor))
    expect(lan2.tinNhan).toEqual([])
  })

  it('cursor rác thì tải lại từ đầu, không ném', async () => {
    await nhoiTin([{ senderType: 'STUDENT', body: 'a', choNTD: false }])
    const bu = await layTinNhan(sv, sessionId, 'rác!!!')
    expect(bu.tinNhan).toHaveLength(1)
  })

  it('người ngoài nhận 404', async () => {
    await expect(layTinNhan(ngoai, sessionId)).rejects.toMatchObject({ status: 404 })
  })
})

describe('guiTinNhan', () => {
  it('chưa HUMAN_ACTIVE thì không gửi được', async () => {
    await expect(guiTinNhan(sv, sessionId, 'cm-0123456789', 'chào')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('HUMAN_ACTIVE thì ghi tin ở seq kế tiếp, và cả hai bên thấy', async () => {
    await nhoiTin([{ senderType: 'STUDENT', body: 'a', choNTD: true }])
    await chuyenSangNTD(1, 'HUMAN_ACTIVE')

    const kq = await guiTinNhan(ntd, sessionId, 'cm-0123456789', 'anh nhận em nhé')
    expect(kq.message).toMatchObject({ seq: 2, senderType: 'EMPLOYER' })
    expect(kq.daCo).toBe(false)

    const tin = await prisma.chatMessage.findUniqueOrThrow({
      where: { sessionId_seq: { sessionId, seq: 2 } },
    })
    expect(tin.visibleToEmployer).toBe(true)
  })

  it('gửi lại cùng clientMessageId → trả tin cũ, KHÔNG tạo tin thứ hai', async () => {
    await chuyenSangNTD(0, 'HUMAN_ACTIVE')
    const lan1 = await guiTinNhan(sv, sessionId, 'cm-0123456789', 'chào anh')
    const lan2 = await guiTinNhan(sv, sessionId, 'cm-0123456789', 'chào anh')

    expect(lan2.daCo).toBe(true)
    expect(lan2.message.id).toBe(lan1.message.id)
    expect(await prisma.chatMessage.count({ where: { sessionId } })).toBe(1)
  })

  /*
   * Gửi lại KHÔNG được tăng `messageSeq`. Transaction rollback lo việc đó —
   * nhưng nếu ai đó tách phép increment ra ngoài transaction thì mỗi lần thử
   * lại sẽ đục một lỗ trong dãy seq, và lỗ đó là lỗ THẬT (không tin nào mang
   * số ấy), khác hẳn lỗ do quyền xem.
   */
  it('gửi lại không đục lỗ trong dãy seq', async () => {
    await chuyenSangNTD(0, 'HUMAN_ACTIVE')
    await guiTinNhan(sv, sessionId, 'cm-0123456789', 'chào anh')
    await guiTinNhan(sv, sessionId, 'cm-0123456789', 'chào anh')
    await guiTinNhan(sv, sessionId, 'cm-9876543210', 'em hỏi thêm')

    const p = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(p.messageSeq).toBe(2)
    const seqs = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { seq: 'asc' },
      select: { seq: true },
    })
    expect(seqs.map((t) => t.seq)).toEqual([1, 2])
  })

  it('người ngoài nhận 404 chứ không 403', async () => {
    await chuyenSangNTD(0, 'HUMAN_ACTIVE')
    await expect(guiTinNhan(ngoai, sessionId, 'cm-0123456789', 'chen vào')).rejects.toMatchObject({
      status: 404,
    })
  })
})
