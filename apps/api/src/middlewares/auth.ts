import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { forbidden, unauthorized } from '../lib/errors.js'
import { verifyAccessToken } from '../lib/token.js'

/**
 * Hai lớp canh cửa: đã đăng nhập chưa, và có đúng vai không.
 *
 * Tách làm hai chứ không gộp, vì phần lớn endpoint chỉ cần lớp thứ nhất. Gộp
 * lại thì mỗi route đều phải liệt kê đủ mọi vai được phép — dài dòng và dễ sót
 * một vai khi thêm vai mới.
 */

/**
 * Gắn thêm `user` vào Request của Express.
 *
 * Khai bằng `declare global` thay vì ép kiểu ở từng chỗ dùng: nhờ vậy mọi
 * controller gõ `req.user` đều có gợi ý và kiểm kiểu, không phải `as any`.
 *
 * Để `?` chứ không bắt buộc là có chủ đích — nó nhắc người viết controller
 * rằng trường này chỉ có sau khi đã đi qua `requireAuth`.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role }
    }
  }
}

/**
 * Bắt buộc phải có access token hợp lệ.
 *
 * Đọc token từ header `Authorization: Bearer ...`, KHÔNG đọc từ cookie. Cookie
 * tự động đi kèm mọi request kể cả request do trang khác kích hoạt — dùng nó
 * để xác thực là mở cửa cho tấn công CSRF. Header thì chỉ có JavaScript của
 * chính trang mình mới đặt được.
 *
 * Cố ý KHÔNG truy vấn database ở đây. Chữ ký hợp lệ là đủ tin, và đó chính là
 * lý do dùng JWT: mọi request được bảo vệ không phải đánh thêm một câu truy vấn
 * — trên Neon gói free thì đó là khác biệt đáng kể. Đánh đổi: tài khoản vừa bị
 * khoá vẫn gọi được API cho tới khi token hết hạn, tối đa 15 phút.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw unauthorized()
  }

  const payload = verifyAccessToken(header.slice(7))
  if (!payload) {
    // Không phân biệt "token hỏng" với "token hết hạn" trong thông điệp gửi ra.
    // Phía web xử lý cả hai giống nhau (gọi refresh rồi thử lại), còn nói rõ
    // chỉ giúp người dò token biết mình đang tới gần.
    throw unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
  }

  req.user = { id: payload.sub, role: payload.role }
  next()
}

/**
 * Đọc token NẾU có, không có cũng cho qua.
 *
 * ---------------------------------------------------------------------------
 * DÙNG CHO ENDPOINT CÔNG KHAI CẦN BIẾT AI ĐANG XEM
 * ---------------------------------------------------------------------------
 * `/api/viec-lam` phải mở cho khách — không ai đăng ký một trang việc làm mà
 * chưa xem được việc nào. Nhưng từ Sprint 3 nó còn phải chấm điểm phù hợp giữa
 * ca làm của tin và lịch rảnh của NGƯỜI ĐANG XEM, nên nó cần danh tính khi có.
 *
 * Đây KHÔNG phải nới lỏng bảo mật: endpoint vẫn chỉ trả tin `status = 'OPEN'`,
 * đúng như trước. Danh tính chỉ dùng để THÊM một trường (`matchScore`) và để
 * bật một bộ lọc tuỳ chọn — không mở thêm dữ liệu nào.
 *
 * Token hỏng hoặc hết hạn thì coi như khách, KHÔNG ném 401. Người dùng có phiên
 * vừa hết hạn mà mở trang việc làm phải thấy danh sách bình thường (chỉ mất
 * điểm phù hợp), chứ không phải một trang lỗi. Phía web sẽ tự gọi refresh rồi
 * tải lại, lúc đó điểm hiện ra.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next()

  const payload = verifyAccessToken(header.slice(7))
  if (payload) req.user = { id: payload.sub, role: payload.role }

  next()
}

/**
 * Chỉ cho phép một số vai trò.
 *
 * Luôn phải đặt SAU `requireAuth` trong danh sách middleware của route. Nếu
 * đứng trước, `req.user` chưa tồn tại và mọi request đều bị 401 — kể cả người
 * có đúng quyền.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized()
    if (!roles.includes(req.user.role)) throw forbidden()
    next()
  }
}
