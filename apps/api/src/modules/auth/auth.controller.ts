import type { Request, RequestHandler, Response } from 'express'
import { z } from 'zod'
import {
  forgotPasswordSchema,
  loginSchema,
  otpSchema,
  registerSchema,
  resetPasswordSchema,
} from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import { env, isProduction } from '../../config/env.js'
import * as authService from './auth.service.js'
import * as otpService from './otp.service.js'
import * as passwordResetService from './password-reset.service.js'
import type { DeviceInfo, SessionResult } from './auth.service.js'

/**
 * Tên cookie chứa refresh token.
 *
 * Tiền tố `__Host-` không phải để cho đẹp: trình duyệt chỉ chấp nhận cookie
 * mang tiền tố này khi nó có `Secure`, `Path=/`, và KHÔNG có `Domain`. Nhờ ràng
 * buộc đó, một subdomain bị chiếm cũng không ghi đè được cookie này.
 *
 * Chỉ dùng ở production. Trên máy chạy http://localhost thì `Secure` không gửi
 * được, nên tiền tố sẽ khiến trình duyệt lặng lẽ bỏ cookie — lỗi rất khó đoán
 * vì không có thông báo nào cả.
 */
const REFRESH_COOKIE = isProduction ? '__Host-uniwork_rt' : 'uniwork_rt'

/**
 * Đặt refresh token vào cookie httpOnly.
 *
 * Từng thuộc tính đều có lý do, không phải sao chép từ đâu về:
 *
 * - httpOnly: JavaScript không đọc được. Đây là thứ khiến một đoạn script bị
 *   chèn vào trang (hoặc một thư viện npm bị nhiễm) không lấy được token.
 * - secure: chỉ gửi qua HTTPS. Ở production luôn bật.
 * - sameSite: production dùng 'none' vì web ở domain Vercel còn API ở domain
 *   Render — hai domain khác nhau, 'lax' sẽ khiến trình duyệt KHÔNG gửi cookie
 *   và người dùng bị đăng xuất ngay sau khi đăng nhập. Trên máy thì cùng
 *   localhost nên 'lax' vừa đủ và an toàn hơn.
 *   Lưu ý: 'none' bắt buộc đi kèm 'secure', trình duyệt từ chối nếu thiếu.
 * - path: giới hạn ở nhánh auth. Cookie sẽ không đi kèm mọi request khác, giảm
 *   bề mặt lộ và bớt vài chục byte cho mỗi lần gọi API.
 */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',

    // Hạn cookie PHẢI lấy từ cùng một biến với hạn ghi trong database.
    //
    // Ghi cứng một con số ở đây là lỗi âm thầm: đổi REFRESH_TTL_DAYS xuống 7 mà
    // cookie vẫn sống 30 ngày thì từ ngày thứ 8 trình duyệt vẫn gửi cookie đều
    // đặn, server tra ra token đã hết hạn và trả 401. Người dùng thấy mình
    // "đang đăng nhập" nhưng thao tác nào cũng lỗi, còn log thì không có gì bất
    // thường vì mọi thứ đều đúng theo code.
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(res: Response) {
  // Phải khớp CHÍNH XÁC path và sameSite của lúc đặt, nếu không trình duyệt coi
  // đây là một cookie khác và cookie cũ vẫn nằm nguyên đó.
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',
  })
}

/** Gửi kết quả phiên: token vào body, refresh token vào cookie — không lẫn lộn. */
function sendSession(res: Response, session: SessionResult, status = 200) {
  setRefreshCookie(res, session.refreshToken)

  // Bóc `refreshToken` ra khỏi thứ gửi đi. Nó đã nằm trong cookie rồi; để lọt
  // thêm vào body là vô hiệu hoá toàn bộ ý nghĩa của httpOnly.
  const { refreshToken: _omit, ...body } = session
  ok(res, body, status)
}

function deviceOf(req: Request): DeviceInfo {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip }
}

/**
 * Kiểm dữ liệu vào bằng Zod rồi ném `badRequest` kèm lỗi từng trường.
 *
 * Trả về `details` dạng `{ email: ['...'] }` để phía web gắn thông báo ngay
 * dưới đúng ô nhập, thay vì hiện một dòng lỗi chung chung ở đầu form.
 */
function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const details: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    ;(details[key] ??= []).push(issue.message)
  }
  throw badRequest('Dữ liệu không hợp lệ', details)
}

/*
 * Luật kiểm dữ liệu lấy từ `@uniwork/shared` chứ không khai lại ở đây.
 *
 * Trước đây file này giữ bản riêng, và phía web chưa có gì. Khi DEV2 dựng form
 * ở T46, hai bên sẽ có hai bản luật — chúng lệch nhau chỉ là vấn đề thời gian,
 * và lúc đó người dùng sẽ điền form hợp lệ rồi nhận lỗi từ server. Xem giải
 * thích đầy đủ trong `packages/shared/src/validation.ts`.
 */

export const registerController: RequestHandler = async (req, res) => {
  const input = parse(registerSchema, req.body)
  sendSession(res, await authService.register(input, deviceOf(req)), 201)
}

export const loginController: RequestHandler = async (req, res) => {
  const { email, password } = parse(loginSchema, req.body)
  sendSession(res, await authService.login(email, password, deviceOf(req)))
}

export const refreshController: RequestHandler = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined

  if (!token) {
    // Xoá cookie rác trước khi trả lỗi. Không xoá thì trình duyệt cứ gửi lại
    // một cookie vô dụng ở mọi lần thử tiếp theo.
    clearRefreshCookie(res)
    throw unauthorized('Chưa đăng nhập')
  }

  sendSession(res, await authService.refresh(token, deviceOf(req)))
}

export const logoutController: RequestHandler = async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined)
  clearRefreshCookie(res)
  ok(res, { ok: true })
}

/* --------------------------------------------------------------- OTP (T42) */

/* ------------------------------------------------------- quên mật khẩu --- */

/**
 * Cùng một thông điệp cho mọi kết quả, kể cả khi email không tồn tại.
 *
 * Đây là endpoint công khai. Trả lời khác nhau cho "có tài khoản" và "không có
 * tài khoản" là biến nó thành công cụ kiểm tra ai đã đăng ký — và danh sách đó
 * đủ để nhắm mục tiêu cho những đợt thử mật khẩu về sau.
 */
export const forgotPasswordController: RequestHandler = async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body)
  const ketQua = await passwordResetService.requestPasswordReset(email)

  ok(res, {
    message: 'Nếu email này có tài khoản, chúng tôi đã gửi mã đặt lại mật khẩu.',
    // Chỉ có ngoài production, để lập trình viên và người demo không phải mở
    // hộp thư. Ở production trường này không bao giờ xuất hiện.
    ...(ketQua.devCode ? { devCode: ketQua.devCode } : {}),
  })
}

export const resetPasswordController: RequestHandler = async (req, res) => {
  const { email, code, password } = parse(resetPasswordSchema, req.body)
  await passwordResetService.resetPassword(email, code, password)

  /*
   * KHÔNG tự đăng nhập sau khi đổi mật khẩu.
   *
   * Vừa thu hồi sạch mọi phiên xong mà lại cấp ngay một phiên mới thì mất phần
   * lớn ý nghĩa của việc thu hồi. Bắt đăng nhập lại cũng là cách để người dùng
   * xác nhận họ nhớ đúng mật khẩu vừa đặt.
   */
  ok(res, { message: 'Đặt lại mật khẩu thành công. Mời bạn đăng nhập lại.' })
}

export const sendOtpController: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized()
  ok(res, await otpService.sendVerificationOtp(req.user.id))
}

export const verifyEmailController: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized()
  const { code } = parse(otpSchema, req.body)
  await otpService.verifyEmailOtp(req.user.id, code)

  // Trả lại hồ sơ đã cập nhật để phía web không phải gọi thêm /api/toi chỉ để
  // biết `emailVerifiedAt` giờ đã có giá trị.
  ok(res, await authService.currentUser(req.user.id))
}
