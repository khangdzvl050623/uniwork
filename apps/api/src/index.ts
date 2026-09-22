/*
 * Nạp .env ở DÒNG ĐẦU TIÊN của process, trước mọi import khác.
 *
 * `config/env.ts` cũng gọi `dotenv/config`, nhưng `packages/ai-runtime` CỐ Ý
 * không import nó (worker sẽ dùng chung package đó và không được import code
 * của api) — nó đọc thẳng `process.env` lúc nạp module. Tức thứ tự nạp quyết
 * định nó thấy hay không thấy giá trị trong .env.
 *
 * Hôm nay thứ tự đang đúng nhờ `app.ts` tình cờ import `config/env.js` trước
 * `routes.js`. Đó là một sự tình cờ, và nó hỏng theo kiểu tệ nhất: đảo hai dòng
 * import trong app.ts là AI_CHAT_TURNS_PER_DAY trong .env bị bỏ qua, rơi về mặc
 * định, và KHÔNG có lỗi nào bắn ra. Dòng này khoá lại chuyện đó.
 */
import 'dotenv/config'
import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { taoAdminMacDinhNeuChua } from './lib/bootstrap-admin.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'
import { ganSocketIO, goSocketIO } from './modules/chat/socket.gateway.js'

const server = createServer(createApp())

/*
 * Socket.IO dùng CHUNG cổng với HTTP.
 *
 * Bắt buộc trên Render gói free: một Web Service chỉ mở được đúng một cổng. Và
 * nó cũng đúng cho local — cùng một origin thì không phải nới thêm CORS, và
 * không phải nhớ hai số cổng.
 */
const io = ganSocketIO(server)

server.listen(env.PORT, env.HOST, () => {
  logger.info('API đã khởi động', {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    url: `http://localhost:${env.PORT}/api/health`,
  })
})

/*
 * KHÔNG await ở đây — xem giải thích đầy đủ trong bootstrap-admin.ts.
 * Server phải nghe cổng ngay, không được đợi việc này xong.
 */
void taoAdminMacDinhNeuChua().catch((err: unknown) => {
  logger.error('Không tự tạo được tài khoản admin mặc định', {
    message: err instanceof Error ? err.message : String(err),
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

  /*
   * Đóng Socket.IO TRƯỚC `server.close()`.
   *
   * `server.close()` chờ mọi kết nối đóng, mà WebSocket là kết nối SỐNG MÃI —
   * không đóng chúng thì nó chờ tới khi hết 10 giây rồi bị `process.exit(1)`.
   * Deploy nào cũng thoát bằng mã lỗi, và log đầy "Hết thời gian chờ".
   *
   * `goSocketIO()` gỡ bộ phát trước, để một tin nhắn đang commit dở không bắn
   * vào một `io` vừa đóng.
   */
  goSocketIO()
  void io.close()

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
