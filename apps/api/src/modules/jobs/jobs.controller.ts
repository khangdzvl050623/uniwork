import type { Request, RequestHandler } from 'express'
import { z } from 'zod'
import {
  adminJobQuerySchema,
  createJobSchema,
  publicJobQuerySchema,
  reviewJobSchema,
  updateJobSchema,
} from '@uniwork/shared'
import { ok } from '../../lib/respond.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import * as jobsService from './jobs.service.js'

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

const thamSoId = z.object({ id: z.string().min(1) })

export const createJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const input = parse(createJobSchema, req.body)
  ok(res, await jobsService.createJob(userId, input), 201)
}

export const listMyJobsController: RequestHandler = async (req, res) => {
  ok(res, { jobs: await jobsService.listMyJobs(requireUserId(req)) })
}

export const getMyJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id } = parse(thamSoId, req.params)
  ok(res, await jobsService.getMyJob(userId, id))
}

export const updateJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id } = parse(thamSoId, req.params)
  const input = parse(updateJobSchema, req.body)
  ok(res, await jobsService.updateJob(userId, id, input))
}

/*
 * Tra 200 kem { id } thay vi 204 rong — cung ly do nhu DELETE ky nang: apiFetch
 * phia web goi response.json() vo dieu kien.
 */
export const deleteJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id } = parse(thamSoId, req.params)
  ok(res, await jobsService.deleteJob(userId, id))
}

export const closeJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id } = parse(thamSoId, req.params)
  ok(res, await jobsService.closeJob(userId, id))
}

export const submitJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { id } = parse(thamSoId, req.params)
  ok(res, await jobsService.submitJob(userId, id))
}

/* ------------------------------------------------- T77–T78: admin duyệt -- */

export const listJobsForAdminController: RequestHandler = async (req, res) => {
  const { status } = parse(adminJobQuerySchema, req.query)
  ok(res, { jobs: await jobsService.listJobsForAdmin(status) })
}

export const reviewJobController: RequestHandler = async (req, res) => {
  const { id } = parse(thamSoId, req.params)
  const input = parse(reviewJobSchema, req.body)
  ok(res, await jobsService.reviewJob(id, input))
}

/* ------------------------------------------------- T79–T80: công khai --- */

export const listPublicJobsController: RequestHandler = async (req, res) => {
  const query = parse(publicJobQuerySchema, req.query)
  ok(res, await jobsService.listPublicJobs(query))
}

export const getPublicJobController: RequestHandler = async (req, res) => {
  const { id } = parse(thamSoId, req.params)
  ok(res, await jobsService.getPublicJob(id))
}

/* ------------------------------------------------- Sprint 3: tin đã lưu -- */

/* Tham số ở đây tên `jobId` chứ không `id` — đường dẫn là /tin-da-luu/:jobId,
   và giữ đúng tên giúp đọc route ra ngay là đang trỏ tới tin nào. */
const thamSoJobId = z.object({ jobId: z.string().min(1) })

export const saveJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { jobId } = parse(thamSoJobId, req.params)
  ok(res, await jobsService.saveJob(userId, jobId))
}

export const unsaveJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const { jobId } = parse(thamSoJobId, req.params)
  ok(res, await jobsService.unsaveJob(userId, jobId))
}

export const listSavedJobsController: RequestHandler = async (req, res) => {
  ok(res, await jobsService.listSavedJobs(requireUserId(req)))
}
