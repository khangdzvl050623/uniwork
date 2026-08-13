import type { RequestHandler } from 'express'
import { logger } from '../lib/logger.js'

/** Đường dẫn không ghi log, tránh làm ngập log vì bị ping mỗi 5 phút. */
const SILENT_PATHS = new Set(['/api/health'])

/**
 * Ghi lại mỗi request sau khi đã trả lời xong.
 *
 * Nghe sự kiện `finish` của response chứ không log ngay đầu handler, vì lúc đó
 * chưa biết mã trạng thái lẫn thời gian xử lý — hai thứ đáng giá nhất khi đi
 * tìm nguyên nhân chậm.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (SILENT_PATHS.has(req.path)) {
    next()
    return
  }

  const startedAt = performance.now()

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt)
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'

    logger[level](`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      durationMs,
    })
  })

  next()
}
