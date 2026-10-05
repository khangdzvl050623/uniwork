import type { RequestHandler } from 'express'
import { z } from 'zod'
import {
  hoiNhaTuyenDungSchema,
  guiTinNhanSchema,
  hoiTroLySchema,
  taoPhienChatSchema,
  tuChoiYeuCauSchema,
  yeuCauHoTroSchema,
} from '@uniwork/shared'
import { CO_KHOA_THAT, demLuotConLai } from '@uniwork/ai-runtime'
import { prisma } from '../../lib/prisma.js'
import { ok } from '../../lib/respond.js'
import { AppError, badRequest, unauthorized } from '../../lib/errors.js'
import {
  batDauLuot,
  guiTinNhan,
  hoiThoaiCuaToi,
  layTinCu,
  layTinNhan,
  moLuong,
} from './chat.service.js'
import * as handoff from './handoff.service.js'
import * as hoTro from './ho-tro.service.js'
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
  ok(res, await moLuong(u.id, u.role, parse(taoPhienChatSchema, req.body).kind), 201)
}

/** Hội thoại của CHÍNH người gọi. Không phải hộp thư handoff — xem service. */
export const hoiThoaiCuaToiController: RequestHandler = async (req, res) => {
  ok(res, await hoiThoaiCuaToi(nguoiGoi(req).id))
}

const thamSoId = z.object({ id: z.string().min(1) })

/*
 * `cursor` và `truocSeq` loại trừ nhau: một cái đi về phía trước (tải bù), cái
 * kia đi ngược (cuộn lên đầu). Gửi cả hai là client đang lẫn hai việc — báo lỗi
 * thay vì đoán xem nó muốn cái nào.
 */
const thamSoCursor = z
  .object({
    cursor: z.string().max(200).optional(),
    truocSeq: z.coerce.number().int().min(1).optional(),
  })
  .refine((v) => !(v.cursor !== undefined && v.truocSeq !== undefined), {
    message: 'Chỉ dùng một trong hai: cursor (tải bù) hoặc truocSeq (tải tin cũ)',
  })

export const layTinNhanController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const { id } = parse(thamSoId, req.params)
  const { cursor, truocSeq } = parse(thamSoCursor, req.query)
  ok(res, truocSeq !== undefined ? await layTinCu(u, id, truocSeq) : await layTinNhan(u, id, cursor))
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
    kind: batDau.kind,
    turnId: batDau.turnId,
    jobIdDangXem: v.jobIdDangXem,
    phat: (ten, du) => kenh.phat(ten, du),
    tinHieu: dung.signal,
  })

  kenh.dongKenh()
}

/* ============================================================== handoff -- */

/**
 * Năm chuyển đổi, mỗi cái một endpoint.
 *
 * KHÔNG gộp thành `PUT /trang-thai { state }`. Gộp lại thì client tự quyết
 * trạng thái đích, và mỗi chuyển đổi có điều kiện và hiệu ứng phụ khác hẳn
 * nhau — kiểm chúng trong một `switch` là dựng lại máy trạng thái ở chỗ dễ sót
 * nhất. Năm đường riêng thì mỗi đường tự mang luật của nó.
 */
/**
 * Hỏi nhà tuyển dụng về một tin.
 *
 * KHÔNG nhận `:id` phiên nữa: `jobId` đã xác định nhà tuyển dụng, và nhà tuyển
 * dụng xác định luồng. Bắt client gửi thêm một sessionId là mời nó gửi sai.
 */
export const chuyenNTDController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const v = parse(hoiNhaTuyenDungSchema, req.body)
  ok(res, await handoff.chuyenNhaTuyenDung(u.id, v.jobId, v.loiNhan ?? ''))
}

export const huyChoController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await handoff.huyCho(u.id, parse(thamSoId, req.params).id))
}

export const tiepNhanController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await handoff.tiepNhan(u, parse(thamSoId, req.params).id))
}

export const ketThucController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await handoff.ketThuc(u, parse(thamSoId, req.params).id))
}

export const hopThuNTDController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await handoff.hopThuNTD(u.id))
}

/** Nhà tuyển dụng từ chối yêu cầu trao đổi. Đóng hẳn để sinh viên hỏi lại được sau. */
export const tuChoiYeuCauController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const { id } = parse(thamSoId, req.params)
  const v = parse(tuChoiYeuCauSchema, req.body)
  ok(res, await handoff.tuChoiYeuCau(u, id, v.lyDo))
}

/* ============================================================== hỗ trợ -- */

export const yeuCauHoTroController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  const { id } = parse(thamSoId, req.params)
  const v = parse(yeuCauHoTroSchema, req.body)
  ok(res, await hoTro.yeuCauHoTro(u.id, id, v.moTa))
}

export const huyYeuCauHoTroController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await hoTro.huyYeuCauHoTro(u.id, parse(thamSoId, req.params).id))
}

export const tiepNhanHoTroController: RequestHandler = async (req, res) => {
  const u = nguoiGoi(req)
  ok(res, await hoTro.tiepNhanHoTro(u.id, parse(thamSoId, req.params).id))
}

export const hangDoiHoTroController: RequestHandler = async (_req, res) => {
  ok(res, await hoTro.hangDoiHoTro())
}
