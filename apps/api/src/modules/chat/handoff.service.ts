import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { createNotification } from '../notifications/notifications.service.js'
import { phongHopThuNTD, quyenTruyCapPhien } from './chat.access.js'
import { ghiTinHeThong, phatTinMoi, phatTrangThai, type TinNhanItem } from './chat.service.js'
import { phatToiPhong } from './phat-su-kien.js'

/**
 * Máy trạng thái chuyển hội thoại từ AI sang người thật.
 *
 * ===========================================================================
 * MỌI CHUYỂN ĐỔI LÀ MỘT `updateMany` CÓ ĐIỀU KIỆN
 * ===========================================================================
 * Trạng thái NGUỒN nằm trong `where`, và `count === 0` là câu trả lời chính
 * xác cho "ai đó đã đổi trước tôi". Đây là compare-and-swap, không phải khoá.
 *
 * KHÔNG BAO GIỜ `findUnique` → `if (state === …)` → `update`. Giữa ba bước đó
 * có khe hở, và khe hở này có người thật đi qua: sinh viên bấm huỷ chờ đúng
 * lúc nhà tuyển dụng bấm tiếp nhận. Postgres nối tiếp hai `UPDATE` trên cùng
 * một hàng, nên ai tới trước thắng và người kia nhận 409 — không có trạng thái
 * lai.
 *
 * Ca đó có test riêng ở làn database; mock Prisma không tái hiện được.
 */

/* ============================================================== dùng chung -- */

export interface KetQuaChuyen {
  sessionId: string
  state: string
  tin: TinNhanItem
}

/** Lấy phiên và chặn người không phải chủ. 404 chứ không 403 — xem `chat.access.ts`. */
async function phienCuaChu(userId: string, sessionId: string) {
  const p = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      kind: true,
      ownerUserId: true,
      state: true,
      jobId: true,
      messageSeq: true,
      employerVisibleFromSeq: true,
      handoffEmployerProfileId: true,
      activeAiRunId: true,
    },
  })
  if (!p || p.ownerUserId !== userId) throw notFound('Không tìm thấy hội thoại')
  return p
}

/**
 * Dịch lỗi trùng khoá của chỉ mục `chat_mot_handoff_moi_ntd` thành một câu
 * người dùng đọc hiểu.
 *
 * Chỉ mục là LỚP THẬT chặn spam: kiểm bằng `findFirst` rồi `if` thì hai
 * request song song đều đọc thấy "chưa có" và cả hai đều tạo. Nhưng P2002 của
 * Prisma đọc lên là "Unique constraint failed" — không nói được gì cho người
 * đang bấm nút.
 */
async function chayVaDichLoiTrung<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const trung =
      typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002'
    if (!trung) throw e
    throw conflict(
      'Bạn đang có một hội thoại mở với nhà tuyển dụng này. Mở lại hội thoại đó để hỏi tiếp.',
    )
  }
}

/* ========================================== A — sinh viên chuyển sang NTD -- */

/**
 * `AI_ACTIVE` → `WAITING_EMPLOYER`.
 *
 * ---------------------------------------------------------------------------
 * NGƯỜI NHẬN HANDOFF ĐÓNG BĂNG Ở LẦN CHUYỂN ĐẦU
 * ---------------------------------------------------------------------------
 * Đổi sang nhà tuyển dụng khác sẽ khiến người mới đọc được những gì đã chia sẻ
 * với người cũ. Muốn hỏi nơi khác thì tạo phiên mới. Nên lần chuyển thứ hai chỉ
 * hợp lệ khi trỏ về ĐÚNG nhà tuyển dụng cũ.
 *
 * `employerVisibleFromSeq` cũng chỉ đặt khi đang `null`, không dịch lên ở lần
 * chuyển sau: dịch lên thì đoạn đã từng chia sẻ biến mất khỏi màn hình NTD;
 * xoá đi thì họ đọc được cả đoạn sinh viên nói riêng với AI ở giữa. Giữ nguyên
 * là đúng cả hai phía — phần riêng tư ở giữa đã có cờ `visibleToEmployer` lo.
 */
export async function chuyenNhaTuyenDung(
  userId: string,
  sessionId: string,
  jobId: string,
  loiNhan: string,
): Promise<KetQuaChuyen> {
  const phien = await phienCuaChu(userId, sessionId)
  if (phien.kind !== 'AI_STUDENT') {
    throw badRequest('Phiên trợ lý của nhà tuyển dụng không chuyển đi đâu được')
  }

  /*
   * Tin phải đang mở VÀ nhà tuyển dụng phải đã được xác minh. Sinh viên không
   * nên bị đẩy sang nói chuyện với một doanh nghiệp chưa ai kiểm giấy tờ.
   */
  const tin = await prisma.job.findFirst({
    where: { id: jobId, status: 'OPEN' },
    select: {
      id: true,
      title: true,
      employerProfileId: true,
      employerProfile: { select: { userId: true, verifiedAt: true, companyName: true } },
    },
  })
  if (!tin) throw notFound('Không tìm thấy tin tuyển dụng, hoặc tin đã đóng')
  if (!tin.employerProfile.verifiedAt) {
    throw badRequest('Nhà tuyển dụng này chưa được xác minh')
  }

  const daChuyen = phien.handoffEmployerProfileId
  if (daChuyen !== null && daChuyen !== tin.employerProfileId) {
    throw conflict(
      'Hội thoại này đã chuyển cho một nhà tuyển dụng khác. Mở hội thoại mới để hỏi nơi này.',
    )
  }

  const kq = await chayVaDichLoiTrung(async () =>
    prisma.$transaction(async (tx) => {
      const doi = await tx.chatSession.updateMany({
        where: { id: sessionId, state: 'AI_ACTIVE' },
        data: {
          state: 'WAITING_EMPLOYER',
          handoffEmployerProfileId: tin.employerProfileId,
          /*
           * `jobId` chỉ đặt LẦN ĐẦU, cùng lý do với người nhận.
           *
           * Bản trước ghi đè mỗi lần chuyển. Hệ quả: hội thoại bàn về tin A,
           * sinh viên hỏi tiếp về tin B của cùng nhà tuyển dụng, và cả luồng
           * lặng lẽ đổi thành "về tin B" — hộp thư NTD hiện tên tin B cho một
           * cuộc trao đổi phần lớn nói về tin A. Không ai thấy nó xảy ra.
           *
           * Tin sau đi vào NGỮ CẢNH của lời nhắn mở đầu, không thay cột này.
           */
          ...(phien.jobId === null ? { jobId: tin.id } : {}),
          handoffRequestedAt: new Date(),
          /*
           * Xoá cờ lượt AI đang chạy. Đây là lớp BỊ ĐỘNG chặn câu trả lời tới
           * muộn: `ghiTraLoi` đòi `activeAiRunId` khớp, nên lượt đang chạy dở sẽ
           * bị bỏ câu trả lời. Lớp chủ động (abort) chỉ tiết kiệm token.
           */
          activeAiRunId: null,
          ...(phien.employerVisibleFromSeq === null
            ? { employerVisibleFromSeq: phien.messageSeq + 1 }
            : {}),
        },
      })
      if (doi.count === 0) {
        throw conflict('Hội thoại không còn ở trạng thái nói chuyện với trợ lý')
      }

      /* Tin mở đầu là tin ĐẦU TIÊN nhà tuyển dụng đọc được, nên `choNTD = true`. */
      const tinMo = await ghiTinHeThong(
        tx,
        sessionId,
        dungLoiMoDau(loiNhan, phien.jobId, tin),
        true,
      )

      await createNotification(tx, {
        userId: tin.employerProfile.userId,
        type: 'CHAT_HANDOFF_REQUESTED',
        title: 'Có sinh viên muốn trao đổi',
        body: `Một sinh viên đang chờ bạn trả lời về tin “${tin.title}”.`,
        link: `/ntd/hoi-thoai`,
      })

      return tinMo
    }),
  )

  phatTinMoi(sessionId, kq, true)
  phatTrangThai(sessionId, 'WAITING_EMPLOYER', userId)
  phatToiPhong(phongHopThuNTD(tin.employerProfileId), 'ntd:hoi-thoai-cho', {
    sessionId,
    jobId: tin.id,
    tenTin: tin.title,
    luc: new Date().toISOString(),
  })

  return { sessionId, state: 'WAITING_EMPLOYER', tin: kq }
}

/**
 * Lời nhắn mở đầu, có đính kèm ngữ cảnh tin khi cần.
 *
 * Hỏi về một tin KHÁC tin đã gắn thì phải nói rõ ở đây: nhà tuyển dụng cần
 * biết đang được hỏi về cái gì, mà cột `jobId` đã đóng băng ở lần chuyển đầu.
 */
function dungLoiMoDau(
  loiNhan: string,
  jobIdDaGan: string | null,
  tin: { id: string; title: string },
): string {
  const than = loiNhan === '' ? 'Sinh viên muốn trao đổi trực tiếp với bạn.' : loiNhan
  const doiTin = jobIdDaGan !== null && jobIdDaGan !== tin.id
  return doiTin
    ? `${than}
(Về tin: ${tin.title})`
    : than
}

/* ================================================= B — sinh viên huỷ chờ -- */

/** `WAITING_EMPLOYER` → `AI_ACTIVE`. Không báo cho nhà tuyển dụng. */
export async function huyCho(userId: string, sessionId: string): Promise<KetQuaChuyen> {
  await phienCuaChu(userId, sessionId)

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'WAITING_EMPLOYER' },
      data: { state: 'AI_ACTIVE', handoffRequestedAt: null },
    })
    if (doi.count === 0) throw conflict('Hội thoại không còn ở trạng thái chờ')

    return ghiTinHeThong(tx, sessionId, 'Bạn đã huỷ yêu cầu trao đổi với nhà tuyển dụng.', false)
  })

  phatTinMoi(sessionId, tin, false)
  phatTrangThai(sessionId, 'AI_ACTIVE', userId)
  return { sessionId, state: 'AI_ACTIVE', tin }
}

/* ==================================================== C — NTD tiếp nhận -- */

/**
 * `WAITING_EMPLOYER` → `HUMAN_ACTIVE`.
 *
 * Một doanh nghiệp ở Việt Nam rất hay có nhiều người dùng chung tài khoản, nên
 * hai người bấm tiếp nhận cùng lúc là chuyện thật. `updateMany` lo: người thứ
 * hai nhận `count === 0` và một thông điệp đúng, không phải một lỗi khó hiểu.
 */
export async function tiepNhan(
  user: { id: string; role: Role },
  sessionId: string,
): Promise<KetQuaChuyen> {
  const quyen = await quyenTruyCapPhien(user, sessionId)
  if (!quyen || quyen.vai !== 'NTD_NHAN_HANDOFF') throw notFound('Không tìm thấy hội thoại')

  const phien = await prisma.chatSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { ownerUserId: true },
  })

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'WAITING_EMPLOYER' },
      data: { state: 'HUMAN_ACTIVE', handoffAcceptedAt: new Date() },
    })
    if (doi.count === 0) throw conflict('Hội thoại này vừa được tiếp nhận hoặc đã huỷ')

    const tinMo = await ghiTinHeThong(tx, sessionId, 'Nhà tuyển dụng đã tiếp nhận.', true)

    await createNotification(tx, {
      userId: phien.ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Nhà tuyển dụng đã trả lời',
      body: 'Bạn có thể nhắn trực tiếp với nhà tuyển dụng ngay bây giờ.',
      link: '/tro-ly',
    })

    return tinMo
  })

  phatTinMoi(sessionId, tin, true)
  phatTrangThai(sessionId, 'HUMAN_ACTIVE', phien.ownerUserId)
  return { sessionId, state: 'HUMAN_ACTIVE', tin }
}

/* ============================================ E — sinh viên quay lại AI -- */

/**
 * `HUMAN_ACTIVE` → `AI_ACTIVE`.
 *
 * Nhà tuyển dụng GIỮ NGUYÊN quyền đọc phần cũ — quyền neo vào
 * `handoffEmployerProfileId`, không vào `state`. Nhưng họ không đọc được phần
 * mới, vì mọi tin trong giai đoạn AI đều `visibleToEmployer = false`, và socket
 * của họ ở phòng `:ntd` cũng không nhận gì.
 */
export async function quayLaiAi(userId: string, sessionId: string): Promise<KetQuaChuyen> {
  await phienCuaChu(userId, sessionId)

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'HUMAN_ACTIVE' },
      data: { state: 'AI_ACTIVE' },
    })
    if (doi.count === 0) throw conflict('Hội thoại không ở trạng thái nhắn trực tiếp')

    /* `choNTD = true`: NTD nên biết vì sao sinh viên ngừng trả lời. */
    return ghiTinHeThong(tx, sessionId, 'Sinh viên quay lại hỏi trợ lý.', true)
  })

  phatTinMoi(sessionId, tin, true)
  phatTrangThai(sessionId, 'AI_ACTIVE', userId)
  return { sessionId, state: 'AI_ACTIVE', tin }
}

/* ================================================== D — cả hai kết thúc -- */

/** `WAITING_EMPLOYER` hoặc `HUMAN_ACTIVE` → `CLOSED`. Cả hai bên đều làm được. */
export async function ketThuc(
  user: { id: string; role: Role },
  sessionId: string,
): Promise<KetQuaChuyen> {
  const quyen = await quyenTruyCapPhien(user, sessionId)
  if (!quyen) throw notFound('Không tìm thấy hội thoại')

  /*
   * Câu ghi vào tin hệ thống theo VAI TRONG PHIÊN, không theo `Role`.
   *
   * Một tài khoản EMPLOYER có thể là chủ phiên trợ lý của chính họ, hoặc là
   * người nhận handoff ở phiên của sinh viên. Lấy `Role` mà viết "Nhà tuyển
   * dụng đã kết thúc" thì phiên `AI_EMPLOYER` của họ cũng ghi câu đó — trong
   * khi người kết thúc chính là chủ phiên.
   */
  const NOI = {
    CHU: 'Người dùng đã kết thúc hội thoại.',
    NTD_NHAN_HANDOFF: 'Nhà tuyển dụng đã kết thúc hội thoại.',
    ADMIN_HO_TRO: 'Quản trị viên đã kết thúc hội thoại.',
  } as const

  /* Kênh hỗ trợ đóng từ `WAITING_ADMIN` — nó không bao giờ qua WAITING_EMPLOYER. */
  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: {
        id: sessionId,
        state: { in: ['WAITING_EMPLOYER', 'WAITING_ADMIN', 'HUMAN_ACTIVE'] },
      },
      data: { state: 'CLOSED', closedAt: new Date(), closedByUserId: user.id },
    })
    if (doi.count === 0) throw conflict('Hội thoại đã kết thúc rồi')

    /*
     * `choNTD = true` chỉ đúng với kênh tuyển dụng. Ở kênh hỗ trợ thì cờ này
     * vô nghĩa — admin đọc theo `kind` — nên để `false` cho khỏi gán nhầm một
     * ý nghĩa không tồn tại.
     */
    return ghiTinHeThong(tx, sessionId, NOI[quyen.vai], quyen.vai !== 'ADMIN_HO_TRO')
  })

  phatTinMoi(sessionId, tin, quyen.vai !== 'ADMIN_HO_TRO')
  phatTrangThai(sessionId, 'CLOSED', quyen.ownerUserId)
  return { sessionId, state: 'CLOSED', tin }
}

/* ============================================ NTD từ chối và hết hạn chờ -- */

/**
 * `WAITING_EMPLOYER` → `CLOSED`, do NHÀ TUYỂN DỤNG từ chối.
 *
 * Đóng hẳn chứ không trả về `AI_ACTIVE`: chỉ mục `chat_mot_handoff_moi_ntd`
 * chặn khi chưa `CLOSED`, nên trả về AI_ACTIVE là khoá sinh viên lại vĩnh
 * viễn với đúng nhà tuyển dụng vừa từ chối họ. Đóng thì họ hỏi lại được sau.
 *
 * Từ chối KHÔNG kèm lý do bắt buộc, khác hẳn từ chối đơn ứng tuyển: ở đây
 * chưa có đơn nào, chưa có gì để giải thích, và ép nhập lý do chỉ khiến người
 * ta gõ bừa một chữ.
 */
export async function tuChoiYeuCau(
  user: { id: string; role: Role },
  sessionId: string,
  lyDo: string,
): Promise<KetQuaChuyen> {
  const quyen = await quyenTruyCapPhien(user, sessionId)
  if (!quyen || quyen.vai !== 'NTD_NHAN_HANDOFF') throw notFound('Không tìm thấy hội thoại')

  const phien = await prisma.chatSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { ownerUserId: true },
  })

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'WAITING_EMPLOYER' },
      data: { state: 'CLOSED', closedAt: new Date(), closedByUserId: user.id },
    })
    if (doi.count === 0) throw conflict('Yêu cầu không còn ở trạng thái chờ')

    const than =
      lyDo.trim() === ''
        ? 'Nhà tuyển dụng chưa thể trao đổi lúc này.'
        : `Nhà tuyển dụng chưa thể trao đổi lúc này: ${lyDo.trim()}`
    const tinMo = await ghiTinHeThong(tx, sessionId, than, true)

    await createNotification(tx, {
      userId: phien.ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Nhà tuyển dụng chưa thể trao đổi',
      body: than,
      link: '/tro-ly',
    })

    return tinMo
  })

  phatTinMoi(sessionId, tin, true)
  phatTrangThai(sessionId, 'CLOSED', phien.ownerUserId)

  return { sessionId, state: 'CLOSED', tin }
}

/** Yêu cầu chờ quá ngần này giờ thì tự đóng. */
const GIO_CHO_TOI_DA = 48

/**
 * Đóng các yêu cầu chờ quá hạn.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CẦN
 * ---------------------------------------------------------------------------
 * Nhà tuyển dụng không bấm gì cả là trạng thái hay gặp nhất, không phải ca
 * hiếm. Không có hạn thì hội thoại nằm `WAITING_EMPLOYER` vĩnh viễn — và vì
 * chỉ mục chống trùng chặn khi chưa `CLOSED`, sinh viên **không bao giờ** hỏi
 * lại được nơi đó nữa. Một bên im lặng khoá vĩnh viễn bên kia.
 *
 * Quét theo lô thay vì hẹn giờ mỗi phiên: một `setTimeout` cho mỗi yêu cầu sẽ
 * chết theo process, và deploy lại là mất sạch.
 */
export async function donYeuCauQuaHan(): Promise<number> {
  const han = new Date(Date.now() - GIO_CHO_TOI_DA * 60 * 60_000)

  const quaHan = await prisma.chatSession.findMany({
    where: {
      state: { in: ['WAITING_EMPLOYER', 'WAITING_ADMIN'] },
      handoffRequestedAt: { lt: han },
    },
    select: { id: true, state: true, ownerUserId: true },
    take: 200,
  })

  for (const p of quaHan) {
    const laHoTro = p.state === 'WAITING_ADMIN'
    try {
      const tin = await prisma.$transaction(async (tx) => {
        /* Vẫn là compare-and-swap: giữa lúc đọc và lúc ghi có thể có người bấm. */
        const doi = await tx.chatSession.updateMany({
          where: { id: p.id, state: p.state },
          data: { state: 'CLOSED', closedAt: new Date() },
        })
        if (doi.count === 0) return null

        return ghiTinHeThong(
          tx,
          p.id,
          laHoTro
            ? `Yêu cầu hỗ trợ đã tự đóng sau ${GIO_CHO_TOI_DA} giờ không có phản hồi.`
            : `Yêu cầu đã tự đóng sau ${GIO_CHO_TOI_DA} giờ nhà tuyển dụng chưa phản hồi.`,
          !laHoTro,
        )
      })
      if (tin) {
        phatTinMoi(p.id, tin, !laHoTro)
        phatTrangThai(p.id, 'CLOSED', p.ownerUserId)
      }
    } catch (e) {
      /* Một phiên hỏng không được chặn cả lô. */
      console.error(`[chat] không đóng được yêu cầu quá hạn ${p.id}`, e)
    }
  }

  return quaHan.length
}

/* ============================================== hộp thư nhà tuyển dụng -- */

export interface MucHopThu {
  sessionId: string
  jobId: string | null
  tenTin: string | null
  hoTenVietTat: string
  state: string
  lastMessageAt: string
}

/**
 * Các hội thoại đang chờ hoặc đang mở của nhà tuyển dụng này.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CHỈ HIỆN TÊN VIẾT TẮT
 * ---------------------------------------------------------------------------
 * Ở đây chưa có đơn ứng tuyển nào — sinh viên chỉ mới bấm "muốn hỏi". Luật
 * `TRANG_THAI_MO_LIEN_HE` của Sprint 4 mở liên hệ khi đơn vào vòng trong; hội
 * thoại không đi qua luật đó, nên không được lặng lẽ mở rộng hơn.
 *
 * "N.V.A" đủ để phân biệt hai hội thoại trong hộp thư, đó là toàn bộ việc màn
 * hình này cần làm. Tên đầy đủ và liên hệ vẫn đi theo đường đơn ứng tuyển.
 */
export async function hopThuNTD(userId: string): Promise<{ hoiThoai: MucHopThu[] }> {
  const hoSo = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!hoSo) throw notFound('Chưa có hồ sơ nhà tuyển dụng')

  const ds = await prisma.chatSession.findMany({
    where: {
      handoffEmployerProfileId: hoSo.id,
      state: { in: ['WAITING_EMPLOYER', 'HUMAN_ACTIVE'] },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      id: true,
      jobId: true,
      state: true,
      lastMessageAt: true,
      job: { select: { title: true } },
      studentProfile: { select: { fullName: true } },
    },
  })

  return {
    hoiThoai: ds.map((p) => ({
      sessionId: p.id,
      jobId: p.jobId,
      tenTin: p.job?.title ?? null,
      hoTenVietTat: vietTat(p.studentProfile?.fullName),
      state: p.state,
      lastMessageAt: p.lastMessageAt.toISOString(),
    })),
  }
}

/** "Nguyễn Văn An" → "N.V.A". Bản cho GIAO DIỆN — bản cho model ở `luoc-pii.ts`. */
function vietTat(ten: string | null | undefined): string {
  const tu = (ten ?? '').trim().split(/\s+/).filter(Boolean)
  if (tu.length === 0) return 'Ẩn danh'
  return tu.map((t) => [...t][0]!.toLocaleUpperCase('vi-VN')).join('.')
}
