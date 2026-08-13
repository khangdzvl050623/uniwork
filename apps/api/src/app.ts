import express, { type Express } from 'express'

/**
 * Tạo Express app nhưng KHÔNG gọi listen.
 *
 * Tách app ra khỏi server là chuyện quan trọng hơn vẻ ngoài của nó: nhờ vậy
 * test tích hợp (Supertest ở T20) gọi thẳng vào app được, không cần mở cổng
 * thật. Mở cổng trong test sẽ làm các test chạy song song tranh nhau cổng.
 */
export function createApp(): Express {
  const app = express()

  // Express mặc định gắn header X-Powered-By: Express — khai luôn mình chạy
  // bằng gì cho người ngoài biết. Tắt đi, không có lợi ích nào bù lại.
  app.disable('x-powered-by')

  // Giới hạn kích thước body. Không đặt thì một request 500MB cũng được nhận,
  // đủ để hạ một instance 512MB RAM trên Render.
  app.use(express.json({ limit: '1mb' }))

  app.get('/', (_req, res) => {
    res.json({ name: 'UniWork API', version: '0.0.0' })
  })

  return app
}
