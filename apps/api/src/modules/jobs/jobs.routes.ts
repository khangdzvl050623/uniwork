import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import {
  createJobController,
  getMyJobController,
  listMyJobsController,
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
