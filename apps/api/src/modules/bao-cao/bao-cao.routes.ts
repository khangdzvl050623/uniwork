import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import {
  baoCaoCuaToiController,
  guiBaoCaoController,
  hangDoiBaoCaoController,
  xuLyBaoCaoController,
} from './bao-cao.controller.js'

/**
 * Báo cáo tin tuyển dụng.
 *
 * Hai nhánh, hai quyền hoàn toàn khác nhau — nên hai router chứ không một
 * router với `if (role === 'ADMIN')` bên trong. Đọc file này là thấy ngay ai
 * làm được gì.
 */

/* ------------------------------------------------------------ người gửi -- */

export const baoCaoRoutes = Router()

baoCaoRoutes.use(requireAuth, requireRole('STUDENT', 'EMPLOYER'))

/**
 * 10 báo cáo mỗi giờ.
 *
 * Chỉ mục một phần `job_reports_mot_bao_cao_mo` đã chặn báo trùng CÙNG một
 * tin. Trần này lo ca khác: rải báo cáo lên hàng chục tin khác nhau để làm
 * ngập hàng đợi admin.
 *
 * Đếm theo `userId`, và khoá đếm dùng MẪU route nên mọi tin dồn về một bộ đếm
 * — xem ghi chú trong `rate-limit.ts` về lỗi khoá chứa id cụ thể.
 */
const guiLimit = rateLimit({
  max: 10,
  windowMs: 60 * 60_000,
  keyOf: (req) => req.user?.id ?? req.ip ?? 'unknown',
})

baoCaoRoutes.post('/', guiLimit, guiBaoCaoController)
baoCaoRoutes.get('/', baoCaoCuaToiController)

/* ---------------------------------------------------------------- admin -- */

export const adminBaoCaoRoutes = Router()

adminBaoCaoRoutes.use(requireAuth, requireRole('ADMIN'))

adminBaoCaoRoutes.get('/', hangDoiBaoCaoController)
adminBaoCaoRoutes.put('/:id', xuLyBaoCaoController)
