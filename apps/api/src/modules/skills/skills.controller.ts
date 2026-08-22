import type { RequestHandler } from 'express'
import { z } from 'zod'
import { createSkillSchema, updateSkillSchema } from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest } from '../../lib/errors.js'
import * as skillsService from './skills.service.js'

/**
 * Không cần bọc try/catch quanh hàm async này.
 *
 * Express 5 tự bắt promise bị reject và chuyển thẳng tới middleware xử lý lỗi.
 * Ở Express 4 thì không — quên bọc là request treo vô hạn, không trả gì cả.
 * Đây là một trong những lý do dự án chọn Express 5.
 */
export const listSkillsController: RequestHandler = async (_req, res) => {
  ok(res, await skillsService.listSkills())
}

/* ----------------------------------------------------- quản trị danh mục -- */

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

const thamSoId = z.object({ id: z.string().min(1) })

export const listSkillsForAdminController: RequestHandler = async (_req, res) => {
  ok(res, { skills: await skillsService.listSkillsForAdmin() })
}

export const createSkillController: RequestHandler = async (req, res) => {
  const { name } = parse(createSkillSchema, req.body)
  ok(res, await skillsService.createSkill(name), 201)
}

export const updateSkillController: RequestHandler = async (req, res) => {
  const { id } = parse(thamSoId, req.params)
  const { name } = parse(updateSkillSchema, req.body)
  ok(res, await skillsService.updateSkill(id, name))
}

/*
 * Trả 200 kèm `{ id }` chứ KHÔNG phải 204 rỗng.
 *
 * `apiFetch` phía web gọi `response.json()` vô điều kiện (xem lib/api.ts), nên
 * một 204 không có thân sẽ ném đúng vào nhánh "Máy chủ trả về dữ liệu không
 * đọc được" — lỗi sai hoàn toàn so với chuyện thật là xoá thành công.
 *
 * Trả lại `id` cũng tiện: phía web vá thẳng cache bằng nó, không cần gọi lại
 * cả danh sách.
 */
export const deleteSkillController: RequestHandler = async (req, res) => {
  const { id } = parse(thamSoId, req.params)
  await skillsService.deleteSkill(id)
  ok(res, { id })
}
