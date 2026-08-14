import type { RequestHandler } from 'express'
import { ok } from '../../lib/respond.js'
import { listSkills } from './skills.service.js'

/**
 * Không cần bọc try/catch quanh hàm async này.
 *
 * Express 5 tự bắt promise bị reject và chuyển thẳng tới middleware xử lý lỗi.
 * Ở Express 4 thì không — quên bọc là request treo vô hạn, không trả gì cả.
 * Đây là một trong những lý do dự án chọn Express 5.
 */
export const listSkillsController: RequestHandler = async (_req, res) => {
  ok(res, await listSkills())
}
