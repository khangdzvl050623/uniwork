import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

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
