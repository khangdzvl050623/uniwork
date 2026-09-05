import { Router } from 'express'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { studentApplicationRoutes } from './modules/applications/applications.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { healthRoutes } from './modules/health/health.routes.js'
import {
  adminJobRoutes,
  employerJobRoutes,
  publicJobRoutes,
  savedJobRoutes,
} from './modules/jobs/jobs.routes.js'
import { profileRoutes } from './modules/profile/profile.routes.js'
import { adminSkillsRoutes, skillsRoutes } from './modules/skills/skills.routes.js'
import { notificationRoutes } from './modules/notifications/notifications.routes.js'

/**
 * Gom router của tất cả module lại, gắn dưới tiền tố /api.
 *
 * Mỗi module tự khai đường dẫn tương đối của mình, chỗ này quyết định nó nằm ở
 * đâu. Muốn đổi /api thành /api/v1 thì sửa đúng một dòng trong app.ts.
 */
export const apiRouter = Router()

apiRouter.use('/health', healthRoutes)
apiRouter.use('/auth', authRoutes)
/*
 * Thông báo — MỘT đường vào duy nhất.
 *
 * Khai TRƯỚC `/toi` bên dưới vì `profileRoutes` gắn `requireAuth` cho cả nhánh
 * đó; cùng lý do `/toi/tin-da-luu` và `/toi/don-ung-tuyen` cũng nằm trên.
 */
apiRouter.use('/toi/thong-bao', notificationRoutes)
apiRouter.use('/skills', skillsRoutes)

/* Việc làm công khai — endpoint DUY NHẤT trong dự án không cần đăng nhập ngoài /health. */
apiRouter.use('/viec-lam', publicJobRoutes)

/*
 * Tin đã lưu — nằm dưới /toi vì đây là dữ liệu của chính người đang đăng nhập,
 * nhưng mã nguồn ở `modules/jobs/` vì nó trả về `PublicJobSummary`.
 *
 * Phải khai TRƯỚC `/toi` bên dưới: Express so khớp theo thứ tự đăng ký, mà
 * `profileRoutes` gắn `requireAuth` cho toàn bộ nhánh `/toi`. Khai sau thì mỗi
 * request tới đây đi qua `requireAuth` của profile, không khớp route nào, rồi
 * mới rơi xuống đây và xác thực lại lần nữa — chạy đúng nhưng thừa một lượt.
 */
apiRouter.use('/toi/tin-da-luu', savedJobRoutes)

/*
 * Đơn ứng tuyển của chính sinh viên — cùng lý do đặt dưới `/toi` và cùng lý do
 * phải khai TRƯỚC `/toi` như dòng trên.
 *
 * `jobId` đi trong body chứ không trên đường dẫn: `/viec-lam` phải giữ được
 * tính chất "nhánh duy nhất không cần đăng nhập" ghi ở dưới.
 */
apiRouter.use('/toi/don-ung-tuyen', studentApplicationRoutes)

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
