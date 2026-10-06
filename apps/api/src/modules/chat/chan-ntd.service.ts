import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'
import { ghiTinHeThong, phatTinMoi, phatTrangThai } from './chat.service.js'

/**
 * Sinh viên chặn một nhà tuyển dụng — chỉ phần nhắn tin.
 *
 * ===========================================================================
 * CHẶN LÀM GÌ, VÀ KHÔNG LÀM GÌ
 * ===========================================================================
 *   Làm:  đóng luồng đang mở với nơi đó; nhà tuyển dụng không mở lời lại được,
 *         kể cả từ đơn ứng tuyển (`ntdChuDongTraoDoi`).
 *   Không: đụng tới đơn ứng tuyển — nhà tuyển dụng vẫn xem và xử lý đơn. Không
 *         báo cho nhà tuyển dụng: họ chỉ thấy cuộc trò chuyện kết thúc, cùng câu
 *         với khi sinh viên bấm "Kết thúc".
 *
 * Sinh viên muốn hỏi lại nơi đã chặn thì phải bỏ chặn trước — như Messenger.
 * Tự bỏ chặn khi họ bấm "hỏi nhà tuyển dụng" là để một cú bấm nhầm xoá mất một
 * quyết định họ đã cân nhắc.
 *
 * ---------------------------------------------------------------------------
 * CHẶN THEO LUỒNG, KHÔNG THEO MÃ NHÀ TUYỂN DỤNG
 * ---------------------------------------------------------------------------
 * Đường vào là `sessionId` của luồng NTD mà sinh viên sở hữu, và nhà tuyển dụng
 * bị chặn suy ra TỪ luồng đó. Nhận thẳng `employerProfileId` từ client thì
 * phải kiểm thêm "người này có thật sự liên quan tới nơi kia không" — còn đây,
 * có luồng của chính mình với nơi đó tức là đã có.
 */

/** Luồng NTD của CHÍNH người gọi. 404 cho mọi trường hợp khác — xem `chat.access.ts`. */
async function luongNTDCuaChu(userId: string, sessionId: string) {
  const p = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, kind: true, ownerUserId: true, handoffEmployerProfileId: true },
  })
  if (!p || p.ownerUserId !== userId || p.kind !== 'NTD' || !p.handoffEmployerProfileId) {
    throw notFound('Không tìm thấy hội thoại')
  }
  return { sessionId: p.id, employerProfileId: p.handoffEmployerProfileId }
}

/** Sinh viên đã chặn nhà tuyển dụng này chưa. Nhận cả transaction client. */
export async function daChan(
  db: Prisma.TransactionClient,
  studentUserId: string,
  employerProfileId: string,
): Promise<boolean> {
  const hang = await db.employerBlock.findUnique({
    where: { studentUserId_employerProfileId: { studentUserId, employerProfileId } },
    select: { id: true },
  })
  return hang !== null
}

export interface KetQuaChan {
  sessionId: string
  daChan: boolean
  /** Trạng thái luồng SAU thao tác. */
  state: string
}

/**
 * Chặn nhà tuyển dụng của luồng này. Bấm hai lần không lỗi.
 *
 * Ghi chặn và đóng luồng trong CÙNG transaction: tách ra thì có khoảnh khắc đã
 * chặn mà luồng còn mở — nhà tuyển dụng vẫn gửi được tin vào đúng khe đó.
 */
export async function chanNhaTuyenDung(userId: string, sessionId: string): Promise<KetQuaChan> {
  const luong = await luongNTDCuaChu(userId, sessionId)

  const kq = await prisma.$transaction(async (tx) => {
    await tx.employerBlock.upsert({
      where: {
        studentUserId_employerProfileId: {
          studentUserId: userId,
          employerProfileId: luong.employerProfileId,
        },
      },
      create: { studentUserId: userId, employerProfileId: luong.employerProfileId },
      update: {},
    })

    /* Đã đóng thì thôi — chặn vẫn ghi, chỉ là không có gì để đóng. */
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: { in: ['WAITING_EMPLOYER', 'HUMAN_ACTIVE'] } },
      data: { state: 'CLOSED', closedAt: new Date(), closedByUserId: userId },
    })
    if (doi.count === 0) return null

    /*
     * CÙNG câu với `ketThuc` của chủ luồng — cố ý. Nhà tuyển dụng không cần,
     * và không nên, biết mình bị chặn hay chỉ là cuộc trò chuyện kết thúc.
     */
    return ghiTinHeThong(tx, sessionId, 'Người dùng đã kết thúc hội thoại.')
  })

  if (kq) {
    phatTinMoi(sessionId, kq)
    phatTrangThai(sessionId, 'CLOSED', userId)
  }
  return { sessionId, daChan: true, state: 'CLOSED' }
}

/** Bỏ chặn. Luồng vẫn ĐÓNG — mở lại là việc của lần hỏi kế tiếp, từ một trong hai bên. */
export async function boChanNhaTuyenDung(userId: string, sessionId: string): Promise<KetQuaChan> {
  const luong = await luongNTDCuaChu(userId, sessionId)

  await prisma.employerBlock.deleteMany({
    where: { studentUserId: userId, employerProfileId: luong.employerProfileId },
  })

  const p = await prisma.chatSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { state: true },
  })
  return { sessionId, daChan: false, state: p.state }
}
