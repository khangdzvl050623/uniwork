import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { env } from '../config/env.js'

/**
 * Hai loại token, hai cơ chế hoàn toàn khác nhau.
 *
 * ---------------------------------------------------------------------------
 * ACCESS TOKEN — JWT, không lưu ở đâu cả
 * ---------------------------------------------------------------------------
 * Là một chuỗi đã ký, tự nó mang đủ thông tin (id, vai trò). Server chỉ cần
 * kiểm chữ ký là biết token thật hay giả, KHÔNG phải truy vấn database. Đó là
 * lý do nó nhanh, và cũng là lý do nó không thu hồi được: server không giữ
 * danh sách nào để mà xoá.
 *
 * Hệ quả: khoá tài khoản ai đó thì họ vẫn dùng được tiếp cho tới khi token hết
 * hạn. Chấp nhận được vì hạn chỉ 15 phút. Đổi lại, mọi request không phải đánh
 * một câu truy vấn — trên Neon gói free thì đó là khác biệt lớn.
 *
 * ---------------------------------------------------------------------------
 * REFRESH TOKEN — chuỗi ngẫu nhiên, lưu bản băm trong database
 * ---------------------------------------------------------------------------
 * CỐ Ý không phải JWT. Nó cần thu hồi được (đăng xuất, phát hiện bị trộm), mà
 * muốn thu hồi thì phải tra được vào đâu đó — tức là phải lưu.
 *
 * Lưu bản BĂM chứ không phải bản gốc: ai đọc được database cũng không mạo danh
 * được ai. Băm nhanh (SHA-256) là đủ, không cần Argon2 như mật khẩu — token
 * vốn đã là 48 byte ngẫu nhiên, không có "từ điển" nào dò ra được. Argon2 ở
 * đây chỉ làm mỗi lần refresh chậm thêm mà không mua được gì.
 */

/** Nội dung nhét vào access token. Chỉ những thứ mọi request đều cần. */
export interface AccessPayload {
  sub: string
  role: Role
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Giải mã access token. Trả `null` khi token sai chữ ký hoặc đã hết hạn.
 *
 * Trả null thay vì ném lỗi vì với middleware xác thực thì "token hỏng" và
 * "token hết hạn" đều dẫn tới cùng một kết quả: 401. Bắt lỗi ở đây giữ cho chỗ
 * gọi không phải viết try/catch.
 */
export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET)
    if (typeof decoded === 'string') return null
    return { sub: String(decoded.sub), role: decoded.role as Role }
  } catch {
    return null
  }
}

/**
 * Sinh một refresh token mới.
 *
 * Trả về CẢ HAI dạng vì mỗi dạng đi một đường: bản gốc gửi cho trình duyệt qua
 * cookie, bản băm ghi vào database. Server không bao giờ giữ lại bản gốc.
 *
 * 48 byte ngẫu nhiên từ `randomBytes` — nguồn ngẫu nhiên của hệ điều hành,
 * không phải `Math.random()`. `Math.random()` đoán trước được nếu biết đủ giá
 * trị trước đó, dùng nó ở đây là tự mở cửa.
 */
export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

/** Băm để tra cứu. Cùng đầu vào luôn cho cùng kết quả, nên tìm được bằng `where`. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Mốc hết hạn của refresh token, tính từ bây giờ. */
export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
}
