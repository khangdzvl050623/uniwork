import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import {
  getEmployerDocumentUrlController,
  listEmployersController,
  listUsersController,
  reviewDocumentController,
  updateUserStatusController,
  verifyEmployerController,
} from './admin.controller.js'

export const adminRoutes = Router()

/* Mọi route trong module này đều cần đăng nhập VÀ đúng vai ADMIN. */
adminRoutes.use(requireAuth, requireRole('ADMIN'))

adminRoutes.get('/nguoi-dung', listUsersController)
adminRoutes.put('/nguoi-dung/:id/trang-thai', updateUserStatusController)

/* `:id` ở đây là id của EmployerProfile, KHÔNG phải userId — xem AdminEmployerResponse. */
adminRoutes.get('/nha-tuyen-dung', listEmployersController)
adminRoutes.get('/nha-tuyen-dung/:id/giay-to/:type/xem', getEmployerDocumentUrlController)
adminRoutes.put('/nha-tuyen-dung/:id/giay-to/:type', reviewDocumentController)
adminRoutes.put('/nha-tuyen-dung/:id/xac-minh', verifyEmployerController)
