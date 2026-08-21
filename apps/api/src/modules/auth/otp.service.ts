import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { otpEmail, sendMail } from '../../lib/mailer.js'
import { logger } from '../../lib/logger.js'
import { isProduction } from '../../config/env.js'

/**
 * Mã xác thực email dùng một lần.
 *
 * ---------------------------------------------------------------------------
 * Vì sao băm `userId:code` chứ không băm mỗi `code`
 * ---------------------------------------------------------------------------
 * Cột `tokenHash` trong bảng `OneTimeToken` có ràng buộc `@unique`. Mã chỉ có 6
 * chữ số nên chỉ có một triệu giá trị — chỉ cần vài trăm người cùng chờ xác
 * thực là hai người trúng cùng một mã, và người thứ hai sẽ không tạo được bản
 * ghi vì vi phạm unique.
 *
 * Ghép userId vào trước khi băm thì hai người có cùng mã vẫn ra hai chuỗi băm
 * khác nhau. Và vì lúc xác thực ta đã biết userId (endpoint yêu cầu đăng nhập),
 * việc tra cứu vẫn là một câu truy vấn thẳng, không phải quét bảng.
 *
 * Phần thưởng kèm theo: mã của người này không dùng cho tài khoản người kia
 * được, kể cả khi đoán trúng — vì chuỗi băm đã gắn với userId.
 */

/** Mã sống bao lâu. 10 phút đủ để mở hộp thư, chưa đủ lâu để đi dò. */
const OTP_TTL_MS = 10 * 60 * 1000

/** Sai quá số lần này thì mã bị huỷ — xem ghi chú `failedAttempts` trong schema. */
export const MAX_FAILED_ATTEMPTS = 5

export function hashOtp(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex')
}

/**
 * So hai chuỗi băm mà thời gian chạy không phụ thuộc vào chỗ khác nhau đầu tiên.
 *
 * `===` trên chuỗi dừng ngay ở ký tự lệch đầu tiên, nên thời gian so sánh tiết
 * lộ có bao nhiêu ký tự đầu đã đúng. Thứ đem so ở đây là bản BĂM chứ không phải
 * mã gốc, nên rò rỉ đó gần như vô dụng với người tấn công — nhưng so đúng cách
 * không tốn thêm gì, và người đọc sau này không phải dừng lại tự hỏi.
 */
export function bangNhauHash(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  // timingSafeEqual ném lỗi nếu hai bên khác độ dài, phải tự chặn trước.
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Sinh mã 6 chữ số.
 *
 * `randomInt` của module crypto, không phải `Math.random()`. Mã này là thứ duy
 * nhất đứng giữa người lạ và tài khoản đã xác thực — dùng nguồn ngẫu nhiên
 * đoán trước được là vô hiệu hoá chính nó.
 *
 * padStart để mã bắt đầu bằng số 0 vẫn đủ 6 chữ số. Thiếu dòng đó thì `randomInt`
 * trả 4821 sẽ thành mã 4 ký tự, và người dùng nhập đủ 6 ô sẽ không bao giờ khớp.
 */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/**
 * Gửi mã xác thực tới email của người đang đăng nhập.
 *
 * Trả về mã khi đang chạy ở môi trường không phải production — để lập trình
 * viên và người demo lấy được mã mà không cần mở hộp thư. Ở production thì
 * không bao giờ trả, vì trả ra là ai gọi API cũng tự xác thực được email của
 * người khác.
 */
export async function sendVerificationOtp(userId: string): Promise<{ devCode?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerifiedAt: true },
  })

  if (!user) throw notFound('Tài khoản không tồn tại')
  if (user.emailVerifiedAt) throw conflict('Email này đã được xác thực rồi')

  const code = generateCode()

  /*
   * Huỷ mọi mã cũ chưa dùng TRƯỚC KHI tạo mã mới.
   *
   * Không có bước này thì bấm "Gửi lại" ba lần sẽ để lại ba mã cùng hiệu lực.
   * Người dùng nhập mã trong email mới nhất — hợp lý — nhưng hai mã cũ vẫn dùng
   * được, và mỗi mã còn sống là thêm một cơ hội cho người đi dò.
   *
   * Cùng transaction với việc tạo mã mới: tách ra thì lỗi giữa chừng sẽ huỷ hết
   * mã cũ mà không có mã mới, người dùng kẹt hoàn toàn.
   */
  await prisma.$transaction([
    prisma.oneTimeToken.updateMany({
      where: { userId, type: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.oneTimeToken.create({
      data: {
        userId,
        type: 'EMAIL_VERIFICATION',
        tokenHash: hashOtp(userId, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ])

  await sendMail({ to: user.email, ...otpEmail(code) })

  if (!isProduction) {
    logger.info('Mã xác thực (chỉ hiện ngoài production)', { email: user.email, code })
    return { devCode: code }
  }

  return {}
}

/**
 * Đối chiếu mã và đánh dấu email đã xác thực.
 *
 * Mọi trường hợp hỏng đều trả về CÙNG một thông điệp: sai mã, mã hết hạn, mã đã
 * dùng. Phân biệt ra thì người đi dò biết mình đang tới gần — "mã đã dùng"
 * chẳng hạn, xác nhận rằng mã đó từng đúng.
 */
export async function verifyEmailOtp(userId: string, code: string): Promise<void> {
  const invalid = badRequest('Mã xác thực không đúng hoặc đã hết hạn')

  const token = await prisma.oneTimeToken.findUnique({
    where: { tokenHash: hashOtp(userId, code) },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
  })

  if (!token) throw invalid
  if (token.type !== 'EMAIL_VERIFICATION') throw invalid
  if (token.usedAt) throw invalid
  if (token.expiresAt < new Date()) throw invalid

  /*
   * Đánh dấu mã đã dùng và ghi mốc xác thực trong cùng transaction.
   *
   * Tách ra thì có khe: ghi được `emailVerifiedAt` mà chưa kịp đánh dấu mã đã
   * dùng, và mã đó còn xài lại được — đúng thứ mà cột `usedAt` sinh ra để chặn.
   */
  await prisma.$transaction([
    prisma.oneTimeToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ])
}
