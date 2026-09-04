import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import {
  createSkillController,
  deleteSkillController,
  listSkillsController,
  listSkillsForAdminController,
  updateSkillController,
} from './skills.controller.js'

/** Đọc danh mục — công khai, ai cũng gọi được để dựng bộ lọc. */
export const skillsRoutes = Router()

skillsRoutes.get('/', listSkillsController)

/**
 * Sửa danh mục — chỉ ADMIN.
 *
 * Router riêng, mount ở `/admin/ky-nang` trong `routes.ts`. Cùng module với
 * phần đọc vì cả hai thao tác trên đúng một bảng `Skill` — tách sang
 * `modules/admin/` thì phải export qua lại kiểu và hàm cho cùng một bảng.
 * Cái phân biệt hai router này là quyền truy cập, và đó là chuyện của tầng
 * route chứ không phải của tầng nghiệp vụ.
 */
export const adminSkillsRoutes = Router()

adminSkillsRoutes.use(requireAuth, requireRole('ADMIN'))

adminSkillsRoutes.get('/', listSkillsForAdminController)
adminSkillsRoutes.post('/', createSkillController)
adminSkillsRoutes.put('/:id', updateSkillController)
adminSkillsRoutes.delete('/:id', deleteSkillController)
