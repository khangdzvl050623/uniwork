import type { DocumentType, Prisma } from '@prisma/client'
import {
  DOCUMENT_TYPES,
  type AdminEmployerResponse,
  type AdminUserResponse,
  type DocumentViewUrlResponse,
  type ReviewDocumentInput,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { getSignedDocumentUrl, type DocumentFileFormat } from '../../lib/cloudinary.js'
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

/* ------------------------------------------------- duyệt nhà tuyển dụng -- */

/**
 * Nối lại phần còn thiếu của T57.
 *
 * T57 cho nhà tuyển dụng nộp đủ ba loại giấy tờ, nhưng chưa có đường nào để
 * admin xem và duyệt chúng. Hệ quả là `EmployerProfile.verifiedAt` vĩnh viễn
 * null — mà theo thiết kế trong schema, NTD chưa xác minh thì tin tuyển dụng
 * không được hiện công khai. Không có phần này thì tới Sprint 2 làm xong chức
 * năng đăng tin sẽ phát hiện không tin nào lên được cả.
 */

const CHON_NTD = {
  id: true,
  companyName: true,
  contactName: true,
  phone: true,
  address: true,
  website: true,
  verifiedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, status: true } },
  documents: {
    select: {
      type: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.EmployerProfileSelect

type HangNtd = Prisma.EmployerProfileGetPayload<{ select: typeof CHON_NTD }>

function toAdminEmployerResponse(ntd: HangNtd): AdminEmployerResponse {
  return {
    id: ntd.id,
    userId: ntd.user.id,
    companyName: ntd.companyName,
    email: ntd.user.email,
    contactName: ntd.contactName,
    phone: ntd.phone,
    address: ntd.address,
    website: ntd.website,
    verifiedAt: ntd.verifiedAt?.toISOString() ?? null,
    accountStatus: ntd.user.status,
    documents: ntd.documents.map((d) => ({
      type: d.type,
      status: d.status,
      reviewNote: d.reviewNote,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      submittedAt: d.createdAt.toISOString(),
    })),
    createdAt: ntd.createdAt.toISOString(),
  }
}

/** Toàn bộ nhà tuyển dụng kèm giấy tờ. Lọc/tìm để phía web làm, như `listUsers`. */
export async function listEmployers(): Promise<AdminEmployerResponse[]> {
  const rows = await prisma.employerProfile.findMany({
    select: CHON_NTD,
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(toAdminEmployerResponse)
}

async function layNtdHoacBao(employerProfileId: string) {
  const ntd = await prisma.employerProfile.findUnique({
    where: { id: employerProfileId },
    select: { id: true, verifiedAt: true },
  })
  if (!ntd) throw notFound('Không tìm thấy nhà tuyển dụng')
  return ntd
}

/**
 * Cấp URL xem tạm cho một giấy tờ — bản dành cho admin.
 *
 * Trùng phần lớn với `profile.getDocumentViewUrl`, nhưng CỐ Ý không dùng chung:
 * hàm bên kia tra giấy tờ theo `userId` của chính người đang đăng nhập, đúng
 * như nó phải thế. Sửa nó thành nhận `employerProfileId` để admin dùng ké là
 * tháo mất chính cái ràng buộc khiến nhà tuyển dụng không xem được giấy tờ của
 * nhau. Hai người gọi, hai luật truy cập khác nhau, hai hàm.
 */
export async function getEmployerDocumentUrl(
  employerProfileId: string,
  type: DocumentType,
): Promise<DocumentViewUrlResponse> {
  const doc = await prisma.employerDocument.findUnique({
    where: { employerProfileId_type: { employerProfileId, type } },
    select: { cloudinaryPublicId: true, fileFormat: true },
  })
  if (!doc) throw notFound('Nhà tuyển dụng chưa nộp giấy tờ loại này')

  const { url, expiresAt } = getSignedDocumentUrl(
    doc.cloudinaryPublicId,
    doc.fileFormat as DocumentFileFormat,
  )

  return { url, expiresAt: expiresAt.toISOString() }
}

/**
 * Duyệt hoặc từ chối MỘT giấy tờ.
 *
 * Từ chối giấy tờ của một NTD đang được xác minh thì gỡ luôn xác minh, trong
 * cùng một transaction. Bất biến cần giữ: "đã xác minh" kéo theo "cả ba giấy tờ
 * đều đã duyệt". Thiếu bước này thì tồn tại được trạng thái vô nghĩa — hồ sơ
 * mang dấu đã xác minh trong khi giấy phép kinh doanh vừa bị bác.
 */
export async function reviewDocument(
  employerProfileId: string,
  type: DocumentType,
  input: ReviewDocumentInput,
): Promise<AdminEmployerResponse> {
  const ntd = await layNtdHoacBao(employerProfileId)

  const doc = await prisma.employerDocument.findUnique({
    where: { employerProfileId_type: { employerProfileId, type } },
    select: { id: true },
  })
  if (!doc) throw notFound('Nhà tuyển dụng chưa nộp giấy tờ loại này')

  const goXacMinh = input.status === 'REJECTED' && ntd.verifiedAt !== null

  await prisma.$transaction([
    prisma.employerDocument.update({
      where: { employerProfileId_type: { employerProfileId, type } },
      data: {
        status: input.status,
        // Duyệt thì xoá lý do từ chối cũ. Giữ lại thì hồ sơ đã duyệt vẫn đeo
        // một dòng "thiếu dấu mộc" từ lần nộp trước, nhà tuyển dụng đọc xong
        // không biết mình còn phải làm gì nữa.
        reviewNote: input.status === 'REJECTED' ? (input.reviewNote ?? null) : null,
        reviewedAt: new Date(),
      },
    }),
    ...(goXacMinh
      ? [
          prisma.employerProfile.update({
            where: { id: employerProfileId },
            data: { verifiedAt: null },
          }),
        ]
      : []),
  ])

  return layMotNtd(employerProfileId)
}

/**
 * Chốt hoặc thu hồi xác minh.
 *
 * Xác minh ĐÒI đủ ba loại giấy tờ và cả ba đều `APPROVED`. Kiểm ở đây chứ không
 * chỉ ở giao diện: nút bị khoá trên màn hình chỉ là hướng dẫn, ai gọi thẳng API
 * vẫn đi vòng qua được.
 *
 * Thu hồi thì KHÔNG đòi điều kiện gì. Đây chính là chế tài dùng khi phát hiện
 * một nhà tuyển dụng có dấu hiệu lừa đảo: gỡ xác minh là toàn bộ tin của họ rời
 * khỏi trang công khai, không cần xoá từng tin và không cần khoá tài khoản.
 */
export async function setEmployerVerified(
  employerProfileId: string,
  verified: boolean,
): Promise<AdminEmployerResponse> {
  await layNtdHoacBao(employerProfileId)

  if (verified) {
    const daDuyet = await prisma.employerDocument.count({
      where: { employerProfileId, status: 'APPROVED' },
    })

    if (daDuyet < DOCUMENT_TYPES.length) {
      throw badRequest(
        `Chỉ xác minh được khi cả ${DOCUMENT_TYPES.length} loại giấy tờ đã duyệt (hiện ${daDuyet})`,
      )
    }
  }

  await prisma.employerProfile.update({
    where: { id: employerProfileId },
    data: { verifiedAt: verified ? new Date() : null },
  })

  return layMotNtd(employerProfileId)
}

/** Đọc lại một hồ sơ sau khi sửa, để trả về đúng hình dạng phía web đang giữ. */
async function layMotNtd(employerProfileId: string): Promise<AdminEmployerResponse> {
  const ntd = await prisma.employerProfile.findUnique({
    where: { id: employerProfileId },
    select: CHON_NTD,
  })
  if (!ntd) throw notFound('Không tìm thấy nhà tuyển dụng')

  return toAdminEmployerResponse(ntd)
}
