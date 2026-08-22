import type { Request, RequestHandler } from 'express'
import { z } from 'zod'
import { createJobSchema } from '@uniwork/shared'
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

export const createJobController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const input = parse(createJobSchema, req.body)
  ok(res, await jobsService.createJob(userId, input), 201)
}
