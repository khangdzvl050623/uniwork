import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import {
  createApplicationController,
  getStudentApplicationController,
  listStudentApplicationsController,
  listApplicantsController,
  updateApplicationStatusController,
  withdrawApplicationController,
} from './applications.controller.js'

/**
 * Đơn ứng tuyển, phía SINH VIÊN.
 *
 * Mount ở `/toi/don-ung-tuyen` trong `routes.ts`, và phải khai TRƯỚC `/toi` —
 * `profileRoutes` gắn `requireAuth` cho toàn bộ nhánh đó, khai sau thì mỗi
 * request đi qua `requireAuth` của profile, không khớp route nào, rồi mới rơi
 * xuống đây và xác thực lại lần nữa. Cùng cái bẫy `/toi/tin-da-luu` đã né ở
 * Sprint 3.
 *
 * `jobId` nằm trong BODY chứ không trên đường dẫn: `/viec-lam` là nhánh DUY
 * NHẤT của dự án không cần đăng nhập, nhét một route bắt token vào đó là phá
 * đúng tính chất mà chú thích trong `routes.ts` đang giữ.
 */
export const studentApplicationRoutes = Router()

studentApplicationRoutes.use(requireAuth, requireRole('STUDENT'))

/**
 * Chặn nộp đơn dồn dập.
 *
 * Khác `POST /tin-da-luu` (không giới hạn vì idempotent — bấm mười lần vẫn ra
 * một hàng): mỗi lần gọi ở đây tạo một hàng MỚI cho một tin KHÁC. Ràng buộc
 * `@@unique` chặn trùng trên cùng một tin nhưng không chặn được việc rải đơn
 * cho toàn bộ danh mục trong mười giây.
 *
 * 30 đơn/giờ rộng rãi so với hành vi thật — sinh viên tìm việc chăm chỉ nộp
 * chừng 5–10 đơn một buổi — nhưng đủ chặn vòng lặp tự động.
 *
 * Đếm theo `userId` chứ không theo IP: cả ký túc xá dùng chung một đường mạng.
 */
const nopDonLimit = rateLimit({
  max: 30,
  windowMs: 60 * 60_000,
  keyOf: (req) => req.user?.id ?? (req.ip ?? 'unknown'),
})

studentApplicationRoutes.post('/', nopDonLimit, createApplicationController)
studentApplicationRoutes.get('/', listStudentApplicationsController)
studentApplicationRoutes.get('/:applicationId', getStudentApplicationController)
studentApplicationRoutes.delete('/:applicationId', withdrawApplicationController)

/**
 * Ứng viên của một tin, phía NHÀ TUYỂN DỤNG.
 *
 * Gắn vào `employerJobRoutes` (`/ntd/tin-tuyen-dung`) thay vì mount riêng: hai
 * endpoint này đều bắt đầu bằng "một tin của tôi", nên chúng chia sẻ đúng luật
 * truy cập của nhánh đó — `requireAuth` + `requireRole('EMPLOYER')` + kiểm chủ
 * sở hữu tin trong service.
 *
 * Router riêng ở file này chứ không viết thẳng vào `jobs.routes.ts`: controller
 * và service nằm ở module `applications`, để route ở đây thì mở một file là
 * thấy trọn cả ba tầng.
 */
export const employerApplicantRoutes = Router({ mergeParams: true })

employerApplicantRoutes.get('/', listApplicantsController)
employerApplicantRoutes.put('/:applicationId/trang-thai', updateApplicationStatusController)
