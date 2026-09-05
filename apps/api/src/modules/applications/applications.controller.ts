import type { Request, RequestHandler } from 'express'
import { z } from 'zod'
import {
  applicantQuerySchema,
  createApplicationSchema,
  updateApplicationStatusSchema,
} from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import * as applicationsService from './applications.service.js'

/** Bản sao của hàm cùng tên ở các module khác — xem giải thích ở admin.controller.ts. */
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

/* ------------------------------------------------- Sinh viên nộp đơn ---- */

export const createApplicationController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const input = parse(createApplicationSchema, req.body)
  ok(res, await applicationsService.createApplication(userId, input), 201)
}

export const listStudentApplicationsController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  ok(res, await applicationsService.listStudentApplications(userId))
}

export const getStudentApplicationController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { applicationId } = parse(z.object({ applicationId: z.string().min(1) }), req.params)
  ok(res, await applicationsService.getStudentApplication(userId, applicationId))
}

export const withdrawApplicationController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { applicationId } = parse(z.object({ applicationId: z.string().min(1) }), req.params)
  ok(res, await applicationsService.withdrawApplication(userId, applicationId))
}

/* ------------------------------------------------- NTD xem ứng viên ----- */

/*
 * Đường dẫn là /ntd/tin-tuyen-dung/:id/ung-vien/:applicationId/trang-thai nên
 * có HAI tham số id. Đặt tên khác nhau chứ không dùng `id` cho cả hai — nhầm
 * hai id với nhau là loại lỗi chạy vẫn ra kết quả, chỉ là kết quả của đơn khác.
 */
const thamSoTin = z.object({ id: z.string().min(1) })
const thamSoTinVaDon = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
})

export const listApplicantsController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id } = parse(thamSoTin, req.params)
  const query = parse(applicantQuerySchema, req.query)
  ok(res, await applicationsService.listApplicants(userId, id, query))
}

export const updateApplicationStatusController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id, applicationId } = parse(thamSoTinVaDon, req.params)
  const input = parse(updateApplicationStatusSchema, req.body)
  ok(res, await applicationsService.updateApplicationStatus(userId, id, applicationId, input))
}
