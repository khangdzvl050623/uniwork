import type { Request, RequestHandler } from 'express'
import { ok } from '../../lib/respond.js'
import { unauthorized } from '../../lib/errors.js'
import * as notificationsService from './notifications.service.js'

function requireUserId(req: Request): string {
  if (!req.user) throw unauthorized()
  return req.user.id
}

export const listNotificationsController: RequestHandler = async (req, res) => {
  ok(res, await notificationsService.listNotifications(requireUserId(req)))
}

export const markNotificationReadController: RequestHandler = async (req, res) => {
  const userId = requireUserId(req)
  const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  ok(res, await notificationsService.markNotificationRead(userId, notificationId))
}

export const markAllNotificationsReadController: RequestHandler = async (req, res) => {
  ok(res, await notificationsService.markAllNotificationsRead(requireUserId(req)))
}
