import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { listUsersController, updateUserStatusController } from './admin.controller.js'

export const adminRoutes = Router()

/* Mọi route trong module này đều cần đăng nhập VÀ đúng vai ADMIN. */
adminRoutes.use(requireAuth, requireRole('ADMIN'))

adminRoutes.get('/nguoi-dung', listUsersController)
adminRoutes.put('/nguoi-dung/:id/trang-thai', updateUserStatusController)
