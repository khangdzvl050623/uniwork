import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from './notifications.controller.js'

/**
 * Thông báo của chính người đang đăng nhập.
 *
 * Mount ở ĐÚNG MỘT chỗ: `/toi/thong-bao`. Bản đầu có ba tiền tố
 * (`/toi/thong-bao`, `/thong-bao`, `/notifications`) nhân đôi PUT/PATCH — sáu
 * đường vào cùng một hàm. Lý do ghi là "để client tích hợp ngoài không phải
 * biết tên tiếng Việt", nhưng dự án KHÔNG có client ngoài nào. Mỗi bí danh là
 * một bề mặt phải nhớ khi đổi quyền, đổi giới hạn nhịp, hay ghi tài liệu — và
 * là một chỗ để quên.
 *
 * `/toi` là quy ước sẵn có cho "dữ liệu của chính tôi", cùng nhóm với
 * `/toi/tin-da-luu` và `/toi/don-ung-tuyen`.
 *
 * PHẢI khai trước `/toi` trong `routes.ts` — `profileRoutes` gắn `requireAuth`
 * cho toàn bộ nhánh đó; cùng cái bẫy đã né hai lần trước.
 */
export const notificationRoutes = Router()

notificationRoutes.use(requireAuth)

notificationRoutes.get('/', listNotificationsController)

/* Khai `/da-doc-het` TRƯỚC `/:id/da-doc`: Express so khớp theo thứ tự, khai sau
   thì "da-doc-het" lọt vào `:id` và biến thành một id không tồn tại. */
notificationRoutes.put('/da-doc-het', markAllNotificationsReadController)
notificationRoutes.put('/:id/da-doc', markNotificationReadController)
