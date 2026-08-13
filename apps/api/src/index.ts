import { createServer } from 'node:http'
import { createApp } from './app.js'
import { logger } from './lib/logger.js'

const PORT = Number(process.env.PORT ?? 4000)

// Phải bind 0.0.0.0 chứ không phải localhost. Trong container, localhost chỉ
// nghe được từ bên trong chính container đó — Render sẽ không kết nối vào được
// và báo "no open ports detected" rồi kill service.
const HOST = process.env.HOST ?? '0.0.0.0'

const server = createServer(createApp())

server.listen(PORT, HOST, () => {
  logger.info('API đã khởi động', { port: PORT, host: HOST, url: `http://localhost:${PORT}` })
})

/**
 * Tắt server có trật tự.
 *
 * Render gửi SIGTERM mỗi lần deploy phiên bản mới. Nếu process chết ngay lập
 * tức, các request đang xử lý dở bị cắt giữa chừng — người dùng thấy lỗi mạng.
 * server.close() ngừng nhận kết nối mới nhưng chờ request đang chạy xong.
 *
 * Hẹn giờ 10 giây là lưới an toàn: nếu có kết nối treo không chịu đóng thì
 * vẫn thoát, không để deploy đứng mãi. unref() để chính cái hẹn giờ này không
 * giữ process sống thêm.
 */
function shutdown(signal: NodeJS.Signals) {
  logger.info('Nhận tín hiệu dừng, đang đóng server', { signal })

  server.close(() => {
    logger.info('Đã đóng server sạch sẽ')
    process.exit(0)
  })

  setTimeout(() => {
    logger.error('Hết thời gian chờ, buộc phải thoát')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
