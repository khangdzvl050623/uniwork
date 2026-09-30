import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * Bốn CHECK constraint của `chat_sessions` — chạy trên PostgreSQL THẬT.
 *
 * Chúng được viết TAY trong migration. Prisma không biết chúng tồn tại:
 * không nằm trong schema.prisma, nên `prisma validate` không kiểm và
 * `prisma db push` dựng ra database KHÔNG có ràng buộc nào.
 *
 * Nghĩa là chúng có thể biến mất mà không công cụ nào kêu lên — và thứ chúng
 * canh là "NTD đọc được hội thoại riêng của người khác", loại lỗi không tự lộ.
 *
 * Cùng lớp với test-db/rang-buoc.test.ts của Sprint 2.
 */

const prisma = new PrismaClient()

let userId: string
let studentProfileId: string
let employerProfileId: string
let dem = 0

/** Mỗi ca một clientSessionId khác nhau — unique (owner, clientSessionId). */
const phien = (sua: Record<string, unknown>) =>
  prisma.chatSession.create({
    data: {
      kind: 'AI_STUDENT',
      ownerUserId: userId,
      clientSessionId: `test-${dem++}`,
      studentProfileId,
      ...sua,
    },
  })

beforeEach(async () => {
  const u = await prisma.user.findFirstOrThrow({
    where: { role: 'STUDENT', studentProfile: { isNot: null } },
    select: { id: true, studentProfile: { select: { id: true } } },
  })
  userId = u.id
  studentProfileId = u.studentProfile!.id
  employerProfileId = (await prisma.employerProfile.findFirstOrThrow({ select: { id: true } })).id
  await prisma.chatSession.deleteMany({ where: { ownerUserId: userId } })
})

afterAll(async () => {
  await prisma.chatSession.deleteMany({ where: { ownerUserId: userId } })
  await prisma.$disconnect()
})

describe('CHECK — hai vai không lẫn vào nhau', () => {
  it('AI_STUDENT mà thiếu studentProfileId thì bị từ chối', async () => {
    await expect(phien({ studentProfileId: null })).rejects.toThrow(/chat_kind_student_profile/)
  })

  it('AI_EMPLOYER mà CÓ studentProfileId thì bị từ chối', async () => {
    await expect(phien({ kind: 'AI_EMPLOYER' })).rejects.toThrow(/chat_kind_student_profile/)
  })

  it('AI_EMPLOYER mà có người nhận handoff thì bị từ chối', async () => {
    await expect(
      phien({
        kind: 'AI_EMPLOYER',
        studentProfileId: null,
        handoffEmployerProfileId: employerProfileId,
      }),
    ).rejects.toThrow(/chat_employer_khong_handoff/)
  })

  /*
   * ---------------------------------------------------------------------
   * HAI RÀNG BUỘC CÙNG CHẶN CA NÀY — và đó là điều đáng ghi lại
   * ---------------------------------------------------------------------
   * Tên đổi ở migration `chat_ho_tro`: `chat_employer_trang_thai` →
   * `chat_trang_thai_theo_kenh`. Bản cũ viết theo lối phủ định
   * ("kind = 'AI_STUDENT' OR state IN …"), nên thêm kênh AI_SUPPORT là vế đó
   * im lặng cho kênh mới đi qua. Bản mới liệt kê tường minh cả ba kind.
   *
   * Nhưng đổi xong thì ca này bắt đầu báo `chat_handoff_du_thong_tin`:
   * AI_EMPLOYER ở HUMAN_ACTIVE vi phạm CẢ HAI, và Postgres chỉ nêu cái nó gặp
   * trước. Rà lại thì hai ràng buộc chồng lấn gần hết — `du_thong_tin` liệt kê
   * từng (kind, state) hợp lệ nên nó cũng loại mọi tổ hợp mà `theo_kenh` loại.
   *
   * GIỮ CẢ HAI, có chủ đích: `theo_kenh` phát biểu luật ở dạng đọc được
   * ("kênh nào được ở trạng thái nào"), `du_thong_tin` phát biểu ở dạng "rời
   * AI_ACTIVE thì phải có đủ cột nào". Sửa nhầm một cái thì cái kia còn đỡ.
   *
   * Vì vậy ca này nhận một trong hai tên, và nói rõ vì sao — chứ không hạ
   * xuống "chỉ cần có ném": ném vì một ràng buộc chẳng liên quan thì test
   * xanh mà điều cần kiểm lại không được kiểm.
   */
  it('AI_EMPLOYER KHÔNG vào được WAITING_EMPLOYER hay HUMAN_ACTIVE', async () => {
    await expect(
      phien({ kind: 'AI_EMPLOYER', studentProfileId: null, state: 'HUMAN_ACTIVE' }),
    ).rejects.toThrow(/chat_trang_thai_theo_kenh|chat_handoff_du_thong_tin/)
  })

  it('rời AI_ACTIVE mà thiếu người nhận / tin / mốc đọc thì bị từ chối', async () => {
    await expect(phien({ state: 'WAITING_EMPLOYER' })).rejects.toThrow(/chat_handoff_du_thong_tin/)
  })

  it('hàng HỢP LỆ vẫn lưu được — ràng buộc không chặt quá tay', async () => {
    const job = await prisma.job.findFirstOrThrow({ select: { id: true } })
    const s = await phien({
      state: 'WAITING_EMPLOYER',
      handoffEmployerProfileId: employerProfileId,
      jobId: job.id,
      employerVisibleFromSeq: 1,
    })
    expect(s.state).toBe('WAITING_EMPLOYER')
  })
})

describe('chống trùng', () => {
  it('cùng chủ + cùng clientSessionId thì không tạo được phiên thứ hai', async () => {
    const k = `trung-${Date.now()}`
    await phien({ clientSessionId: k })
    await expect(phien({ clientSessionId: k })).rejects.toThrow()
  })

  it('cùng phiên + cùng clientMessageId thì không tạo được tin thứ hai', async () => {
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

  it('hai tin cùng seq trong một phiên thì bị từ chối', async () => {
    const s = await phien({})
    const tin = (clientMessageId: string) =>
      prisma.chatMessage.create({
        data: { sessionId: s.id, seq: 1, senderType: 'AI', clientMessageId, body: 'x' },
      })

    await tin('a')
    await expect(tin('b')).rejects.toThrow()
  })
})
