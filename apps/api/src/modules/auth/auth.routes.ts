import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import { ipAndEmail, rateLimit } from '../../middlewares/rate-limit.js'
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
  sendOtpController,
  verifyEmailController,
} from './auth.controller.js'

export const authRoutes = Router()

/*
 * Ngưỡng giới hạn tần suất (T43).
 *
 * Chọn theo nguyên tắc: đủ rộng để người dùng thật gõ nhầm vài lần vẫn thoải
 * mái, đủ hẹp để máy dò tự động không đi tới đâu.
 *
 * Với /dang-nhap: 10 lần trong 15 phút. Người thật gõ sai mật khẩu quá 10 lần
 * liên tiếp thì vấn đề của họ không phải là bị chặn. Còn máy dò thì 10 lần mỗi
 * 15 phút nghĩa là gần 1000 năm để quét hết một mật khẩu 8 ký tự — coi như bất
 * khả thi.
 *
 * Với /gui-otp: 5 lần mỗi giờ, chặt hơn hẳn. Mỗi lần gọi là một email thật được
 * gửi đi, mà Brevo gói free chỉ cho 300 email/ngày. Không chặn thì một người
 * bấm "Gửi lại" liên tục có thể đốt sạch hạn mức của cả hệ thống trong vài phút.
 *
 * Với /xac-thuc-email: 10 lần mỗi 15 phút. Đây là hàng rào duy nhất chặn việc
 * dò mã 6 chữ số — mã sống 10 phút, nên trong quãng đó kẻ dò chỉ thử được 10
 * trong một triệu khả năng.
 */
const loginLimit = rateLimit({ max: 10, windowMs: 15 * 60_000, keyOf: ipAndEmail })
const otpSendLimit = rateLimit({ max: 5, windowMs: 60 * 60_000 })
const otpVerifyLimit = rateLimit({ max: 10, windowMs: 15 * 60_000 })

/*
 * Bốn endpoint đầu là công khai — chính chúng tạo ra phiên đăng nhập, nên không
 * thể đòi phải đăng nhập trước.
 *
 * Đường dẫn đặt tiếng Việt cho khớp với route phía web (/dang-nhap, /dang-ky),
 * trừ /refresh vì đó là thuật ngữ kỹ thuật, người dùng không bao giờ nhìn thấy.
 */
authRoutes.post('/dang-ky', registerController)
authRoutes.post('/dang-nhap', loginLimit, loginController)
authRoutes.post('/refresh', refreshController)
authRoutes.post('/dang-xuat', logoutController)

/*
 * Hai endpoint OTP đều yêu cầu đăng nhập.
 *
 * Cố ý KHÔNG nhận email trong body để gửi mã. Nếu nhận, bất kỳ ai cũng gọi được
 * và biến endpoint này thành hai thứ cùng lúc: công cụ dò xem email nào có
 * trong hệ thống, và máy gửi thư rác miễn phí nhắm vào người khác.
 *
 * Luồng thật không cần điều đó: đăng ký xong là đã có access token, gửi mã cho
 * chính mình.
 */
authRoutes.post('/gui-otp', requireAuth, otpSendLimit, sendOtpController)
authRoutes.post('/xac-thuc-email', requireAuth, otpVerifyLimit, verifyEmailController)

/* Endpoint duy nhất còn lại cần đăng nhập: hỏi "tôi là ai". */
authRoutes.get('/toi', requireAuth, meController)
