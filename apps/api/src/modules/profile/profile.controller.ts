import type { Request, RequestHandler } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { TIME_SLOTS } from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import * as profileService from './profile.service.js'

/**
 * Kiểm dữ liệu vào bằng Zod rồi ném `badRequest` kèm lỗi từng trường.
 *
 * Bản sao của hàm cùng tên trong auth.controller.ts. Không tách ra `lib/` dùng
 * chung vì hai module không có gì khác phụ thuộc lẫn nhau — tách sớm mà chỉ có
 * hai chỗ dùng là thêm một tầng gián tiếp không cần thiết.
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

function requireUserId(req: Request): string {
  if (!req.user) throw unauthorized()
  return req.user.id
}

/* ------------------------------------------------------------------ T51 -- */

export const getMeController: RequestHandler = async (req, res) => {
  ok(res, await profileService.getMe(requireUserId(req)))
}

/* ------------------------------------------------------------------ T52 -- */

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))

const updateStudentProfileSchema = z.object({
  university: nullableTrimmed(200),
  major: nullableTrimmed(200),
  year: z.number().int().min(1).max(10).nullable().optional(),
  bio: nullableTrimmed(2000),
})

export const getStudentProfileController: RequestHandler = async (req, res) => {
  ok(res, await profileService.getStudentProfile(requireUserId(req)))
}

export const updateStudentProfileController: RequestHandler = async (req, res) => {
  const input = parse(updateStudentProfileSchema, req.body)
  ok(res, await profileService.updateStudentProfile(requireUserId(req), input))
}

/* ------------------------------------------------------------------ T53 -- */

const updateEmployerProfileSchema = z.object({
  companyName: z.string().trim().min(2, 'Tên công ty cần ít nhất 2 ký tự').max(200),
  description: nullableTrimmed(2000),
  address: nullableTrimmed(300),
  website: z
    .string()
    .trim()
    .url('Website không đúng định dạng')
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
})

export const getEmployerProfileController: RequestHandler = async (req, res) => {
  ok(res, await profileService.getEmployerProfile(requireUserId(req)))
}

export const updateEmployerProfileController: RequestHandler = async (req, res) => {
  const input = parse(updateEmployerProfileSchema, req.body)
  ok(res, await profileService.updateEmployerProfile(requireUserId(req), input))
}

/* ------------------------------------------------------------------ T54 -- */

const updateSkillsSchema = z.object({
  skillIds: z.array(z.string()).max(50, 'Tối đa 50 kỹ năng'),
})

export const updateSkillsController: RequestHandler = async (req, res) => {
  const { skillIds } = parse(updateSkillsSchema, req.body)
  ok(res, await profileService.replaceSkills(requireUserId(req), skillIds))
}

/* ------------------------------------------------------------------ T56 -- */

/**
 * `memoryStorage`: file vào thẳng RAM dưới dạng `Buffer`, không ghi ra đĩa.
 *
 * Đúng nhu cầu ở đây — file chỉ cần đi qua tay ta để chuyển tiếp lên Cloudinary,
 * không cần giữ lại. Ghi ra đĩa trên Render còn hỏng hẳn: filesystem của gói
 * free là tạm, mất sạch mỗi khi service khởi động lại.
 *
 * `fileFilter` lọc nhanh theo mimetype trình duyệt gửi — chặn sớm phần lớn file
 * sai định dạng, đỡ tốn công đọc hết vào RAM. Đây KHÔNG phải lớp bảo vệ chính:
 * mimetype suy từ đuôi file, đổi tên `.exe` thành `.pdf` là qua được. Lớp bảo vệ
 * thật nằm ở `profile.service.ts` — đọc byte đầu file để biết nội dung thật.
 */
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(badRequest('Chỉ nhận file PDF'))
      return
    }
    cb(null, true)
  },
})

export const uploadCvMiddleware = uploadMemory.single('cv')

export const uploadCvController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  if (!req.file) throw badRequest('Thiếu file CV')
  ok(res, await profileService.uploadCv(userId, req.file.buffer))
}

/* ------------------------------------------------------------------ T55 -- */

const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
])

const availabilitySlotSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  slot: z.enum(TIME_SLOTS),
})

const updateAvailabilitySchema = z.object({
  // 21 = 7 ngày × 3 khung giờ, không thể vượt quá dù không trùng ô nào.
  slots: z.array(availabilitySlotSchema).max(21, 'Tối đa 21 ô (7 ngày × 3 buổi)'),
})

export const getAvailabilityController: RequestHandler = async (req, res) => {
  const slots = await profileService.getAvailability(requireUserId(req))
  ok(res, { slots })
}

export const updateAvailabilityController: RequestHandler = async (req, res) => {
  const { slots } = parse(updateAvailabilitySchema, req.body)
  const result = await profileService.replaceAvailability(requireUserId(req), slots)
  ok(res, { slots: result })
}
