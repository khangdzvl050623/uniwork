import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Role } from '@prisma/client'
import {
  DANH_MUC_HO_TRO_LABELS,
  type DanhMucHoTro,
  type HoTroKhachInput,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { createNotification } from '../notifications/notifications.service.js'
import { PHONG_ADMIN_HO_TRO } from './chat.access.js'
import { ghiTinHeThong, phatTinMoi, phatTrangThai, type TinNhanItem } from './chat.service.js'
import { phatToiPhong } from './phat-su-kien.js'
import { otpEmail, sendMail } from '../../lib/mailer.js'
import { isProduction } from '../../config/env.js'
import { logger } from '../../lib/logger.js'

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
 * hội thoại khác sang thì người dùng phải tự xem và xác nhận bản tóm tắt, tức
 * là tự đọc và tự quyết chia sẻ cái gì.
 *
 * ===========================================================================
 * KHÁC HANDOFF NTD Ở HAI ĐIỂM
 * ===========================================================================
 *   Người nhận đặt lúc TIẾP NHẬN, không phải lúc yêu cầu. Admin là hàng đợi;
 *   lúc bấm gửi thì chưa biết ai sẽ xử.
 *
 *   Admin đọc TỪ ĐẦU hội thoại hỗ trợ, không có mốc riêng tư. Hội thoại hỗ trợ chính
 *   là nội dung cái ticket, và người dùng chủ động mở nó để xin người thật.
 *   Admin TUYỆT ĐỐI KHÔNG đọc được chat SV–NTD hoặc lịch sử AI riêng.
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

export interface ThongTinYeuCauHoTro {
  danhMuc?: DanhMucHoTro
  moTa?: string
  tomTatAi?: string
}

/**
 * `AI_ACTIVE` hoặc `CLOSED` → `WAITING_ADMIN`.
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
  inputHoacMoTa: string | ThongTinYeuCauHoTro,
): Promise<KetQuaHoTro> {
  await phienHoTroCuaChu(userId, sessionId)

  const danhMuc: DanhMucHoTro =
    typeof inputHoacMoTa === 'object' && inputHoacMoTa.danhMuc
      ? inputHoacMoTa.danhMuc
      : 'KHAC'
  const moTaRaw =
    typeof inputHoacMoTa === 'object'
      ? (inputHoacMoTa.moTa ?? '')
      : (inputHoacMoTa ?? '')
  const tomTatAi =
    typeof inputHoacMoTa === 'object' ? inputHoacMoTa.tomTatAi : undefined

  const tenDanhMuc = DANH_MUC_HO_TRO_LABELS[danhMuc] || 'Vấn đề khác'
  const thanMoTa = moTaRaw.trim() !== '' ? moTaRaw.trim() : 'Người dùng yêu cầu hỗ trợ trực tiếp.'

  const loiHeThong = tomTatAi && tomTatAi.trim() !== ''
    ? `[Vấn đề: ${tenDanhMuc}]\n${thanMoTa}\n\n(Bản tóm tắt từ AI đã được người dùng xác nhận:\n${tomTatAi.trim()})`
    : `[Vấn đề: ${tenDanhMuc}]\n${thanMoTa}`

  const tin = await dichLoiTrungHoTro(async () =>
    prisma.$transaction(async (tx) => {
      const doi = await tx.chatSession.updateMany({
        where: { id: sessionId, state: { in: ['AI_ACTIVE', 'CLOSED'] } },
        data: {
          state: 'WAITING_ADMIN',
          handoffRequestedAt: new Date(),
          closedAt: null,
          closedByUserId: null,
          activeAiRunId: null,
        },
      })
      if (doi.count === 0) throw conflict('Yêu cầu hỗ trợ đang được xử lý rồi')

      return ghiTinHeThong(tx, sessionId, loiHeThong)
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

    const tinMo = await ghiTinHeThong(tx, sessionId, 'Quản trị viên đã tiếp nhận phiên hỗ trợ.')

    await createNotification(tx, {
      userId: p.ownerUserId,
      type: 'CHAT_HANDOFF_ACCEPTED',
      title: 'Quản trị viên đã trả lời',
      body: 'Bạn có thể trao đổi trực tiếp ngay bây giờ.',
      link: '/ho-tro',
    })

    return tinMo
  })

  phatTinMoi(sessionId, tin)
  phatTrangThai(sessionId, 'HUMAN_ACTIVE', p.ownerUserId)

  return { sessionId, state: 'HUMAN_ACTIVE', tin }
}

export interface MucHangDoiHoTro {
  sessionId: string
  ownerVai: Role
  state: string
  moTaDau: string | null
  danhMuc: string | null
  handoffAdminUserId: string | null
  handoffRequestedAt: string | null
  lastMessageAt: string
}

export interface MucHoTroKhach {
  id: string
  email: string
  hoTen: string
  phone?: string
  danhMuc: DanhMucHoTro
  moTa: string
  createdAt: string
  status: 'WAITING_ADMIN' | 'RESOLVED' | 'CLOSED'
  ghiChuXuLy?: string
}

const dsHoTroKhach: MucHoTroKhach[] = []

export function layDanhSachHoTroKhach(): MucHoTroKhach[] {
  return dsHoTroKhach
}

/**
 * Hàng đợi hỗ trợ của admin.
 *
 * Hiện cả các phiên hội thoại đăng nhập (`hoTro`) lẫn các yêu cầu của khách không đăng nhập được (`hoTroKhach`).
 */
export async function hangDoiHoTro(): Promise<{
  hoTro: MucHangDoiHoTro[]
  hoTroKhach: MucHoTroKhach[]
}> {
  const ds = await prisma.chatSession.findMany({
    where: { kind: 'AI_SUPPORT', state: { in: ['WAITING_ADMIN', 'HUMAN_ACTIVE'] } },
    orderBy: { handoffRequestedAt: 'asc' },
    take: 100,
    select: {
      id: true,
      state: true,
      handoffAdminUserId: true,
      handoffRequestedAt: true,
      lastMessageAt: true,
      owner: { select: { role: true } },
      messages: {
        where: { senderType: 'SYSTEM' },
        orderBy: { seq: 'asc' },
        take: 1,
        select: { body: true },
      },
    },
  })

  return {
    hoTro: ds.map((p) => {
      const body = p.messages[0]?.body ?? null
      const match = body ? body.match(/\[Vấn đề: ([^\]]+)\]/) : null
      return {
        sessionId: p.id,
        ownerVai: p.owner.role,
        state: p.state,
        moTaDau: body,
        danhMuc: match ? match[1] : null,
        handoffAdminUserId: p.handoffAdminUserId,
        handoffRequestedAt: p.handoffRequestedAt?.toISOString() ?? null,
        lastMessageAt: p.lastMessageAt.toISOString(),
      }
    }),
    hoTroKhach: layDanhSachHoTroKhach(),
  }
}

/* ==================================== Hỗ trợ cho người không đăng nhập được == */

interface OtpKhachEntry {
  hash: string
  code: string
  expiresAt: number
  attempts: number
}

const otpKhachStore = new Map<string, OtpKhachEntry>()
const OTP_KHACH_TTL_MS = 10 * 60 * 1000 // 10 phút

function hashOtpKhach(email: string, code: string): string {
  return createHash('sha256').update(`${email.toLowerCase()}:${code}`).digest('hex')
}

export async function guiOtpKhach(email: string): Promise<{ devCode?: string }> {
  const code = randomInt(100000, 1000000).toString()
  const hash = hashOtpKhach(email, code)

  otpKhachStore.set(email.toLowerCase(), {
    hash,
    code,
    expiresAt: Date.now() + OTP_KHACH_TTL_MS,
    attempts: 0,
  })

  await sendMail({
    to: email,
    ...otpEmail(code),
    subject: '[UniWork] Mã xác thực liên hệ hỗ trợ',
  })

  if (!isProduction) {
    logger.info('Mã xác thực hỗ trợ khách (dev)', { email, code })
    return { devCode: code }
  }

  return {}
}

export async function guiYeuCauKhach(input: HoTroKhachInput): Promise<{ ticket: MucHoTroKhach }> {
  const entry = otpKhachStore.get(input.email.toLowerCase())
  if (!entry) {
    throw badRequest('Chưa yêu cầu mã xác thực hoặc mã đã hết hạn. Vui lòng bấm gửi mã mới.')
  }

  if (Date.now() > entry.expiresAt) {
    otpKhachStore.delete(input.email.toLowerCase())
    throw badRequest('Mã xác thực đã hết hạn. Vui lòng lấy mã mới.')
  }

  entry.attempts++
  if (entry.attempts > 5) {
    otpKhachStore.delete(input.email.toLowerCase())
    throw badRequest('Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu mã mới.')
  }

  const userHash = hashOtpKhach(input.email, input.code)
  const a = Buffer.from(entry.hash)
  const b = Buffer.from(userHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw badRequest('Mã xác thực không đúng. Vui lòng kiểm tra lại hộp thư.')
  }

  // Xác minh thành công, huỷ mã
  otpKhachStore.delete(input.email.toLowerCase())

  const ticket: MucHoTroKhach = {
    id: `khach-${Date.now()}-${randomInt(1000, 9999)}`,
    email: input.email,
    hoTen: input.hoTen,
    phone: input.phone,
    danhMuc: input.danhMuc,
    moTa: input.moTa,
    createdAt: new Date().toISOString(),
    status: 'WAITING_ADMIN',
  }

  dsHoTroKhach.unshift(ticket)

  // Thông báo tới phòng Admin
  phatToiPhong(PHONG_ADMIN_HO_TRO, 'ho-tro:khach-moi', ticket)

  // Gửi mail xác nhận cho người gửi
  try {
    await sendMail({
      to: input.email,
      subject: '[UniWork] Đã tiếp nhận yêu cầu hỗ trợ của bạn',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
          <h2>UniWork đã tiếp nhận yêu cầu hỗ trợ</h2>
          <p>Xin chào <strong>${input.hoTen}</strong>,</p>
          <p>Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn với thông tin:</p>
          <ul>
            <li><strong>Danh mục:</strong> ${DANH_MUC_HO_TRO_LABELS[input.danhMuc]}</li>
            <li><strong>Mô tả:</strong> ${input.moTa}</li>
          </ul>
          <p>Ban quản trị UniWork sẽ xem xét và phản hồi trực tiếp tới email này sớm nhất.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Đội ngũ hỗ trợ UniWork</p>
        </div>
      `,
    })
  } catch (err) {
    logger.warn('Không gửi được email xác nhận tới khách', { err, email: input.email })
  }

  return { ticket }
}

export async function xuLyYeuCauKhach(
  _adminUserId: string,
  ticketId: string,
  status: 'RESOLVED' | 'CLOSED',
  ghiChu?: string,
): Promise<{ ticket: MucHoTroKhach }> {
  const t = dsHoTroKhach.find((x) => x.id === ticketId)
  if (!t) throw notFound('Không tìm thấy yêu cầu hỗ trợ của khách')

  t.status = status
  if (ghiChu) t.ghiChuXuLy = ghiChu

  return { ticket: t }
}
