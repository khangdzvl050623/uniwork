import type { ApiErrorCode } from '@uniwork/shared'

/**
 * Lỗi có chủ đích — thứ mà code tự ném ra khi biết rõ chuyện gì sai.
 *
 * Phân biệt với lỗi ngoài ý muốn (TypeError, mất kết nối database): loại đó
 * không phải AppError và sẽ bị middleware xử lý lỗi quy về INTERNAL_ERROR,
 * đồng thời giấu chi tiết khỏi người dùng.
 */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/* Các lỗi hay dùng, gói sẵn để chỗ gọi ngắn gọn và mã lỗi không bị gõ sai. */

export const badRequest = (message: string, details?: Record<string, string[]>) =>
  new AppError('VALIDATION_ERROR', message, 400, details)

export const unauthorized = (message = 'Bạn cần đăng nhập để thực hiện thao tác này') =>
  new AppError('UNAUTHORIZED', message, 401)

export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này') =>
  new AppError('FORBIDDEN', message, 403)

export const notFound = (message = 'Không tìm thấy dữ liệu') =>
  new AppError('NOT_FOUND', message, 404)

export const conflict = (message: string) => new AppError('CONFLICT', message, 409)

export const tooManyRequests = (message = 'Bạn thao tác quá nhanh, thử lại sau ít phút') =>
  new AppError('RATE_LIMITED', message, 429)
