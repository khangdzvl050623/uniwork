import type { RequestHandler } from 'express'
import { z } from 'zod'
import { guiTinNhanSchema, hoiTroLySchema, taoPhienChatSchema } from '@uniwork/shared'
import { CO_KHOA_THAT, demLuotConLai } from '@uniwork/ai-runtime'
import { prisma } from '../../lib/prisma.js'
import { ok } from '../../lib/respond.js'
import { AppError, badRequest, unauthorized } from '../../lib/errors.js'
import { batDauLuot, guiTinNhan, layTinNhan, taoPhien } from './chat.service.js'
import { KenhSSE } from './sse.js'
import { chayLuot, RUNNER_ID } from './tro-ly.service.js'

/** Bản sao của hàm cùng tên ở các module khác — xem giải thích ở admin.controller.ts. */
function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const details: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    ;(details[key] ??= []).push(issue.message)
  }
  throw badRequest('Dữ liệu không hợp lệ', details)
}

function nguoiGoi(req: { user?: { id: string; role: 'STUDENT' | 'EMPLOYER' | 'ADMIN' } }) {
  if (!req.user) throw unauthorized()
  return req.user
}

/* ================================================================ phiên -- */

export const taoPhienController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await taoPhien(u.id, u.role, parse(taoPhienChatSchema, req.body)), 201)
}

const thamSoId = z.object({ id: z.string().min(1) })

const thamSoCursor = z.object({ cursor: z.string().max(200).optional() })

export const layTinNhanController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const { id } = parse(thamSoId, req.params)
  const { cursor } = parse(thamSoCursor, req.query)
  ok(res, await layTinNhan(u, id, cursor))
}

/**
 * Đường REST để gửi tin, song song với Socket.IO.
 *
 * Không phải dự phòng cho vui: WebSocket bị chặn ở nhiều mạng trường học và
 * wifi có proxy, và không có đường này thì không test được bằng Supertest.
 */
export const guiTinNhanController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const { id } = parse(thamSoId, req.params)
  const v = parse(guiTinNhanSchema, req.body)
  const kq = await guiTinNhan(u, id, v.clientMessageId, v.noiDung)
  ok(res, kq, kq.daCo ? 200 : 201)
}

export const luotConLaiController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, { ...(await demLuotConLai(prisma, u.id, 'CHAT')), sanSang: CO_KHOA_THAT })
}

/* ============================================================ hỏi (SSE) -- */

/**
 * ===========================================================================
 * THỨ TỰ Ở ĐÂY LÀ THIẾT KẾ, KHÔNG PHẢI NGẪU NHIÊN
 * ===========================================================================
 * Mọi thứ kiểm được phải kiểm XONG, và lượt phải giữ XONG, trước khi mở kênh
 * SSE. Sau khi header đã gửi thì HTTP status đóng băng ở 200 — lúc đó không
 * còn cách nào trả 429 "hết lượt" nữa, và một client đơn giản (fetch + kiểm
 * res.ok) sẽ coi lượt hỏng là thành công.
 *
 * Nên: xác thực → Zod → có khoá không → giữ lượt (429/409 ở đây) → MỞ KÊNH →
 * từ đây trở đi mọi lỗi đi bằng sự kiện `loi`.
 */
export const hoiController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const v = parse(hoiTroLySchema, req.body)

  /*
   * Chưa cấu hình khoá thì dừng ở đây, TRƯỚC khi chạm database. Máy của người
   * chưa tạo API key vẫn chạy được cả dự án; chỉ nút trợ lý là tắt.
   */
  if (!CO_KHOA_THAT) {
    throw new AppError('AI_UNAVAILABLE', 'Trợ lý AI chưa được cấu hình trên máy chủ này', 503)
  }

  const batDau = await batDauLuot({
    userId: u.id,
    role: u.role,
    sessionId: v.sessionId,
    clientMessageId: v.clientMessageId,
    noiDung: v.noiDung,
    runnerId: RUNNER_ID,
  })

  const kenh = new KenhSSE(res)
  kenh.moKenh()

  /*
   * Gửi lại: tin này đã có trong database rồi. Phát nguyên câu trả lời cũ và
   * đóng kênh — KHÔNG gọi model lần hai, và lượt cũng không bị trừ thêm.
   */
  if (batDau.loai === 'gui-lai') {
    kenh.phat('phien', { guiLai: true })
    if (batDau.traLoiCu !== null) kenh.phat('chu', batDau.traLoiCu)
    kenh.phat('xong', { daLuu: true, seq: null })
    kenh.dongKenh()
    return
  }

  kenh.phat('phien', {
    turnId: batDau.turnId,
    seqCauHoi: batDau.seqCauHoi,
    conLai: batDau.conLai,
  })

  /*
   * Người dùng đóng tab giữa chừng thì `abort()` dừng `streamText` ngay. Không
   * có dòng này, model vẫn sinh hết câu trả lời cho một kết nối không còn ai
   * nghe — tốn token cho đúng con số không.
   */
  const dung = new AbortController()
  kenh.khiNguoiDungRoiDi(() => dung.abort())

  await chayLuot({
    userId: u.id,
    role: u.role,
    sessionId: v.sessionId,
    turnId: batDau.turnId,
    jobIdDangXem: v.jobIdDangXem,
    phat: (ten, du) => kenh.phat(ten, du),
    tinHieu: dung.signal,
  })

  kenh.dongKenh()
}
