import type { DocumentType } from '@prisma/client'
import type {
  AvailabilitySlot,
  DocumentViewUrlResponse,
  EmployerDocumentResponse,
  EmployerProfileResponse,
  MeResponse,
  StudentProfileResponse,
  UpdateEmployerProfileInput,
  UpdateStudentProfileInput,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import {
  getSignedDocumentUrl,
  uploadCvFile,
  uploadDocumentFile,
  type DocumentFileFormat,
} from '../../lib/cloudinary.js'
import { sniffFileKind } from '../../lib/file-sniff.js'
import { displayNameOf } from '../auth/auth.service.js'

/**
 * Nghiệp vụ hồ sơ (T51–T55).
 *
 * Mọi hàm ở đây nhận `userId` từ `req.user.id` (do requireAuth gắn vào) — không
 * hàm nào nhận id của một user khác làm tham số. Đó là lý do "sửa hồ sơ người
 * khác" không cần một nhánh kiểm tra quyền sở hữu riêng: không có đường gọi nào
 * đưa được id người khác vào tới đây.
 */

function toStudentProfileResponse(profile: {
  fullName: string
  university: string | null
  major: string | null
  year: number | null
  bio: string | null
  phone: string | null
  cvUrl: string | null
  expectedHourlyRate: number | null
  skills: { skill: { id: string; name: string; slug: string } }[]
}): StudentProfileResponse {
  return {
    fullName: profile.fullName,
    university: profile.university,
    major: profile.major,
    year: profile.year,
    bio: profile.bio,
    phone: profile.phone,
    cvUrl: profile.cvUrl,
    expectedHourlyRate: profile.expectedHourlyRate,
    skills: profile.skills.map((s) => s.skill),
  }
}

function toEmployerDocumentResponse(doc: {
  type: DocumentType
  status: EmployerDocumentResponse['status']
  reviewNote: string | null
  reviewedAt: Date | null
  updatedAt: Date
}): EmployerDocumentResponse {
  return {
    type: doc.type,
    status: doc.status,
    reviewNote: doc.reviewNote,
    reviewedAt: doc.reviewedAt?.toISOString() ?? null,
    submittedAt: doc.updatedAt.toISOString(),
  }
}

function toEmployerProfileResponse(profile: {
  companyName: string
  description: string | null
  address: string | null
  website: string | null
  logoUrl: string | null
  contactName: string | null
  phone: string | null
  verifiedAt: Date | null
  documents: Parameters<typeof toEmployerDocumentResponse>[0][]
}): EmployerProfileResponse {
  return {
    companyName: profile.companyName,
    description: profile.description,
    address: profile.address,
    website: profile.website,
    logoUrl: profile.logoUrl,
    contactName: profile.contactName,
    phone: profile.phone,
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    documents: profile.documents.map(toEmployerDocumentResponse),
  }
}

/** Chọn đúng cột cần cho `EmployerDocumentResponse`, dùng lại ở mọi truy vấn hồ sơ NTD. */
const DOCUMENT_SELECT = {
  type: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  updatedAt: true,
} as const

/* ------------------------------------------------------------------ T51 -- */

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      studentProfile: {
        select: {
          fullName: true,
          university: true,
          major: true,
          year: true,
          bio: true,
          phone: true,
          cvUrl: true,
          expectedHourlyRate: true,
          skills: { select: { skill: { select: { id: true, name: true, slug: true } } } },
        },
      },
      employerProfile: {
        select: {
          companyName: true,
          description: true,
          address: true,
          website: true,
          logoUrl: true,
          contactName: true,
          phone: true,
          verifiedAt: true,
          documents: { select: DOCUMENT_SELECT },
        },
      },
    },
  })

  // Token hợp lệ nhưng user không còn — tài khoản bị xoá giữa lúc token còn hạn.
  if (!user) throw notFound('Tài khoản không còn tồn tại')

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    displayName: displayNameOf(user),
    createdAt: user.createdAt.toISOString(),
    studentProfile: user.studentProfile ? toStudentProfileResponse(user.studentProfile) : null,
    employerProfile: user.employerProfile ? toEmployerProfileResponse(user.employerProfile) : null,
  }
}

/* ------------------------------------------------------------------ T52 -- */

/**
 * `requireRole('STUDENT')` ở tầng route đã đảm bảo vai đúng, nên profile ở đây
 * PHẢI tồn tại — nó được tạo cùng transaction với user lúc đăng ký (auth.service.ts).
 * Không tìm thấy nghĩa là dữ liệu đã hỏng, không phải một ca người dùng thường gặp.
 */
async function requireStudentProfileId(userId: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!profile) throw notFound('Không tìm thấy hồ sơ sinh viên')
  return profile.id
}

export async function getStudentProfile(userId: string): Promise<StudentProfileResponse> {
  const me = await getMe(userId)
  if (!me.studentProfile) throw forbidden('Tài khoản này không có hồ sơ sinh viên')
  return me.studentProfile
}

export async function updateStudentProfile(
  userId: string,
  input: UpdateStudentProfileInput,
): Promise<StudentProfileResponse> {
  await requireStudentProfileId(userId)

  const updated = await prisma.studentProfile.update({
    where: { userId },
    data: {
      university: input.university,
      major: input.major,
      year: input.year,
      bio: input.bio,
    },
    select: {
      fullName: true,
      university: true,
      major: true,
      year: true,
      bio: true,
      phone: true,
      cvUrl: true,
      expectedHourlyRate: true,
      skills: { select: { skill: { select: { id: true, name: true, slug: true } } } },
    },
  })

  return toStudentProfileResponse(updated)
}

/* ------------------------------------------------------------------ T53 -- */

export async function getEmployerProfile(userId: string): Promise<EmployerProfileResponse> {
  const me = await getMe(userId)
  if (!me.employerProfile) throw forbidden('Tài khoản này không có hồ sơ nhà tuyển dụng')
  return me.employerProfile
}

/**
 * NTD ở trạng thái PENDING (`verifiedAt: null`) vẫn sửa được hồ sơ bình thường
 * — cố ý KHÔNG kiểm `verifiedAt` ở đây. Cái bị chặn khi chưa duyệt là đăng tin
 * (Sprint 2), không phải sửa hồ sơ của chính mình.
 */
export async function updateEmployerProfile(
  userId: string,
  input: UpdateEmployerProfileInput,
): Promise<EmployerProfileResponse> {
  const profile = await prisma.employerProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!profile) throw notFound('Không tìm thấy hồ sơ nhà tuyển dụng')

  const updated = await prisma.employerProfile.update({
    where: { userId },
    data: {
      companyName: input.companyName.trim(),
      description: input.description,
      address: input.address,
      website: input.website,
    },
    select: {
      companyName: true,
      description: true,
      address: true,
      website: true,
      logoUrl: true,
      contactName: true,
      phone: true,
      verifiedAt: true,
      documents: { select: DOCUMENT_SELECT },
    },
  })

  return toEmployerProfileResponse(updated)
}

/**
 * `requireRole('EMPLOYER')` ở tầng route đã đảm bảo vai đúng, nên profile ở
 * đây PHẢI tồn tại — cùng lý do `requireStudentProfileId` ở T52.
 */
async function requireEmployerProfileId(userId: string): Promise<string> {
  const profile = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!profile) throw notFound('Không tìm thấy hồ sơ nhà tuyển dụng')
  return profile.id
}

/* ------------------------------------------------------------------ T57 -- */

const FORMAT_BY_KIND: Record<NonNullable<ReturnType<typeof sniffFileKind>>, DocumentFileFormat> = {
  pdf: 'pdf',
  jpeg: 'jpg',
  png: 'png',
}

/**
 * Nộp một loại giấy tờ. Nộp lại cùng loại thì GHI ĐÈ bản cũ (upsert theo
 * ràng buộc `@@unique([employerProfileId, type])`) và trạng thái reset về
 * PENDING — bản bị admin từ chối trước đó không nên tồn đọng vĩnh viễn cùng
 * bản mới vừa nộp.
 */
export async function uploadEmployerDocument(
  userId: string,
  type: DocumentType,
  buffer: Buffer,
): Promise<EmployerProfileResponse> {
  const kind = sniffFileKind(buffer)
  if (!kind) {
    throw badRequest('File phải là PDF, JPG hoặc PNG hợp lệ')
  }
  const format = FORMAT_BY_KIND[kind]

  const employerProfileId = await requireEmployerProfileId(userId)
  const publicId = `uniwork/documents/${employerProfileId}/${type}`

  await uploadDocumentFile(buffer, publicId, format)

  await prisma.employerDocument.upsert({
    where: { employerProfileId_type: { employerProfileId, type } },
    create: { employerProfileId, type, cloudinaryPublicId: publicId, fileFormat: format },
    update: {
      cloudinaryPublicId: publicId,
      fileFormat: format,
      status: 'PENDING',
      reviewNote: null,
      reviewedAt: null,
    },
  })

  return getEmployerProfile(userId)
}

/** Cấp URL xem tạm cho một giấy tờ đã nộp — chỉ chủ hồ sơ mới gọi được (route đã kiểm vai). */
export async function getDocumentViewUrl(
  userId: string,
  type: DocumentType,
): Promise<DocumentViewUrlResponse> {
  const employerProfileId = await requireEmployerProfileId(userId)

  const doc = await prisma.employerDocument.findUnique({
    where: { employerProfileId_type: { employerProfileId, type } },
    select: { cloudinaryPublicId: true, fileFormat: true },
  })
  if (!doc) throw notFound('Chưa nộp giấy tờ loại này')

  const { url, expiresAt } = getSignedDocumentUrl(
    doc.cloudinaryPublicId,
    doc.fileFormat as DocumentFileFormat,
  )

  return { url, expiresAt: expiresAt.toISOString() }
}

/* ------------------------------------------------------------------ T54 -- */

/**
 * Thay TOÀN BỘ danh sách kỹ năng trong một transaction — không phải thêm/bớt
 * từng cái. Gửi mảng rỗng thì xoá sạch, đúng yêu cầu của T54.
 */
export async function replaceSkills(userId: string, skillIds: string[]): Promise<StudentProfileResponse> {
  const studentProfileId = await requireStudentProfileId(userId)

  const unique = [...new Set(skillIds)]

  if (unique.length > 0) {
    const found = await prisma.skill.count({ where: { id: { in: unique } } })
    if (found !== unique.length) {
      throw badRequest('Có kỹ năng không tồn tại trong danh mục')
    }
  }

  await prisma.$transaction([
    prisma.studentSkill.deleteMany({ where: { studentProfileId } }),
    ...(unique.length > 0
      ? [
          prisma.studentSkill.createMany({
            data: unique.map((skillId) => ({ studentProfileId, skillId })),
          }),
        ]
      : []),
  ])

  return getStudentProfile(userId)
}

/* ------------------------------------------------------------------ T56 -- */

export async function uploadCv(userId: string, buffer: Buffer): Promise<StudentProfileResponse> {
  if (sniffFileKind(buffer) !== 'pdf') {
    throw badRequest('File phải là PDF hợp lệ')
  }

  await requireStudentProfileId(userId)

  const cvUrl = await uploadCvFile(buffer, userId)

  const updated = await prisma.studentProfile.update({
    where: { userId },
    data: { cvUrl },
    select: {
      fullName: true,
      university: true,
      major: true,
      year: true,
      bio: true,
      phone: true,
      cvUrl: true,
      expectedHourlyRate: true,
      skills: { select: { skill: { select: { id: true, name: true, slug: true } } } },
    },
  })

  return toStudentProfileResponse(updated)
}

/* ------------------------------------------------------------------ T55 -- */

export async function getAvailability(userId: string): Promise<AvailabilitySlot[]> {
  const studentProfileId = await requireStudentProfileId(userId)

  const rows = await prisma.availability.findMany({
    where: { studentProfileId },
    select: { dayOfWeek: true, slot: true },
  })

  return rows.map((r) => ({ dayOfWeek: r.dayOfWeek as AvailabilitySlot['dayOfWeek'], slot: r.slot }))
}

/**
 * Thay TOÀN BỘ lưới 7×3 trong một transaction. Trùng ô (cùng dayOfWeek + slot)
 * bị chặn ở đây bằng lỗi rõ ràng, thay vì để lọt xuống database và văng lỗi vi
 * phạm ràng buộc unique khó hiểu.
 */
export async function replaceAvailability(
  userId: string,
  slots: AvailabilitySlot[],
): Promise<AvailabilitySlot[]> {
  const studentProfileId = await requireStudentProfileId(userId)

  const keys = new Set<string>()
  for (const s of slots) {
    const key = `${s.dayOfWeek}:${s.slot}`
    if (keys.has(key)) throw badRequest('Danh sách lịch rảnh có ô bị lặp lại')
    keys.add(key)
  }

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { studentProfileId } }),
    ...(slots.length > 0
      ? [
          prisma.availability.createMany({
            data: slots.map((s) => ({ studentProfileId, dayOfWeek: s.dayOfWeek, slot: s.slot })),
          }),
        ]
      : []),
  ])

  return getAvailability(userId)
}
