import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import {
  guiTinNhanController,
  hoiController,
  layTinNhanController,
  luotConLaiController,
  taoPhienController,
} from './chat.controller.js'

/**
 * Hội thoại — tạo phiên và tải lại tin nhắn.
 *
 * Tách khỏi `/tro-ly` bên dưới vì hai nhánh có tính chất khác hẳn: nhánh này rẻ
 * và idempotent, nhánh kia tốn lượt và tốn tiền. Gộp lại thì giới hạn tần suất
 * của nhánh đắt sẽ chặn nhầm cả việc mở lại một hội thoại cũ.
 *
 * ADMIN không có trợ lý — không có dữ liệu nào của riêng họ để tra.
 */
export const hoiThoaiRoutes = Router()

hoiThoaiRoutes.use(requireAuth, requireRole('STUDENT', 'EMPLOYER'))

hoiThoaiRoutes.post('/', taoPhienController)
hoiThoaiRoutes.get('/:id/tin-nhan', layTinNhanController)
hoiThoaiRoutes.post('/:id/tin-nhan', guiTinNhanController)

/* ------------------------------------------------------------- trợ lý -- */

export const troLyRoutes = Router()

troLyRoutes.use(requireAuth, requireRole('STUDENT', 'EMPLOYER'))

/**
 * 30 lượt/phút, đếm theo `userId`.
 *
 * Đây KHÔNG phải tầng chống lạm dụng chính — tầng đó là hạn mức ngày
 * (`AI_CHAT_TURNS_PER_DAY`, mặc định 5) và nó nằm trong cùng transaction với
 * việc ghi tin. Giới hạn ở đây lo một việc khác hẳn: chặn một vòng lặp gõ vào
 * endpoint trước khi nó kịp chạm database, vì mỗi lần chạm là một transaction
 * trên Neon gói free.
 *
 * Đếm theo `userId` chứ không theo IP: cả ký túc xá dùng chung một đường mạng,
 * và endpoint này bắt buộc đăng nhập nên luôn có userId.
 */
const hoiLimit = rateLimit({
  max: 30,
  windowMs: 60_000,
  keyOf: (req) => req.user?.id ?? req.ip ?? 'unknown',
})

troLyRoutes.post('/hoi', hoiLimit, hoiController)
troLyRoutes.get('/luot-con-lai', luotConLaiController)
