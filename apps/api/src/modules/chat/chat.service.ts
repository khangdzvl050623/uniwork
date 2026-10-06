import type { ChatKind, ChatSenderType, Prisma, Role } from '@prisma/client'
import type { ModelMessage } from '@uniwork/ai-runtime'
import { aiConfig, DangBanError, giuLuot, machChoPhep } from '@uniwork/ai-runtime'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, forbidden, notFound, AppError } from '../../lib/errors.js'
import {
  phongAdmin,
  phongChu,
  phongNguoiDung,
  phongNTD,
  quyenTruyCapPhien,
  type QuyenTruyCap,
} from './chat.access.js'
import { dongCursor, moCursor } from './cursor.js'
import { phatToiPhong } from './phat-su-kien.js'
import { cauHinhTroLy } from './tro-ly.cau-hinh.js'
import { createNotification } from '../notifications/notifications.service.js'

/* ================================================================ phiên -- */

/** Kênh mà người dùng tự mở được. Luồng NTD KHÔNG nằm ở đây — xem `moLuongNTD`. */
export type KenhTuMo = 'AI_STUDENT' | 'AI_EMPLOYER' | 'AI_SUPPORT'

export interface PhienResponse {
  sessionId: string
  kind: ChatKind
  state: string
  jobId: string | null
  /**
   * Luồng này vừa được tạo trong chính lời gọi đó.
   *
   * Nơi gọi CẦN biết: luồng NTD ra đời ở `WAITING_EMPLOYER` (CHECK cấm nó ở
   * `AI_ACTIVE`), nên chỉ nhìn `state` thì không phân biệt được "vừa mở" với
   * "đã gửi yêu cầu từ trước". Thiếu cờ này, lần bấm ĐẦU TIÊN đã bị báo trùng.
   */
  vuaTao: boolean
}

/**
 * `clientSessionId` giờ là KHOÁ TỰ NHIÊN viết thành chuỗi, không phải id do
 * trình duyệt sinh.
 *
 * ===========================================================================
 * VÌ SAO GIỮ CỘT NÀY THAY VÌ BỎ
 * ===========================================================================
 * `@@unique([ownerUserId, clientSessionId])` đã có sẵn trong bảng. Đổ khoá tự
 * nhiên vào đó thì chính ràng buộc ấy trở thành thứ cưỡng chế "một luồng cho
 * mỗi đối tượng" — không phải thêm ràng buộc, mà là cuối cùng cũng dùng đúng
 * cái đang có.
 *
 * Client thôi gửi giá trị này. Đó là điểm chính: suốt ngày 2026-09-30 có hai
 * lỗi thật đều từ việc để trình duyệt quyết mở luồng nào — xoá localStorage,
 * đổi máy, hay cửa sổ ẩn danh là người dùng rơi vào một hội thoại trống trong
 * khi cuộc trò chuyện thật nằm ở hàng khác.
 */
const KHOA_LUONG: Record<KenhTuMo, string> = {
  AI_STUDENT: 'luong:tro-ly',
  AI_EMPLOYER: 'luong:tro-ly',
  AI_SUPPORT: 'luong:ho-tro',
}

export const khoaLuongNTD = (employerProfileId: string) => `luong:ntd:${employerProfileId}`

/**
 * Mở luồng của người dùng với MỘT đối tượng. Có rồi thì trả lại, chưa có thì tạo.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TÁCH KHỎI `/api/tro-ly/hoi`
 * ---------------------------------------------------------------------------
 * Đường này RẺ: không chạm model, không tốn lượt, gọi bao nhiêu lần cũng ra
 * cùng một kết quả. Gộp vào lượt hỏi thì mỗi lần thử lại (mạng chập chờn,
 * bấm hai lần) đều có nguy cơ sinh thêm một luồng.
 *
 * Giờ nó idempotent theo ĐỐI TƯỢNG chứ không theo một id client gửi lên, nên
 * "gọi bao nhiêu lần cũng vậy" đúng kể cả khi đổi máy.
 */
export async function moLuong(
  userId: string,
  role: Role,
  kind: KenhTuMo,
): Promise<PhienResponse> {
  if (kind === 'AI_STUDENT' && role !== 'STUDENT') {
    throw forbidden('Luồng trợ lý sinh viên chỉ dành cho tài khoản sinh viên')
  }
  if (kind === 'AI_EMPLOYER' && role !== 'EMPLOYER') {
    throw forbidden('Luồng trợ lý nhà tuyển dụng chỉ dành cho tài khoản nhà tuyển dụng')
  }

  /*
   * Luồng TRỢ LÝ mà chưa có trợ lý thì không mở.
   *
   * `AI_EMPLOYER` hợp lệ về schema nhưng hôm nay chưa có prompt hay tool nào.
   * Mở ra thì nó nằm trong "Hội thoại của tôi" như một luồng chết: gõ vào là
   * nhận lỗi. Từ chối ở đây thì không có luồng chết nào sinh ra.
   *
   * `AI_SUPPORT` KHÔNG qua kiểm này — nó là kênh người–người, không cần trợ lý.
   */
  if (kind !== 'AI_SUPPORT' && !cauHinhTroLy(kind)) {
    throw badRequest('Trợ lý AI cho loại tài khoản này chưa được mở')
  }

  /*
   * CHECK `chat_kind_student_profile` đòi AI_STUDENT phải có studentProfileId.
   * Tra ở đây chứ không để database ném: lỗi CHECK của Postgres đọc lên là
   * "new row violates check constraint" — không nói được gì cho người dùng.
   */
  let studentProfileId: string | null = null
  if (kind === 'AI_STUDENT') {
    const hoSo = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!hoSo) throw notFound('Chưa có hồ sơ sinh viên')
    studentProfileId = hoSo.id
  }

  return timHoacTao({
    userId,
    clientSessionId: KHOA_LUONG[kind],
    tao: { kind, ownerUserId: userId, clientSessionId: KHOA_LUONG[kind], studentProfileId },
  })
}

/**
 * Mở luồng với MỘT nhà tuyển dụng. Gọi từ `chuyenNhaTuyenDung`, không phải từ
 * endpoint tạo phiên — người dùng không tự mở luồng NTD, họ bấm hỏi một tin.
 */
export async function moLuongNTD(v: {
  userId: string
  studentProfileId: string
  employerProfileId: string
  jobId: string
}): Promise<PhienResponse> {
  return timHoacTao({
    userId: v.userId,
    clientSessionId: khoaLuongNTD(v.employerProfileId),
    tao: {
      kind: 'NTD',
      ownerUserId: v.userId,
      clientSessionId: khoaLuongNTD(v.employerProfileId),
      studentProfileId: v.studentProfileId,
      handoffEmployerProfileId: v.employerProfileId,
      jobId: v.jobId,
      /* Luồng NTD không bao giờ ở `AI_ACTIVE` — CHECK `chat_trang_thai_theo_kenh` cấm. */
      state: 'WAITING_EMPLOYER',
    },
  })
}

const CHON_PHIEN = { id: true, kind: true, state: true, jobId: true } satisfies Prisma.ChatSessionSelect

async function timHoacTao(v: {
  userId: string
  clientSessionId: string
  tao: Prisma.ChatSessionUncheckedCreateInput
}): Promise<PhienResponse> {
  const khoa = {
    ownerUserId_clientSessionId: {
      ownerUserId: v.userId,
      clientSessionId: v.clientSessionId,
    },
  }

  const daCo = await prisma.chatSession.findUnique({ where: khoa, select: CHON_PHIEN })
  if (daCo) return { ...goi(daCo), vuaTao: false }

  try {
    const p = await prisma.chatSession.create({ data: v.tao, select: CHON_PHIEN })
    return { ...goi(p), vuaTao: true }
  } catch (e) {
    /*
     * Hai request song song: cái thứ hai đụng khoá. Đó là ĐÚNG Ý — đọc lại
     * luồng cái thứ nhất vừa tạo và trả về, không báo lỗi.
     */
    if (!laTrungKhoa(e)) throw e
    const lai = await prisma.chatSession.findUniqueOrThrow({ where: khoa, select: CHON_PHIEN })
    return { ...goi(lai), vuaTao: false }
  }
}

type HangPhien = { id: string; kind: ChatKind; state: string; jobId: string | null }
const goi = (p: HangPhien) => ({
  sessionId: p.id,
  kind: p.kind,
  state: p.state,
  jobId: p.jobId,
})

/**
 * `Role` của tài khoản → nhãn người gửi ghi vào tin nhắn.
 *
 * Ánh xạ 1:1, nhưng KHÔNG ép kiểu thẳng. Hai enum này trùng nhau hôm nay là
 * tình cờ; `Role` là của cả hệ thống, `ChatSenderType` còn có AI và SYSTEM.
 * Viết rời ra thì lần nào một bên thêm giá trị mới, TypeScript bắt ngay tại
 * đây thay vì để một chuỗi lạ chui vào cột.
 *
 * Bản trước viết `role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT'` — nhánh `else`
 * nuốt luôn ADMIN, nên câu trả lời của admin trong phiên hỗ trợ nằm trong
 * database dưới nhãn STUDENT, không phân biệt được với câu hỏi của chính
 * người đang xin giúp.
 */
const NGUOI_GUI: Record<Role, ChatSenderType> = {
  STUDENT: 'STUDENT',
  EMPLOYER: 'EMPLOYER',
  ADMIN: 'ADMIN',
}

/* ================================================ hội thoại của tôi -- */

export interface MucHoiThoaiCuaToi {
  sessionId: string
  kind: ChatKind
  state: string
  jobId: string | null
  /** Tin tuyển dụng đang bàn tới, nếu hội thoại đã gắn với một tin. */
  tenTin: string | null
  /** Nơi đã nhận handoff. `null` khi chưa chuyển đi đâu. */
  congTy: string | null
  /** Câu cuối cùng, để nhận ra hội thoại nào là hội thoại nào. */
  tinCuoi: string | null
  lastMessageAt: string
}

/**
 * Mọi hội thoại của CHÍNH người đang đăng nhập.
 *
 * ===========================================================================
 * VÌ SAO ĐƯỜNG NÀY LÀ BẮT BUỘC, KHÔNG PHẢI TIỆN NGHI
 * ===========================================================================
 * Thiết kế CHO PHÉP một sinh viên có nhiều phiên `AI_STUDENT` cùng lúc — chỉ
 * mục `chat_mot_handoff_moi_ntd` khoá theo cặp (sinh viên, nhà tuyển dụng),
 * nên mỗi nơi họ hỏi là một hội thoại riêng. Đó là chủ ý: nhà tuyển dụng B
 * không được đọc những gì đã chia sẻ với A.
 *
 * Nhưng giao diện lại buộc `/tro-ly` vào ĐÚNG MỘT `clientSessionId` trong
 * localStorage. Hệ quả: hội thoại thứ hai trở đi không có đường nào mở lại
 * được — chúng vẫn nằm trong database, vẫn nhận tin nhắn realtime, và chủ của
 * chúng không bao giờ nhìn thấy nữa.
 *
 * Chính server cũng đang bảo người dùng làm một việc bất khả: khi chuyển sang
 * nhà tuyển dụng thứ hai, nó trả về "Mở hội thoại mới để hỏi nơi này" — trong
 * khi không có nút nào mở được.
 *
 * ---------------------------------------------------------------------------
 * CHỈ TRẢ VỀ HỘI THOẠI MÌNH LÀ CHỦ
 * ---------------------------------------------------------------------------
 * KHÔNG gộp hộp thư của nhà tuyển dụng vào đây. Một tài khoản EMPLOYER vừa có
 * thể là chủ phiên của chính mình, vừa là người nhận handoff ở phiên của sinh
 * viên — hai vai, hai quyền đọc khác hẳn nhau (xem `chat.access.ts`). Trộn
 * chung một danh sách là mời người viết màn hình quên mất điều đó.
 */
export async function hoiThoaiCuaToi(userId: string): Promise<{ hoiThoai: MucHoiThoaiCuaToi[] }> {
  const ds = await prisma.chatSession.findMany({
    where: { ownerUserId: userId },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      id: true,
      kind: true,
      state: true,
      jobId: true,
      lastMessageAt: true,
      job: { select: { title: true } },
      handoffEmployer: { select: { companyName: true } },
      /*
       * Bỏ tin SYSTEM khỏi phần xem trước.
       *
       * Tin hệ thống là câu mới nhất ở gần như mọi hội thoại đã có chuyển đổi
       * ("Nhà tuyển dụng đã tiếp nhận."). Lấy nó thì cả danh sách hiện cùng
       * một câu và không phân biệt được gì — đúng lỗi vừa sửa ở `moTaDau` của
       * hàng đợi hỗ trợ.
       */
      messages: {
        where: { senderType: { not: 'SYSTEM' } },
        orderBy: { seq: 'desc' },
        take: 1,
        select: { body: true },
      },
    },
  })

  return {
    hoiThoai: ds.map((p) => ({
      sessionId: p.id,
      kind: p.kind,
      state: p.state,
      jobId: p.jobId,
      tenTin: p.job?.title ?? null,
      congTy: p.handoffEmployer?.companyName ?? null,
      tinCuoi: p.messages[0]?.body ?? null,
      lastMessageAt: p.lastMessageAt.toISOString(),
    })),
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
  /** Trạng thái phiên lúc đọc. Client hiển thị, KHÔNG tự suy từ danh sách tin. */
  state: string
  /**
   * Còn tin CŨ HƠN tin đầu tiên trả về không. Chỉ có khi mở luồng (không truyền
   * cursor) — lúc tải bù thì câu hỏi này không có nghĩa, và trả `false` là nói
   * dối, nên bỏ hẳn trường đi.
   */
  conCu?: boolean
}

/** Trần mỗi trang, cả tải bù lẫn tải ngược. */
const TRAN_TAI_BU = 50

/**
 * Mở luồng, hoặc tải bù từ một cursor. Dùng cho cả REST lẫn `hoi-thoai:tai-bu`.
 *
 * ---------------------------------------------------------------------------
 * KHÔNG CÓ CURSOR = TRANG MỚI NHẤT, KHÔNG PHẢI TRANG ĐẦU TIÊN
 * ---------------------------------------------------------------------------
 * Bản trước lấy `seq >= 1` tăng dần, tức 50 tin CŨ NHẤT, rồi trả cờ `conNua`
 * mà client không đọc. Luồng quá 50 tin thì mở ra thấy đoạn đầu cuộc trò
 * chuyện từ mấy tuần trước, còn câu vừa nói thì không bao giờ hiện — F5 cũng
 * vậy. Trước kia hiếm vì phiên sống ngắn; từ khi luồng sống vĩnh viễn thì chắc
 * chắn xảy ra, chỉ là sớm hay muộn.
 *
 * Mọi ứng dụng nhắn tin mở ở CUỐI cuộc trò chuyện. Tin cũ hơn lấy bằng
 * `layTinCu`, cuộn lên tới đâu tải tới đó.
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

  /*
   * Ai vào được luồng thì đọc TRỌN luồng — không còn mốc `docTuSeq` và không
   * còn bộ lọc `visibleToEmployer`.
   *
   * Cả hai từng cần vì một hàng chứa hai cuộc trò chuyện. Từ khi mỗi đối tượng
   * một luồng, chúng là hai hàng khác nhau và `quyenTruyCapPhien` đã quyết
   * xong ai đọc được hàng nào.
   */
  if (cursor === undefined) {
    /*
     * Lấy dư MỘT tin để biết còn tin cũ hơn không, khỏi tốn một câu `count`.
     */
    const moi = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { seq: 'desc' },
      take: TRAN_TAI_BU + 1,
      select: CHON_TIN,
    })
    const trang = moi.slice(0, TRAN_TAI_BU).reverse()

    return {
      tinNhan: trang.map(raTinNhanItem),
      /*
       * Đã có trang MỚI NHẤT nên mọi tin tới `seqHienTai` coi như đã xét về
       * phía trước. Lấy `max` với tin cuối vừa đọc: một tin chen vào giữa lúc
       * đọc `seqHienTai` và lúc truy vấn thì nó đã nằm trong trang, khỏi tải lại.
       */
      cursor: dongCursor(Math.max(quyen.seqHienTai, trang.at(-1)?.seq ?? 0)),
      conNua: false,
      conCu: moi.length > TRAN_TAI_BU,
      duocGui: quyen.duocGui,
      state: quyen.trangThai,
    }
  }

  const tu = moCursor(cursor) + 1

  const ds = await prisma.chatMessage.findMany({
    where: { sessionId, seq: { gte: tu } },
    orderBy: { seq: 'asc' },
    take: TRAN_TAI_BU,
    select: CHON_TIN,
  })

  const conNua = ds.length === TRAN_TAI_BU
  const daXet = conNua ? ds[ds.length - 1]!.seq : quyen.seqHienTai

  return {
    tinNhan: ds.map(raTinNhanItem),
    cursor: dongCursor(Math.max(daXet, moCursor(cursor))),
    conNua,
    duocGui: quyen.duocGui,
    state: quyen.trangThai,
  }
}

/**
 * Trang tin CŨ HƠN `truocSeq`, để cuộn ngược lên đầu cuộc trò chuyện.
 *
 * ---------------------------------------------------------------------------
 * HÀM RIÊNG, VÀ KHÔNG TRẢ CURSOR NÀO
 * ---------------------------------------------------------------------------
 * Cursor của `layTinNhan` đi về PHÍA TRƯỚC: "đã đồng bộ mọi tin mới tới đây".
 * Trang cũ hơn đi ngược chiều. Nếu nó cũng trả một cursor thì sớm muộn sẽ có
 * chỗ lỡ tay ghi đè cursor tải bù bằng nó — và khi đang mất kết nối, cursor
 * nhảy tới `seqHienTai` là bỏ qua đúng những tin chưa nhận được.
 *
 * Không có trường đó thì không có gì để ghi đè nhầm.
 */
export async function layTinCu(
  user: { id: string; role: Role },
  sessionId: string,
  truocSeq: number,
): Promise<{ tinNhan: TinNhanItem[]; conCu: boolean }> {
  const quyen = await quyenTruyCapPhien(user, sessionId)
  if (!quyen) throw notFound('Không tìm thấy hội thoại')

  const cu = await prisma.chatMessage.findMany({
    where: { sessionId, seq: { lt: truocSeq } },
    orderBy: { seq: 'desc' },
    take: TRAN_TAI_BU + 1,
    select: CHON_TIN,
  })

  return {
    tinNhan: cu.slice(0, TRAN_TAI_BU).reverse().map(raTinNhanItem),
    conCu: cu.length > TRAN_TAI_BU,
  }
}

const CHON_TIN = {
  id: true,
  seq: true,
  senderType: true,
  body: true,
  createdAt: true,
} satisfies Prisma.ChatMessageSelect

function raTinNhanItem(t: {
  id: string
  seq: number
  senderType: ChatSenderType
  body: string
  createdAt: Date
}): TinNhanItem {
  return { ...t, createdAt: t.createdAt.toISOString() }
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
  | { loai: 'moi'; turnId: string; seqCauHoi: number; conLai: number; kind: ChatKind }
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

  /*
   * Hỏi "luồng này có trợ lý không" TRƯỚC mọi thứ khác.
   *
   * Điều bắt buộc là nó nằm TRONG `batDauLuot`, trước khi transaction giữ
   * lượt commit. Bản trước chặn ở tool — tức SAU commit và sau khi đã gọi
   * model — nên lượt bị trừ thật và token bị đốt thật.
   *
   * Đứng đầu hàm (thay vì ở bất kỳ đâu trước commit) thì không mở transaction,
   * không chạy câu SQL hạn mức nào cho một yêu cầu chắc chắn bị từ chối. Đó là
   * lý do hiệu năng, không phải đúng sai: đặt nó sau `giuLuot` trong cùng
   * transaction thì rollback vẫn trả lượt lại. Đã kiểm bằng đột biến.
   *
   * Xem `tro-ly.cau-hinh.ts` về vì sao chặn theo cấu hình trợ lý, không theo tool.
   */
  const cauHinh = cauHinhTroLy(phien.kind)
  if (!cauHinh) {
    throw badRequest('Hội thoại này không có trợ lý AI')
  }

  /*
   * Mạch ngắt mở = nhà cung cấp đang lỗi liên tiếp. Từ chối NGAY, trước khi
   * giữ lượt và trước khi mở transaction.
   *
   * Cho đi tiếp thì người dùng giữ một lượt, chờ một vòng gọi model, nhận lỗi,
   * rồi được hoàn lượt — tốn thời gian của họ và tốn ngân sách chung, đổi lấy
   * đúng câu trả lời mà ta đã biết trước.
   */
  const mach = machChoPhep()
  if (!mach.duoc) {
    const giay = Math.ceil(mach.thuLaiSauMs / 1000)
    throw new AppError(
      'AI_UNAVAILABLE',
      `Trợ lý đang quá tải, bạn thử lại sau khoảng ${giay} giây nhé. Lượt của bạn không bị trừ.`,
      503,
    )
  }

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
        promptVersion: cauHinh.promptVersion,
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
          senderType: NGUOI_GUI[v.role],
          senderUserId: v.userId,
          clientMessageId: v.clientMessageId,
          body: v.noiDung,
        },
      })

      return {
        loai: 'moi' as const,
        turnId: luot.turnId,
        seqCauHoi: sau.messageSeq,
        conLai: luot.conLai,
        kind: phien.kind,
      }
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

  return ds.reverse().map((t) => ({
    role: t.senderType === 'AI' ? ('assistant' as const) : ('user' as const),
    content: t.body,
  }))
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
          senderType: NGUOI_GUI[user.role],
          senderUserId: user.id,
          clientMessageId,
          body: noiDung,
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
    phatTinMoi(sessionId, message)

    /*
     * Hai bên online thì nhận qua socket realtime; offline vẫn lưu tin và nhận thông báo khi có phản hồi.
     */
    try {
      if (prisma.chatSession?.findUnique) {
        const phien = await prisma.chatSession.findUnique({
          where: { id: sessionId },
          select: {
            kind: true,
            ownerUserId: true,
            handoffAdminUserId: true,
            handoffEmployerProfileId: true,
          },
        })
        const hasNotification =
          typeof (prisma as unknown as { notification?: { create?: unknown } }).notification
            ?.create === 'function'
        if (phien && hasNotification) {
          const preview = noiDung.length > 80 ? noiDung.slice(0, 80) + '…' : noiDung
          if (phien.kind === 'AI_SUPPORT') {
            if (user.role === 'ADMIN' && phien.ownerUserId !== user.id) {
              await createNotification(prisma, {
                userId: phien.ownerUserId,
                type: 'CHAT_HANDOFF_ACCEPTED',
                title: 'Phản hồi từ quản trị viên',
                body: preview,
                link: '/ho-tro',
              })
            } else if (phien.handoffAdminUserId && phien.handoffAdminUserId !== user.id) {
              await createNotification(prisma, {
                userId: phien.handoffAdminUserId,
                type: 'CHAT_HANDOFF_REQUESTED',
                title: 'Tin nhắn mới từ người dùng hỗ trợ',
                body: preview,
                link: '/admin/ho-tro',
              })
            }
          } else if (phien.kind === 'NTD') {
            if (user.role === 'EMPLOYER' && phien.ownerUserId !== user.id) {
              await createNotification(prisma, {
                userId: phien.ownerUserId,
                type: 'CHAT_HANDOFF_ACCEPTED',
                title: 'Tin nhắn mới từ nhà tuyển dụng',
                body: preview,
                link: `/hoi-thoai/${sessionId}`,
              })
            } else if (user.role === 'STUDENT' && phien.handoffEmployerProfileId) {
              const ntd = await prisma.employerProfile.findUnique({
                where: { id: phien.handoffEmployerProfileId },
                select: { userId: true },
              })
              if (ntd && ntd.userId !== user.id) {
                await createNotification(prisma, {
                  userId: ntd.userId,
                  type: 'CHAT_HANDOFF_REQUESTED',
                  title: 'Tin nhắn mới từ sinh viên',
                  body: preview,
                  link: '/ntd/hoi-thoai',
                })
              }
            }
          }
        }
      }
    } catch {
      // Thông báo là kênh phụ cho offline, không chặn dòng chính nếu có lỗi gửi thông báo
    }

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
 * BA PHÒNG, PHÁT VÀO CẢ BA — AN TOÀN NHỜ MỘT BẤT BIẾN
 * ===========================================================================
 * Không còn cờ `choNTD` nào ở đây, và đó là hệ quả trực tiếp của việc tách
 * luồng: một luồng chỉ có một đối tượng, nên mọi tin trong luồng đều thuộc về
 * đúng những người vào được luồng ấy.
 *
 * Bất biến làm cho việc phát vô điều kiện là an toàn:
 *
 *   Đường DUY NHẤT vào `hoi-thoai:<id>:ntd` hay `:admin` là `hoi-thoai:vao` →
 *   `quyenTruyCapPhien`. Hàm đó chỉ mở phòng `:ntd` cho luồng `kind = 'NTD'`
 *   của đúng nhà tuyển dụng sở hữu, và phòng `:admin` cho luồng
 *   `kind = 'AI_SUPPORT'`. Với luồng trợ lý thì cả hai phòng RỖNG một cách
 *   chứng minh được — có test canh.
 *
 * Bản trước phải mang cờ vì một hàng chứa hai cuộc trò chuyện, và cờ đó là
 * thứ phải nhớ đặt đúng ở CHÍN chỗ gọi. Quên một chỗ là rò realtime mà không
 * test REST nào bắt được.
 */
export function phatTinMoi(sessionId: string, message: TinNhanItem): void {
  phatToiPhong(phongChu(sessionId), 'hoi-thoai:tin-moi', { sessionId, message })
  phatToiPhong(phongNTD(sessionId), 'hoi-thoai:tin-moi', { sessionId, message })
  /*
   * =========================================================================
   * PHÒNG ADMIN: PHÁT VÔ ĐIỀU KIỆN, VÀ ĐIỀU ĐÓ AN TOÀN
   * =========================================================================
   * Không có cờ nào ở đây, khác hẳn `choNTD`. Lý do là một BẤT BIẾN, không
   * phải một sự cẩu thả:
   *
   *   Đường DUY NHẤT vào `hoi-thoai:<id>:admin` là `hoi-thoai:vao` →
   *   `quyenTruyCapPhien`, và hàm đó chỉ trả phòng này khi `kind ===
   *   'AI_SUPPORT'`. Với mọi kênh khác nó trả `null`, nên phòng RỖNG một cách
   *   chứng minh được — có test canh ("admin KHÔNG đọc được hội thoại sinh
   *   viên–nhà tuyển dụng").
   *
   * Và trong phiên hỗ trợ thì admin đọc TỪ SEQ 1, không có mốc riêng tư nào,
   * nên mọi tin đều thuộc về họ. Một cờ `choAdmin` ở đây sẽ là cờ luôn đúng —
   * tức là một chỗ để gán nhầm chứ không phải một lớp bảo vệ.
   *
   * ---------------------------------------------------------------------------
   * VÌ SAO DÒNG NÀY TỪNG THIẾU, VÀ NÓ HỎNG RA SAO
   * ---------------------------------------------------------------------------
   * Hàm này viết khi hệ chỉ có HAI phòng. Kênh hỗ trợ thêm phòng thứ ba nhưng
   * không ai sửa chỗ phát, nên `tiepNhanHoTro` phải tự vá thêm một `emit`
   * riêng. Mọi đường khác — kể cả `guiTinNhan`, đường mà MỌI tin nhắn thật đi
   * qua — thì không.
   *
   * Hệ quả: admin gõ xong không thấy gì, sinh viên nhắn sang admin cũng không
   * thấy gì. Phải F5 mới hiện. Không lỗi, không log — chỉ là realtime chết một
   * nửa ở đúng kênh mới nhất.
   */
  phatToiPhong(phongAdmin(sessionId), 'hoi-thoai:tin-moi', { sessionId, message })
}

/**
 * Báo đổi trạng thái phiên — cho CẢ HAI bên, không riêng chủ phiên.
 *
 * ===========================================================================
 * BỐN ĐÍCH, VÀ MỖI ĐÍCH LO MỘT CA KHÁC NHAU
 * ===========================================================================
 *   ba phòng hội thoại — người đang MỞ hội thoại thấy nút đổi ngay dưới tay
 *   phòng riêng của chủ    — chủ phiên đang ở trang khác vẫn nhận được
 *
 * Bản trước chỉ phát vào phòng riêng của CHỦ phiên. Nên phía bên kia —
 * nhà tuyển dụng hoặc admin đang ngồi trong chính hội thoại đó — không bao giờ
 * biết nó vừa đóng: ô nhập vẫn mở, gõ xong mới nhận lỗi từ server.
 *
 * Phát thừa vào một phòng rỗng không tốn gì (Socket.IO bỏ qua), còn phát
 * thiếu thì giao diện nói dối. Nên khi phân vân thì phát.
 */
export function phatTrangThai(sessionId: string, state: string, ownerUserId: string): void {
  const du = { sessionId, state }
  phatToiPhong(phongChu(sessionId), 'hoi-thoai:trang-thai', du)
  phatToiPhong(phongNTD(sessionId), 'hoi-thoai:trang-thai', du)
  phatToiPhong(phongAdmin(sessionId), 'hoi-thoai:trang-thai', du)
  phatToiPhong(phongNguoiDung(ownerUserId), 'hoi-thoai:trang-thai', du)
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

/* ====================================================== tin hệ thống -- */

/**
 * Ghi một tin `SYSTEM` và tăng `seq`, trong CÙNG transaction với việc đổi
 * trạng thái.
 *
 * Ở đây chứ không ở `handoff.service`: mọi chuyển đổi của cả hai kênh đều cần
 * nó, và `seq` phải cấp bằng `increment` chứ không phải `max()+1` — xem
 * `batDauLuot` về lý do.
 *
 * KHÔNG còn tham số `choNTD`. Tin hệ thống nằm trong luồng nào thì thuộc về
 * mọi người vào được luồng ấy — đó là điều việc tách luồng bảo đảm.
 */
export async function ghiTinHeThong(
  tx: Prisma.TransactionClient,
  sessionId: string,
  body: string,
): Promise<TinNhanItem> {
  const sau = await tx.chatSession.update({
    where: { id: sessionId },
    data: { messageSeq: { increment: 1 }, lastMessageAt: new Date() },
    select: { messageSeq: true },
  })

  const tin = await tx.chatMessage.create({
    data: {
      sessionId,
      seq: sau.messageSeq,
      senderType: 'SYSTEM',
      body,
    },
    select: { id: true, seq: true, senderType: true, body: true, createdAt: true },
  })

  return { ...tin, createdAt: tin.createdAt.toISOString() }
}
