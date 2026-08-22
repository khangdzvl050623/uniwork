import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { MulterError } from 'multer'
import { Prisma } from '@prisma/client'

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

/*
 * Lỗi ràng buộc từ Prisma — lưới an toàn cho MỌI endpoint.
 *
 * Gần như mọi endpoint sửa/xoá đều theo hình dạng "đọc kiểm tồn tại → rồi ghi".
 * Giữa hai câu truy vấn đó có một khe: một request khác kịp xoá đúng hàng ấy.
 * Bắt tập trung ở đây thay vì try/catch từng nơi, vì khe đó có ở mọi endpoint
 * cùng hình dạng — bắt lẻ nghĩa là phải nhớ bọc đúng mọi chỗ hôm nay và mọi chỗ
 * thêm về sau.
 */
function loiPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('thông điệp gốc của Prisma', {
    code,
    clientVersion: '6.19.3',
  })
}

describe('errorHandler với lỗi ràng buộc Prisma', () => {
  it('P2025 (hàng cần sửa/xoá không còn) trả 404, KHÔNG phải 500', () => {
    const res = taoResGia()

    // Không có nhánh này thì người dùng nhận "máy chủ hỏng" trong khi chuyện
    // thật chỉ là dữ liệu vừa bị người khác xoá.
    errorHandler(loiPrisma('P2025'), reqGia, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json.mock.calls[0][0]).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('P2002 (trùng ràng buộc duy nhất) trả 409', () => {
    const res = taoResGia()

    errorHandler(loiPrisma('P2002'), reqGia, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('P2003 (vi phạm khoá ngoại) trả 409', () => {
    const res = taoResGia()

    errorHandler(loiPrisma('P2003'), reqGia, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('mã Prisma lạ vẫn rơi về 500 — không đoán bừa là lỗi người dùng', () => {
    const res = taoResGia()

    // Chỉ ba mã trên là chắc chắn do phía người gửi. Mã khác (mất kết nối, hết
    // hạn mức, timeout…) là lỗi hạ tầng thật, trả 404/409 cho chúng là che mất
    // sự cố cần được biết.
    errorHandler(loiPrisma('P1001'), reqGia, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: { code: 'INTERNAL_ERROR' } })
  })
})
