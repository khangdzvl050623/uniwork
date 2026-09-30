import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { conflict, notFound } from '../../lib/errors.js'
import { createNotification } from '../notifications/notifications.service.js'
import { PHONG_ADMIN_HO_TRO } from './chat.access.js'
import { ghiTinHeThong, phatTinMoi, phatTrangThai, type TinNhanItem } from './chat.service.js'
import { phatToiPhong } from './phat-su-kien.js'

/**
 * Kênh HỖ TRỢ — người dùng hỏi quản trị viên.
 *
 * ===========================================================================
 * VÌ SAO LÀ MỘT KÊNH RIÊNG, KHÔNG PHẢI MỘT TRẠNG THÁI CỦA KÊNH CŨ
 * ===========================================================================
 * Toàn bộ thiết kế handoff dựa trên việc người nhận ĐÓNG BĂNG. Cho một hội
 * thoại đổi đối tượng giữa chừng — đang nói với nhà tuyển dụng rồi chuyển sang
 * admin — là phá chính tính chất đó: admin sẽ đọc được đoạn sinh viên trao đổi
 * riêng với nhà tuyển dụng, và không ai từng đồng ý điều đó.
 *
 * Nên `AI_SUPPORT` là `kind` thứ ba, tạo phiên riêng. Muốn chuyển ngữ cảnh từ
 * hội thoại khác sang thì người dùng phải tự dán vào, tức là tự đọc và tự
 * quyết chia sẻ cái gì.
 *
 * ===========================================================================
 * KHÁC HANDOFF NTD Ở HAI ĐIỂM
 * ===========================================================================
 *   Người nhận đặt lúc TIẾP NHẬN, không phải lúc yêu cầu. Admin là hàng đợi;
 *   lúc bấm gửi thì chưa biết ai sẽ xử.
 *
 *   Admin đọc TỪ ĐẦU hội thoại, không có mốc riêng tư. Hội thoại hỗ trợ chính
 *   là nội dung cái ticket, và người dùng chủ động mở nó để xin người thật.
 */

export interface KetQuaHoTro {
  sessionId: string
  state: string
  tin: TinNhanItem
}

async function phienHoTroCuaChu(userId: string, sessionId: string) {
  const p = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, kind: true, ownerUserId: true, state: true },
  })
  if (!p || p.ownerUserId !== userId) throw notFound('Không tìm thấy hội thoại')
  if (p.kind !== 'AI_SUPPORT') throw conflict('Hội thoại này không phải kênh hỗ trợ')
  return p
}

/**
 * Dịch lỗi trùng khoá của `chat_mot_ho_tro_dang_mo` thành câu người dùng hiểu.
 *
 * Không có bước này thì `error-handler` trả về "Dữ liệu đã tồn tại" — đúng về
 * mặt kỹ thuật và vô dụng với người đang cần giúp. Họ không biết "dữ liệu" nào,
 * không biết phải làm gì tiếp.
 *
 * Bản sao của `chayVaDichLoiTrung` bên `handoff.service` — CỐ Ý không gộp: hai
 * chỉ mục khác nhau cần hai lời giải thích khác nhau, và gộp lại thì hàm chung
 * phải đoán xem mình đang ở kênh nào.
 */
async function dichLoiTrungHoTro<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const trung =
      typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002'
    if (!trung) throw e
    throw conflict('Bạn đang có một yêu cầu hỗ trợ chưa đóng. Mở lại yêu cầu đó để nhắn tiếp.')
  }
}

/* ==================================================== yêu cầu người thật -- */

/**
 * `AI_ACTIVE` → `WAITING_ADMIN`.
 *
 * ---------------------------------------------------------------------------
 * KHÔNG PHỤ THUỘC HẠN MỨC AI
 * ---------------------------------------------------------------------------
 * Hàm này không gọi model, không giữ lượt. Người dùng hết 5 lượt hỏi trợ lý
 * vẫn phải xin được người thật — nếu không thì đúng lúc họ cần giúp nhất lại
 * là lúc cửa đóng.
 */
export async function yeuCauHoTro(
  userId: string,
  sessionId: string,
  moTa: string,
): Promise<KetQuaHoTro> {
  await phienHoTroCuaChu(userId, sessionId)

  const tin = await dichLoiTrungHoTro(async () =>
    prisma.$transaction(async (tx) => {
      /*
       * Nhận CẢ `CLOSED`, không riêng `AI_ACTIVE`.
       *
       * Luồng hỗ trợ là vĩnh viễn: đóng một ticket không xoá luồng, nó chỉ
       * ngừng nhận tin. Xin hỗ trợ lần sau là MỞ LẠI chính luồng ấy, mang
       * theo cả lịch sử — người dùng đọc lại được quản trị viên đã trả lời gì
       * hôm trước.
       *
       * Thiếu `CLOSED` ở đây thì sau ticket đầu tiên, người dùng vĩnh viễn
       * không xin hỗ trợ được nữa: chỉ mục chỉ cho họ một luồng, mà luồng ấy
       * lại không mở lại được.
       */
      const doi = await tx.chatSession.updateMany({
        where: { id: sessionId, state: { in: ['AI_ACTIVE', 'CLOSED'] } },
        data: {
          state: 'WAITING_ADMIN',
          handoffRequestedAt: new Date(),
          closedAt: null,
          closedByUserId: null,
          /* Cùng lý do với handoff NTD: chặn câu trả lời AI tới muộn. */
          activeAiRunId: null,
        },
      })
      if (doi.count === 0) throw conflict('Yêu cầu hỗ trợ đang được xử lý rồi')

      return ghiTinHeThong(
        tx,
        sessionId,
        moTa.trim() === '' ? 'Người dùng xin gặp quản trị viên.' : moTa.trim(),
      )
    }),
  )

  phatTinMoi(sessionId, tin)
  phatTrangThai(sessionId, 'WAITING_ADMIN', userId)
  /* Hàng đợi chung — mọi admin đang mở màn hình đều thấy ngay. */
  phatToiPhong(PHONG_ADMIN_HO_TRO, 'ho-tro:yeu-cau-moi', {
    sessionId,
    luc: new Date().toISOString(),
  })

  return { sessionId, state: 'WAITING_ADMIN', tin }
}

/** `WAITING_ADMIN` → `AI_ACTIVE`. Người dùng tự giải quyết được rồi. */
export async function huyYeuCauHoTro(userId: string, sessionId: string): Promise<KetQuaHoTro> {
  await phienHoTroCuaChu(userId, sessionId)

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'WAITING_ADMIN' },
      data: { state: 'AI_ACTIVE', handoffRequestedAt: null },
    })
    if (doi.count === 0) throw conflict('Yêu cầu không còn ở trạng thái chờ')

    return ghiTinHeThong(tx, sessionId, 'Bạn đã huỷ yêu cầu hỗ trợ.')
  })

  phatTinMoi(sessionId, tin)
  phatTrangThai(sessionId, 'AI_ACTIVE', userId)
  return { sessionId, state: 'AI_ACTIVE', tin }
}

/* ========================================================= admin nhận -- */

/**
 * `WAITING_ADMIN` → `HUMAN_ACTIVE`, và ghi luôn AI NHẬN.
 *
 * Hai admin cùng bấm thì `updateMany` cho người thứ hai `count === 0`. Quan
 * trọng hơn: `handoffAdminUserId` đặt trong CÙNG câu lệnh đó, nên không có
 * khoảnh khắc nào hội thoại ở `HUMAN_ACTIVE` mà chưa biết ai đang xử —
 * `chat_handoff_du_thong_tin` cũng cấm trạng thái đó ở tầng database.
 */
export async function tiepNhanHoTro(adminUserId: string, sessionId: string): Promise<KetQuaHoTro> {
  const p = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { kind: true, ownerUserId: true },
  })
  if (!p || p.kind !== 'AI_SUPPORT') throw notFound('Không tìm thấy yêu cầu hỗ trợ')

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'WAITING_ADMIN' },
      data: {
        state: 'HUMAN_ACTIVE',
        handoffAdminUserId: adminUserId,
        handoffAcceptedAt: new Date(),
      },
    })
    if (doi.count === 0) throw conflict('Yêu cầu này vừa được người khác tiếp nhận hoặc đã huỷ')

    const tinMo = await ghiTinHeThong(tx, sessionId, 'Quản trị viên đã tiếp nhận.')

    await createNotification(tx, {
      userId: p.ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Quản trị viên đã trả lời',
      body: 'Bạn có thể trao đổi trực tiếp ngay bây giờ.',
      link: '/ho-tro',
    })

    return tinMo
  })

  /* `phatTinMoi` đã lo cả phòng admin — xem ghi chú bất biến trong hàm đó. */
  phatTinMoi(sessionId, tin)
  phatTrangThai(sessionId, 'HUMAN_ACTIVE', p.ownerUserId)

  return { sessionId, state: 'HUMAN_ACTIVE', tin }
}

export interface MucHangDoiHoTro {
  sessionId: string
  ownerVai: Role
  state: string
  moTaDau: string | null
  handoffRequestedAt: string | null
  lastMessageAt: string
}

/**
 * Hàng đợi hỗ trợ.
 *
 * Hiện cả `WAITING_ADMIN` lẫn `HUMAN_ACTIVE`: admin cần thấy cả việc chưa ai
 * nhận lẫn việc mình đang xử dở. Không hiện danh tính người dùng — admin mở
 * hội thoại ra là đọc được ngữ cảnh, danh sách chỉ cần đủ để chọn.
 */
export async function hangDoiHoTro(): Promise<{ hoTro: MucHangDoiHoTro[] }> {
  const ds = await prisma.chatSession.findMany({
    where: { kind: 'AI_SUPPORT', state: { in: ['WAITING_ADMIN', 'HUMAN_ACTIVE'] } },
    orderBy: { handoffRequestedAt: 'asc' },
    take: 100,
    select: {
      id: true,
      state: true,
      handoffRequestedAt: true,
      lastMessageAt: true,
      owner: { select: { role: true } },
      /*
       * Tin hệ thống ĐẦU TIÊN (`asc`), không phải tin mới nhất.
       *
       * Tin đầu chính là câu người dùng gõ lúc bấm xin hỗ trợ — thứ duy nhất
       * trong danh sách nói được ticket này về chuyện gì.
       *
       * Bản trước dùng `desc`, nên ngay sau khi admin bấm tiếp nhận thì dòng
       * mô tả đổi thành "Quản trị viên đã tiếp nhận." — hệ thống tự mô tả
       * chính nó, và nội dung người dùng viết biến mất khỏi hàng đợi.
       */
      messages: {
        where: { senderType: 'SYSTEM' },
        orderBy: { seq: 'asc' },
        take: 1,
        select: { body: true },
      },
    },
  })

  return {
    hoTro: ds.map((p) => ({
      sessionId: p.id,
      ownerVai: p.owner.role,
      state: p.state,
      moTaDau: p.messages[0]?.body ?? null,
      handoffRequestedAt: p.handoffRequestedAt?.toISOString() ?? null,
      lastMessageAt: p.lastMessageAt.toISOString(),
    })),
  }
}
