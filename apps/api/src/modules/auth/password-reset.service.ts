import { randomInt } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { badRequest } from '../../lib/errors.js'
import { passwordResetEmail, sendMail } from '../../lib/mailer.js'
import { hashPassword } from '../../lib/password.js'
import { logger } from '../../lib/logger.js'
import { isProduction } from '../../config/env.js'
import { bangNhauHash, hashOtp, MAX_FAILED_ATTEMPTS } from './otp.service.js'

/**
 * Quên mật khẩu, và đặt mật khẩu lần đầu cho tài khoản chỉ đăng nhập Google.
 *
 * ---------------------------------------------------------------------------
 * MỘT LUỒNG CHO CẢ HAI VIỆC
 * ---------------------------------------------------------------------------
 * Tài khoản đăng nhập bằng Google có `passwordHash = null`. Muốn thêm mật khẩu
 * thì đi qua đúng luồng này — cố ý KHÔNG dựng một endpoint riêng kiểu "đặt mật
 * khẩu khi đang đăng nhập".
 *
 * Lý do: endpoint đó chỉ cần một access token còn hạn là chạy được, nên ai
 * chiếm được phiên đăng nhập (đọc được token qua XSS, hoặc cầm máy lúc chưa
 * khoá màn hình) sẽ gắn được một mật khẩu VĨNH VIỄN vào tài khoản — một cửa
 * hậu sống lâu hơn nhiều so với phiên 15 phút mà họ chiếm được. Bắt đi qua
 * email thì phải chứng minh còn giữ hộp thư, giống hệt lúc đăng ký.
 *
 * Vì vậy hàm dưới đây KHÔNG kiểm `passwordHash` có null hay không.
 */

const OTP_TTL_MS = 10 * 60 * 1000

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/**
 * Gửi mã đặt lại mật khẩu.
 *
 * Luôn kết thúc êm ả, kể cả khi email không tồn tại — controller trả cùng một
 * thông điệp cho mọi trường hợp. Báo "email này chưa đăng ký" là biến endpoint
 * công khai này thành công cụ kiểm tra ai có tài khoản trong hệ thống.
 */
export async function requestPasswordReset(emailInput: string): Promise<{ devCode?: string }> {
  const email = emailInput.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  })

  // Không có tài khoản: im lặng rời đi. Không gửi mail, không báo lỗi.
  if (!user) return {}

  // Tài khoản bị khoá thì đặt lại mật khẩu cũng vô nghĩa — và gửi mail cho họ
  // chỉ khiến người dùng tưởng mình sắp vào lại được.
  if (user.status === 'SUSPENDED') return {}

  const code = generateCode()

  /*
   * Huỷ mọi mã cũ chưa dùng TRƯỚC KHI tạo mã mới, trong cùng một transaction.
   *
   * Bấm "gửi lại" ba lần mà không huỷ thì để lại ba mã cùng hiệu lực, và mỗi
   * mã còn sống là thêm một cơ hội cho người đi dò. Tách hai lệnh ra thì lỗi
   * giữa chừng sẽ huỷ hết mã cũ mà chưa có mã mới — người dùng kẹt hoàn toàn.
   */
  await prisma.$transaction([
    prisma.oneTimeToken.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.oneTimeToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashOtp(user.id, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ])

  await sendMail({ to: user.email, ...passwordResetEmail(code) })

  if (!isProduction) {
    logger.info('Mã đặt lại mật khẩu (chỉ hiện ngoài production)', { email: user.email, code })
    return { devCode: code }
  }

  return {}
}

/**
 * Đối chiếu mã rồi đặt mật khẩu mới.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TRA THEO userId CHỨ KHÔNG TRA THEO BĂM CỦA MÃ
 * ---------------------------------------------------------------------------
 * Luồng xác thực email tra thẳng `tokenHash = hashOtp(userId, code)`. Cách đó
 * gọn nhưng KHÔNG đếm được số lần nhập sai: mã sai thì chuỗi băm không khớp
 * hàng nào, nên không có bản ghi nào để tăng bộ đếm.
 *
 * Ở đây ta có email nên suy ra được userId, tra được đúng mã đang sống của họ,
 * rồi mới so băm. Nhờ vậy mỗi lần sai đều ghi được vào đúng mã đó — và bộ đếm
 * gắn liền với mã thì đổi IP cũng không thoát.
 */
export async function resetPassword(
  emailInput: string,
  code: string,
  matKhauMoi: string,
): Promise<void> {
  const email = emailInput.trim().toLowerCase()

  // Mọi nhánh hỏng đều dùng CHUNG thông điệp này: sai mã, hết hạn, đã dùng,
  // email không tồn tại. Phân biệt ra là chỉ đường cho người đi dò.
  const invalid = badRequest('Mã không đúng hoặc đã hết hạn. Vui lòng yêu cầu mã mới.')

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) throw invalid

  const token = await prisma.oneTimeToken.findFirst({
    where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, tokenHash: true, expiresAt: true, failedAttempts: true },
  })

  if (!token) throw invalid
  if (token.expiresAt < new Date()) throw invalid

  if (!bangNhauHash(token.tokenHash, hashOtp(user.id, code))) {
    const soLanSai = token.failedAttempts + 1

    await prisma.oneTimeToken.update({
      where: { id: token.id },
      data: {
        failedAttempts: soLanSai,
        // Quá ngưỡng thì huỷ luôn mã. Kẻ dò mất sạch tiến độ và phải bắt đầu
        // lại với một mã khác hẳn; người dùng thật chỉ cần bấm "gửi lại".
        ...(soLanSai >= MAX_FAILED_ATTEMPTS ? { usedAt: new Date() } : {}),
      },
    })

    throw invalid
  }

  const passwordHash = await hashPassword(matKhauMoi)

  /*
   * Ba việc trong cùng một transaction.
   *
   * Việc thứ ba — thu hồi mọi refresh token — quan trọng hơn vẻ ngoài của nó.
   * Người ta thường bấm "quên mật khẩu" chính vì nghi tài khoản đã bị người
   * khác vào. Đổi mật khẩu mà để nguyên các phiên cũ thì kẻ đó vẫn đang đăng
   * nhập bình thường, và chủ tài khoản yên tâm rằng mình vừa xử lý xong.
   */
  await prisma.$transaction([
    prisma.oneTimeToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}
