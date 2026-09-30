import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth.js'
import { rateLimit } from '../../middlewares/rate-limit.js'
import {
  chuyenNTDController,
  guiTinNhanController,
  hangDoiHoTroController,
  hopThuNTDController,
  huyChoController,
  huyYeuCauHoTroController,
  ketThucController,
  hoiController,
  layTinNhanController,
  luotConLaiController,
  quayLaiAiController,
  taoPhienController,
  tiepNhanController,
  tiepNhanHoTroController,
  tuChoiYeuCauController,
  yeuCauHoTroController,
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

/*
 * ADMIN CÓ trong danh sách này, và đó không phải nới lỏng.
 *
 * Admin vừa tiếp nhận một ticket hỗ trợ thì phải đọc và trả lời được —
 * `GET /:id/tin-nhan`, `POST /:id/tin-nhan`, `POST /:id/ket-thuc`. Chặn ở đây
 * là họ nhận xong rồi ngồi nhìn.
 *
 * Cửa thật vẫn là `quyenTruyCapPhien`: nó chỉ cấp quyền cho ADMIN ở phiên
 * `AI_SUPPORT`, và trả `null` cho mọi hội thoại sinh viên–nhà tuyển dụng (có
 * test canh). Các chuyển đổi chỉ dành cho một vai thì tự khai `requireRole`
 * của riêng chúng ở dưới.
 */
hoiThoaiRoutes.use(requireAuth, requireRole('STUDENT', 'EMPLOYER', 'ADMIN'))

/*
 * Hai trần tần suất cho nhánh này.
 *
 * Chúng là LƯỚI, không phải lớp chính — lớp chính là chỉ mục một phần
 * `chat_mot_handoff_moi_ntd`. Nhưng handoff KHÔNG gọi model nên hạn mức ngày
 * (AI_CHAT_TURNS_PER_DAY) không chạm tới đường này, và mỗi lần chạm đều là một
 * transaction trên Neon gói free.
 *
 * Đếm theo `userId` chứ không theo IP: cả ký túc xá dùng chung một đường mạng.
 */
const taoPhienLimit = rateLimit({
  max: 20,
  windowMs: 60 * 60_000,
  keyOf: (req) => req.user?.id ?? req.ip ?? 'unknown',
})

const chuyenLimit = rateLimit({
  max: 10,
  windowMs: 60 * 60_000,
  keyOf: (req) => req.user?.id ?? req.ip ?? 'unknown',
})

/* ADMIN là bên HỖ TRỢ, không phải bên dùng trợ lý — không tạo phiên. */
hoiThoaiRoutes.post('/', requireRole('STUDENT', 'EMPLOYER'), taoPhienLimit, taoPhienController)
hoiThoaiRoutes.get('/:id/tin-nhan', layTinNhanController)
hoiThoaiRoutes.post('/:id/tin-nhan', guiTinNhanController)

/*
 * Năm chuyển đổi của máy trạng thái handoff.
 *
 * Vai kiểm ở ROUTE chứ không ở service: sinh viên không "tiếp nhận" được, nhà
 * tuyển dụng không "huỷ chờ" được. Đặt ở đây thì đọc bảng route là thấy ngay
 * ai làm được gì, không phải lần vào từng hàm.
 *
 * `ket-thuc` là ngoại lệ duy nhất — cả hai bên đều đóng được, và service tự
 * phân biệt ai đóng để ghi đúng câu vào tin hệ thống.
 */
hoiThoaiRoutes.post('/:id/chuyen-ntd', chuyenLimit, requireRole('STUDENT'), chuyenNTDController)
hoiThoaiRoutes.post('/:id/huy-cho', requireRole('STUDENT'), huyChoController)
hoiThoaiRoutes.post('/:id/quay-lai-ai', requireRole('STUDENT'), quayLaiAiController)
hoiThoaiRoutes.post('/:id/tiep-nhan', requireRole('EMPLOYER'), tiepNhanController)
hoiThoaiRoutes.post('/:id/tu-choi', requireRole('EMPLOYER'), tuChoiYeuCauController)
hoiThoaiRoutes.post('/:id/ket-thuc', ketThucController)

/*
 * Kênh hỗ trợ. Cả hai vai đều mở được — nhà tuyển dụng cũng cần hỗ trợ.
 *
 * `yeu-cau-ho-tro` KHÔNG gọi model và KHÔNG giữ lượt: người dùng hết 5 lượt
 * hỏi trợ lý vẫn phải xin được người thật, nếu không thì đúng lúc họ cần giúp
 * nhất lại là lúc cửa đóng.
 */
hoiThoaiRoutes.post('/:id/yeu-cau-ho-tro', chuyenLimit, yeuCauHoTroController)
hoiThoaiRoutes.post('/:id/huy-ho-tro', huyYeuCauHoTroController)

/* Hop thu cua NTD — mount rieng o /api/ntd/hoi-thoai trong routes.ts. */
export const hopThuNTDRoutes = Router()
hopThuNTDRoutes.use(requireAuth, requireRole('EMPLOYER'))

/* ------------------------------------------------------ hàng đợi hỗ trợ -- */

/**
 * Hàng đợi hỗ trợ của admin — mount ở `/api/admin/ho-tro`.
 *
 * `tiep-nhan` nằm ở đây chứ không ở `hoiThoaiRoutes`: nhánh kia chặn ADMIN
 * ngay từ `requireRole('STUDENT', 'EMPLOYER')`. Tách router theo vai thì đọc
 * là thấy, không phải lần vào từng handler.
 */
export const adminHoTroRoutes = Router()
adminHoTroRoutes.use(requireAuth, requireRole('ADMIN'))
adminHoTroRoutes.get('/', hangDoiHoTroController)
adminHoTroRoutes.post('/:id/tiep-nhan', tiepNhanHoTroController)
hopThuNTDRoutes.get('/', hopThuNTDController)

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
