import type { Prisma, User } from '@prisma/client'
import type { AuthTokens, AuthUser, SignupRole } from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { conflict, unauthorized } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { createRefreshToken, hashToken, refreshExpiry, signAccessToken } from '../../lib/token.js'
import { env } from '../../config/env.js'

/**
 * Nghiệp vụ xác thực. Controller chỉ đọc request và gọi xuống đây.
 *
 * Mọi hàm trả về refresh token dưới dạng chuỗi GỐC. Controller là nơi duy nhất
 * biết cách đặt nó vào cookie — service không chạm tới `res`, nhờ vậy test gọi
 * thẳng service được mà không cần dựng cả Express.
 */

export interface SessionResult extends AuthTokens {
  refreshToken: string
}

/** Thông tin thiết bị, ghi vào phiên để sau này dựng màn "đăng xuất thiết bị khác". */
export interface DeviceInfo {
  userAgent?: string
  ipAddress?: string
}

/**
 * Đổi `ACCESS_TTL` dạng '15m' sang số giây, để web biết khi nào cần refresh.
 *
 * Tự tính thay vì giải mã lại JWT: giải mã tốn công vô ích cho một giá trị ta
 * vốn đã biết từ lúc cấu hình.
 */
function accessTtlSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.ACCESS_TTL)
  if (!match) return 900
  const value = Number(match[1])
  const unit = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2]] ?? 60
  return value * unit
}

/**
 * Lấy tên hiển thị từ hồ sơ tương ứng vai trò.
 *
 * Sinh viên và nhà tuyển dụng lưu tên ở hai bảng khác nhau, nên phía web sẽ
 * phải viết nhánh if nếu ta trả về nguyên hai object. Gộp thành một trường
 * `displayName` để web chỉ việc hiện ra.
 */
function displayNameOf(user: {
  email: string
  studentProfile: { fullName: string } | null
  employerProfile: { companyName: string } | null
}): string {
  return user.studentProfile?.fullName ?? user.employerProfile?.companyName ?? user.email
}

const PROFILE_SELECT = {
  studentProfile: { select: { fullName: true } },
  employerProfile: { select: { companyName: true } },
} satisfies Prisma.UserSelect

/**
 * Bóc user thành dạng an toàn để gửi ra ngoài.
 *
 * Liệt kê tường minh từng trường thay vì loại bỏ trường xấu (`delete
 * user.passwordHash`). Cách liệt kê thì thêm cột mới vào bảng `users` sẽ KHÔNG
 * tự động lọt ra API; cách loại bỏ thì mỗi cột nhạy cảm mới lại phải nhớ thêm
 * một dòng delete, và quên một lần là lộ.
 */
function toAuthUser(
  user: Pick<User, 'id' | 'email' | 'role' | 'emailVerifiedAt'> & {
    studentProfile: { fullName: string } | null
    employerProfile: { companyName: string } | null
  },
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    displayName: displayNameOf(user),
  }
}

/** Cấp một cặp token mới và ghi phiên vào database. */
async function issueSession(
  user: Parameters<typeof toAuthUser>[0],
  device: DeviceInfo,
): Promise<SessionResult> {
  const { token, tokenHash } = createRefreshToken()

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiry(),
      userAgent: device.userAgent?.slice(0, 255),
      ipAddress: device.ipAddress,
    },
  })

  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    expiresIn: accessTtlSeconds(),
    user: toAuthUser(user),
    refreshToken: token,
  }
}

/* ------------------------------------------------------------- đăng ký --- */

export interface RegisterInput {
  email: string
  password: string
  role: SignupRole
  /** Sinh viên: họ tên. Nhà tuyển dụng: tên công ty. */
  name: string
}

/**
 * Tạo tài khoản kèm hồ sơ tương ứng vai trò.
 *
 * Toàn bộ nằm trong MỘT transaction. Không có nó thì tạo `User` xong mà tạo
 * profile lỗi sẽ để lại một tài khoản đăng nhập được nhưng không có hồ sơ —
 * dạng dữ liệu hỏng rất khó phát hiện, vì mọi thứ trông vẫn bình thường cho
 * tới lúc ai đó mở trang hồ sơ.
 */
export async function register(input: RegisterInput, device: DeviceInfo): Promise<SessionResult> {
  const email = input.email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    // Nói thẳng là email đã tồn tại, không né tránh.
    //
    // Có trường phái giấu thông tin này để chống dò email. Ở đây không giấu
    // được: màn đăng ký nào cũng phải báo trùng thì người dùng mới biết đường
    // đi đăng nhập. Giấu chỉ làm người dùng thật bối rối trong khi kẻ dò vẫn
    // suy ra được từ việc đăng ký không thành công.
    throw conflict('Email này đã được đăng ký. Bạn thử đăng nhập xem sao.')
  }

  const passwordHash = await hashPassword(input.password)
  const name = input.name.trim()

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: input.role,
        ...(input.role === 'STUDENT'
          ? { studentProfile: { create: { fullName: name } } }
          : { employerProfile: { create: { companyName: name } } }),
      },
      select: { id: true, email: true, role: true, emailVerifiedAt: true, ...PROFILE_SELECT },
    })
    return created
  })

  return issueSession(user, device)
}

/* ------------------------------------------------------------ đăng nhập -- */

export async function login(
  emailInput: string,
  password: string,
  device: DeviceInfo,
): Promise<SessionResult> {
  const email = emailInput.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      passwordHash: true,
      status: true,
      ...PROFILE_SELECT,
    },
  })

  /*
   * Cùng một thông báo cho "email không tồn tại" và "sai mật khẩu".
   *
   * Khác với lúc đăng ký: ở đây phân biệt hai ca sẽ biến form đăng nhập thành
   * công cụ kiểm tra email nào có trong hệ thống. Người dùng thật gõ nhầm thì
   * thử lại cả hai ô, không mất gì.
   */
  const invalid = unauthorized('Email hoặc mật khẩu không đúng')

  if (!user || !user.passwordHash) throw invalid
  if (!(await verifyPassword(user.passwordHash, password))) throw invalid

  if (user.status === 'SUSPENDED') {
    throw unauthorized('Tài khoản đã bị khoá. Liên hệ hỗ trợ để biết lý do.')
  }

  return issueSession(user, device)
}

/* -------------------------------------------------------------- refresh -- */

/**
 * Đổi refresh token cũ lấy cặp mới — có XOAY VÒNG và PHÁT HIỆN DÙNG LẠI.
 *
 * Đây là phần quan trọng nhất của cả module, nên nói rõ vì sao:
 *
 * Mỗi lần refresh, token cũ bị đánh dấu thu hồi và cấp token mới. Hàng cũ được
 * GIỮ LẠI (đánh `revokedAt`) chứ không xoá — vì nhờ nó còn nằm đó, ta phát
 * hiện được trường hợp có ai dùng lại một token đã thu hồi.
 *
 * Mà token đã thu hồi bị đem ra dùng chỉ có một cách giải thích: nó đã bị sao
 * chép. Người thật đã refresh và nhận token mới rồi; kẻ cầm bản sao đang dùng
 * bản cũ. Lúc đó ta không biết ai là ai, nên xử lý an toàn nhất là HUỶ TOÀN BỘ
 * phiên của tài khoản đó và bắt đăng nhập lại. Người thật mất công đăng nhập
 * một lần; kẻ trộm mất sạch.
 *
 * Không có bước này thì kẻ trộm dùng token vô thời hạn mà chủ tài khoản không
 * bao giờ biết.
 */
export async function refresh(rawToken: string, device: DeviceInfo): Promise<SessionResult> {
  const expired = unauthorized('Phiên đăng nhập đã hết hạn, mời đăng nhập lại')

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          status: true,
          ...PROFILE_SELECT,
        },
      },
    },
  })

  if (!stored) throw expired

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    throw unauthorized(
      'Phiên đăng nhập không còn hợp lệ. Vì lý do an toàn, mọi thiết bị đã bị đăng xuất.',
    )
  }

  if (stored.expiresAt < new Date()) throw expired
  if (stored.user.status === 'SUSPENDED') throw unauthorized('Tài khoản đã bị khoá')

  const { token, tokenHash } = createRefreshToken()

  /*
   * Thu hồi cũ và tạo mới trong cùng transaction.
   *
   * Tách ra hai lệnh riêng thì có khe: lỗi giữa chừng sẽ để lại phiên cũ đã
   * thu hồi mà chưa có phiên mới — người dùng bị đăng xuất không rõ lý do.
   */
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash,
        expiresAt: refreshExpiry(),
        userAgent: device.userAgent?.slice(0, 255),
        ipAddress: device.ipAddress,
      },
    }),
  ])

  return {
    accessToken: signAccessToken({ sub: stored.user.id, role: stored.user.role }),
    expiresIn: accessTtlSeconds(),
    user: toAuthUser(stored.user),
    refreshToken: token,
  }
}

/* ------------------------------------------------------------ đăng xuất -- */

/**
 * Thu hồi phiên hiện tại.
 *
 * Cố ý KHÔNG ném lỗi khi token không tìm thấy hoặc đã thu hồi. Đăng xuất là
 * thao tác cần luôn thành công dưới góc nhìn người dùng — báo lỗi ở đây chỉ
 * khiến họ tưởng mình vẫn đang đăng nhập.
 */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return

  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/* ------------------------------------------------------------------ tôi -- */

export async function currentUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, emailVerifiedAt: true, ...PROFILE_SELECT },
  })

  // Token hợp lệ nhưng user không còn — tài khoản đã bị xoá giữa lúc token còn
  // hạn. Hiếm, nhưng để lọt thì controller sẽ đọc thuộc tính của null.
  if (!user) throw unauthorized('Tài khoản không còn tồn tại')

  return toAuthUser(user)
}
