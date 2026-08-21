import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { MulterError } from 'multer'

/**
 * Ép middleware tin rằng nó đang chạy trên production.
 *
 * `isProduction` được tính đúng một lần lúc nạp module, nên không thể đổi bằng
 * cách gán process.env trong test. Phải chặn ngay ở tầng module.
 */
vi.mock('../config/env.js', () => ({
  isProduction: true,
  env: { NODE_ENV: 'production' },
}))

// Middleware ghi log lỗi là đúng nhiệm vụ của nó, nhưng ở đây log sẽ trộn vào
// kết quả test cho khó đọc. Chặn lại, không phải vì nó sai.
vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const { errorHandler } = await import('./error-handler.js')

function taoResGia() {
  const res = {} as Response & { json: ReturnType<typeof vi.fn> }
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const reqGia = { method: 'GET', originalUrl: '/api/skills' } as Request

describe('errorHandler khi chạy production', () => {
  it('không để thông điệp lỗi gốc lọt ra ngoài', () => {
    const res = taoResGia()

    // Thông điệp lỗi thật hay chứa thứ không nên công khai: đường dẫn file trên
    // máy chủ, IP nội bộ, tên và phiên bản thư viện — vừa đủ để người ngoài tra
    // xem bản đó có lỗ hổng nào đã biết.
    errorHandler(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 tại /opt/render/project/src/db.ts'),
      reqGia,
      res,
      vi.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(500)

    const body = JSON.stringify(res.json.mock.calls[0][0])
    expect(body).not.toContain('ECONNREFUSED')
    expect(body).not.toContain('10.0.0.5')
    expect(body).not.toContain('/opt/render')
  })

  it('vẫn trả đúng hình dạng ApiFailure để phía web xử lý được', () => {
    const res = taoResGia()

    errorHandler(new Error('bất kỳ lỗi gì'), reqGia, res, vi.fn())

    expect(res.json.mock.calls[0][0]).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
  })
})

describe('errorHandler với lỗi từ multer (T56/T57)', () => {
  it('file vượt giới hạn dung lượng trả 400, không phải 500', () => {
    const res = taoResGia()

    // Đây là lỗi phía người gửi (chọn file quá lớn), không phải lỗi server —
    // trước khi có nhánh riêng trong error-handler.ts, lỗi này rơi vào nhánh
    // "ngoài ý muốn" và trả nhầm 500 cho một request hoàn toàn hợp lệ về phía
    // server.
    errorHandler(new MulterError('LIMIT_FILE_SIZE', 'cv'), reqGia, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0]).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('lỗi multer khác (vd sai tên field) cũng trả 400 với thông điệp chung', () => {
    const res = taoResGia()

    errorHandler(new MulterError('LIMIT_UNEXPECTED_FILE', 'file'), reqGia, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0]).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    })
  })
})
