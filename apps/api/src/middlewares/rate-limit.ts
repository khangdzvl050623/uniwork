import type { Request, RequestHandler } from 'express'
import { tooManyRequests } from '../lib/errors.js'

/**
 * Giới hạn số lần gọi một endpoint trong một khoảng thời gian.
 *
 * ---------------------------------------------------------------------------
 * Vì sao đếm trong bộ nhớ chứ không dùng Redis
 * ---------------------------------------------------------------------------
 * Render gói free chạy đúng MỘT instance, nên bộ đếm nằm trong bộ nhớ của tiến
 * trình là đủ chính xác. Thêm Redis lúc này là thêm một dịch vụ phải dựng, phải
 * cấu hình, phải xử lý khi nó sập — để đổi lấy đúng con số mà ta đã có.
 *
 * Điều cần biết khi mở rộng: chạy nhiều instance thì mỗi instance đếm riêng,
 * nên ngưỡng thực tế nhân lên theo số instance. Lúc đó mới đáng chuyển sang
 * Redis. `docker-compose.yml` đã có sẵn Redis ở profile `cache` cho ngày đó.
 *
 * Một hệ quả khác: khởi động lại là mất sạch bộ đếm. Với Render free thì service
 * ngủ dậy liên tục, nên đây không phải hàng rào tuyệt đối — nó là thứ chặn dò
 * mật khẩu tự động, không phải chặn một người kiên nhẫn.
 *
 * ---------------------------------------------------------------------------
 * Cửa sổ trượt theo từng khoá, không phải cửa sổ cố định
 * ---------------------------------------------------------------------------
 * Cửa sổ cố định (chia thời gian thành từng ô 15 phút) có lỗ hổng ở ranh giới:
 * gọi hết hạn mức ở cuối ô này rồi gọi tiếp hạn mức mới ở đầu ô sau, thành ra
 * gấp đôi ngưỡng trong vài giây. Ở đây mỗi khoá có mốc hết hạn riêng, tính từ
 * lần gọi đầu tiên của nó.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Dọn các khoá đã hết hạn.
 *
 * Không có bước này thì Map phình mãi — mỗi IP từng gọi API một lần sẽ chiếm
 * một ô vĩnh viễn, và trên một instance 512MB thì đó là rò rỉ bộ nhớ thật sự.
 *
 * Dọn theo kiểu "gặp thì dọn" chứ không đặt setInterval: không tạo thêm timer
 * chạy nền, và bảng chỉ được quét khi thật sự có lưu lượng.
 */
let lastSweep = Date.now()
const SWEEP_EVERY_MS = 5 * 60 * 1000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  /** Số lần tối đa trong một cửa sổ. */
  max: number
  /** Độ dài cửa sổ, tính bằng mili giây. */
  windowMs: number
  /**
   * Cách dựng khoá đếm từ request.
   *
   * Mặc định đếm theo IP. Với các endpoint có email trong body thì nên đếm theo
   * cả IP lẫn email: chỉ theo IP thì cả một phòng máy trong trường dùng chung
   * một IP sẽ chặn nhầm nhau; chỉ theo email thì kẻ dò đổi email là thoát.
   */
  keyOf?: (req: Request) => string
}

export function rateLimit({ max, windowMs, keyOf }: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now()
    sweep(now)

    // Gắn tiền tố là đường dẫn route để hai endpoint khác nhau không dùng chung
    // bộ đếm — dò mật khẩu ở /dang-nhap không nên làm khoá luôn /gui-otp.
    const key = `${req.baseUrl}${req.path}:${keyOf ? keyOf(req) : (req.ip ?? 'unknown')}`
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    bucket.count += 1

    if (bucket.count > max) {
      const secondsLeft = Math.ceil((bucket.resetAt - now) / 1000)

      // Header chuẩn để phía web biết chờ bao lâu thay vì thử lại mù quáng.
      res.setHeader('Retry-After', String(secondsLeft))
      throw tooManyRequests(`Bạn thao tác quá nhanh. Thử lại sau ${secondsLeft} giây.`)
    }

    next()
  }
}

/**
 * Khoá đếm theo IP + email trong body.
 *
 * Email hạ về chữ thường để `A@x.com` và `a@x.com` không thành hai bộ đếm khác
 * nhau — nếu không thì chỉ cần đổi hoa thường là né được giới hạn.
 */
export function ipAndEmail(req: Request): string {
  const email = String((req.body as { email?: unknown } | undefined)?.email ?? '')
    .trim()
    .toLowerCase()
  return `${req.ip ?? 'unknown'}|${email}`
}

/** Chỉ dùng trong test — xoá sạch bộ đếm giữa các ca test. */
export function resetRateLimits() {
  buckets.clear()
  lastSweep = Date.now()
}
