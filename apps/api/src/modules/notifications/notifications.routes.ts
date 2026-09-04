import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from './notifications.controller.js'

export const notificationRoutes = Router()
notificationRoutes.use(requireAuth)
notificationRoutes.get('/', listNotificationsController)
notificationRoutes.put('/da-doc-het', markAllNotificationsReadController)
notificationRoutes.put('/:id/da-doc', markNotificationReadController)
// PATCH aliases keep the endpoint convenient for clients that use PATCH for
// partial state changes; the documented contract remains PUT.
notificationRoutes.patch('/da-doc-het', markAllNotificationsReadController)
notificationRoutes.patch('/:id/da-doc', markNotificationReadController)
