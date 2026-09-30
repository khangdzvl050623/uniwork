import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { quyenTruyCapPhien } from '../src/modules/chat/chat.access.js'
import { guiTinNhan, layTinNhan, moLuong } from '../src/modules/chat/chat.service.js'
import { ketThuc } from '../src/modules/chat/handoff.service.js'
import {
  hangDoiHoTro,
  huyYeuCauHoTro,
  tiepNhanHoTro,
  yeuCauHoTro,
} from '../src/modules/chat/ho-tro.service.js'

/**
 * Kênh hỗ trợ — PostgreSQL thật.
 *
 * Hai thứ chỉ database mới kiểm được:
 *   1. Năm CHECK viết lại cho ba kênh — `prisma db push` không dựng chúng
 *   2. Hai admin cùng tiếp nhận một ticket
 *
 * Và một thứ quan trọng hơn cả hai: **admin KHÔNG đọc được hội thoại giữa
 * sinh viên và nhà tuyển dụng**. Đó là ranh giới riêng tư của cả thiết kế.
 */

const prisma = new PrismaClient()

let sv: { id: string; role: 'STUDENT' }
let ntd: { id: string; role: 'EMPLOYER' }
let adminA: { id: string; role: 'ADMIN' }
let adminB: { id: string; role: 'ADMIN' }
let phienHoTro: string
let phienTuyenDung: string

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
  sv = (await taoUser('ho-tro-sv@test.local', 'STUDENT')) as typeof sv
  ntd = (await taoUser('ho-tro-ntd@test.local', 'EMPLOYER')) as typeof ntd
  adminA = (await taoUser('ho-tro-admin-a@test.local', 'ADMIN')) as typeof adminA
  adminB = (await taoUser('ho-tro-admin-b@test.local', 'ADMIN')) as typeof adminB

  const hsSv = await prisma.studentProfile.upsert({
    where: { userId: sv.id },
    update: {},
    create: { userId: sv.id, fullName: 'Người Cần Hỗ Trợ' },
    select: { id: true },
  })
  const hsNtd = await prisma.employerProfile.upsert({
    where: { userId: ntd.id },
    update: { verifiedAt: new Date() },
    create: { userId: ntd.id, companyName: 'Quán Hỗ Trợ', verifiedAt: new Date() },
    select: { id: true },
  })

  /*
   * Dọn SẠCH trước khi dựng: chỉ mục khoá theo NGƯỜI, nên một luồng sót lại
   * từ ca trước sẽ chặn luồng dựng ở đây — và lỗi hiện ra ở `beforeEach`, xa
   * hẳn ca thật sự gây ra nó.
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

  /* Luồng HỖ TRỢ — không có studentProfileId, không có tin. */
  const a = await prisma.chatSession.upsert({
    where: { ownerUserId_clientSessionId: { ownerUserId: sv.id, clientSessionId: 'luong:ho-tro' } },
    update: {
      state: 'AI_ACTIVE',
      messageSeq: 0,
      handoffAdminUserId: null,
      handoffRequestedAt: null,
      closedAt: null,
    },
    create: { kind: 'AI_SUPPORT', ownerUserId: sv.id, clientSessionId: 'luong:ho-tro' },
    select: { id: true },
  })
  phienHoTro = a.id

  /* Luồng TUYỂN DỤNG — dùng để canh admin KHÔNG đọc được nó. */
  const job = await prisma.job.upsert({
    where: {
      id:
        (
          await prisma.job.findFirst({
            where: { employerProfileId: hsNtd.id },
            select: { id: true },
          })
        )?.id ?? 'khong-co',
    },
    update: {},
    create: {
      employerProfileId: hsNtd.id,
      title: 'Tin riêng tư',
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
  })

  const b = await prisma.chatSession.create({
    data: {
      kind: 'NTD',
      ownerUserId: sv.id,
      clientSessionId: `luong:ntd:${hsNtd.id}`,
      studentProfileId: hsSv.id,
      state: 'HUMAN_ACTIVE',
      messageSeq: 1,
      handoffEmployerProfileId: hsNtd.id,
      jobId: job.id,
    },
    select: { id: true },
  })
  phienTuyenDung = b.id

  await prisma.chatMessage.create({
    data: {
      sessionId: phienTuyenDung,
      seq: 1,
      senderType: 'STUDENT',
      body: 'Em muốn hỏi riêng về mức lương',
    },
  })
  await prisma.notification.deleteMany({ where: { userId: sv.id } })

}

const doc = () => prisma.chatSession.findUniqueOrThrow({ where: { id: phienHoTro } })

beforeEach(dungDuLieu)

afterAll(async () => {
  await prisma.chatMessage.deleteMany({
    where: { sessionId: { in: [phienHoTro, phienTuyenDung] } },
  })
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('ranh giới riêng tư của admin', () => {
  /*
   * =====================================================================
   * CA QUAN TRỌNG NHẤT CỦA CẢ KÊNH HỖ TRỢ
   * =====================================================================
   * Thêm một vai có quyền đọc là lúc dễ mở rộng quá tay nhất. Admin phải đọc
   * được ticket hỗ trợ, nhưng KHÔNG được đọc chuyện sinh viên nói với nhà
   * tuyển dụng — không ai từng đồng ý điều đó.
   */
  it('admin KHÔNG đọc được hội thoại sinh viên–nhà tuyển dụng', async () => {
    expect(await quyenTruyCapPhien(adminA, phienTuyenDung)).toBeNull()
    await expect(layTinNhan(adminA, phienTuyenDung)).rejects.toMatchObject({ status: 404 })
  })

  it('admin đọc được phiên hỗ trợ, từ seq 1', async () => {
    const q = await quyenTruyCapPhien(adminA, phienHoTro)
    expect(q?.vai).toBe('ADMIN_HO_TRO')
    expect(q?.phong).toBe(`hoi-thoai:${phienHoTro}:admin`)
  })

  /* Đọc để nhận việc thì mọi admin cần; GỬI thì chỉ người đã nhận. */
  it('admin chưa nhận thì đọc được nhưng KHÔNG gửi được', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'quên mật khẩu')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    const cuaA = await quyenTruyCapPhien(adminA, phienHoTro)
    const cuaB = await quyenTruyCapPhien(adminB, phienHoTro)

    expect(cuaA?.duocGui).toBe(true)
    expect(cuaB?.vai).toBe('ADMIN_HO_TRO')
    expect(cuaB?.duocGui).toBe(false)
  })

  it('nhà tuyển dụng không liên quan thì không đọc được ticket hỗ trợ', async () => {
    expect(await quyenTruyCapPhien(ntd, phienHoTro)).toBeNull()
  })

  it('phòng socket của ba vai khác nhau hoàn toàn', async () => {
    const chu = await quyenTruyCapPhien(sv, phienHoTro)
    const ad = await quyenTruyCapPhien(adminA, phienHoTro)
    const ntdQ = await quyenTruyCapPhien(ntd, phienTuyenDung)

    expect(new Set([chu?.phong, ad?.phong, ntdQ?.phong]).size).toBe(3)
  })
})

describe('máy trạng thái hỗ trợ', () => {
  it('yêu cầu đưa sang WAITING_ADMIN, không cần ai được chỉ định trước', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'Em không đăng nhập được')

    const p = await doc()
    expect(p.state).toBe('WAITING_ADMIN')
    expect(p.handoffAdminUserId).toBeNull()
    expect(p.handoffRequestedAt).not.toBeNull()
  })

  it('tiếp nhận ghi luôn ai nhận, trong cùng một câu lệnh', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    const p = await doc()
    expect(p.state).toBe('HUMAN_ACTIVE')
    expect(p.handoffAdminUserId).toBe(adminA.id)
  })

  it('huỷ yêu cầu quay về AI_ACTIVE', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await huyYeuCauHoTro(sv.id, phienHoTro)
    expect((await doc()).state).toBe('AI_ACTIVE')
  })

  it('hai admin cùng tiếp nhận: đúng MỘT người thắng', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    const kq = await Promise.allSettled([
      tiepNhanHoTro(adminA.id, phienHoTro),
      tiepNhanHoTro(adminB.id, phienHoTro),
    ])

    expect(kq.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const p = await doc()
    expect([adminA.id, adminB.id]).toContain(p.handoffAdminUserId)
  })

  it('admin kết thúc thì ghi đúng ai đóng', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await tiepNhanHoTro(adminA.id, phienHoTro)
    const kq = await ketThuc(adminA, phienHoTro)

    expect(kq.tin.body).toContain('Quản trị viên')
    expect((await doc()).closedByUserId).toBe(adminA.id)
  })

  /*
   * =======================================================================
   * CA NÀY CHẶN "ADMIN NÓI CHUYỆN VỚI CHÍNH MÌNH"
   * =======================================================================
   * `guiTinNhan` từng ghi `role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT'`, nên
   * câu trả lời của admin nằm trong database dưới nhãn STUDENT — trùng đúng
   * nhãn của người đang xin hỗ trợ.
   *
   * Không có lỗi nào bắn ra: cả hai bên vẫn nhận đủ tin. Chỉ là giao diện
   * không còn cách nào vẽ đúng ai nói câu nào, và đọc lại một ticket cũ thì
   * nó là một người tự nói chuyện với mình.
   *
   * Nhãn của HAI bên phải khác nhau — đó mới là điều cần khẳng định, chứ
   * không phải riêng chuỗi 'ADMIN'.
   */
  it('nhãn người gửi phân biệt được admin với người xin hỗ trợ', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    await guiTinNhan(sv, phienHoTro, 'cm-sv-1', 'em cần giúp ạ')
    await guiTinNhan(adminA, phienHoTro, 'cm-ad-1', 'chào bạn, mình xem giúp nhé')

    const ds = await prisma.chatMessage.findMany({
      where: { sessionId: phienHoTro, senderType: { not: 'SYSTEM' } },
      orderBy: { seq: 'asc' },
      select: { senderType: true, senderUserId: true },
    })

    const cuaSV = ds.find((t) => t.senderUserId === sv.id)
    const cuaAdmin = ds.find((t) => t.senderUserId === adminA.id)

    expect(cuaSV?.senderType).toBe('STUDENT')
    expect(cuaAdmin?.senderType).toBe('ADMIN')
    expect(cuaSV?.senderType).not.toBe(cuaAdmin?.senderType)
  })

  it('người dùng nhận thông báo khi admin tiếp nhận', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    const tb = await prisma.notification.findFirst({
      where: { userId: sv.id, type: 'CHAT_HANDOFF_ACCEPTED' },
    })
    expect(tb).not.toBeNull()
  })

  it('hàng đợi hiện cả việc chưa ai nhận lẫn việc đang xử', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'Em không đăng nhập được')
    const cho = await hangDoiHoTro()
    expect(cho.hoTro.find((h) => h.sessionId === phienHoTro)?.state).toBe('WAITING_ADMIN')

    await tiepNhanHoTro(adminA.id, phienHoTro)
    const dangXu = await hangDoiHoTro()
    expect(dangXu.hoTro.find((h) => h.sessionId === phienHoTro)?.state).toBe('HUMAN_ACTIVE')
  })

  /*
   * =======================================================================
   * CA NÀY CHẶN "HÀNG ĐỢI TỰ MÔ TẢ CHÍNH NÓ"
   * =======================================================================
   * `moTaDau` lấy tin hệ thống ĐẦU TIÊN — câu người dùng gõ lúc xin hỗ trợ.
   * Bản trước lấy tin MỚI NHẤT (`desc`), nên ngay sau khi admin bấm tiếp nhận
   * thì dòng mô tả đổi thành "Quản trị viên đã tiếp nhận." và nội dung người
   * dùng viết biến mất khỏi hàng đợi.
   *
   * Phải khẳng định SAU khi tiếp nhận: trước đó chỉ có đúng một tin hệ thống
   * nên `asc` và `desc` cho cùng kết quả, và ca kiểm sẽ luôn xanh.
   */
  /*
   * =======================================================================
   * KHÔNG CÒN ĐƯỜNG NÀO MỞ TICKET THỨ HAI
   * =======================================================================
   * Bản trước có chuỗi khai thác: xin hỗ trợ → admin nhận → `quay-lai-ai` →
   * xin tiếp. Mỗi vòng một ticket mới, tất cả cùng mở, hàng đợi admin ngập.
   *
   * Hai thứ cùng xoá nó: `quayLaiAi` không còn tồn tại, và chỉ mục
   * `chat_mot_luong_ho_tro` khoá theo NGƯỜI chứ không theo `state` — nên kể
   * cả một hàm tương lai đẩy state về đâu thì luồng thứ hai vẫn bị chặn.
   *
   * Ca này kiểm lớp DATABASE, lớp sống sót được qua mọi lần viết thêm hàm.
   */
  it('không mở được luồng hỗ trợ thứ hai, dù state bị đẩy về AI_ACTIVE', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    /* Đi thẳng vào database — mô phỏng một hàm tương lai quên kiểm `kind`. */
    await prisma.chatSession.update({
      where: { id: phienHoTro },
      data: { state: 'AI_ACTIVE' },
    })

    await expect(
      prisma.chatSession.create({
        data: {
          kind: 'AI_SUPPORT',
          ownerUserId: sv.id,
          clientSessionId: 'luong:ho-tro-2',
          state: 'WAITING_ADMIN',
          handoffRequestedAt: new Date(),
        },
      }),
    ).rejects.toThrow()
  })

  it('mô tả trong hàng đợi vẫn là câu người dùng viết, sau khi admin tiếp nhận', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'Em không đăng nhập được')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    const { hoTro } = await hangDoiHoTro()
    const muc = hoTro.find((h) => h.sessionId === phienHoTro)

    expect(muc?.moTaDau).toBe('Em không đăng nhập được')
  })

  /*
   * =======================================================================
   * CA NÀY CHẶN "SINH VIÊN NHÌN MỘT HỘI THOẠI TRỐNG"
   * =======================================================================
   * Lỗi thật 2026-09-30: một tài khoản có HAI luồng AI_SUPPORT — một
   * HUMAN_ACTIVE seq 7 (admin đang trả lời) và một AI_ACTIVE seq 0 (màn hình
   * sinh viên đang mở). Nguyên nhân: client chọn luồng bằng một khoá trong
   * localStorage, trong khi server mới giữ luật "mỗi người một ticket".
   *
   * Giờ `moLuong` KHÔNG nhận khoá nào cả — nó suy từ `kind` cộng người đang
   * đăng nhập. Client không có gì để chọn, nên cũng không có gì để chọn sai.
   */
  it('mở kênh hỗ trợ luôn ra đúng luồng đang có, không đẻ luồng mới', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'Em không đăng nhập được')
    await tiepNhanHoTro(adminA.id, phienHoTro)

    const lai = await moLuong(sv.id, 'STUDENT', 'AI_SUPPORT')

    expect(lai.sessionId).toBe(phienHoTro)
    expect(lai.state).toBe('HUMAN_ACTIVE')
    expect(lai.vuaTao).toBe(false)
    expect(
      await prisma.chatSession.count({ where: { ownerUserId: sv.id, kind: 'AI_SUPPORT' } }),
    ).toBe(1)
  })

  it('hàng đợi KHÔNG lẫn hội thoại tuyển dụng vào', async () => {
    const { hoTro } = await hangDoiHoTro()
    expect(hoTro.find((h) => h.sessionId === phienTuyenDung)).toBeUndefined()
  })
})

/*
 * Năm CHECK viết lại cho ba kênh. Chúng nằm trong migration viết tay, nên
 * `prisma db push` dựng database KHÔNG có cái nào và không báo gì.
 */
describe('CHECK theo kênh', () => {
  it('AI_SUPPORT KHÔNG vào được WAITING_EMPLOYER', async () => {
    await expect(
      prisma.chatSession.update({
        where: { id: phienHoTro },
        data: { state: 'WAITING_EMPLOYER' },
      }),
    ).rejects.toThrow(/chat_trang_thai_theo_kenh|chat_handoff_du_thong_tin/)
  })

  it('AI_STUDENT KHÔNG vào được WAITING_ADMIN', async () => {
    await expect(
      prisma.chatSession.update({
        where: { id: phienTuyenDung },
        data: { state: 'WAITING_ADMIN' },
      }),
    ).rejects.toThrow(/chat_trang_thai_theo_kenh|chat_handoff_du_thong_tin/)
  })

  it('chỉ AI_SUPPORT mới được gán admin', async () => {
    await expect(
      prisma.chatSession.update({
        where: { id: phienTuyenDung },
        data: { handoffAdminUserId: adminA.id },
      }),
    ).rejects.toThrow(/chat_admin_chi_ho_tro/)
  })

  it('HUMAN_ACTIVE ở kênh hỗ trợ mà chưa có admin thì bị từ chối', async () => {
    await expect(
      prisma.chatSession.update({
        where: { id: phienHoTro },
        data: { state: 'HUMAN_ACTIVE' },
      }),
    ).rejects.toThrow(/chat_dang_noi_biet_voi_ai/)
  })

  /*
   * Chỉ mục một phần `chat_mot_ho_tro_dang_mo`.
   *
   * ---------------------------------------------------------------------
   * KHẲNG ĐỊNH TRÊN TÊN CỘT, KHÔNG TRÊN TÊN CHỈ MỤC — và lý do đáng nhớ
   * ---------------------------------------------------------------------
   * Với CHECK thì thông điệp thô của Postgres đi thẳng qua Prisma, nên tên
   * ràng buộc còn nguyên và các ca ở trên khẳng định được trên nó.
   *
   * Với UNIQUE thì KHÔNG: Prisma chuẩn hoá thành P2002 và chỉ giữ danh sách
   * CỘT — "Unique constraint failed on the fields: (`ownerUserId`)". Tên chỉ
   * mục biến mất.
   *
   * `ownerUserId` một mình chỉ unique trong đúng chỉ mục này (khoá kia là
   * `(ownerUserId, clientSessionId)`, hai cột), nên khẳng định trên nó vẫn
   * chỉ đúng một ràng buộc.
   */
  it('một người chỉ MỘT ticket hỗ trợ đang mở', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')

    await expect(
      prisma.chatSession.create({
        data: {
          kind: 'AI_SUPPORT',
          ownerUserId: sv.id,
          clientSessionId: 'cs-ho-tro-2',
          state: 'WAITING_ADMIN',
          handoffRequestedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/Unique constraint failed on the fields: \(`ownerUserId`\)/)
  })

  /* Đóng ticket cũ rồi thì mở được ticket mới — chỉ mục là MỘT PHẦN. */
  /*
   * Đóng ticket rồi thì CHÍNH luồng đó mở lại, mang theo lịch sử — không phải
   * một hàng mới. Đó là khác biệt giữa một hộp thư và một tập phiếu dùng một
   * lần, và nó là thứ người dùng thấy: lần sau xin hỗ trợ vẫn đọc lại được
   * quản trị viên đã trả lời gì hôm trước.
   */
  it('đóng ticket rồi thì CHÍNH luồng đó mở lại, lịch sử còn nguyên', async () => {
    await yeuCauHoTro(sv.id, phienHoTro, 'x')
    await tiepNhanHoTro(adminA.id, phienHoTro)
    await ketThuc(adminA, phienHoTro)
    const soTinCu = await prisma.chatMessage.count({ where: { sessionId: phienHoTro } })

    const lai = await moLuong(sv.id, 'STUDENT', 'AI_SUPPORT')
    expect(lai.sessionId).toBe(phienHoTro)

    await yeuCauHoTro(sv.id, phienHoTro, 'em cần hỏi lại')
    expect((await doc()).state).toBe('WAITING_ADMIN')
    expect(await prisma.chatMessage.count({ where: { sessionId: phienHoTro } })).toBe(
      soTinCu + 1,
    )
  })
})
