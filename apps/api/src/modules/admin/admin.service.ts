import type { Prisma } from '@prisma/client'
import type { AdminUserResponse } from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { displayNameOf } from '../auth/auth.service.js'

/**
 * Nghiệp vụ quản trị người dùng.
 *
 * Mọi hàm ở đây giả định vai ADMIN đã được xác nhận ở tầng route
 * (`requireRole('ADMIN')`) — không tự kiểm lại vai trò của người gọi.
 */

/** Chọn đúng cột cần cho `AdminUserResponse`, dùng chung cho danh sách và cập nhật. */
const CHON_USER = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  studentProfile: {
    select: { fullName: true, university: true, _count: { select: { applications: true } } },
  },
  employerProfile: { select: { companyName: true } },
} satisfies Prisma.UserSelect

type HangUser = Prisma.UserGetPayload<{ select: typeof CHON_USER }>

function toAdminUserResponse(user: HangUser): AdminUserResponse {
  return {
    id: user.id,
    displayName: displayNameOf(user),
    email: user.email,
    role: user.role,
    status: user.status,
    school: user.studentProfile?.university ?? null,
    joinedAt: user.createdAt.toISOString(),
    applicationCount: user.studentProfile?._count.applications ?? 0,
  }
}

/**
 * Danh sách toàn bộ người dùng.
 *
 * Không phân trang: quy mô đồ án chỉ vài trăm tài khoản là cùng, và trang
 * quản trị đã tự lọc/tìm ở phía web (xem `pages/admin/Users.tsx`). Thêm phân
 * trang bây giờ là giải quyết một vấn đề chưa xảy ra.
 */
export async function listUsers(): Promise<AdminUserResponse[]> {
  const users = await prisma.user.findMany({
    select: CHON_USER,
    orderBy: { createdAt: 'desc' },
  })

  return users.map(toAdminUserResponse)
}

/**
 * Đổi trạng thái một tài khoản (khoá/mở khoá).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CHẶN ĐỔI TRẠNG THÁI TÀI KHOẢN ADMIN
 * ---------------------------------------------------------------------------
 * Khoá được tài khoản admin khác (hoặc chính mình) từ đúng màn hình này là mở
 * đường tự khoá nhau hoặc tự khoá chính mình — không có cách nào mở lại ngoài
 * việc vào thẳng database. Chặn hẳn ở đây, đúng như UI đã disable nút cho hàng
 * có vai ADMIN.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO THU HỒI REFRESH TOKEN NGAY KHI KHOÁ
 * ---------------------------------------------------------------------------
 * `login`/`refresh` đã tự chặn tài khoản `SUSPENDED` (xem auth.service.ts), nên
 * về lý thuyết không cần thêm bước này. Nhưng access token là JWT sống tới 15
 * phút không tra cứu được — thu hồi refresh token ngay thì lần refresh KẾ TIẾP
 * của người bị khoá chắc chắn thất bại, thay vì phải đợi suy luận qua nhánh
 * kiểm `status` ở một chỗ khác. Hai lớp phòng thủ cho cùng một việc.
 */
export async function updateUserStatus(
  targetUserId: string,
  status: AdminUserResponse['status'],
): Promise<AdminUserResponse> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  })
  if (!target) throw notFound('Không tìm thấy người dùng')
  if (target.role === 'ADMIN') {
    throw forbidden('Không thể đổi trạng thái tài khoản quản trị từ màn hình này')
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    select: CHON_USER,
  })

  if (status === 'SUSPENDED') {
    await prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  return toAdminUserResponse(updated)
}
