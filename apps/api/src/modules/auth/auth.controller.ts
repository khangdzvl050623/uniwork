import type { Request, RequestHandler, Response } from 'express'
import { z } from 'zod'
import { SIGNUP_ROLES } from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import { env, isProduction } from '../../config/env.js'
import * as authService from './auth.service.js'
import * as otpService from './otp.service.js'
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
 * Quy tắc mật khẩu: tối thiểu 8 ký tự, có chữ và có số.
 *
 * Cố ý KHÔNG bắt ký tự đặc biệt. Nghiên cứu của NIST cho thấy luật càng rườm
 * rà thì người dùng càng đối phó bằng những mẫu dễ đoán (`Password1!`), trong
 * khi độ dài mới là thứ thật sự làm tăng độ khó dò.
 */
const passwordRule = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .regex(/[a-zA-Z]/, 'Mật khẩu cần có ít nhất một chữ cái')
  .regex(/[0-9]/, 'Mật khẩu cần có ít nhất một chữ số')

const registerSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: passwordRule,
  role: z.enum(SIGNUP_ROLES),
  name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(120),
})

const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  // Không áp `passwordRule` ở đây: người đăng ký từ trước có thể đang dùng mật
  // khẩu theo luật cũ. Bắt đúng luật mới sẽ khoá họ ra ngoài chính tài khoản
  // của mình, và thông báo lỗi còn tiết lộ luật mật khẩu cho người dò.
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

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

const otpSchema = z.object({
  // Đúng 6 chữ số. `regex` chứ không phải `min(6).max(6)`: chuỗi 'abcdef' cũng
  // dài 6 nhưng không bao giờ khớp mã, chặn sớm ở đây thì đỡ một câu truy vấn.
  code: z.string().regex(/^\d{6}$/, 'Mã xác thực gồm đúng 6 chữ số'),
})

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
