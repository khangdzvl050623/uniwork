import type { Request, RequestHandler } from 'express'
import { z } from 'zod'
import { createJobSchema, updateJobSchema } from '@uniwork/shared'
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
