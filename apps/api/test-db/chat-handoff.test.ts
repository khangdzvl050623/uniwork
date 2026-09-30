import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { quyenTruyCapPhien } from '../src/modules/chat/chat.access.js'
import {
  chuyenNhaTuyenDung,
  hopThuNTD,
  huyCho,
  ketThuc,
  quayLaiAi,
  tiepNhan,
} from '../src/modules/chat/handoff.service.js'

/**
 * Máy trạng thái handoff — PostgreSQL thật.
 *
 * Thứ duy nhất chỉ database mới dựng lại được: **hai `UPDATE` tranh nhau một
 * hàng**. Sinh viên bấm huỷ chờ đúng lúc nhà tuyển dụng bấm tiếp nhận. Mock
 * Prisma trả về đúng thứ ta bảo nó trả, nên nó không có khái niệm "ai tới
 * trước" — mà đó chính là điều đang cần khẳng định.
 *
 * Chạy: pnpm --filter @uniwork/api test:db
 */

const prisma = new PrismaClient()

let sv: { id: string; role: 'STUDENT' }
let ntd: { id: string; role: 'EMPLOYER' }
let ntdKhac: { id: string; role: 'EMPLOYER' }
let employerProfileId: string
let jobId: string
let jobKhacId: string
let sessionId: string

async function taoUser(email: string, role: 'STUDENT' | 'EMPLOYER') {
  const u = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role, passwordHash: null },
    select: { id: true },
  })
  return { id: u.id, role }
}

async function taoNTD(email: string, ten: string, daXacMinh: boolean) {
  const u = await taoUser(email, 'EMPLOYER')
  const hs = await prisma.employerProfile.upsert({
    where: { userId: u.id },
    update: { verifiedAt: daXacMinh ? new Date() : null },
    create: { userId: u.id, companyName: ten, verifiedAt: daXacMinh ? new Date() : null },
    select: { id: true },
  })
  const j =
    (await prisma.job.findFirst({ where: { employerProfileId: hs.id }, select: { id: true } })) ??
    (await prisma.job.create({
      data: {
        employerProfileId: hs.id,
        title: `Tin của ${ten}`,
        description: 'x',
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
  return { user: u, employerProfileId: hs.id, jobId: j.id }
}

async function dungDuLieu() {
  sv = (await taoUser('handoff-sv@test.local', 'STUDENT')) as typeof sv

  const a = await taoNTD('handoff-ntd@test.local', 'Quán A', true)
  ntd = a.user as typeof ntd
  employerProfileId = a.employerProfileId
  jobId = a.jobId

  const b = await taoNTD('handoff-ntd-khac@test.local', 'Quán B', true)
  ntdKhac = b.user as typeof ntdKhac
  jobKhacId = b.jobId

  const hs = await prisma.studentProfile.upsert({
    where: { userId: sv.id },
    update: {},
    create: { userId: sv.id, fullName: 'Nguyễn Văn An' },
    select: { id: true },
  })

  const p = await prisma.chatSession.upsert({
    where: { ownerUserId_clientSessionId: { ownerUserId: sv.id, clientSessionId: 'cs-handoff' } },
    update: {
      state: 'AI_ACTIVE',
      messageSeq: 0,
      activeAiRunId: null,
      employerVisibleFromSeq: null,
      handoffEmployerProfileId: null,
      jobId: null,
      handoffRequestedAt: null,
      handoffAcceptedAt: null,
      closedAt: null,
      closedByUserId: null,
    },
    create: {
      kind: 'AI_STUDENT',
      ownerUserId: sv.id,
      clientSessionId: 'cs-handoff',
      studentProfileId: hs.id,
    },
    select: { id: true },
  })
  sessionId = p.id
  await prisma.chatMessage.deleteMany({ where: { sessionId } })

  /*
   * Dọn phiên phụ ở ĐÂY chứ không ở cuối từng ca.
   *
   * Bản đầu gọi `delete` ở dòng cuối mỗi ca. Khi một `expect` hỏng thì dòng
   * đó KHÔNG chạy, phiên phụ ở lại với handoff đang mở, và ca sau bị chặn bởi
   * chính chỉ mục đang được kiểm — một ca đỏ kéo theo ca khác xanh giả.
   *
   * Phát hiện lúc chạy đột biến: bỏ chỉ mục lẽ ra hai ca đỏ, nhưng chỉ một ca
   * đỏ.
   */
  await prisma.chatSession.deleteMany({
    where: { ownerUserId: sv.id, clientSessionId: { in: ['cs-spam', 'cs-quaylai', 'cs-huy'] } },
  })
  await prisma.notification.deleteMany({ where: { userId: { in: [sv.id, ntd.id] } } })
}

const doc = () => prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } })
const chuyen = (job = jobId) => chuyenNhaTuyenDung(sv.id, sessionId, job, '')

beforeEach(dungDuLieu)

afterAll(async () => {
  await prisma.chatMessage.deleteMany({ where: { sessionId } })
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('A — sinh viên chuyển sang nhà tuyển dụng', () => {
  it('đổi trạng thái, đóng băng người nhận và tin, đặt mốc đọc', async () => {
    await chuyen()
    const p = await doc()

    expect(p.state).toBe('WAITING_EMPLOYER')
    expect(p.handoffEmployerProfileId).toBe(employerProfileId)
    expect(p.jobId).toBe(jobId)
    expect(p.employerVisibleFromSeq).toBe(1)
    expect(p.handoffRequestedAt).not.toBeNull()
  })

  it('tin mở đầu là tin ĐẦU TIÊN nhà tuyển dụng đọc được', async () => {
    const kq = await chuyen()
    const tin = await prisma.chatMessage.findUniqueOrThrow({
      where: { sessionId_seq: { sessionId, seq: kq.tin.seq } },
    })
    expect(tin.senderType).toBe('SYSTEM')
    expect(tin.visibleToEmployer).toBe(true)
  })

  /*
   * Lớp BỊ ĐỘNG chặn câu trả lời AI tới muộn. `ghiTraLoi` đòi `activeAiRunId`
   * khớp, nên xoá cờ ở đây là câu trả lời của lượt đang chạy dở sẽ bị bỏ.
   */
  it('xoá cờ lượt AI đang chạy', async () => {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { activeAiRunId: 'turn-dang-chay' },
    })
    await chuyen()
    expect((await doc()).activeAiRunId).toBeNull()
  })

  it('báo cho nhà tuyển dụng', async () => {
    await chuyen()
    const tb = await prisma.notification.findFirst({ where: { userId: ntd.id } })
    expect(tb?.type).toBe('CHAT_HANDOFF_REQUESTED')
  })

  /*
   * ---------------------------------------------------------------------
   * NGƯỜI NHẬN ĐÓNG BĂNG — CA QUAN TRỌNG NHẤT CỦA CHUYỂN ĐỔI A
   * ---------------------------------------------------------------------
   * Cho đổi sang nhà tuyển dụng khác nghĩa là người mới đọc được toàn bộ những
   * gì đã chia sẻ với người cũ. Không có màn hình nào cảnh báo điều đó, và
   * sinh viên không có cách nào lấy lại.
   */
  it('chuyển lần hai sang NTD KHÁC bị từ chối', async () => {
    await chuyen()
    await huyCho(sv.id, sessionId)

    await expect(chuyen(jobKhacId)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await doc()).handoffEmployerProfileId).toBe(employerProfileId)
  })

  it('chuyển lại cho ĐÚNG NTD cũ thì được, và mốc đọc KHÔNG dịch lên', async () => {
    await chuyen()
    const mocDau = (await doc()).employerVisibleFromSeq

    await huyCho(sv.id, sessionId)

    /* Sinh viên nói riêng với AI vài câu ở giữa hai lần chuyển. */
    const truoc = (await doc()).messageSeq
    await prisma.chatMessage.createMany({
      data: [1, 2].map((i) => ({
        sessionId,
        seq: truoc + i,
        senderType: 'STUDENT' as const,
        body: `riêng ${i}`,
        visibleToEmployer: false,
      })),
    })
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { messageSeq: { increment: 2 } },
    })

    await chuyen()
    expect((await doc()).employerVisibleFromSeq).toBe(mocDau)
  })

  it('tin đã đóng thì không chuyển được', async () => {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'CLOSED' } })
    await expect(chuyen()).rejects.toMatchObject({ status: 404 })
    await prisma.job.update({ where: { id: jobId }, data: { status: 'OPEN' } })
  })

  it('nhà tuyển dụng chưa xác minh thì không chuyển được', async () => {
    await prisma.employerProfile.update({
      where: { id: employerProfileId },
      data: { verifiedAt: null },
    })
    await expect(chuyen()).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await prisma.employerProfile.update({
      where: { id: employerProfileId },
      data: { verifiedAt: new Date() },
    })
  })
})

describe('B, C, D, E — các chuyển đổi còn lại', () => {
  it('huỷ chờ đưa về AI_ACTIVE và KHÔNG báo nhà tuyển dụng', async () => {
    await chuyen()
    await prisma.notification.deleteMany({ where: { userId: ntd.id } })

    await huyCho(sv.id, sessionId)

    expect((await doc()).state).toBe('AI_ACTIVE')
    expect(await prisma.notification.count({ where: { userId: ntd.id } })).toBe(0)
  })

  it('tiếp nhận đưa sang HUMAN_ACTIVE và báo sinh viên', async () => {
    await chuyen()
    await tiepNhan(ntd, sessionId)

    const p = await doc()
    expect(p.state).toBe('HUMAN_ACTIVE')
    expect(p.handoffAcceptedAt).not.toBeNull()
    const tb = await prisma.notification.findFirst({
      where: { userId: sv.id, type: 'CHAT_HANDOFF_ACCEPTED' },
    })
    expect(tb).not.toBeNull()
  })

  it('NTD khác không tiếp nhận được', async () => {
    await chuyen()
    await expect(tiepNhan(ntdKhac, sessionId)).rejects.toMatchObject({ status: 404 })
  })

  it('tiếp nhận lần hai bị từ chối', async () => {
    await chuyen()
    await tiepNhan(ntd, sessionId)
    await expect(tiepNhan(ntd, sessionId)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  /*
   * Quyền ĐỌC neo vào `handoffEmployerProfileId`, không vào `state`. Quay lại
   * AI thì NTD vẫn mở xem được phần đã chia sẻ — nhưng không gửi được nữa, và
   * phần mới đều `visibleToEmployer = false`.
   */
  it('quay lại AI: NTD còn đọc được, hết gửi được', async () => {
    await chuyen()
    await tiepNhan(ntd, sessionId)
    await quayLaiAi(sv.id, sessionId)

    expect((await doc()).state).toBe('AI_ACTIVE')
    const q = await quyenTruyCapPhien(ntd, sessionId)
    expect(q?.vai).toBe('NTD_NHAN_HANDOFF')
    expect(q?.duocGui).toBe(false)
  })

  it('cả hai bên đều kết thúc được, và ghi đúng ai đóng', async () => {
    await chuyen()
    await tiepNhan(ntd, sessionId)
    const kq = await ketThuc(ntd, sessionId)

    const p = await doc()
    expect(p.state).toBe('CLOSED')
    expect(p.closedByUserId).toBe(ntd.id)
    expect(kq.tin.body).toContain('Nhà tuyển dụng')
  })

  it('kết thúc lần hai bị từ chối', async () => {
    await chuyen()
    await ketThuc(sv.id === '' ? ntd : sv, sessionId)
    await expect(ketThuc(sv, sessionId)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

/*
 * =====================================================================
 * CA ĐUA — LÝ DO FILE NÀY PHẢI CHẠY TRÊN POSTGRES THẬT
 * =====================================================================
 * Sinh viên bấm huỷ chờ đúng lúc nhà tuyển dụng bấm tiếp nhận. Cả hai đều là
 * `updateMany` xuất phát từ `WAITING_EMPLOYER`.
 *
 * Nếu viết bằng `findUnique` → kiểm `state` → `update` thì cả hai đều đọc thấy
 * WAITING_EMPLOYER, cả hai đều ghi, và trạng thái cuối tuỳ thuộc ai ghi sau —
 * không ai nhận lỗi, và một bên tin sai về chuyện vừa xảy ra.
 */
describe('ca đua', () => {
  it('huỷ chờ và tiếp nhận cùng lúc: đúng MỘT bên thắng', async () => {
    for (let lan = 0; lan < 5; lan += 1) {
      await dungDuLieu()
      await chuyen()

      const kq = await Promise.allSettled([huyCho(sv.id, sessionId), tiepNhan(ntd, sessionId)])
      const thang = kq.filter((r) => r.status === 'fulfilled')
      const thua = kq.filter((r) => r.status === 'rejected')

      expect(thang, `lần ${lan}`).toHaveLength(1)
      expect(thua, `lần ${lan}`).toHaveLength(1)

      /* Trạng thái cuối phải là MỘT trong hai, không bao giờ là thứ lai. */
      expect(['AI_ACTIVE', 'HUMAN_ACTIVE']).toContain((await doc()).state)
    }
  })

  it('hai NTD cùng tiếp nhận: người thứ hai nhận 409, không phải lỗi khó hiểu', async () => {
    await chuyen()
    const kq = await Promise.allSettled([tiepNhan(ntd, sessionId), tiepNhan(ntd, sessionId)])

    expect(kq.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const hong = kq.find((r) => r.status === 'rejected')
    expect((hong as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' })
  })
})

describe('hộp thư nhà tuyển dụng', () => {
  it('hiện hội thoại đang chờ, và chỉ tên viết tắt', async () => {
    await chuyen()
    const { hoiThoai } = await hopThuNTD(ntd.id)

    const muc = hoiThoai.find((h) => h.sessionId === sessionId)
    expect(muc).toMatchObject({ state: 'WAITING_EMPLOYER', hoTenVietTat: 'N.V.A' })
    expect(JSON.stringify(muc)).not.toContain('Nguyễn Văn An')
  })

  it('NTD khác không thấy hội thoại này', async () => {
    await chuyen()
    const { hoiThoai } = await hopThuNTD(ntdKhac.id)
    expect(hoiThoai.find((h) => h.sessionId === sessionId)).toBeUndefined()
  })

  it('hội thoại đã kết thúc rời khỏi hộp thư', async () => {
    await chuyen()
    await ketThuc(sv, sessionId)
    const { hoiThoai } = await hopThuNTD(ntd.id)
    expect(hoiThoai.find((h) => h.sessionId === sessionId)).toBeUndefined()
  })
})

/*
 * =====================================================================
 * CHỐNG SPAM — LỚP THẬT LÀ CHỈ MỤC, KHÔNG PHẢI RATE LIMIT
 * =====================================================================
 * Handoff KHÔNG gọi model nên hạn mức ngày không chạm tới đường này. Không có
 * chỉ mục `chat_mot_handoff_moi_ntd` thì một tài khoản sinh viên tạo bao nhiêu
 * phiên cũng được (mỗi `clientSessionId` một phiên) và đổ bấy nhiêu yêu cầu
 * vào hộp thư một nhà tuyển dụng.
 *
 * Rate limit ở tầng route là lưới; nó không chạy trong các ca này vì chúng gọi
 * thẳng service — và đó chính là điều cần kiểm: lớp dưới cùng có giữ không.
 */
describe('chống spam handoff', () => {
  /** Phiên thứ hai của CÙNG sinh viên, như khi họ đổi clientSessionId. */
  async function phienThuHai() {
    const hs = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: sv.id },
      select: { id: true },
    })
    const p = await prisma.chatSession.upsert({
      where: { ownerUserId_clientSessionId: { ownerUserId: sv.id, clientSessionId: 'cs-spam' } },
      update: {
        state: 'AI_ACTIVE',
        messageSeq: 0,
        handoffEmployerProfileId: null,
        jobId: null,
        employerVisibleFromSeq: null,
      },
      create: {
        kind: 'AI_STUDENT',
        ownerUserId: sv.id,
        clientSessionId: 'cs-spam',
        studentProfileId: hs.id,
      },
      select: { id: true },
    })
    return p.id
  }

  it('phiên thứ hai tới CÙNG nhà tuyển dụng bị chặn', async () => {
    await chuyen()
    const hai = await phienThuHai()

    await expect(chuyenNhaTuyenDung(sv.id, hai, jobId, '')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('thông điệp nói rõ phải mở lại hội thoại cũ, không phải lỗi khoá trùng', async () => {
    await chuyen()
    const hai = await phienThuHai()

    await expect(chuyenNhaTuyenDung(sv.id, hai, jobId, '')).rejects.toThrow(/hội thoại mở/)
  })

  /* Chỉ mục MỘT PHẦN: hội thoại đã đóng không được chặn lần sau. */
  it('đóng hội thoại cũ rồi thì mở lại được với chính NTD đó', async () => {
    await chuyen()
    await ketThuc(sv, sessionId)

    const hai = await phienThuHai()
    await expect(chuyenNhaTuyenDung(sv.id, hai, jobId, '')).resolves.toMatchObject({
      state: 'WAITING_EMPLOYER',
    })
  })

  it('nhà tuyển dụng KHÁC thì không bị chặn', async () => {
    await chuyen()
    const hai = await phienThuHai()

    await expect(chuyenNhaTuyenDung(sv.id, hai, jobKhacId, '')).resolves.toMatchObject({
      state: 'WAITING_EMPLOYER',
    })
  })
})

/*
 * =====================================================================
 * BA LỖI TÌM RA KHI RÀ LẠI PLAN — không phải khi viết code
 * =====================================================================
 * Cả ba đều qua sạch bộ test cũ. Chúng là loại lỗi "code làm đúng thứ nó
 * viết, nhưng thứ nó viết không phải nghiệp vụ".
 */
describe('chống trùng neo vào nghiệp vụ, không vào state', () => {
  async function phienPhu(ten: string) {
    const hs = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: sv.id },
      select: { id: true },
    })
    const p = await prisma.chatSession.upsert({
      where: { ownerUserId_clientSessionId: { ownerUserId: sv.id, clientSessionId: ten } },
      update: {
        state: 'AI_ACTIVE',
        messageSeq: 0,
        handoffEmployerProfileId: null,
        jobId: null,
        employerVisibleFromSeq: null,
      },
      create: {
        kind: 'AI_STUDENT',
        ownerUserId: sv.id,
        clientSessionId: ten,
        studentProfileId: hs.id,
      },
      select: { id: true },
    })
    return p.id
  }

  /*
   * ---------------------------------------------------------------------
   * "QUAY LẠI AI" KHÔNG PHẢI LÀ KẾT THÚC
   * ---------------------------------------------------------------------
   * Chỉ mục bản đầu dùng `WHERE state IN ('WAITING_EMPLOYER','HUMAN_ACTIVE')`.
   * Quay lại AI thì state về AI_ACTIVE trong khi `handoffEmployerProfileId`
   * vẫn giữ — hội thoại chỉ TẠM DỪNG. Lúc đó chỉ mục hết phủ và sinh viên mở
   * được luồng thứ hai tới cùng nhà tuyển dụng.
   */
  it('quay lại AI rồi thì VẪN không mở được hội thoại thứ hai với NTD đó', async () => {
    await chuyen()
    await tiepNhan(ntd, sessionId)
    await quayLaiAi(sv.id, sessionId)
    expect((await doc()).state).toBe('AI_ACTIVE')

    const hai = await phienPhu('cs-quaylai')
    await expect(chuyenNhaTuyenDung(sv.id, hai, jobId, '')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('huỷ chờ rồi cũng vậy — chưa đóng thì chưa mở luồng mới được', async () => {
    await chuyen()
    await huyCho(sv.id, sessionId)

    const hai = await phienPhu('cs-huy')
    await expect(chuyenNhaTuyenDung(sv.id, hai, jobId, '')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })
})

describe('jobId đóng băng, tin sau đi vào ngữ cảnh', () => {
  /*
   * Ghi đè `jobId` làm hộp thư NTD hiện tên tin B cho một cuộc trao đổi phần
   * lớn nói về tin A — và không ai thấy nó xảy ra.
   */
  it('chuyển lại với tin KHÁC của cùng NTD thì jobId KHÔNG đổi', async () => {
    const job2 = await prisma.job.create({
      data: {
        employerProfileId,
        title: 'Tin thứ hai của Quán A',
        description: 'y',
        city: 'Hà Nội',
        district: 'Đống Đa',
        salaryUnit: 'HOUR',
        salaryNegotiable: true,
        scheduleType: 'RECURRING',
        deadline: new Date(Date.now() + 30 * 86_400_000),
        status: 'OPEN',
        publishedAt: new Date(),
      },
      select: { id: true },
    })

    await chuyen()
    await huyCho(sv.id, sessionId)
    const kq = await chuyenNhaTuyenDung(sv.id, sessionId, job2.id, 'hỏi thêm')

    expect((await doc()).jobId).toBe(jobId)
    expect(kq.tin.body).toContain('Tin thứ hai của Quán A')

    await prisma.job.delete({ where: { id: job2.id } })
  })
})
