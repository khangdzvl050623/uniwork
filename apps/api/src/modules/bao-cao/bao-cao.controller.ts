import type { Request, RequestHandler } from 'express'
import { z } from 'zod'
import { guiBaoCaoSchema, xuLyBaoCaoSchema } from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import * as baoCao from './bao-cao.service.js'

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

function requireUserId(req: Request): string {
  if (!req.user) throw unauthorized()
  return req.user.id
}

const thamSoId = z.object({ id: z.string().min(1) })

/* ------------------------------------------------------------ người gửi -- */

/**
 * Gửi lại cùng `clientReportId` trả **200** kèm bản cũ, không phải 201.
 *
 * Mã trạng thái là cách rẻ nhất để client phân biệt "vừa tạo" với "đã có" mà
 * không phải đọc thân response — và nó đúng nghĩa HTTP: không có tài nguyên
 * mới nào được tạo ở lần gọi thứ hai.
 */
export const guiBaoCaoController: RequestHandler = async (req, res) => {
  const kq = await baoCao.guiBaoCao(requireUserId(req), parse(guiBaoCaoSchema, req.body))
  ok(res, kq, kq.daCo ? 200 : 201)
}

export const baoCaoCuaToiController: RequestHandler = async (req, res) => {
  ok(res, await baoCao.baoCaoCuaToi(requireUserId(req)))
}

/* ---------------------------------------------------------------- admin -- */

const locTrangThai = z.object({
  status: z.enum(['CHO_XU_LY', 'DANG_XEM', 'DA_XU_LY', 'BAC_BO']).optional(),
})

export const hangDoiBaoCaoController: RequestHandler = async (req, res) => {
  const { status } = parse(locTrangThai, req.query)
  ok(res, await baoCao.hangDoiBaoCao(status))
}

export const xuLyBaoCaoController: RequestHandler = async (req, res) => {
  const adminId = requireUserId(req)
  const { id } = parse(thamSoId, req.params)
  const v = parse(xuLyBaoCaoSchema, req.body)
  ok(res, await baoCao.xuLyBaoCao(adminId, id, v.status, v.ketLuan))
}
