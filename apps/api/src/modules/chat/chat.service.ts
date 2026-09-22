import type { ChatKind, ChatSenderType, Prisma, Role } from '@prisma/client'
import type { ModelMessage } from '@uniwork/ai-runtime'
import { aiConfig, DangBanError, giuLuot } from '@uniwork/ai-runtime'
import { prisma } from '../../lib/prisma.js'
import { conflict, forbidden, notFound, AppError } from '../../lib/errors.js'
import { phongChu, phongNTD, quyenTruyCapPhien, type QuyenTruyCap } from './chat.access.js'
import { dongCursor, moCursor } from './cursor.js'
import { phatToiPhong } from './phat-su-kien.js'
import { PROMPT_VERSION } from './prompts/he-thong-sinh-vien.js'

/* ================================================================ phiên -- */

export interface TaoPhienInput {
  kind: ChatKind
  clientSessionId: string
  jobId?: string
}

export interface PhienResponse {
  sessionId: string
  kind: ChatKind
  state: string
  jobId: string | null
}

/**
 * Tạo phiên, hoặc trả lại phiên đã có.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TÁCH KHỎI `/api/tro-ly/hoi`
 * ---------------------------------------------------------------------------
 * Endpoint này RẺ: không chạm model, không tốn lượt, gọi lại bao nhiêu lần cũng
 * ra cùng một kết quả. Gộp việc tạo phiên vào lượt hỏi thì mỗi lần thử lại
 * (mạng chập chờn, người dùng bấm hai lần) đều có nguy cơ sinh thêm một phiên —
 * và khoá chống trùng trên tin nhắn không cứu được, vì `sessionId` đã khác nhau
 * thì hai tin không còn đụng nhau nữa.
 *
 * `clientSessionId` do trình duyệt sinh và giữ nguyên qua mọi lần thử lại.
 */
export async function taoPhien(
  userId: string,
  role: Role,
  input: TaoPhienInput,
): Promise<PhienResponse> {
  if (input.kind === 'AI_STUDENT' && role !== 'STUDENT') {
    throw forbidden('Phiên trợ lý sinh viên chỉ dành cho tài khoản sinh viên')
  }
  if (input.kind === 'AI_EMPLOYER' && role !== 'EMPLOYER') {
    throw forbidden('Phiên trợ lý nhà tuyển dụng chỉ dành cho tài khoản nhà tuyển dụng')
  }

  const daCo = await prisma.chatSession.findUnique({
    where: { ownerUserId_clientSessionId: { ownerUserId: userId, clientSessionId: input.clientSessionId } },
    select: { id: true, kind: true, state: true, jobId: true },
  })
  if (daCo) return { sessionId: daCo.id, kind: daCo.kind, state: daCo.state, jobId: daCo.jobId }

  /*
   * CHECK constraint `chat_kind_student_profile` đòi AI_STUDENT phải có
   * studentProfileId. Tra ở đây chứ không để database ném: lỗi CHECK của
   * Postgres đọc lên là "new row violates check constraint" — không nói được
   * cho người dùng điều gì.
   */
  let studentProfileId: string | null = null
  if (input.kind === 'AI_STUDENT') {
    const hoSo = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!hoSo) throw notFound('Chưa có hồ sơ sinh viên')
    studentProfileId = hoSo.id
  }

  try {
    const p = await prisma.chatSession.create({
      data: {
        kind: input.kind,
        ownerUserId: userId,
        clientSessionId: input.clientSessionId,
        studentProfileId,
        jobId: input.jobId ?? null,
      },
      select: { id: true, kind: true, state: true, jobId: true },
    })
    return { sessionId: p.id, kind: p.kind, state: p.state, jobId: p.jobId }
  } catch (e) {
    /*
     * Hai request tạo phiên chạy song song: cái thứ hai đụng
     * `@@unique([ownerUserId, clientSessionId])`. Đó là ĐÚNG Ý — đọc lại phiên
     * cái thứ nhất vừa tạo và trả về, không báo lỗi.
     */
    if (!laTrungKhoa(e)) throw e
    const lai = await prisma.chatSession.findUniqueOrThrow({
      where: { ownerUserId_clientSessionId: { ownerUserId: userId, clientSessionId: input.clientSessionId } },
      select: { id: true, kind: true, state: true, jobId: true },
    })
    return { sessionId: lai.id, kind: lai.kind, state: lai.state, jobId: lai.jobId }
  }
}

export interface TinNhanItem {
  id: string
  seq: number
  senderType: ChatSenderType
  body: string
  createdAt: string
}

export interface TraTinNhan {
  tinNhan: TinNhanItem[]
  cursor: string
  conNua: boolean
  duocGui: boolean
}

/** Trần mỗi lần tải bù. Vượt thì client gọi tiếp với cursor mới. */
const TRAN_TAI_BU = 50

/**
 * Tải bù từ một cursor. Dùng cho cả REST lẫn sự kiện `hoi-thoai:tai-bu`.
 *
 * ---------------------------------------------------------------------------
 * CURSOR TRẢ VỀ LÀ SEQ SERVER **ĐÃ XÉT**, KHÔNG PHẢI SEQ ĐÃ TRẢ
 * ---------------------------------------------------------------------------
 * Đây là toàn bộ điểm của cursor. Nếu trả seq lớn nhất trong `tinNhan`, thì một
 * NTD có 5 tin riêng tư của sinh viên ở phía trước sẽ nhận mảng rỗng kèm cursor
 * ĐỨNG YÊN — và gọi lại mãi đúng khoảng đó, mỗi lần một truy vấn, vĩnh viễn.
 *
 * Chưa chạm trần ⇒ đã xét hết tới `seqHienTai`. Chạm trần ⇒ chỉ chắc chắn đã
 * xét tới tin cuối cùng trả về.
 */
export async function layTinNhan(
  user: { id: string; role: Role },
  sessionId: string,
  cursor?: string,
): Promise<TraTinNhan> {
  const quyen = await quyenTruyCapPhien(user, sessionId)
  if (!quyen) throw notFound('Không tìm thấy hội thoại')

  const tu = Math.max(quyen.docTuSeq, moCursor(cursor) + 1)

  const ds = await prisma.chatMessage.findMany({
    where: {
      sessionId,
      seq: { gte: tu },
      ...(quyen.chiTinChiaSe ? { visibleToEmployer: true } : {}),
    },
    orderBy: { seq: 'asc' },
    take: TRAN_TAI_BU,
    select: { id: true, seq: true, senderType: true, body: true, createdAt: true },
  })

  const conNua = ds.length === TRAN_TAI_BU
  const daXet = conNua ? ds[ds.length - 1]!.seq : quyen.seqHienTai

  return {
    tinNhan: ds.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    cursor: dongCursor(Math.max(daXet, moCursor(cursor))),
    conNua,
    duocGui: quyen.duocGui,
  }
}

async function layPhienCuaChu(userId: string, sessionId: string) {
  const p = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, kind: true, ownerUserId: true, state: true, jobId: true, messageSeq: true },
  })
  if (!p) throw notFound('Không tìm thấy hội thoại')
  /*
   * 404 chứ không 403 khi không phải chủ: trả 403 là xác nhận "id này có thật",
   * biến endpoint thành công cụ dò id. Chủ phiên thì không phân biệt được hai
   * ca vì với họ cả hai đều không xảy ra.
   */
  if (p.ownerUserId !== userId) throw notFound('Không tìm thấy hội thoại')
  return p
}

/* ============================================================ giữ lượt -- */

export interface BatDauLuotInput {
  userId: string
  role: Role
  sessionId: string
  clientMessageId: string
  noiDung: string
  runnerId: string
}

export type KetQuaBatDau =
  | { loai: 'moi'; turnId: string; seqCauHoi: number; conLai: number }
  /** Tin này đã gửi rồi. Trả lại câu trả lời cũ, KHÔNG gọi model lần hai. */
  | { loai: 'gui-lai'; traLoiCu: string | null }

/**
 * Ba việc trong MỘT transaction: giữ lượt, tạo AiTurn, ghi câu hỏi.
 *
 * ===========================================================================
 * VÌ SAO PHẢI CHUNG MỘT TRANSACTION
 * ===========================================================================
 * Khe hở của bản tách rời, và nó xảy ra thật:
 *
 *   giữ lượt (nguyên tử)  → turnsReserved += 1        ✔ đã trừ
 *   INSERT AiTurn         → P2002 vì chỉ mục một phần → 409 AI_BUSY
 *                                                       ✘ LƯỢT KHÔNG ĐƯỢC TRẢ
 *
 * Người dùng mở hai tab. Tab thứ hai nhận AI_BUSY — một lỗi hoàn toàn vô hại —
 * mà vẫn mất một trong năm lượt của ngày. Lặp năm lần là hết quota chưa hỏi
 * được câu nào.
 *
 * `giuLuot` nhận `tx`, không nhận client toàn cục: dùng client toàn cục thì câu
 * lệnh nằm NGOÀI transaction và khe hở còn nguyên.
 *
 * ===========================================================================
 * VÌ SAO GHI CÂU HỎI TRƯỚC KHI GỌI MODEL
 * ===========================================================================
 * Mạng rớt giữa lúc model đang trả lời. Ghi sau thì câu hỏi biến mất — mở lại
 * app thấy hội thoại trống, tưởng chưa gửi, gõ lại, mất thêm một lượt.
 */
export async function batDauLuot(v: BatDauLuotInput): Promise<KetQuaBatDau> {
  const phien = await layPhienCuaChu(v.userId, v.sessionId)
  if (phien.state !== 'AI_ACTIVE') {
    throw conflict('Hội thoại này đã chuyển sang người thật hoặc đã kết thúc')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const luot = await giuLuot(tx, {
        userId: v.userId,
        feature: 'CHAT',
        runnerId: v.runnerId,
        modelId: aiConfig.chatModel,
        promptVersion: PROMPT_VERSION,
        sessionId: v.sessionId,
      })
      if (!luot.ok) throw new HetLuotError()

      /*
       * Cấp `seq` bằng UPDATE … increment RETURNING, không phải SELECT max()+1.
       * Câu increment khoá hàng phiên nên hai lượt song song bị nối tiếp; đọc
       * max rồi cộng một thì cả hai đọc cùng số và đụng `@@unique([sessionId, seq])`.
       */
      const sau = await tx.chatSession.update({
        where: { id: v.sessionId },
        data: {
          messageSeq: { increment: 1 },
          lastMessageAt: new Date(),
          activeAiRunId: luot.turnId,
        },
        select: { messageSeq: true },
      })

      await tx.chatMessage.create({
        data: {
          sessionId: v.sessionId,
          seq: sau.messageSeq,
          senderType: v.role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT',
          senderUserId: v.userId,
          clientMessageId: v.clientMessageId,
          body: v.noiDung,
          visibleToEmployer: false,
        },
      })

      return { loai: 'moi' as const, turnId: luot.turnId, seqCauHoi: sau.messageSeq, conLai: luot.conLai }
    })
  } catch (e) {
    if (e instanceof HetLuotError) {
      throw new AppError('AI_QUOTA_EXCEEDED', 'Hôm nay bạn đã dùng hết lượt hỏi trợ lý', 429)
    }
    if (e instanceof DangBanError) {
      throw new AppError('AI_BUSY', 'Câu hỏi trước của bạn đang được xử lý, đợi một chút nhé', 409)
    }
    /*
     * P2002 trên (sessionId, clientMessageId) = GỬI LẠI, không phải lỗi.
     * Transaction đã rollback nên lượt vừa giữ cũng được trả lại. Trả câu trả
     * lời đã có và KHÔNG gọi model lần hai.
     */
    if (laTrungKhoa(e)) return await layLaiTraLoi(v.sessionId, v.clientMessageId)
    throw e
  }
}

/** Chỉ để bật rollback từ bên trong transaction. Không lọt ra ngoài module này. */
class HetLuotError extends Error {}

async function layLaiTraLoi(sessionId: string, clientMessageId: string): Promise<KetQuaBatDau> {
  const cauHoi = await prisma.chatMessage.findUnique({
    where: { sessionId_clientMessageId: { sessionId, clientMessageId } },
    select: { seq: true },
  })
  if (!cauHoi) throw conflict('Tin nhắn này đang được xử lý, thử lại sau một chút')

  const traLoi = await prisma.chatMessage.findFirst({
    where: { sessionId, senderType: 'AI', seq: { gt: cauHoi.seq } },
    orderBy: { seq: 'asc' },
    select: { body: true },
  })
  return { loai: 'gui-lai', traLoiCu: traLoi?.body ?? null }
}

/* ========================================================== ghi trả lời -- */

/**
 * Ghi câu trả lời CÓ ĐIỀU KIỆN.
 *
 * ===========================================================================
 * CA ĐUA THẬT: NGƯỜI DÙNG BẤM "NHẮN NHÀ TUYỂN DỤNG" GIỮA LÚC MODEL ĐANG VIẾT
 * ===========================================================================
 * Lúc đó `state` đổi sang WAITING_EMPLOYER và `activeAiRunId` bị xoá. Câu trả
 * lời của AI không còn chỗ đứng trong hội thoại — nó trả lời cho một ngữ cảnh
 * đã không còn.
 *
 * Có hai lớp chặn, và KHÔNG được đảo vai trò của chúng:
 *
 *   Lớp CHỦ ĐỘNG — `abortController.abort()` khi trạng thái đổi. Chỉ để tiết
 *   kiệm token. Nó có thể lỡ: message tới trễ, hoặc stream sắp xong rồi.
 *
 *   Lớp BỊ ĐỘNG — câu UPDATE dưới đây, có điều kiện. Đây là lớp CHẮC CHẮN
 *   ĐÚNG. 0 hàng ⇒ hội thoại đã chuyển đi ⇒ bỏ câu trả lời.
 *
 * Lượt vẫn tính SUCCEEDED: token đã tiêu thật rồi. "Lượt đã dùng" và "câu trả
 * lời có tới được người dùng không" là hai chuyện khác nhau.
 */
export async function ghiTraLoi(
  sessionId: string,
  turnId: string,
  noiDung: string,
): Promise<{ ghi: boolean; seq?: number }> {
  return await prisma.$transaction(async (tx) => {
    const sau = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'AI_ACTIVE', activeAiRunId: turnId },
      data: { messageSeq: { increment: 1 }, lastMessageAt: new Date(), activeAiRunId: null },
    })
    if (sau.count === 0) return { ghi: false }

    const phien = await tx.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { messageSeq: true },
    })
    await tx.chatMessage.create({
      data: {
        sessionId,
        seq: phien.messageSeq,
        senderType: 'AI',
        body: noiDung,
        visibleToEmployer: false,
      },
    })
    return { ghi: true, seq: phien.messageSeq }
  })
}

/** Dọn `activeAiRunId` khi lượt hỏng, để lượt sau không bị kẹt. */
export async function boCoDangChay(sessionId: string, turnId: string): Promise<void> {
  await prisma.chatSession.updateMany({
    where: { id: sessionId, activeAiRunId: turnId },
    data: { activeAiRunId: null },
  })
}

/* ============================================================= lịch sử -- */

/**
 * Dựng ngữ cảnh gửi cho model.
 *
 * Lấy `AI_HISTORY_MESSAGES` tin gần nhất TÍNH CẢ câu hỏi vừa ghi. Cắt cửa sổ
 * chứ không gửi cả hội thoại: một hội thoại 200 tin là hết cửa sổ ngữ cảnh và
 * đốt hạn mức TPM cho một câu hỏi.
 *
 * Tin SYSTEM ("Nhà tuyển dụng đã tiếp nhận") bị bỏ: nó là thông báo cho người
 * đọc, không phải lượt nói của ai cả, và nhét vào vai 'user' sẽ khiến model
 * tưởng người dùng vừa nói câu đó.
 */
export async function layLichSu(sessionId: string): Promise<ModelMessage[]> {
  const ds = await prisma.chatMessage.findMany({
    where: { sessionId, senderType: { not: 'SYSTEM' } },
    orderBy: { seq: 'desc' },
    take: aiConfig.historyMessages,
    select: { senderType: true, body: true },
  })

  return ds
    .reverse()
    .map((t) => ({ role: t.senderType === 'AI' ? ('assistant' as const) : ('user' as const), content: t.body }))
}

/* ================================================================ chung -- */

function laTrungKhoa(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
}

/* ======================================================= tin của người -- */

export interface GuiTinNhanKetQua {
  message: TinNhanItem
  cursor: string
  /** Tin này đã gửi rồi, đây là bản cũ. Client đánh dấu đã gửi, không vẽ thêm. */
  daCo: boolean
}

/**
 * Gửi một tin của NGƯỜI (không phải AI).
 *
 * ===========================================================================
 * SOCKET.IO KHÔNG PHẢI ĐƯỜNG DUY NHẤT — VÀ ĐÓ LÀ QUYẾT ĐỊNH, KHÔNG PHẢI DƯ
 * ===========================================================================
 * `POST /api/hoi-thoai/:id/tin-nhan` làm được y hệt, vì:
 *
 *   WebSocket bị chặn ở nhiều mạng trường học và wifi công cộng có proxy. Không
 *   có đường REST thì ở đó chat chết hẳn, không phải chậm.
 *
 *   Không có REST thì không test được bằng Supertest, mà repo đang dựa nặng vào
 *   Supertest — xem `docs/nep-kiem-thu.md` mục 4.
 *
 * Cả hai đường gọi đúng hàm này. Handler socket là lớp vỏ mỏng, không chứa
 * nghiệp vụ. Nghiệp vụ nằm ở đây, một bản.
 */
export async function guiTinNhan(
  user: { id: string; role: Role },
  sessionId: string,
  clientMessageId: string,
  noiDung: string,
): Promise<GuiTinNhanKetQua> {
  const quyen = await quyenTruyCapPhien(user, sessionId)
  if (!quyen) throw notFound('Không tìm thấy hội thoại')
  if (!quyen.duocGui) {
    throw conflict('Hội thoại chưa ở trạng thái nhắn trực tiếp')
  }

  try {
    const { tin, seqHienTai } = await prisma.$transaction(async (tx) => {
      const sau = await tx.chatSession.update({
        where: { id: sessionId },
        data: { messageSeq: { increment: 1 }, lastMessageAt: new Date() },
        select: { messageSeq: true },
      })
      const tin = await tx.chatMessage.create({
        data: {
          sessionId,
          seq: sau.messageSeq,
          senderType: user.role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT',
          senderUserId: user.id,
          clientMessageId,
          body: noiDung,
          /*
           * `true` — và đây là chỗ DUY NHẤT trong dự án đặt cờ này thành true.
           *
           * `duocGui` chỉ đúng khi state = HUMAN_ACTIVE, tức hai người đang nói
           * trực tiếp với nhau. Tin nói trực tiếp thì cả hai bên phải thấy.
           * Mọi tin khác — hỏi trợ lý, trả lời của AI — giữ mặc định `false`.
           */
          visibleToEmployer: true,
        },
        select: { id: true, seq: true, senderType: true, body: true, createdAt: true },
      })
      return { tin, seqHienTai: sau.messageSeq }
    })

    const message: TinNhanItem = { ...tin, createdAt: tin.createdAt.toISOString() }

    /*
     * Phát SAU khi transaction commit, không phải trong.
     *
     * Phát bên trong thì một rollback ở dòng cuối vẫn để lại một tin nhắn đã
     * hiện trên màn hình người kia — và nó biến mất ở lần tải lại tiếp theo.
     */
    phatTinMoi(sessionId, message, true)

    return { message, cursor: dongCursor(seqHienTai), daCo: false }
  } catch (e) {
    /*
     * Mạng chập chờn, client gửi lại cùng `clientMessageId`. Không phải lỗi:
     * trả lại đúng tin đã ghi, và transaction đã rollback nên không có tin thứ
     * hai. Client đánh dấu đã gửi và thôi.
     */
    if (!laTrungKhoa(e)) throw e
    const cu = await prisma.chatMessage.findUniqueOrThrow({
      where: { sessionId_clientMessageId: { sessionId, clientMessageId } },
      select: { id: true, seq: true, senderType: true, body: true, createdAt: true },
    })
    return {
      message: { ...cu, createdAt: cu.createdAt.toISOString() },
      cursor: dongCursor(cu.seq),
      daCo: true,
    }
  }
}

/**
 * Luật phát, một chỗ.
 *
 * ===========================================================================
 * HAI PHÒNG, KHÔNG PHẢI MỘT
 * ===========================================================================
 * Một phòng chung nghĩa là mọi `emit` tới cả hai bên. Khi phiên quay về
 * AI_ACTIVE, NTD đang ngồi trong phòng đó sẽ nhận realtime TỪNG CÂU sinh viên
 * nói với trợ lý — dù truy vấn REST chặn họ đọc đúng những tin ấy.
 *
 * Không test REST nào bắt được, vì REST hoàn toàn đúng.
 *
 * Cùng một cờ `visibleToEmployer` quyết định cả câu truy vấn REST lẫn phòng
 * socket. Một nguồn sự thật, hai đường dùng.
 */
export function phatTinMoi(sessionId: string, message: TinNhanItem, choNTD: boolean): void {
  phatToiPhong(phongChu(sessionId), 'hoi-thoai:tin-moi', { sessionId, message })
  if (choNTD) {
    phatToiPhong(phongNTD(sessionId), 'hoi-thoai:tin-moi', { sessionId, message })
  }
}

/** Dùng lại cho handler socket — tránh hai chỗ cùng gọi `quyenTruyCapPhien`. */
export async function quyenPhien(
  user: { id: string; role: Role },
  sessionId: string,
): Promise<QuyenTruyCap> {
  const q = await quyenTruyCapPhien(user, sessionId)
  if (!q) throw notFound('Không tìm thấy hội thoại')
  return q
}
