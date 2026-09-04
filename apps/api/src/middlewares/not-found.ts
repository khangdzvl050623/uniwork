import type { RequestHandler } from 'express'
import { fail } from '../lib/respond.js'

/**
 * Đặt sau tất cả route. Request tới đây nghĩa là không route nào khớp.
 *
 * Không có middleware này, Express trả về trang HTML 404 mặc định — phía web
 * đang chờ JSON sẽ vỡ ở bước parse, và thông báo lỗi hiện ra chẳng liên quan gì
 * tới nguyên nhân thật là gõ sai đường dẫn.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  fail(res, 'NOT_FOUND', `Không có endpoint ${req.method} ${req.originalUrl}`, 404)
}
