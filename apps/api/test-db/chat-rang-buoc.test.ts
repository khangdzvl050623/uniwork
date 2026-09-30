import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * Năm CHECK và ba chỉ mục của `chat_sessions` — chạy trên PostgreSQL THẬT.
 *
 * Chúng được viết TAY trong migration. Prisma không biết chúng tồn tại: không
 * nằm trong schema.prisma, nên `prisma validate` không kiểm và `prisma db push`
 * dựng ra database KHÔNG có ràng buộc nào.
 *
 * Nghĩa là chúng có thể biến mất mà không công cụ nào kêu lên — và thứ chúng
 * canh là "một người có hai luồng tới cùng một nơi" cùng "nhà tuyển dụng đọc
 * được hội thoại không phải của mình", hai loại lỗi không tự lộ.
 *
 * ===========================================================================
 * BA CHỈ MỤC LÀ ĐỊNH NGHĨA CỦA "MỘT LUỒNG MỖI ĐỐI TƯỢNG"
 * ===========================================================================
 * Không phải tối ưu truy vấn. Chúng LÀ cái luật ấy, và chúng không neo vào
 * `state` — luồng vĩnh viễn thì không có câu hỏi "còn mở không". Hai lần trước
 * chỉ mục neo vào `state` và cả hai lần đều hỏng đúng một kiểu.
 */

const prisma = new PrismaClient()

let userId: string
let studentProfileId: string
let employerProfileId: string
let employerKhacId: string
let jobId: string

/** Mặc định là một luồng trợ lý hợp lệ; mỗi ca sửa đúng thứ nó muốn phá. */
const phien = (sua: Record<string, unknown>) =>
  prisma.chatSession.create({
    data: {
      kind: 'AI_STUDENT',
      ownerUserId: userId,
      clientSessionId: 'luong:tro-ly',
      studentProfileId,
      ...sua,
    },
  })

/** Một luồng NTD hợp lệ; dùng làm nền cho các ca về kênh đó. */
const phienNTD = (sua: Record<string, unknown> = {}) =>
  phien({
    kind: 'NTD',
    clientSessionId: `luong:ntd:${employerProfileId}`,
    handoffEmployerProfileId: employerProfileId,
    jobId,
    state: 'WAITING_EMPLOYER',
    ...sua,
  })

beforeEach(async () => {
  const u = await prisma.user.findFirstOrThrow({
    where: { role: 'STUDENT', studentProfile: { isNot: null } },
    select: { id: true, studentProfile: { select: { id: true } } },
  })
  userId = u.id
  studentProfileId = u.studentProfile!.id

  const hs = await prisma.employerProfile.findMany({ select: { id: true }, take: 2 })
  employerProfileId = hs[0]!.id
  employerKhacId = hs[1]?.id ?? hs[0]!.id
  jobId = (await prisma.job.findFirstOrThrow({ select: { id: true } })).id

  const cu = await prisma.chatSession.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  })
  if (cu.length > 0) {
    const ids = cu.map((c) => c.id)
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.chatSession.deleteMany({ where: { id: { in: ids } } })
  }
})

afterAll(async () => {
  const cu = await prisma.chatSession.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  })
  const ids = cu.map((c) => c.id)
  await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids } } })
  await prisma.chatSession.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
})

describe('CHECK — mỗi kênh mang đúng cột của nó', () => {
  it('AI_STUDENT mà thiếu studentProfileId thì bị từ chối', async () => {
    await expect(phien({ studentProfileId: null })).rejects.toThrow(/chat_kind_student_profile/)
  })

  it('AI_EMPLOYER mà CÓ studentProfileId thì bị từ chối', async () => {
    await expect(phien({ kind: 'AI_EMPLOYER' })).rejects.toThrow(/chat_kind_student_profile/)
  })

  it('kênh KHÔNG phải NTD mà có người nhận handoff thì bị từ chối', async () => {
    await expect(phien({ handoffEmployerProfileId: employerProfileId })).rejects.toThrow(
      /chat_ntd_du_doi_tuong/,
    )
  })

  /*
   * `handoffEmployerProfileId` là NỬA KHOÁ TỰ NHIÊN của luồng NTD, không phải
   * một cột đặt sau. Thiếu nó thì luồng không có danh tính, và chỉ mục
   * `chat_mot_luong_ntd` (phủ theo cột đó) cũng không phủ được hàng này.
   */
  it('NTD mà thiếu người nhận hoặc thiếu tin thì bị từ chối', async () => {
    await expect(phienNTD({ handoffEmployerProfileId: null })).rejects.toThrow(
      /chat_ntd_du_doi_tuong/,
    )
    await expect(phienNTD({ jobId: null })).rejects.toThrow(/chat_ntd_du_doi_tuong/)
  })

  it('handoffAdminUserId chỉ có ở kênh hỗ trợ', async () => {
    await expect(phien({ handoffAdminUserId: userId })).rejects.toThrow(/chat_admin_chi_ho_tro/)
  })
})

/*
 * ===========================================================================
 * CA QUAN TRỌNG NHẤT FILE — LUỒNG TRỢ LÝ LÀ VĨNH VIỄN
 * ===========================================================================
 * "Hôm nay hỏi tiếp dựa trên nội dung hôm qua" là hệ quả của ĐÚNG ràng buộc
 * dưới đây, không phải của giao diện: luồng trợ lý không có trạng thái nào
 * ngoài `AI_ACTIVE`, nên không có đường nào đóng nó lại.
 *
 * Bỏ vế này đi thì không màn hình nào đỏ — chỉ là vài tháng sau có người viết
 * một hàm đóng luồng trợ lý, và lịch sử của người dùng biến mất.
 */
describe('CHECK — trạng thái nào hợp lệ ở kênh nào', () => {
  it('luồng trợ lý KHÔNG đóng được, và KHÔNG chờ ai được', async () => {
    await expect(phien({ state: 'CLOSED' })).rejects.toThrow(/chat_trang_thai_theo_kenh/)
    await expect(phien({ state: 'WAITING_EMPLOYER' })).rejects.toThrow(
      /chat_trang_thai_theo_kenh/,
    )
    await expect(phien({ state: 'HUMAN_ACTIVE' })).rejects.toThrow(
      /chat_trang_thai_theo_kenh|chat_dang_noi_biet_voi_ai/,
    )
  })

  /* Ngược lại: luồng NTD không bao giờ ở `AI_ACTIVE` — không có trợ lý nào trong đó. */
  it('luồng NTD KHÔNG vào được AI_ACTIVE', async () => {
    await expect(phienNTD({ state: 'AI_ACTIVE' })).rejects.toThrow(/chat_trang_thai_theo_kenh/)
  })

  it('đang nói trực tiếp mà không biết nói với ai thì bị từ chối', async () => {
    await expect(
      phien({
        kind: 'AI_SUPPORT',
        studentProfileId: null,
        clientSessionId: 'luong:ho-tro',
        state: 'HUMAN_ACTIVE',
      }),
    ).rejects.toThrow(/chat_dang_noi_biet_voi_ai/)
  })

  it('hàng HỢP LỆ vẫn lưu được — ràng buộc không chặt quá tay', async () => {
    expect((await phienNTD()).state).toBe('WAITING_EMPLOYER')
    expect((await phien({})).state).toBe('AI_ACTIVE')
  })
})

/**
 * Khẳng định lỗi TRÙNG KHOÁ theo tên CỘT, không theo tên chỉ mục.
 *
 * Prisma chuẩn hoá P2002 thành `meta.target` là danh sách cột và VỨT tên chỉ
 * mục đi — đo thật: `{"modelName":"ChatSession","target":["ownerUserId"]}`.
 * Nên `toThrow(/chat_mot_luong_tro_ly/)` không bao giờ khớp, dù chỉ mục đang
 * chạy hoàn hảo.
 *
 * Khác hẳn CHECK: Postgres trả nguyên văn tên ràng buộc, nên các ca ở trên
 * khẳng định được theo tên.
 */
async function moTrungKhoa(fn: () => Promise<unknown>, cot: string[]) {
  const loi = await fn().then(
    () => null,
    (e: unknown) => e as { code?: string; meta?: { target?: string[] } },
  )
  expect(loi?.code, 'phải là lỗi trùng khoá P2002').toBe('P2002')
  expect(loi?.meta?.target).toEqual(cot)
}

describe('chỉ mục — một luồng cho mỗi đối tượng', () => {
  it('hai luồng trợ lý cho cùng một người thì bị chặn', async () => {
    await phien({})
    await moTrungKhoa(() => phien({ clientSessionId: 'luong:khac' }), ['ownerUserId'])
  })

  /*
   * Chặn theo NGƯỜI, không theo `kind`: một tài khoản chỉ có MỘT luồng trợ lý,
   * dù nó là `AI_STUDENT` hay `AI_EMPLOYER`. Hai kind đó là hai vai của cùng
   * một thứ — "tôi và trợ lý" — nên tách ra là chia đôi lịch sử.
   */
  it('luồng AI_EMPLOYER cũng tính là luồng trợ lý', async () => {
    await phien({})
    await moTrungKhoa(
      () => phien({ kind: 'AI_EMPLOYER', studentProfileId: null, clientSessionId: 'luong:khac' }),
      ['ownerUserId'],
    )
  })

  it('hai luồng hỗ trợ cho cùng một người thì bị chặn', async () => {
    const hoTro = (k: string) =>
      phien({ kind: 'AI_SUPPORT', studentProfileId: null, clientSessionId: k })

    await hoTro('luong:ho-tro')
    await moTrungKhoa(() => hoTro('luong:ho-tro-2'), ['ownerUserId'])
  })

  it('hai luồng tới CÙNG nhà tuyển dụng thì bị chặn', async () => {
    await phienNTD()
    await moTrungKhoa(() => phienNTD({ clientSessionId: 'luong:ntd:khac-khoa' }), [
      'ownerUserId',
      'handoffEmployerProfileId',
    ])
  })

  /*
   * Và đây là vế còn lại — thứ làm cả mô hình có nghĩa. Chặn quá tay ở đây thì
   * sinh viên không hỏi được nơi thứ hai, đúng cái hạn chế vừa được gỡ bỏ.
   */
  it('luồng tới nhà tuyển dụng KHÁC thì KHÔNG bị chặn', async () => {
    await phienNTD()
    const b = await phienNTD({
      clientSessionId: `luong:ntd:${employerKhacId}`,
      handoffEmployerProfileId: employerKhacId,
    })
    expect(b.handoffEmployerProfileId).toBe(employerKhacId)
  })
})

describe('chống trùng tin nhắn', () => {
  it('cùng luồng + cùng clientMessageId thì không tạo được tin thứ hai', async () => {
    const s = await phien({})
    const tin = (seq: number) =>
      prisma.chatMessage.create({
        data: {
          sessionId: s.id,
          seq,
          senderType: 'STUDENT',
          senderUserId: userId,
          clientMessageId: 'uuid-abc',
          body: 'xin chào',
        },
      })

    await tin(1)
    await expect(tin(2)).rejects.toThrow() // khác seq, nhưng trùng clientMessageId
  })

  it('hai tin cùng seq trong một luồng thì bị từ chối', async () => {
    const s = await phien({})
    const tin = (clientMessageId: string) =>
      prisma.chatMessage.create({
        data: { sessionId: s.id, seq: 1, senderType: 'AI', clientMessageId, body: 'x' },
      })

    await tin('a')
    await expect(tin('b')).rejects.toThrow()
  })
})
