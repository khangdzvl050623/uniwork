import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import {
  getAvailabilityController,
  getDocumentViewUrlController,
  getEmployerProfileController,
  getMeController,
  getStudentProfileController,
  updateAvailabilityController,
  updateEmployerProfileController,
  updateSkillsController,
  updateStudentProfileController,
  uploadCvController,
  uploadCvMiddleware,
  uploadDocumentController,
  uploadDocumentMiddleware,
} from './profile.controller.js'

export const profileRoutes = Router()

/* Mọi route trong module này đều là "hồ sơ của chính tôi" — luôn cần đăng nhập. */
profileRoutes.use(requireAuth)

/* T51 */
profileRoutes.get('/', getMeController)

/* T52 — chỉ sinh viên mới có hồ sơ dạng này. */
profileRoutes.get('/ho-so-sinh-vien', requireRole('STUDENT'), getStudentProfileController)
profileRoutes.put('/ho-so-sinh-vien', requireRole('STUDENT'), updateStudentProfileController)

/* T53 — chỉ nhà tuyển dụng. */
profileRoutes.get('/ho-so-ntd', requireRole('EMPLOYER'), getEmployerProfileController)
profileRoutes.put('/ho-so-ntd', requireRole('EMPLOYER'), updateEmployerProfileController)

/* T54 */
profileRoutes.put('/ky-nang', requireRole('STUDENT'), updateSkillsController)

/* T56 */
profileRoutes.post('/cv', requireRole('STUDENT'), uploadCvMiddleware, uploadCvController)

/* T57 — chỉ nhà tuyển dụng. */
profileRoutes.post(
  '/giay-to',
  requireRole('EMPLOYER'),
  uploadDocumentMiddleware,
  uploadDocumentController,
)
profileRoutes.get('/giay-to/:type/xem', requireRole('EMPLOYER'), getDocumentViewUrlController)

/* T55 */
profileRoutes.get('/lich-ranh', requireRole('STUDENT'), getAvailabilityController)
profileRoutes.put('/lich-ranh', requireRole('STUDENT'), updateAvailabilityController)
