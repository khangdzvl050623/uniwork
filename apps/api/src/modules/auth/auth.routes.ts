import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import { ipAndEmail, rateLimit } from '../../middlewares/rate-limit.js'
import {
  forgotPasswordController,
  googleCallbackController,
  googleStartController,
  loginController,
  logoutController,
  refreshController,
  registerController,
  resetPasswordController,
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
 * Quên mật khẩu: 3 lần mỗi giờ, tính theo IP + email.
 *
 * Chặt hơn /gui-otp (5 lần) vì đây là endpoint CÔNG KHAI — không cần đăng nhập
 * nên ai cũng gọi được, và mỗi lần gọi là một email thật gửi tới hộp thư của
 * người khác. Không chặn thì nó vừa là máy gửi thư rác nhắm vào một người cụ
 * thể, vừa đốt sạch hạn mức 300 email/ngày của Brevo.
 *
 * Người quên mật khẩu thật hiếm khi cần quá 3 lần trong một giờ; đến lần thứ tư
 * thì vấn đề của họ không phải là thiếu mã.
 *
 * Tính theo cả IP lẫn email: chỉ theo IP thì cả phòng máy trong trường dùng
 * chung một địa chỉ sẽ chặn nhầm nhau.
 */
const forgotPasswordLimit = rateLimit({ max: 3, windowMs: 60 * 60_000, keyOf: ipAndEmail })

/*
 * Đặt lại mật khẩu: 10 lần mỗi 15 phút.
 *
 * Đây chỉ là lớp chặn spam request. Hàng rào thật chống dò mã nằm ở bộ đếm
 * `failedAttempts` gắn trên chính mã đó — sai 5 lần là mã bị huỷ, và bộ đếm ấy
 * đổi IP cũng không thoát được. Xem `password-reset.service.ts`.
 */
const resetPasswordLimit = rateLimit({ max: 10, windowMs: 15 * 60_000, keyOf: ipAndEmail })

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
 * Quên mật khẩu cũng là endpoint công khai — người đang cần dùng nó theo định
 * nghĩa là người KHÔNG đăng nhập được.
 *
 * Luồng này còn kiêm việc đặt mật khẩu lần đầu cho tài khoản chỉ đăng nhập
 * Google: đi qua email thì phải chứng minh còn giữ hộp thư, an toàn hơn hẳn
 * một endpoint chỉ cần access token còn hạn. Xem password-reset.service.ts.
 */
authRoutes.post('/quen-mat-khau', forgotPasswordLimit, forgotPasswordController)
authRoutes.post('/dat-lai-mat-khau', resetPasswordLimit, resetPasswordController)

/*
 * Đăng nhập Google — hai chặng, và cả hai đều là GET.
 *
 * Khác mọi endpoint khác của module này ở chỗ chúng là điểm đến của TRÌNH DUYỆT
 * chứ không phải lời gọi API: người dùng bấm nút, trình duyệt rời khỏi trang
 * web sang google.com, rồi Google chuyển hướng ngược về `/callback`. Cả hai
 * chặng vì thế phải là GET và kết thúc bằng `redirect`, không phải JSON.
 *
 * Đây cũng là lý do không đặt giới hạn tần suất ở đây: người dùng bị chặn giữa
 * chuỗi chuyển hướng sẽ thấy một trang lỗi trơ trọi không rõ vì sao. Chống lạm
 * dụng ở luồng này do chính Google lo.
 */
authRoutes.get('/google', googleStartController)
authRoutes.get('/google/callback', googleCallbackController)

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
