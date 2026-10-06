import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { quyenTruyCapPhien } from '../src/modules/chat/chat.access.js'
import { guiTinNhan, hoiThoaiCuaToi } from '../src/modules/chat/chat.service.js'
import {
  chuyenNhaTuyenDung,
  hopThuNTD,
  huyCho,
  ketThuc,
  ntdChuDongTraoDoi,
  tiepNhan,
} from '../src/modules/chat/handoff.service.js'

/**
 * Luồng trao đổi với nhà tuyển dụng — PostgreSQL thật.
 *
 * ===========================================================================
 * MỘT LUỒNG CHO MỖI CẶP (SINH VIÊN, NHÀ TUYỂN DỤNG)
 * ===========================================================================
 * Luồng trợ lý của sinh viên KHÔNG đổi trạng thái khi họ hỏi một nhà tuyển
 * dụng — nó đứng yên, và một luồng `NTD` riêng mở ra. Hỏi nơi thứ hai là mở
 * luồng thứ hai.
 *
 * Đó là khác biệt lớn nhất so với bản trước, nơi `chuyenNhaTuyenDung` BIẾN
 * chính luồng trợ lý thành luồng với nhà tuyển dụng. Nhiều ca dưới đây tồn tại
 * để canh rằng hai luồng thật sự tách biệt.
 *
 * Thứ chỉ database mới dựng lại được: **hai `UPDATE` tranh nhau một hàng** —
 * sinh viên bấm huỷ chờ đúng lúc nhà tuyển dụng bấm tiếp nhận. Mock Prisma trả
 * về đúng thứ ta bảo nó trả, nên nó không có khái niệm "ai tới trước".
 *
 * Chạy: pnpm --filter @uniwork/api test:db
 */

const prisma = new PrismaClient()

let sv: { id: string; role: 'STUDENT' }
let ntd: { id: string; role: 'EMPLOYER' }
let ntdKhac: { id: string; role: 'EMPLOYER' }
let employerProfileId: string
let employerKhacId: string
let jobId: string
let jobKhacId: string
let hoSoSvId: string
/** Luồng TRỢ LÝ của sinh viên. Vĩnh viễn, không bao giờ rời `AI_ACTIVE`. */
let luongAi: string

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
  /*
   * Đưa tin về MỞ ở đầu MỖI ca. Ca "tin đã đóng" đóng nó; bản trước mở lại ở
   * cuối chính ca đó, nên ca đó đỏ giữa chừng là tin kẹt ở trạng thái đóng và
   * mọi ca sau đỏ dây chuyền với "tin đã đóng" — người đọc log đi tìm lỗi ở
   * nhầm chỗ. Dọn ở `beforeEach`, không dọn ở cuối ca.
   */
  await prisma.job.update({
    where: { id: j.id },
    data: { status: 'OPEN', goBoiAdminId: null, lyDoGo: null },
  })
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
  employerKhacId = b.employerProfileId
  jobKhacId = b.jobId

  const hs = await prisma.studentProfile.upsert({
    where: { userId: sv.id },
    update: {},
    create: { userId: sv.id, fullName: 'Nguyễn Văn An' },
    select: { id: true },
  })
  hoSoSvId = hs.id
  await prisma.application.deleteMany({ where: { studentProfileId: hs.id } })

  /*
   * Dọn SẠCH mọi luồng của sinh viên trước mỗi ca.
   *
   * Không liệt kê `clientSessionId` cụ thể như bản trước: giờ mỗi nhà tuyển
   * dụng sinh ra một luồng riêng, nên danh sách khoá sẽ luôn thiếu một cái.
   * Đã dính đúng chuyện đó ở `chat-ho-tro.test.ts` — lần chạy đầu xanh, lần
   * thứ hai đỏ, và người đỏ là ca không liên quan.
   */
  const cu = await prisma.chatSession.findMany({
    where: { ownerUserId: sv.id },
    select: { id: true },
  })
  if (cu.length > 0) {
    const ids = cu.map((c) => c.id)
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.chatSession.deleteMany({ where: { id: { in: ids } } })
  }

  const p = await prisma.chatSession.create({
    data: {
      kind: 'AI_STUDENT',
      ownerUserId: sv.id,
      clientSessionId: 'luong:tro-ly',
      studentProfileId: hs.id,
    },
    select: { id: true },
  })
  luongAi = p.id

  await prisma.notification.deleteMany({ where: { userId: { in: [sv.id, ntd.id] } } })
}

const doc = (id: string) => prisma.chatSession.findUniqueOrThrow({ where: { id } })
const chuyen = (job = jobId) => chuyenNhaTuyenDung(sv.id, job, '')

/** Mở luồng với Quán A và trả về id của chính luồng đó. */
async function moLuongA(): Promise<string> {
  return (await chuyen()).sessionId
}

/** Sinh viên nộp đơn vào tin của Quán A, ở trạng thái cho trước. */
async function nopDon(status: 'PENDING' | 'VIEWED' | 'WITHDRAWN' = 'PENDING'): Promise<string> {
  const d = await prisma.application.create({
    data: { jobId, studentProfileId: hoSoSvId, status },
    select: { id: true },
  })
  return d.id
}

beforeEach(dungDuLieu)

afterAll(async () => {
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('mở luồng với nhà tuyển dụng', () => {
  it('tạo luồng RIÊNG, luồng trợ lý không hề đổi', async () => {
    const id = await moLuongA()

    expect(id).not.toBe(luongAi)

    const ntdThread = await doc(id)
    expect(ntdThread.kind).toBe('NTD')
    expect(ntdThread.state).toBe('WAITING_EMPLOYER')
    expect(ntdThread.handoffEmployerProfileId).toBe(employerProfileId)
    expect(ntdThread.jobId).toBe(jobId)

    /* Khẳng định quan trọng nhất của cả mô hình mới. */
    const ai = await doc(luongAi)
    expect(ai.kind).toBe('AI_STUDENT')
    expect(ai.state).toBe('AI_ACTIVE')
    expect(ai.handoffEmployerProfileId).toBeNull()
  })

  it('tin mở đầu là tin hệ thống, có kèm tên tin', async () => {
    const kq = await chuyen()
    expect(kq.tin.senderType).toBe('SYSTEM')
    expect(kq.tin.body).toContain('Quán A')
  })

  it('báo cho nhà tuyển dụng', async () => {
    await chuyen()
    const tb = await prisma.notification.findFirst({ where: { userId: ntd.id } })
    expect(tb?.type).toBe('CHAT_HANDOFF_REQUESTED')
  })

  /*
   * =====================================================================
   * HAI NƠI = HAI LUỒNG, VÀ ĐÓ LÀ CẢ LÝ DO TÁCH
   * =====================================================================
   * Bản trước từ chối lần chuyển thứ hai sang nhà tuyển dụng KHÁC, vì cả hai
   * cuộc trò chuyện phải chen vào một hàng. Nay chúng là hai hàng, nên hỏi nơi
   * thứ hai là chuyện bình thường — và nơi B không đọc được gì của nơi A.
   */
  it('hỏi nơi thứ hai mở luồng thứ hai, hai luồng tách hẳn', async () => {
    const a = await moLuongA()
    const b = (await chuyen(jobKhacId)).sessionId

    expect(b).not.toBe(a)
    expect((await doc(b)).handoffEmployerProfileId).toBe(employerKhacId)

    /* Quán B không với được vào luồng của Quán A, và ngược lại. */
    expect(await quyenTruyCapPhien(ntdKhac, a)).toBeNull()
    expect(await quyenTruyCapPhien(ntd, b)).toBeNull()
  })

  it('bấm lại khi đang chờ thì báo trùng, không ghi thêm lời mở đầu', async () => {
    const id = await moLuongA()
    const truoc = (await doc(id)).messageSeq

    await expect(chuyen()).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await doc(id)).messageSeq).toBe(truoc)
  })

  /*
   * Luồng đã đóng MỞ LẠI, mang theo lịch sử. Đây là điều làm nó giống một hộp
   * thư thật chứ không phải một phiếu dùng một lần.
   */
  it('luồng đã đóng thì mở lại được, và lịch sử còn nguyên', async () => {
    const id = await moLuongA()
    await ketThuc(sv, id)
    const soTinCu = await prisma.chatMessage.count({ where: { sessionId: id } })

    const lai = await chuyen()

    expect(lai.sessionId).toBe(id)
    expect((await doc(id)).state).toBe('WAITING_EMPLOYER')
    expect(await prisma.chatMessage.count({ where: { sessionId: id } })).toBe(soTinCu + 1)
  })

  /*
   * =====================================================================
   * AI ĐƯỢC HỎI: THEO TRẠNG THÁI TIN, KHÔNG THEO ĐƠN
   * =====================================================================
   * Tin mở → hỏi được khi CHƯA nộp đơn (việc chính của nút, và của thẻ đề
   * nghị bên trợ lý). Tin đóng → chỉ người đã nộp đơn chưa rút. Tin bị gỡ →
   * không ai. Mọi ca ở trên đều chạy KHÔNG có đơn nào — chính chúng là bằng
   * chứng cho vế đầu.
   */
  it('tin đang mở: chưa nộp đơn vẫn hỏi được', async () => {
    expect(await prisma.application.count({ where: { studentProfileId: hoSoSvId } })).toBe(0)
    expect((await chuyen()).state).toBe('WAITING_EMPLOYER')
  })

  it('tin đã đóng, chưa nộp đơn: không mở luồng được', async () => {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'CLOSED' } })
    await expect(chuyen()).rejects.toMatchObject({ status: 404 })
  })

  it('tin đã đóng, ĐÃ nộp đơn: vẫn trao đổi tiếp được về đơn đó', async () => {
    await nopDon('VIEWED')
    await prisma.job.update({ where: { id: jobId }, data: { status: 'CLOSED' } })
    expect((await chuyen()).state).toBe('WAITING_EMPLOYER')
  })

  it('tin đã đóng, đơn đã RÚT: không mở luồng được', async () => {
    await nopDon('WITHDRAWN')
    await prisma.job.update({ where: { id: jobId }, data: { status: 'CLOSED' } })
    await expect(chuyen()).rejects.toMatchObject({ status: 404 })
  })

  it('tin bị quản trị viên GỠ: đã nộp đơn cũng không mở được', async () => {
    await nopDon('VIEWED')
    const admin = await prisma.user.upsert({
      where: { email: 'handoff-admin@test.local' },
      update: {},
      create: { email: 'handoff-admin@test.local', role: 'ADMIN', passwordHash: null },
      select: { id: true },
    })
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'CLOSED', goBoiAdminId: admin.id, lyDoGo: 'Tin lừa đảo' },
    })
    await expect(chuyen()).rejects.toMatchObject({ status: 404 })
  })

  /*
   * Kế hoạch: nút trao đổi "mở hội thoại hiện có hoặc gửi yêu cầu mới". Báo
   * trùng phải kèm id, nếu không giao diện chỉ hiện được một câu lỗi.
   */
  it('báo trùng kèm id luồng đang có', async () => {
    const id = await moLuongA()
    await expect(chuyen()).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { sessionId: [id] },
    })
  })

  it('nhà tuyển dụng chưa xác minh thì không mở luồng được', async () => {
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

describe('các chuyển đổi còn lại', () => {
  it('huỷ chờ ĐÓNG luồng và KHÔNG báo nhà tuyển dụng', async () => {
    const id = await moLuongA()
    await prisma.notification.deleteMany({ where: { userId: ntd.id } })

    await huyCho(sv.id, id)

    /* `CLOSED` chứ không `AI_ACTIVE`: luồng NTD không có trợ lý để quay về. */
    expect((await doc(id)).state).toBe('CLOSED')
    expect(await prisma.notification.count({ where: { userId: ntd.id } })).toBe(0)
  })

  it('tiếp nhận đưa sang HUMAN_ACTIVE và báo sinh viên', async () => {
    const id = await moLuongA()
    await tiepNhan(ntd, id)

    const p = await doc(id)
    expect(p.state).toBe('HUMAN_ACTIVE')
    expect(p.handoffAcceptedAt).not.toBeNull()
    const tb = await prisma.notification.findFirst({
      where: { userId: sv.id, type: 'CHAT_HANDOFF_ACCEPTED' },
    })
    expect(tb).not.toBeNull()
  })

  it('NTD khác không tiếp nhận được', async () => {
    const id = await moLuongA()
    await expect(tiepNhan(ntdKhac, id)).rejects.toMatchObject({ status: 404 })
  })

  it('tiếp nhận lần hai bị từ chối', async () => {
    const id = await moLuongA()
    await tiepNhan(ntd, id)
    await expect(tiepNhan(ntd, id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('cả hai bên đều kết thúc được, và ghi đúng ai đóng', async () => {
    const id = await moLuongA()
    await tiepNhan(ntd, id)
    const kq = await ketThuc(ntd, id)

    const p = await doc(id)
    expect(p.state).toBe('CLOSED')
    expect(p.closedByUserId).toBe(ntd.id)
    expect(kq.tin.body).toContain('Nhà tuyển dụng')
  })

  it('kết thúc lần hai bị từ chối', async () => {
    const id = await moLuongA()
    await ketThuc(sv, id)
    await expect(ketThuc(sv, id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  /*
   * Đóng rồi thì nhà tuyển dụng VẪN đọc lại được — quyền đọc neo vào `kind` và
   * người sở hữu, không vào `state`. Chỉ quyền GỬI mới tắt.
   */
  it('luồng đã đóng: NTD còn đọc được, hết gửi được', async () => {
    const id = await moLuongA()
    await tiepNhan(ntd, id)
    await ketThuc(sv, id)

    const q = await quyenTruyCapPhien(ntd, id)
    expect(q?.vai).toBe('NTD_NHAN_HANDOFF')
    expect(q?.duocGui).toBe(false)
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
 * WAITING_EMPLOYER, cả hai đều ghi, và trạng thái cuối tuỳ ai ghi sau — không
 * ai nhận lỗi, và một bên tin sai về chuyện vừa xảy ra.
 */
describe('ca đua', () => {
  it('huỷ chờ và tiếp nhận cùng lúc: đúng MỘT bên thắng', async () => {
    for (let lan = 0; lan < 5; lan += 1) {
      await dungDuLieu()
      const id = await moLuongA()

      const kq = await Promise.allSettled([huyCho(sv.id, id), tiepNhan(ntd, id)])
      const thang = kq.filter((r) => r.status === 'fulfilled')
      const thua = kq.filter((r) => r.status === 'rejected')

      expect(thang, `lần ${lan}`).toHaveLength(1)
      expect(thua, `lần ${lan}`).toHaveLength(1)

      /* Trạng thái cuối phải là MỘT trong hai, không bao giờ là thứ lai. */
      expect(['CLOSED', 'HUMAN_ACTIVE']).toContain((await doc(id)).state)
    }
  })

  it('hai NTD cùng tiếp nhận: người thứ hai nhận 409, không phải lỗi khó hiểu', async () => {
    const id = await moLuongA()
    const kq = await Promise.allSettled([tiepNhan(ntd, id), tiepNhan(ntd, id)])

    expect(kq.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const hong = kq.find((r) => r.status === 'rejected')
    expect((hong as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' })
  })

  /*
   * Hai lần bấm hỏi cùng lúc KHÔNG được sinh hai luồng.
   *
   * Khoá tự nhiên `(ownerUserId, clientSessionId)` là thứ chặn, và nó chặn ở
   * tầng DATABASE — không phải bằng một câu `if` nào trong service.
   */
  it('bấm hỏi hai lần cùng lúc chỉ ra MỘT luồng', async () => {
    await Promise.allSettled([chuyen(), chuyen()])

    const soLuong = await prisma.chatSession.count({
      where: { ownerUserId: sv.id, kind: 'NTD' },
    })
    expect(soLuong).toBe(1)
  })
})

describe('hộp thư nhà tuyển dụng', () => {
  it('hiện luồng đang chờ, và chỉ tên viết tắt', async () => {
    const id = await moLuongA()
    const { hoiThoai } = await hopThuNTD(ntd.id)

    const muc = hoiThoai.find((h) => h.sessionId === id)
    expect(muc).toMatchObject({ state: 'WAITING_EMPLOYER', hoTenVietTat: 'N.V.A' })
    expect(JSON.stringify(muc)).not.toContain('Nguyễn Văn An')
  })

  it('NTD khác không thấy luồng này', async () => {
    const id = await moLuongA()
    const { hoiThoai } = await hopThuNTD(ntdKhac.id)
    expect(hoiThoai.find((h) => h.sessionId === id)).toBeUndefined()
  })

  it('luồng đã kết thúc rời khỏi hộp thư', async () => {
    const id = await moLuongA()
    await ketThuc(sv, id)
    const { hoiThoai } = await hopThuNTD(ntd.id)
    expect(hoiThoai.find((h) => h.sessionId === id)).toBeUndefined()
  })

  /* Luồng trợ lý KHÔNG BAO GIỜ được lọt vào hộp thư của bất kỳ ai. */
  it('luồng trợ lý không nằm trong hộp thư nào', async () => {
    await moLuongA()
    const { hoiThoai } = await hopThuNTD(ntd.id)
    expect(hoiThoai.find((h) => h.sessionId === luongAi)).toBeUndefined()
  })
})

/*
 * =====================================================================
 * DANH SÁCH HỘI THOẠI CỦA CHÍNH MÌNH
 * =====================================================================
 * Hai ranh giới phải canh, và ranh giới thứ hai mới là ranh giới riêng tư:
 *   thấy ĐỦ luồng mình là chủ
 *   KHÔNG thấy luồng của người khác, kể cả khi mình là bên nhận
 */
describe('hội thoại của tôi', () => {
  it('thấy cả luồng trợ lý lẫn từng luồng nhà tuyển dụng', async () => {
    const a = await moLuongA()
    const b = (await chuyen(jobKhacId)).sessionId

    const { hoiThoai } = await hoiThoaiCuaToi(sv.id)
    const ids = hoiThoai.map((h) => h.sessionId)

    expect(ids).toContain(luongAi)
    expect(ids).toContain(a)
    expect(ids).toContain(b)
  })

  it('nhà tuyển dụng nhận luồng KHÔNG thấy nó là của mình', async () => {
    const id = await moLuongA()
    const { hoiThoai } = await hoiThoaiCuaToi(ntd.id)
    expect(hoiThoai.find((h) => h.sessionId === id)).toBeUndefined()
  })

  it('luồng đã đóng VẪN còn trong danh sách, để đọc lại', async () => {
    const id = await moLuongA()
    await ketThuc(sv, id)

    const { hoiThoai } = await hoiThoaiCuaToi(sv.id)
    expect(hoiThoai.find((h) => h.sessionId === id)?.state).toBe('CLOSED')
  })

  /*
   * Xem trước phải là câu NGƯỜI nói, không phải tin hệ thống.
   *
   * `ketThuc` ghi một tin SYSTEM với seq CAO NHẤT — thứ tự này là bắt buộc:
   * đặt tin người sau cùng thì nó là tin cuối theo cả hai cách lọc, và ca kiểm
   * luôn xanh dù có bộ lọc hay không. Đã viết sai đúng như vậy một lần, chỉ lộ
   * ra khi chạy đột biến.
   */
  it('xem trước bỏ qua tin hệ thống', async () => {
    const id = await moLuongA()
    await tiepNhan(ntd, id)
    await guiTinNhan(sv, id, 'cm-xem-truoc', 'em hỏi thêm một câu')
    await ketThuc(sv, id)

    const { hoiThoai } = await hoiThoaiCuaToi(sv.id)
    expect(hoiThoai.find((h) => h.sessionId === id)?.tinCuoi).toBe('em hỏi thêm một câu')
  })
})

/* ===================================================================== */

/*
 * Nhà tuyển dụng mở lời từ một ĐƠN của tin mình. Thứ đáng canh nhất: bấm lại
 * không ghi thêm gì — đây là lối vào cuộc trò chuyện từ màn hình ứng viên, bị
 * bấm nhiều lần là chuyện thường.
 */
describe('nhà tuyển dụng mở lời từ đơn ứng tuyển', () => {
  const soTin = (id: string) => prisma.chatMessage.count({ where: { sessionId: id } })
  const soThongBaoSv = () => prisma.notification.count({ where: { userId: sv.id } })

  it('mở lời → HUMAN_ACTIVE, đúng một tin hệ thống, báo sinh viên', async () => {
    const don = await nopDon()
    const kq = await ntdChuDongTraoDoi(ntd, don, 'Chào bạn, bên mình muốn hẹn phỏng vấn')

    const luong = await doc(kq.sessionId)
    expect(luong.kind).toBe('NTD')
    expect(luong.state).toBe('HUMAN_ACTIVE')
    expect(luong.handoffEmployerProfileId).toBe(employerProfileId)
    expect(kq.tin?.senderType).toBe('SYSTEM')
    expect(await soTin(kq.sessionId)).toBe(1)
    expect(await soThongBaoSv()).toBe(1)
  })

  it('bấm lại khi đang trao đổi: không ghi thêm tin, không báo thêm', async () => {
    const don = await nopDon()
    const dau = await ntdChuDongTraoDoi(ntd, don)

    const lai = await ntdChuDongTraoDoi(ntd, don)

    expect(lai.sessionId).toBe(dau.sessionId)
    expect(lai.tin).toBeNull()
    expect(await soTin(dau.sessionId)).toBe(1)
    expect(await soThongBaoSv()).toBe(1)
  })

  it('sinh viên đang chờ: mở lời chính là tiếp nhận, cùng một luồng', async () => {
    const don = await nopDon()
    const cho = await moLuongA()

    const kq = await ntdChuDongTraoDoi(ntd, don)

    expect(kq.sessionId).toBe(cho)
    expect((await doc(cho)).state).toBe('HUMAN_ACTIVE')
  })

  it('luồng đã đóng thì mở lại, lịch sử còn nguyên', async () => {
    const don = await nopDon()
    const dau = await ntdChuDongTraoDoi(ntd, don)
    await ketThuc(sv, dau.sessionId)
    const truoc = await soTin(dau.sessionId)

    const lai = await ntdChuDongTraoDoi(ntd, don)

    expect(lai.sessionId).toBe(dau.sessionId)
    expect((await doc(dau.sessionId)).state).toBe('HUMAN_ACTIVE')
    expect(await soTin(dau.sessionId)).toBe(truoc + 1)
  })

  it('đơn của tin nơi khác → 403, không tạo luồng nào', async () => {
    const don = await nopDon()
    await expect(ntdChuDongTraoDoi(ntdKhac, don)).rejects.toMatchObject({ status: 403 })
    expect(await prisma.chatSession.count({ where: { ownerUserId: sv.id, kind: 'NTD' } })).toBe(0)
  })

  it('đơn đã rút → từ chối', async () => {
    const don = await nopDon('WITHDRAWN')
    await expect(ntdChuDongTraoDoi(ntd, don)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('doanh nghiệp chưa xác minh → từ chối', async () => {
    const don = await nopDon()
    await prisma.employerProfile.update({
      where: { id: employerProfileId },
      data: { verifiedAt: null },
    })
    await expect(ntdChuDongTraoDoi(ntd, don)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
