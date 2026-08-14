import express, { type Express } from 'express'
import cors from 'cors'
import { corsOrigins } from './config/env.js'
import { apiRouter } from './routes.js'
import { requestLogger } from './middlewares/request-logger.js'
import { notFoundHandler } from './middlewares/not-found.js'
import { errorHandler } from './middlewares/error-handler.js'

/**
 * Tạo Express app nhưng KHÔNG gọi listen.
 *
 * Tách app ra khỏi server để test tích hợp (Supertest) gọi thẳng vào app được,
 * không cần mở cổng thật — các file test chạy song song sẽ không tranh nhau cổng.
 *
 * THỨ TỰ MIDDLEWARE DƯỚI ĐÂY LÀ CÓ CHỦ ĐÍCH. Express chạy đúng theo thứ tự khai
 * báo, đặt sai chỗ là middleware không bao giờ được gọi tới.
 */
export function createApp(): Express {
  const app = express()

  // Express mặc định gắn header X-Powered-By: Express — khai luôn mình chạy
  // bằng gì cho người ngoài biết. Tắt đi, không có lợi ích nào bù lại.
  app.disable('x-powered-by')

  // CORS phải đứng trước mọi route. Trình duyệt gửi một request OPTIONS thăm dò
  // trước khi gửi request thật; nếu route xử lý trước thì request thăm dò rơi
  // vào 404 và trình duyệt chặn luôn request thật.
  app.use(
    cors({
      origin: corsOrigins,
      // Bật để trình duyệt chịu gửi kèm cookie — refresh token sẽ nằm trong
      // cookie httpOnly ở Sprint 1.
      credentials: true,
    }),
  )

  // Giới hạn kích thước body. Không đặt thì một request 500MB cũng được nhận,
  // đủ để hạ một instance 512MB RAM trên Render.
  app.use(express.json({ limit: '1mb' }))

  app.use(requestLogger)

  app.use('/api', apiRouter)

  // Hai middleware cuối cùng, đúng thứ tự này:
  // - notFound bắt request không khớp route nào và trả JSON thay vì HTML.
  // - errorHandler phải là cái cuối cùng, vì Express chỉ chuyển lỗi tới
  //   middleware 4 tham số nằm SAU chỗ lỗi phát sinh.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
