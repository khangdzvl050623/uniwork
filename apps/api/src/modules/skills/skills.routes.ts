import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import {
  createSkillController,
  deleteSkillController,
  listSkillsController,
  listSkillsForAdminController,
  setSkillFeaturedController,
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

/*
 * ⚠ LỚP CANH NÀY LÀ LỚP THỨ HAI, KHÔNG PHẢI LỚP DUY NHẤT — ĐỪNG GỠ.
 *
 * Router này mount ở `/admin/ky-nang`, mà `routes.ts` mount `adminRoutes` ở
 * `/admin` TRƯỚC đó. Express cho `use('/admin', …)` khớp mọi đường dẫn bắt đầu
 * bằng `/admin`, nên middleware của `adminRoutes` — cũng `requireAuth` +
 * `requireRole('ADMIN')` — đã chạy xong trước khi request tới được đây.
 *
 * Đo bằng đột biến (2026-09-06): gỡ RIÊNG dòng này thì không ca test nào đỏ,
 * gỡ riêng dòng bên `adminRoutes` cũng vậy; phải gỡ CẢ HAI mới đỏ 8 ca. Tức là
 * mỗi request quản trị đang xác thực hai lượt.
 *
 * Vẫn giữ, vì đây là kiểm QUYỀN chứ không phải tối ưu tốc độ: chi phí là một
 * lượt verify JWT, còn cái giá của việc gỡ nhầm là cả nhánh sửa danh mục mở
 * toang nếu sau này ai đó đổi thứ tự mount hoặc tách `/admin/ky-nang` ra khỏi
 * `/admin`. Ghi ra đây để lần "dọn dẹp trùng lặp" sau đọc được lý do.
 */
adminSkillsRoutes.use(requireAuth, requireRole('ADMIN'))

adminSkillsRoutes.get('/', listSkillsForAdminController)
adminSkillsRoutes.post('/', createSkillController)
adminSkillsRoutes.put('/:id', updateSkillController)

/*
 * Bật/tắt chip ở trang chủ — route RIÊNG, cùng khuôn `/nha-tuyen-dung/:id/xac-minh`.
 *
 * Khai SAU `/:id` không sao: Express so khớp theo số đoạn đường dẫn, mà
 * `/:id/noi-bat` có hai đoạn nên không bao giờ đụng `/:id` một đoạn.
 */
adminSkillsRoutes.put('/:id/noi-bat', setSkillFeaturedController)
adminSkillsRoutes.delete('/:id', deleteSkillController)
