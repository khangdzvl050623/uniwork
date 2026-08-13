import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { fail } from '../lib/respond.js'
import { logger } from '../lib/logger.js'
import { isProduction } from '../config/env.js'

/**
 * Chỗ duy nhất biến lỗi thành response.
 *
 * Nhờ Express 5, lỗi ném ra từ handler `async` cũng tự chảy về đây — ở Express 4
 * phải bọc try/catch từng handler rồi gọi next(err), quên một chỗ là request
 * treo cho tới khi timeout.
 *
 * Middleware xử lý lỗi bắt buộc có đủ 4 tham số, kể cả khi không dùng `next`.
 * Express nhận diện nó bằng số lượng tham số chứ không phải bằng tên.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Lỗi validate từ Zod: gom theo từng trường để form hiện đúng chỗ sai.
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_'
      details[key] = [...(details[key] ?? []), issue.message]
    }
    fail(res, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', 400, details)
    return
  }

  // 2. Lỗi mình chủ động ném: đã biết rõ mã, thông điệp và mã HTTP.
  if (err instanceof AppError) {
    fail(res, err.code, err.message, err.status, err.details)
    return
  }

  // 3. Còn lại là lỗi ngoài ý muốn. Ghi log đầy đủ để còn lần ra, nhưng KHÔNG
  //    trả chi tiết về cho client: stack trace lộ đường dẫn file, tên thư viện
  //    và phiên bản — vừa đủ để người khác dò lỗ hổng đã biết.
  const error = err instanceof Error ? err : new Error(String(err))

  logger.error('Lỗi không lường trước', {
    method: req.method,
    path: req.originalUrl,
    message: error.message,
    stack: error.stack,
  })

  fail(
    res,
    'INTERNAL_ERROR',
    isProduction ? 'Có lỗi xảy ra ở máy chủ, vui lòng thử lại sau' : error.message,
    500,
  )
}
