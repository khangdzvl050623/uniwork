import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from './auth.controller.js'

export const authRoutes = Router()

/*
 * Bốn endpoint đầu là công khai — chính chúng tạo ra phiên đăng nhập, nên không
 * thể đòi phải đăng nhập trước.
 *
 * Đường dẫn đặt tiếng Việt cho khớp với route phía web (/dang-nhap, /dang-ky),
 * trừ /refresh vì đó là thuật ngữ kỹ thuật, người dùng không bao giờ nhìn thấy.
 */
authRoutes.post('/dang-ky', registerController)
authRoutes.post('/dang-nhap', loginController)
authRoutes.post('/refresh', refreshController)
authRoutes.post('/dang-xuat', logoutController)

/* Endpoint duy nhất cần đăng nhập: hỏi "tôi là ai". */
authRoutes.get('/toi', requireAuth, meController)
