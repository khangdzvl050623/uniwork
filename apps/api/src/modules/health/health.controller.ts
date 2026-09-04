import type { RequestHandler } from 'express'
import { ok } from '../../lib/respond.js'
import { getHealth } from './health.service.js'

/**
 * Controller chỉ làm ba việc: đọc dữ liệu từ request, gọi service, trả response.
 * Mọi logic nghiệp vụ nằm ở service — nhờ vậy service test được mà không cần
 * dựng request giả.
 */
export const healthController: RequestHandler = (_req, res) => {
  ok(res, getHealth())
}
