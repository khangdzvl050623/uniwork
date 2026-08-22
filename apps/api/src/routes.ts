import { Router } from 'express'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { healthRoutes } from './modules/health/health.routes.js'
import {
  adminJobRoutes,
  employerJobRoutes,
  publicJobRoutes,
} from './modules/jobs/jobs.routes.js'
import { profileRoutes } from './modules/profile/profile.routes.js'
import { adminSkillsRoutes, skillsRoutes } from './modules/skills/skills.routes.js'

/**
 * Gom router của tất cả module lại, gắn dưới tiền tố /api.
 *
 * Mỗi module tự khai đường dẫn tương đối của mình, chỗ này quyết định nó nằm ở
 * đâu. Muốn đổi /api thành /api/v1 thì sửa đúng một dòng trong app.ts.
 */
export const apiRouter = Router()

apiRouter.use('/health', healthRoutes)
apiRouter.use('/auth', authRoutes)
apiRouter.use('/skills', skillsRoutes)

/* Việc làm công khai — endpoint DUY NHẤT trong dự án không cần đăng nhập ngoài /health. */
apiRouter.use('/viec-lam', publicJobRoutes)
apiRouter.use('/toi', profileRoutes)
apiRouter.use('/ntd/tin-tuyen-dung', employerJobRoutes)
apiRouter.use('/admin', adminRoutes)

/* Duyệt tin — cùng bảng `Job` với /ntd/tin-tuyen-dung nhưng luật truy cập khác hẳn. */
apiRouter.use('/admin/tin-tuyen-dung', adminJobRoutes)

/*
 * Danh mục kỹ năng có hai cửa: `/skills` để đọc (công khai) và `/admin/ky-nang`
 * để sửa (chỉ ADMIN). Cùng một bảng, hai quyền truy cập khác nhau.
 *
 * Mount riêng ở đây chứ không nhét vào `adminRoutes`: giữ toàn bộ mã liên quan
 * tới bảng `Skill` trong `modules/skills/`.
 */
apiRouter.use('/admin/ky-nang', adminSkillsRoutes)
