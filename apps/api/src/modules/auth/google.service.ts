import { randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import { env } from '../../config/env.js'

/**
 * Đăng nhập bằng Google — Authorization Code Flow.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG DÙNG IMPLICIT FLOW
 * ---------------------------------------------------------------------------
 * Implicit flow trả token thẳng cho trình duyệt qua thanh địa chỉ. Token đó nằm
 * trong URL nên lọt vào lịch sử duyệt web, log của proxy, và header `Referer`
 * gửi sang mọi trang khác mà người dùng bấm tiếp.
 *
 * Ở đây `redirect_uri` trỏ về BACKEND. Google gửi về một mã tạm dùng-một-lần,
 * rồi backend tự đổi mã đó lấy token qua một lời gọi server-to-server có kèm
 * `client_secret`. Token thật của Google không bao giờ chạm tới trình duyệt.
 *
 * Cái client nhận được chỉ là access/refresh token do CHÍNH UniWork phát hành,
 * đúng cơ chế đã dùng cho đăng nhập thường.
 */

/**
 * Thiếu khoá thì tính năng tự tắt, không làm sập app.
 *
 * Đăng nhập Google là tính năng thêm: không có khoá thì nút đó biến mất khỏi
 * giao diện, còn đăng nhập bằng mật khẩu vẫn chạy. Nhờ vậy người trong nhóm
 * chạy được dự án mà không cần ai cũng phải tạo project trên Google Cloud.
 */
export const GOOGLE_SAN_SANG = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

/** Đường dẫn Google gọi ngược về. Phải khai Y HỆT trong Google Cloud Console. */
export function redirectUri(): string {
  return `${env.API_URL}/api/auth/google/callback`
}

function client(): OAuth2Client {
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri())
}

/* ----------------------------------------------------------- chống CSRF -- */

/**
 * Sinh chuỗi `state` ngẫu nhiên cho một lượt đăng nhập.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG ĐƯỢC BỎ BƯỚC NÀY
 * ---------------------------------------------------------------------------
 * Không có `state`, kẻ tấn công tự bắt đầu một lượt đăng nhập Google bằng tài
 * khoản CỦA HẮN, lấy được URL callback kèm mã, rồi lừa nạn nhân bấm vào. Trình
 * duyệt nạn nhân gọi callback đó, và họ lặng lẽ bị đăng nhập vào tài khoản của
 * kẻ tấn công — mọi thứ họ làm tiếp theo (tải CV lên chẳng hạn) đều rơi vào
 * tài khoản kẻ đó đang nắm.
 *
 * `state` chặn điều đó: chuỗi này được đặt vào cookie của chính trình duyệt
 * người dùng lúc bắt đầu, và phải khớp lúc quay về. Trình duyệt nạn nhân không
 * có cookie ứng với `state` của kẻ tấn công nên callback bị từ chối.
 */
export function taoState(): string {
  return randomBytes(24).toString('base64url')
}

/** Địa chỉ Google để chuyển hướng người dùng tới. */
export function urlDangNhap(state: string): string {
  return client().generateAuthUrl({
    // Chỉ xin đúng thứ cần để biết "người này là ai". Không xin Calendar,
    // Drive... — quyền không dùng tới mà vẫn xin thì vừa làm người dùng ngần
    // ngại bấm đồng ý, vừa là thứ phải giải trình nếu Google xét duyệt.
    scope: ['openid', 'email', 'profile'],
    state,
    // Không cần `access_type: 'offline'`: ta KHÔNG gọi API nào thay mặt người
    // dùng, nên không cần refresh token của Google. Xin về rồi không dùng thì
    // chỉ tạo thêm một bí mật phải bảo quản.
    prompt: 'select_account',
  })
}

/* --------------------------------------------------------- đọc danh tính -- */

export interface DanhTinhGoogle {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
}

/**
 * Đổi mã tạm lấy danh tính, và XÁC MINH chữ ký của Google.
 *
 * `verifyIdToken` của thư viện chính thức tự kiểm: chữ ký đúng khoá công khai
 * hiện hành của Google, thuật toán RS256 (không chấp nhận `alg: none` hay
 * HS256), `iss` đúng, `aud` đúng CLIENT_ID của mình, và chưa hết hạn.
 *
 * Tự viết phần này bằng cách giải mã JWT rồi đọc payload là lỗ hổng kinh điển:
 * payload của JWT chưa xác minh thì ai cũng bịa ra được, và khi đó chỉ cần khai
 * `email` bất kỳ là chiếm được tài khoản tương ứng.
 */
export async function docDanhTinh(code: string): Promise<DanhTinhGoogle> {
  const oauth = client()

  const { tokens } = await oauth.getToken(code)
  if (!tokens.id_token) throw unauthorized('Google không trả về thông tin tài khoản')

  const ticket = await oauth.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email) {
    throw unauthorized('Thông tin tài khoản Google không đầy đủ')
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  }
}

/* ------------------------------------------------- tìm hoặc tạo tài khoản -- */

/** Chọn đúng những cột `toAuthUser` cần, khai một lần dùng cho mọi truy vấn dưới đây. */
const CHON_USER = {
  id: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  status: true,
  studentProfile: { select: { fullName: true } },
  employerProfile: { select: { companyName: true } },
} satisfies Prisma.UserSelect

export type UserDangNhap = Prisma.UserGetPayload<{ select: typeof CHON_USER }>

/**
 * Tìm tài khoản ứng với danh tính Google, tạo mới nếu chưa có.
 *
 * ---------------------------------------------------------------------------
 * LUẬT GHÉP TÀI KHOẢN — chỗ dễ tạo lỗ hổng chiếm tài khoản nhất
 * ---------------------------------------------------------------------------
 * Thứ tự tra cứu QUAN TRỌNG:
 *
 * 1. Tra theo `sub` của Google trước. Đây là mã định danh nội bộ, KHÔNG đổi kể
 *    cả khi người dùng đổi địa chỉ Gmail. Đã liên kết rồi thì luôn về đúng tài
 *    khoản cũ, bất kể email hiện tại là gì.
 *
 * 2. Chưa liên kết thì mới tra theo email — và CHỈ ghép khi Google khẳng định
 *    `email_verified`. Đây là chốt chặn quan trọng nhất của cả file: kẻ xấu có
 *    thể đăng ký trước bằng email không phải của mình (ta chưa bắt xác thực
 *    mới cho đăng ký), rồi đợi chủ thật đăng nhập Google. Ghép bừa theo email
 *    thì chủ thật rơi thẳng vào tài khoản kẻ xấu đang giữ mật khẩu.
 *
 * 3. Không có gì khớp thì tạo tài khoản mới với `passwordHash = null`.
 */
export async function timHoacTao(danhTinh: DanhTinhGoogle): Promise<UserDangNhap> {
  const daLienKet = await prisma.userAccount.findUnique({
    where: {
      provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: danhTinh.sub },
    },
    select: { user: { select: CHON_USER } },
  })

  if (daLienKet) {
    if (daLienKet.user.status === 'SUSPENDED') throw unauthorized('Tài khoản đã bị khoá')
    return daLienKet.user
  }

  const theoEmail = await prisma.user.findUnique({
    where: { email: danhTinh.email },
    select: CHON_USER,
  })

  if (theoEmail) {
    if (!danhTinh.emailVerified) {
      throw badRequest(
        'Google chưa xác thực địa chỉ email này nên không thể liên kết với tài khoản đã có. ' +
          'Vui lòng đăng nhập bằng mật khẩu.',
      )
    }
    if (theoEmail.status === 'SUSPENDED') throw unauthorized('Tài khoản đã bị khoá')

    await prisma.userAccount.create({
      data: { userId: theoEmail.id, provider: 'GOOGLE', providerAccountId: danhTinh.sub },
    })

    return theoEmail
  }

  /*
   * Tài khoản mới. Mặc định vai SINH VIÊN.
   *
   * Không thể hỏi vai trò ở đây vì người dùng đang ở giữa một chuỗi chuyển
   * hướng — không có chỗ nào để hiện câu hỏi. Chọn STUDENT vì đó là phần lớn
   * người dùng; nhà tuyển dụng có quy trình riêng (nộp giấy tờ, chờ duyệt) nên
   * họ đăng ký qua form là hợp lý hơn.
   *
   * `emailVerifiedAt` đặt luôn: Google đã khẳng định người này sở hữu hộp thư,
   * bắt họ nhập thêm mã OTP nữa là thừa và làm mất hẳn cái lợi của nút này.
   */
  return prisma.user.create({
    data: {
      email: danhTinh.email,
      passwordHash: null,
      role: 'STUDENT',
      emailVerifiedAt: danhTinh.emailVerified ? new Date() : null,
      studentProfile: { create: { fullName: danhTinh.name?.trim() || danhTinh.email } },
      linkedAccounts: {
        create: { provider: 'GOOGLE', providerAccountId: danhTinh.sub },
      },
    },
    select: CHON_USER,
  })
}
