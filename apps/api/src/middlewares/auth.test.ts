import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { requireAuth, requireRole } from './auth.js'
import { AppError } from '../lib/errors.js'
import { signAccessToken } from '../lib/token.js'

/**
 * Test trực tiếp middleware, không đi qua Express/supertest — hai hàm này
 * không đọc gì khác ngoài `req.headers`/`req.cookies`/`req.user`, nên gọi
 * thẳng là đủ và nhanh hơn dựng cả app.
 *
 * requireAuth/requireRole vốn đã được test GIÁN TIẾP qua rất nhiều route (mọi
 * ca "không token thì 401", "sai vai thì 403" trong auth.test.ts/otp.test.ts/
 * profile.test.ts) — nhưng chưa có test nào nhắm thẳng vào chính middleware.
 * File này lấp đúng chỗ trống T58 nêu ("phân quyền"), và phục hồi một ca đã bị
 * mất khi T51 gộp GET /api/auth/toi vào module profile: xác nhận cookie không
 * thay được header Authorization.
 */

function reqVoi(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as Request
}

function ganAppError(chay: () => void): AppError {
  try {
    chay()
  } catch (err) {
    if (err instanceof AppError) return err
    throw err
  }
  throw new Error('Không có lỗi nào được ném ra — test sai giả định')
}

describe('requireAuth', () => {
  it('không có header Authorization thì ném UNAUTHORIZED', () => {
    const next = vi.fn()
    const err = ganAppError(() => requireAuth(reqVoi(), {} as Response, next))

    expect(err.code).toBe('UNAUTHORIZED')
    expect(next).not.toHaveBeenCalled()
  })

  it('cookie KHÔNG thay được header Authorization — đây là hàng rào chống CSRF', () => {
    // Cookie tự động đi kèm mọi request kể cả request do trang khác kích hoạt.
    // Giả lập cookie-parser đã chạy và gắn sẵn req.cookies, nhưng KHÔNG có
    // header Authorization — requireAuth phải vẫn từ chối.
    const token = signAccessToken({ sub: 'u-1', role: 'STUDENT' })
    const req = reqVoi({ cookies: { uniwork_rt: token } } as Partial<Request>)

    const err = ganAppError(() => requireAuth(req, {} as Response, vi.fn()))
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('header thiếu tiền tố "Bearer " thì ném UNAUTHORIZED', () => {
    const token = signAccessToken({ sub: 'u-1', role: 'STUDENT' })
    const req = reqVoi({ headers: { authorization: token } })

    const err = ganAppError(() => requireAuth(req, {} as Response, vi.fn()))
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('token rác (sai chữ ký) thì ném UNAUTHORIZED với thông điệp riêng', () => {
    const req = reqVoi({ headers: { authorization: 'Bearer khong-phai-jwt' } })

    const err = ganAppError(() => requireAuth(req, {} as Response, vi.fn()))
    expect(err.code).toBe('UNAUTHORIZED')
    // Thông điệp khác thông điệp "thiếu token" ở test đầu — không phân biệt
    // "hỏng" với "hết hạn", nhưng vẫn phải khác thông điệp "chưa đăng nhập".
    expect(err.message).toMatch(/hết hạn/)
  })

  it('token hợp lệ: gắn req.user đúng id/role và gọi next()', () => {
    const token = signAccessToken({ sub: 'u-1', role: 'EMPLOYER' })
    const req = reqVoi({ headers: { authorization: `Bearer ${token}` } })
    const next = vi.fn()

    requireAuth(req, {} as Response, next)

    expect(req.user).toEqual({ id: 'u-1', role: 'EMPLOYER' })
    expect(next).toHaveBeenCalledOnce()
  })
})

describe('requireRole', () => {
  it('đúng vai thì gọi next(), không ném gì', () => {
    const req = reqVoi({ user: { id: 'u-1', role: 'ADMIN' } })
    const next = vi.fn()

    requireRole('ADMIN')(req, {} as Response, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('nằm trong danh sách nhiều vai được phép thì vẫn qua', () => {
    const req = reqVoi({ user: { id: 'u-2', role: 'EMPLOYER' } })
    const next = vi.fn()

    requireRole('ADMIN', 'EMPLOYER')(req, {} as Response, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('sai vai thì ném FORBIDDEN', () => {
    const req = reqVoi({ user: { id: 'u-1', role: 'STUDENT' } })

    const err = ganAppError(() => requireRole('ADMIN', 'EMPLOYER')(req, {} as Response, vi.fn()))
    expect(err.code).toBe('FORBIDDEN')
  })

  it('gọi khi chưa qua requireAuth (req.user rỗng) thì ném UNAUTHORIZED, không sập vì đọc thuộc tính của undefined', () => {
    const err = ganAppError(() => requireRole('STUDENT')(reqVoi(), {} as Response, vi.fn()))
    expect(err.code).toBe('UNAUTHORIZED')
  })
})
