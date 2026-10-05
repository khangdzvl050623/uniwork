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
import { aiConfig, donLuotMoCoi } from '@uniwork/ai-runtime'
import { donYeuCauQuaHan } from './modules/chat/handoff.service.js'
import { RUNNER_ID } from './modules/chat/tro-ly.service.js'
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

/*
 * Quét đóng các yêu cầu chờ quá hạn, mỗi 15 phút.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO QUÉT THEO LÔ, KHÔNG HẸN GIỜ TỪNG PHIÊN
 * ---------------------------------------------------------------------------
 * Một `setTimeout` cho mỗi yêu cầu sẽ chết theo process. Render deploy lại vài
 * lần một ngày, và mỗi lần là mọi hẹn giờ đang treo biến mất — yêu cầu nằm
 * `WAITING_EMPLOYER` vĩnh viễn, mà chỉ mục chống trùng lại chặn khi chưa
 * `CLOSED`, nên sinh viên không bao giờ hỏi lại nơi đó được nữa.
 *
 * Quét từ database thì trạng thái nằm ở database, không nằm trong bộ nhớ của
 * một process cụ thể.
 *
 * `unref()` để cái hẹn giờ này không giữ process sống lúc tắt server.
 */
const QUET_MOI_MS = 15 * 60_000

function quetQuaHan() {
  void donYeuCauQuaHan().catch((err: unknown) => {
    logger.error('Không quét được yêu cầu quá hạn', {
      message: err instanceof Error ? err.message : String(err),
    })
  })
}

quetQuaHan()
setInterval(quetQuaHan, QUET_MOI_MS).unref()

/*
 * Dọn lượt AI mồ côi, mỗi phút — và NGAY lúc khởi động.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO NHỊP NÀY KHÁC HẲN NHỊP QUÉT YÊU CẦU QUÁ HẠN (15 PHÚT)
 * ---------------------------------------------------------------------------
 * Yêu cầu quá hạn thì không ai đang chờ ngay trước màn hình. Lượt mồ côi thì
 * có: người dùng bấm hỏi và nhận 409 "đang bận" cho tới khi lượt được dọn.
 * Nên khoảng chờ tệ nhất phải tính bằng phút, không bằng phần tư giờ.
 *
 * Lần chạy lúc khởi động là lần quan trọng nhất: nó dọn đúng những lượt mà
 * process TRƯỚC bỏ lại khi chết — trường hợp phổ biến nhất của cả lỗi này.
 *
 * ---------------------------------------------------------------------------
 * NGƯỠNG TUỔI = TRẦN MỘT LƯỢT + 2 PHÚT
 * ---------------------------------------------------------------------------
 * `turnTimeoutMs` là trần cứng: SDK huỷ luồng khi chạm nó, rồi lượt được chốt
 * trong vài trăm mili giây. Một lượt còn `RESERVED` sau trần đó cộng hai phút
 * là lượt mà không còn process nào đang giữ — biên rộng để không bao giờ hoàn
 * nhầm một lượt đang ghi kết quả dở.
 */
const DON_MO_COI_MOI_MS = 60_000
const TUOI_MO_COI_MS = aiConfig.turnTimeoutMs + 2 * 60_000

function donMoCoi() {
  void donLuotMoCoi(prisma, { cuHon: new Date(Date.now() - TUOI_MO_COI_MS) }, 'MO_COI')
    .then((n) => {
      if (n > 0) logger.warn('Đã hoàn lượt AI mồ côi', { soLuot: n })
    })
    .catch((err: unknown) => {
      logger.error('Không dọn được lượt AI mồ côi', {
        message: err instanceof Error ? err.message : String(err),
      })
    })
}

donMoCoi()
setInterval(donMoCoi, DON_MO_COI_MOI_MS).unref()

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
/**
 * Luật 17: hoàn ĐÚNG những lượt AI của chính process này.
 *
 * Chạy SAU khi chờ các kết nối đóng, không phải ngay lúc nhận SIGTERM: lượt
 * nào kịp chạy xong trong khoảng chờ thì đã tự chốt, và chỉ những lượt thật
 * sự bị cắt ngang mới còn `RESERVED` để hoàn.
 *
 * Theo `runnerId`, không theo tuổi — process sắp tắt biết chắc lượt nào là
 * của mình, không cần đoán. Lượt của instance khác (nếu có) không bị đụng.
 *
 * Đây là đường NHANH. Crash cứng không đi qua đây — sweeper theo tuổi lo ca đó.
 */
async function hoanLuotCuaMinh(): Promise<void> {
  try {
    const n = await donLuotMoCoi(prisma, { runnerId: RUNNER_ID }, 'TAT_SERVER')
    if (n > 0) logger.warn('Đã hoàn lượt AI bị cắt ngang khi tắt server', { soLuot: n })
  } catch (err) {
    logger.error('Không hoàn được lượt AI khi tắt server', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

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
    void hoanLuotCuaMinh().finally(() => {
      void prisma.$disconnect().finally(() => {
        logger.info('Đã đóng server và ngắt kết nối database')
        process.exit(0)
      })
    })
  })

  setTimeout(() => {
    logger.error('Hết thời gian chờ, buộc phải thoát')
    /*
     * Ở ĐÂY mới là chỗ quan trọng: lượt AI chạy tới 180 giây, hạn chờ chỉ 10.
     * Mọi lượt còn dở lúc này sẽ bị cắt giữa chừng — nên hoàn chúng TRƯỚC khi
     * thoát, có trần 3 giây để một database chậm không giữ deploy lại mãi.
     */
    void Promise.race([hoanLuotCuaMinh(), new Promise((r) => setTimeout(r, 3_000))]).finally(
      () => process.exit(1),
    )
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
