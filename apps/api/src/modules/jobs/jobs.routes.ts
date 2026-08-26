import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import {
  closeJobController,
  createJobController,
  deleteJobController,
  getMyJobController,
  getPublicJobController,
  listJobsForAdminController,
  listPublicJobsController,
  listMyJobsController,
  listSavedJobsController,
  reviewJobController,
  saveJobController,
  submitJobController,
  unsaveJobController,
  updateJobController,
} from './jobs.controller.js'

/**
 * Tin tuyển dụng, phía NHÀ TUYỂN DỤNG quản lý tin của chính mình.
 *
 * Mount ở `/ntd/tin-tuyen-dung`. Hai nhánh còn lại trên cùng bảng `Job` —
 * admin duyệt và trang công khai — sẽ có router riêng trong file này ở T77 và
 * T79, vì chúng có luật truy cập khác hẳn.
 */
export const employerJobRoutes = Router()

employerJobRoutes.use(requireAuth, requireRole('EMPLOYER'))

/**
 * Chặn tạo tin dồn dập.
 *
 * Mối lo thật ở đây KHÔNG phải kẻ tấn công — tạo tin đòi vai EMPLOYER, mà đăng
 * ký nhà tuyển dụng phải qua OTP email nên không ẩn danh. Thứ dễ xảy ra hơn
 * nhiều là bug của chính mình: người dùng bấm "Lưu nháp" hai lần, hoặc một vòng
 * retry gọi lại POST liên tục. Đó mới là thứ tạo ra 200 tin rác trong 5 phút.
 *
 * Cố ý KHÔNG đặt giới hạn "tối đa N tin nháp": nó không chặn được double-submit
 * (N=20 thì vẫn tạo được 20 rác) lại chặn oan nhà tuyển dụng nhiều chi nhánh
 * soạn sẵn 25 tin. Giới hạn theo NHỊP ĐỘ mới đúng với nguyên nhân.
 *
 * Đếm theo `userId` chứ không theo IP: một quán có nhiều nhân viên đăng tin từ
 * cùng một mạng wifi không nên chặn nhầm nhau.
 */
const taoTinLimit = rateLimit({
  max: 20,
  windowMs: 60 * 60_000,
  keyOf: (req) => req.user?.id ?? (req.ip ?? 'unknown'),
})

employerJobRoutes.post('/', taoTinLimit, createJobController)

// Đọc thì không giới hạn nhịp — chỉ thao tác GHI mới có nguy cơ tạo rác.
employerJobRoutes.get('/', listMyJobsController)
employerJobRoutes.get('/:id', getMyJobController)
employerJobRoutes.put('/:id', updateJobController)
employerJobRoutes.delete('/:id', deleteJobController)

// Dong tin la duong DUNG de go mot tin da duyet xuong — xem closeJob().
employerJobRoutes.post('/:id/dong', closeJobController)

// Gui duyet: DRAFT -> PENDING. Doi NTD da duoc xac minh, xem submitJob().
employerJobRoutes.post('/:id/gui-duyet', submitJobController)

/**
 * Duyệt tin — phía ADMIN.
 *
 * Router riêng vì luật truy cập khác hẳn nhánh của NTD ở trên: KHÔNG kiểm chủ
 * sở hữu (admin duyệt tin của mọi người), đổi lại đòi vai ADMIN. Cùng một bảng
 * `Job`, hai thế giới khác nhau — và đó là lý do không gộp hai router làm một
 * rồi phân nhánh bằng `if` bên trong controller.
 *
 * Mount ở `/admin/tin-tuyen-dung` trong `routes.ts`.
 */
export const adminJobRoutes = Router()

adminJobRoutes.use(requireAuth, requireRole('ADMIN'))

adminJobRoutes.get('/', listJobsForAdminController)
adminJobRoutes.put('/:id/duyet', reviewJobController)

/**
 * Việc làm — bản CÔNG KHAI.
 *
 * KHÔNG có `requireAuth`, và đó là chủ đích: người chưa đăng nhập phải xem
 * được danh sách việc làm, nếu không thì trang chủ chẳng có gì để xem và cũng
 * không ai có lý do đăng ký.
 *
 * Đổi lại, toàn bộ lớp bảo vệ dồn vào điều kiện `status: 'OPEN'` trong service.
 * Không bao giờ để người gọi truyền `status` vào hai endpoint này.
 *
 * Mount ở `/viec-lam` trong `routes.ts`.
 */
export const publicJobRoutes = Router()

publicJobRoutes.get('/', listPublicJobsController)
publicJobRoutes.get('/:id', getPublicJobController)

/**
 * Tin đã lưu — dấu trang của SINH VIÊN.
 *
 * Router thứ tư trên cùng bảng `Job`, và cũng có luật truy cập riêng: đòi vai
 * `STUDENT` (nhà tuyển dụng không có "tin đã lưu"), và mọi thao tác đều ngầm
 * giới hạn trong hồ sơ của chính người gọi — `studentProfileId` lấy từ token,
 * không bao giờ nhận từ body.
 *
 * KHÔNG bọc `rateLimit`: khác `POST /` tạo tin, thao tác ở đây là idempotent.
 * Bấm mười lần vẫn ra đúng một hàng, nên không có rác nào để chặn.
 *
 * Mount ở `/toi/tin-da-luu` trong `routes.ts`.
 */
export const savedJobRoutes = Router()

savedJobRoutes.use(requireAuth, requireRole('STUDENT'))

savedJobRoutes.get('/', listSavedJobsController)
savedJobRoutes.post('/:jobId', saveJobController)
savedJobRoutes.delete('/:jobId', unsaveJobController)
