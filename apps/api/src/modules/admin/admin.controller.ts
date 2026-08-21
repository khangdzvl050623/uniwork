import type { RequestHandler } from 'express'
import { z } from 'zod'
import { updateUserStatusSchema } from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest } from '../../lib/errors.js'
import * as adminService from './admin.service.js'

/**
 * Kiểm dữ liệu vào bằng Zod rồi ném `badRequest` kèm lỗi từng trường.
 *
 * Bản sao của hàm cùng tên ở auth.controller.ts/profile.controller.ts. Không
 * tách ra `lib/` dùng chung vì ba module không phụ thuộc lẫn nhau — tách sớm
 * chỉ thêm một tầng gián tiếp không cần thiết cho vài dòng này.
 */
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

export const listUsersController: RequestHandler = async (_req, res) => {
  ok(res, { users: await adminService.listUsers() })
}

export const updateUserStatusController: RequestHandler = async (req, res) => {
  const { status } = parse(updateUserStatusSchema, req.body)
  const { id } = parse(z.object({ id: z.string().min(1) }), req.params)
  ok(res, await adminService.updateUserStatus(id, status))
}
