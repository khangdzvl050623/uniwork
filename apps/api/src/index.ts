import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'

const server = createServer(createApp())

server.listen(env.PORT, env.HOST, () => {
  logger.info('API đã khởi động', {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    url: `http://localhost:${env.PORT}/api/health`,
  })
})

/**
 * Tắt server có trật tự.
 *
 * Render gửi SIGTERM mỗi lần deploy phiên bản mới. Nếu process chết ngay lập
 * tức, các request đang xử lý dở bị cắt giữa chừng — người dùng thấy lỗi mạng.
 * server.close() ngừng nhận kết nối mới nhưng chờ request đang chạy xong.
 *
 * Hẹn giờ 10 giây là lưới an toàn: nếu có kết nối treo không chịu đóng thì vẫn
 * thoát, không để deploy đứng mãi. unref() để chính cái hẹn giờ này không giữ
 * process sống thêm.
 */
function shutdown(signal: NodeJS.Signals) {
  logger.info('Nhận tín hiệu dừng, đang đóng server', { signal })

  server.close(() => {
    // Trả kết nối database về trước khi thoát. Không làm bước này thì mỗi lần
    // Render deploy lại bỏ lại một nắm kết nối treo, phải chờ Neon tự dọn —
    // mà gói free của Neon giới hạn số kết nối rất chặt, vài lần deploy liên
    // tiếp là đủ để lần khởi động sau không xin nổi kết nối nào.
    void prisma.$disconnect().finally(() => {
      logger.info('Đã đóng server và ngắt kết nối database')
      process.exit(0)
    })
  })

  setTimeout(() => {
    logger.error('Hết thời gian chờ, buộc phải thoát')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
