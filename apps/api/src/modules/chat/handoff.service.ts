import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { conHanNop } from '../../lib/han-nop.js'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import { createNotification } from '../notifications/notifications.service.js'
import { phongHopThuNTD, quyenTruyCapPhien } from './chat.access.js'
import { daChan } from './chan-ntd.service.js'
import {
  ghiTinHeThong,
  khoaLuongNTD,
  moLuongNTD,
  phatTinMoi,
  phatTrangThai,
  type TinNhanItem,
} from './chat.service.js'
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

const KHONG_THAY_TIN = 'Không tìm thấy tin tuyển dụng, hoặc tin đã đóng'

/*
 * Câu cho nhà tuyển dụng khi sinh viên đã chặn họ. Không nói chữ "chặn": nói
 * đủ để họ hiểu vì sao nút không ăn, không hơn — cùng tinh thần với việc
 * không báo cho họ lúc bị chặn.
 */
const UNG_VIEN_KHONG_NHAN_TIN = 'Ứng viên này hiện không nhận tin nhắn từ bạn.'

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
      handoffEmployerProfileId: true,
      activeAiRunId: true,
    },
  })
  if (!p || p.ownerUserId !== userId) throw notFound('Không tìm thấy hội thoại')
  return p
}


/* ========================================== A — sinh viên chuyển sang NTD -- */

/**
 * Mở (hoặc mở lại) luồng với nhà tuyển dụng sở hữu tin.
 *
 * ===========================================================================
 * KHÔNG CÒN "CHUYỂN" LUỒNG NÀO CẢ
 * ===========================================================================
 * Bản trước BIẾN chính luồng trợ lý của sinh viên thành luồng với nhà tuyển
 * dụng. Nên hỏi nơi thứ hai là phải đẻ một luồng trợ lý mới, và lịch sử trò
 * chuyện với AI bị cắt thành nhiều mảnh rời.
 *
 * Giờ luồng trợ lý đứng yên, còn đây mở một luồng RIÊNG cho cặp (sinh viên,
 * nhà tuyển dụng). Hỏi nơi thứ hai là mở luồng thứ hai — không ảnh hưởng gì
 * tới luồng thứ nhất, và không ai phải "tạo hội thoại mới".
 *
 * ---------------------------------------------------------------------------
 * MỞ LẠI LUỒNG ĐÃ ĐÓNG LÀ CHUYỆN BÌNH THƯỜNG
 * ---------------------------------------------------------------------------
 * Nhà tuyển dụng từ chối hoặc hai bên kết thúc → luồng `CLOSED`. Sinh viên hỏi
 * lại nơi đó vài tháng sau thì CHÍNH luồng ấy mở lại, mang theo cả lịch sử cũ.
 *
 * Đó là điều mọi ứng dụng nhắn tin làm, và nó cũng xoá luôn câu hỏi "đã đóng
 * thì chỉ mục còn giữ không" — câu hỏi đã sinh ra hai lỗi thật ở bản trước.
 *
 * ---------------------------------------------------------------------------
 * AI ĐƯỢC HỎI: THEO TRẠNG THÁI TIN, KHÔNG THEO ĐƠN
 * ---------------------------------------------------------------------------
 *   Tin đang MỞ   → ai cũng hỏi được, CHƯA cần nộp đơn. Đây là việc chính của
 *                   nút này: hỏi ca, hỏi lương trước khi quyết định nộp — và
 *                   là thứ thẻ đề nghị của trợ lý mở ra [03, nhóm câu hỏi 2].
 *   Tin đã ĐÓNG   → (kể cả QUÁ HẠN NỘP mà vẫn `OPEN`)
 *                   chỉ người đã nộp đơn (chưa rút): không còn gì để hỏi
 *                   "trước khi ứng tuyển", nhưng trao đổi về đơn đã nộp phải
 *                   tiếp tục được (kế hoạch chat SV–NTD, mục 1).
 *   Tin bị GỠ     → không ai mở được, kể cả người đã nộp đơn: tin vi phạm
 *                   không phải chủ đề để mở thêm cuộc trò chuyện.
 *
 * Bản 2026-10-06 bắt buộc có đơn ở MỌI trường hợp. Thẻ đề nghị của trợ lý
 * thành nút luôn trả lỗi với người chưa nộp đơn, và 25 ca ở làn database đỏ —
 * CI không chạy làn đó nên không ai thấy.
 */
export async function chuyenNhaTuyenDung(
  userId: string,
  jobId: string,
  loiNhan: string,
): Promise<KetQuaChuyen> {
  const tin = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      status: true,
      deadline: true,
      goBoiAdminId: true,
      employerProfileId: true,
      employerProfile: { select: { userId: true, verifiedAt: true, companyName: true } },
    },
  })
  if (!tin || tin.goBoiAdminId !== null) throw notFound(KHONG_THAY_TIN)

  /*
   * Nhà tuyển dụng phải đã được xác minh. Sinh viên không nên bị đẩy sang nói
   * chuyện với một doanh nghiệp chưa ai kiểm giấy tờ.
   */
  if (!tin.employerProfile.verifiedAt) {
    throw badRequest('Nhà tuyển dụng này chưa được xác minh')
  }

  const hoSo = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!hoSo) throw notFound('Chưa có hồ sơ sinh viên')

  /*
   * Quá hạn nộp cũng là "đã đóng": không nhận hồ sơ nữa thì không còn gì để hỏi
   * trước khi ứng tuyển. Tin vẫn `OPEN` vì không có gì tự đóng nó — xem
   * `lib/han-nop.ts`.
   */
  const conNhanDon = tin.status === 'OPEN' && conHanNop(tin.deadline)
  if (!conNhanDon) {
    const don = await prisma.application.findUnique({
      where: { jobId_studentProfileId: { jobId: tin.id, studentProfileId: hoSo.id } },
      select: { status: true },
    })
    // Cùng 404 với "không có tin": người chưa nộp đơn không cần biết tin
    // đóng hay chưa từng có — với họ, nó không còn để hỏi nữa.
    if (!don || don.status === 'WITHDRAWN') throw notFound(KHONG_THAY_TIN)
  }

  /*
   * Đã chặn nơi này thì phải bỏ chặn trước — không tự bỏ hộ, xem
   * `chan-ntd.service.ts`. Kèm id luồng: giao diện hiện nút "Mở hội thoại",
   * và nút "Bỏ chặn" nằm ngay trong luồng đó.
   */
  if (await daChan(prisma, userId, tin.employerProfileId)) {
    const cu = await prisma.chatSession.findUnique({
      where: {
        ownerUserId_clientSessionId: {
          ownerUserId: userId,
          clientSessionId: khoaLuongNTD(tin.employerProfileId),
        },
      },
      select: { id: true },
    })
    throw conflict(
      'Bạn đã chặn nhà tuyển dụng này. Bỏ chặn trong cuộc trò chuyện với họ để trao đổi lại.',
      cu ? { sessionId: [cu.id] } : undefined,
    )
  }

  const luong = await moLuongNTD({
    userId,
    studentProfileId: hoSo.id,
    employerProfileId: tin.employerProfileId,
    jobId: tin.id,
  })
  const sessionId = luong.sessionId

  const kq = await prisma.$transaction(async (tx) => {
    /*
     * Chỉ luồng ĐANG ĐÓNG mới cần mở lại. Đang chờ hoặc đang trao đổi thì bấm
     * thêm lần nữa là trùng — báo rõ thay vì lặng lẽ ghi thêm một lời nhắn mở
     * đầu thứ hai vào giữa cuộc trò chuyện.
     *
     * `vuaTao` là thứ phân biệt được hai ca giống hệt nhau qua `state`: luồng
     * NTD ra đời đã ở `WAITING_EMPLOYER` (CHECK cấm `AI_ACTIVE`), nên thiếu cờ
     * này thì chính lần bấm ĐẦU TIÊN bị báo trùng.
     *
     * Báo trùng KÈM id luồng: kế hoạch nói nút trao đổi "mở hội thoại hiện có
     * hoặc gửi yêu cầu mới". Giao diện dùng id này để đưa người dùng tới đúng
     * cuộc trò chuyện đang có, thay vì để họ đứng trước một câu báo lỗi.
     */
    const luongDangCo = { sessionId: [sessionId] }
    if (!luong.vuaTao && luong.state === 'WAITING_EMPLOYER') {
      throw conflict('Bạn đã gửi yêu cầu và đang chờ nhà tuyển dụng này trả lời.', luongDangCo)
    }
    if (luong.state === 'HUMAN_ACTIVE') {
      throw conflict('Bạn đang trao đổi trực tiếp với nhà tuyển dụng này rồi.', luongDangCo)
    }

    if (luong.state === 'CLOSED') {
      const doi = await tx.chatSession.updateMany({
        where: { id: sessionId, state: 'CLOSED' },
        data: {
          state: 'WAITING_EMPLOYER',
          jobId: tin.id,
          handoffRequestedAt: new Date(),
          closedAt: null,
          closedByUserId: null,
        },
      })
      if (doi.count === 0) throw conflict('Luồng vừa đổi trạng thái, thử lại giúp tôi')
    } else {
      /* Luồng vừa được tạo ở `WAITING_EMPLOYER`; chỉ cần đóng dấu thời điểm. */
      await tx.chatSession.update({
        where: { id: sessionId },
        data: { handoffRequestedAt: new Date() },
      })
    }

    const tinMo = await ghiTinHeThong(tx, sessionId, dungLoiMoDau(loiNhan, tin))

    await createNotification(tx, {
      userId: tin.employerProfile.userId,
      type: 'CHAT_HANDOFF_REQUESTED',
      title: 'Có sinh viên muốn trao đổi',
      body: `Một sinh viên đang chờ bạn trả lời về tin “${tin.title}”.`,
      link: `/ntd/hoi-thoai?phien=${sessionId}`,
    })

    return tinMo
  })

  phatTinMoi(sessionId, kq)
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
 * Lời nhắn mở đầu, LUÔN đính kèm tên tin.
 *
 * Một luồng NTD sống lâu và có thể bàn về nhiều tin của cùng nơi đó — cột
 * `jobId` chỉ giữ tin của lần mở GẦN NHẤT (hộp thư nhà tuyển dụng hiện tên tin
 * theo cột này). Nên mỗi lần mở lại phải nói rõ lần này hỏi về cái gì, nếu
 * không nhà tuyển dụng đọc một câu hỏi lơ lửng giữa một cuộc trò chuyện cũ.
 *
 * Bản trước chỉ đính kèm khi tin KHÁC tin đã gắn. Đúng với mô hình cũ (một
 * luồng một lần trao đổi), sai với luồng vĩnh viễn.
 */
function dungLoiMoDau(loiNhan: string, tin: { id: string; title: string }): string {
  const than = loiNhan === '' ? 'Sinh viên muốn trao đổi trực tiếp với bạn.' : loiNhan
  return `${than}
(Về tin: ${tin.title})`
}

/* ================================================= B — sinh viên huỷ chờ -- */

/**
 * `WAITING_EMPLOYER` → `CLOSED`. Không báo cho nhà tuyển dụng.
 *
 * ĐÓNG chứ không về `AI_ACTIVE`: luồng NTD không có trợ lý nào để quay về, và
 * `chat_trang_thai_theo_kenh` cấm trạng thái đó ở kênh này. Sinh viên đổi ý
 * thì luồng đóng lại — hỏi lại nơi đó lần sau chính là mở lại luồng này, mang
 * theo cả lịch sử.
 */
export async function huyCho(userId: string, sessionId: string): Promise<KetQuaChuyen> {
  await phienCuaChu(userId, sessionId)

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: 'WAITING_EMPLOYER' },
      data: { state: 'CLOSED', handoffRequestedAt: null, closedAt: new Date() },
    })
    if (doi.count === 0) throw conflict('Hội thoại không còn ở trạng thái chờ')

    return ghiTinHeThong(tx, sessionId, 'Bạn đã huỷ yêu cầu trao đổi với nhà tuyển dụng.')
  })

  phatTinMoi(sessionId, tin)
  phatTrangThai(sessionId, 'CLOSED', userId)
  return { sessionId, state: 'CLOSED', tin }
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

    const tinMo = await ghiTinHeThong(tx, sessionId, 'Nhà tuyển dụng đã tiếp nhận.')

    await createNotification(tx, {
      userId: phien.ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Nhà tuyển dụng đã trả lời',
      body: 'Bạn có thể nhắn trực tiếp với nhà tuyển dụng ngay bây giờ.',
      link: '/hoi-thoai',
    })

    return tinMo
  })

  phatTinMoi(sessionId, tin)
  phatTrangThai(sessionId, 'HUMAN_ACTIVE', phien.ownerUserId)
  return { sessionId, state: 'HUMAN_ACTIVE', tin }
}

/* ============================== C2 — nhà tuyển dụng mở lời từ một đơn -- */

export interface KetQuaTraoDoi {
  sessionId: string
  state: 'HUMAN_ACTIVE'
  /** `null` = luồng vốn đang trao đổi, không có gì được ghi thêm. */
  tin: TinNhanItem | null
}

/**
 * Nhà tuyển dụng mở trao đổi với một ứng viên, từ ĐƠN của tin mình.
 *
 * Kế hoạch chat SV–NTD, mục 1: "NTD chỉ được chủ động liên hệ từ đơn ứng tuyển
 * thuộc tin của mình; SV được từ chối/chặn." Không có đơn thì không có cửa —
 * nhà tuyển dụng không lấy được danh sách sinh viên để nhắn tuỳ ý.
 *
 * ---------------------------------------------------------------------------
 * BẤM LẠI KHÔNG GHI THÊM GÌ
 * ---------------------------------------------------------------------------
 * Đây là lối vào cuộc trò chuyện từ màn hình ứng viên, nên sẽ bị bấm nhiều lần.
 * Bản 2026-10-06 mỗi lần bấm ghi một tin hệ thống và gửi một thông báo — mười
 * lần mở là mười dòng "nhà tuyển dụng muốn trao đổi" trong chuông của sinh
 * viên. Giờ chỉ khi luồng thật sự ĐỔI trạng thái mới có tin và thông báo.
 *
 * ---------------------------------------------------------------------------
 * BA TRẠNG THÁI NGUỒN, MỘT CÂU UPDATE CÓ ĐIỀU KIỆN
 * ---------------------------------------------------------------------------
 *   vừa tạo / `CLOSED`   → `HUMAN_ACTIVE`: nhà tuyển dụng mở lời.
 *   `WAITING_EMPLOYER`   → `HUMAN_ACTIVE`: sinh viên đã hỏi trước; mở lời lúc
 *                          này chính là tiếp nhận.
 *   `HUMAN_ACTIVE`       → giữ nguyên, chỉ trả id để mở ra.
 *
 * Vào thẳng `HUMAN_ACTIVE`, không chờ sinh viên đồng ý: họ là người đã nộp đơn
 * cho chính tin này, và "Kết thúc" đóng luồng bất cứ lúc nào — đó là quyền từ
 * chối của kế hoạch. Chặn hẳn một nhà tuyển dụng là việc còn nợ.
 */
export async function ntdChuDongTraoDoi(
  user: { id: string; role: Role },
  applicationId: string,
  loiNhan = '',
): Promise<KetQuaTraoDoi> {
  const don = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      jobId: true,
      studentProfileId: true,
      studentProfile: { select: { userId: true } },
      job: {
        select: {
          title: true,
          goBoiAdminId: true,
          employerProfileId: true,
          employerProfile: { select: { userId: true, verifiedAt: true } },
        },
      },
    },
  })
  if (!don) throw notFound('Không tìm thấy đơn ứng tuyển')
  // 403 như phần còn lại của module đơn ứng tuyển (`layTinCuaNtd`).
  if (don.job.employerProfile.userId !== user.id) {
    throw forbidden('Đơn ứng tuyển này không thuộc tin của bạn')
  }
  if (don.status === 'WITHDRAWN') throw badRequest('Ứng viên đã rút đơn này')
  if (don.job.goBoiAdminId !== null) throw badRequest('Tin này đã bị gỡ khỏi trang')
  /* Cùng luật với phía sinh viên: doanh nghiệp chưa ai kiểm giấy tờ thì không mở lời. */
  if (!don.job.employerProfile.verifiedAt) {
    throw badRequest('Hồ sơ doanh nghiệp của bạn chưa được xác minh')
  }

  const ownerUserId = don.studentProfile.userId

  /* Kiểm sớm: chưa có luồng thì đừng tạo ra một luồng chỉ để từ chối. */
  if (await daChan(prisma, ownerUserId, don.job.employerProfileId)) {
    throw forbidden(UNG_VIEN_KHONG_NHAN_TIN)
  }

  const luong = await moLuongNTD({
    userId: ownerUserId,
    studentProfileId: don.studentProfileId,
    employerProfileId: don.job.employerProfileId,
    jobId: don.jobId,
  })
  const sessionId = luong.sessionId
  if (luong.state === 'HUMAN_ACTIVE') return { sessionId, state: 'HUMAN_ACTIVE', tin: null }

  const tin = await prisma.$transaction(async (tx) => {
    const doi = await tx.chatSession.updateMany({
      where: { id: sessionId, state: { in: ['WAITING_EMPLOYER', 'CLOSED'] } },
      data: {
        state: 'HUMAN_ACTIVE',
        jobId: don.jobId,
        handoffAcceptedAt: new Date(),
        closedAt: null,
        closedByUserId: null,
      },
    })
    /*
     * `count === 0` chỉ có một nghĩa ở đây: giữa lúc đọc và lúc ghi, luồng đã
     * sang `HUMAN_ACTIVE` (chính nhà tuyển dụng bấm ở tab khác). Đích đã đạt,
     * không có gì để ghi — không phải lỗi.
     */
    if (doi.count === 0) return null

    /*
     * Kiểm LẠI, trong transaction, SAU câu UPDATE. Lần kiểm sớm ở trên có khe:
     * sinh viên bấm chặn đúng lúc này. Câu UPDATE đã khoá hàng luồng, nên giao
     * dịch chặn (cũng UPDATE hàng đó để đóng luồng) hoặc đã commit — và lần
     * đọc này thấy nó — hoặc phải chờ ta xong rồi mới đóng luồng lại. Không có
     * thứ tự nào để luồng mở với một người đã chặn.
     */
    if (await daChan(tx, ownerUserId, don.job.employerProfileId)) {
      throw forbidden(UNG_VIEN_KHONG_NHAN_TIN)
    }

    const than = loiNhan.trim() === '' ? 'Nhà tuyển dụng muốn trao đổi với bạn.' : loiNhan.trim()
    const tinMo = await ghiTinHeThong(tx, sessionId, `${than}\n(Về đơn ứng tuyển tin: ${don.job.title})`)

    await createNotification(tx, {
      userId: ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Nhà tuyển dụng muốn trao đổi',
      body: `Về đơn ứng tuyển tin “${don.job.title}”.`,
      link: `/hoi-thoai/${sessionId}`,
    })

    return tinMo
  })

  if (tin) {
    phatTinMoi(sessionId, tin)
    phatTrangThai(sessionId, 'HUMAN_ACTIVE', ownerUserId)
  }
  return { sessionId, state: 'HUMAN_ACTIVE', tin }
}

/*
 * ============================================================================
 * KHÔNG CÒN "QUAY LẠI HỎI TRỢ LÝ"
 * ============================================================================
 * `quayLaiAi` từng đưa luồng từ `HUMAN_ACTIVE` về `AI_ACTIVE` — nó tồn tại chỉ
 * vì một hàng phải kiêm cả hai cuộc trò chuyện.
 *
 * Giờ luồng trợ lý là một hàng riêng, luôn sống. Sinh viên muốn hỏi trợ lý thì
 * mở luồng trợ lý; luồng với nhà tuyển dụng đứng nguyên đó và không ai phải
 * đổi trạng thái gì.
 *
 * Hàm ấy cũng từng là một lỗ: nó không kiểm `kind`, nên gọi được trên một
 * ticket hỗ trợ đang mở và làm chỉ mục chống trùng nhả hàng ra. Xoá hàm là
 * xoá luôn lỗ.
 */

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
    return ghiTinHeThong(tx, sessionId, NOI[quyen.vai])
  })

  phatTinMoi(sessionId, tin)
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
    const tinMo = await ghiTinHeThong(tx, sessionId, than)

    await createNotification(tx, {
      userId: phien.ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Nhà tuyển dụng chưa thể trao đổi',
      body: than,
      link: '/tro-ly',
    })

    return tinMo
  })

  phatTinMoi(sessionId, tin)
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
        )
      })
      if (tin) {
        phatTinMoi(p.id, tin)
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

  /*
   * Lọc thêm `kind: 'NTD'` dù `handoffEmployerProfileId` đã đủ hẹp.
   *
   * `chat_ntd_du_doi_tuong` bảo đảm cột kia chỉ khác NULL ở luồng NTD, nên hai
   * điều kiện trùng nhau hôm nay. Viết cả hai là để truy vấn tự nói rõ nó tìm
   * cái gì — và để nó vẫn đúng nếu sau này có kênh khác mượn cột ấy.
   *
   * Vẫn lọc theo `state`: hộp thư là việc CẦN LÀM, không phải kho lưu trữ.
   * Luồng đã đóng nằm ở lịch sử, không đứng chắn giữa những yêu cầu đang chờ.
   */
  const ds = await prisma.chatSession.findMany({
    where: {
      kind: 'NTD',
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
