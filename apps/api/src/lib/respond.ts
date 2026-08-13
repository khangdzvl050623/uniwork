import type { Response } from 'express'
import type { ApiFailure, ApiErrorCode, ApiSuccess } from '@uniwork/shared'

/**
 * Hai hàm duy nhất được phép gửi response ra ngoài.
 *
 * Bắt mọi endpoint đi qua đây để hình dạng response luôn giống nhau. Nếu để
 * mỗi controller tự gọi res.json() thì chỗ trả `{data}`, chỗ trả thẳng mảng,
 * chỗ lại `{result}` — phía web phải nhớ từng ca một.
 *
 * Kiểu ApiSuccess/ApiFailure lấy từ packages/shared, đúng bộ mà web dùng để
 * đọc. Đổi hình dạng ở shared là cả hai phía cùng báo lỗi biên dịch.
 */
export function ok<T>(res: Response, data: T, status = 200) {
  const body: ApiSuccess<T> = { ok: true, data }
  res.status(status).json(body)
}

export function fail(
  res: Response,
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, string[]>,
) {
  const body: ApiFailure = { ok: false, error: { code, message, details } }
  res.status(status).json(body)
}
