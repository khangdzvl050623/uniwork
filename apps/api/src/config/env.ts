import 'dotenv/config'
import { z } from 'zod'
import { logger } from '../lib/logger.js'

/**
 * Khai báo mọi biến môi trường mà app cần, kèm kiểu và giá trị mặc định.
 *
 * Nguyên tắc: **thiếu biến thì chết ngay lúc khởi động**, không chạy tiếp.
 *
 * Nếu không kiểm ở đây, một biến thiếu sẽ thành `undefined` và lặng lẽ đi sâu
 * vào code — tới lúc có người dùng thật gọi tới mới vỡ, thường là vào đúng
 * buổi demo. Chết sớm lúc khởi động thì lỗi hiện ngay trên log deploy, kèm
 * đúng tên biến bị thiếu.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Render tự chèn PORT vào môi trường, không được hardcode.
  // coerce vì mọi biến môi trường đều là chuỗi, cần ép về số.
  PORT: z.coerce.number().int().positive().default(4000),

  // Trong container phải bind 0.0.0.0, localhost sẽ không ai gọi vào được.
  HOST: z.string().min(1).default('0.0.0.0'),

  // Danh sách origin được phép gọi API, ngăn cách bằng dấu phẩy.
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // Chuỗi kết nối Postgres. CỐ TÌNH không có giá trị mặc định.
  //
  // Đặt mặc định trỏ localhost là cái bẫy: deploy lên Render mà quên khai biến
  // này thì app vẫn khởi động ngon lành, log deploy vẫn xanh, rồi mới sập lúc
  // người dùng thật bấm vào. Không mặc định thì Render báo lỗi ngay lúc build.
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
      message: 'phải là chuỗi kết nối Postgres, bắt đầu bằng postgresql://',
    }),

  // -------------------------------------------------------------- Sprint 1 --

  /*
   * Chuỗi ký JWT. CỐ TÌNH không có giá trị mặc định, và đây là chỗ tuyệt đối
   * không được nhân nhượng.
   *
   * Đặt mặc định thì ai đọc source trên GitHub cũng biết chuỗi ký, và tự ký
   * được token mạo danh bất kỳ ai — kể cả admin. Khác với DATABASE_URL (quên
   * khai thì app không chạy, lỗi lộ ngay), quên khai secret mà có mặc định thì
   * app chạy hoàn toàn bình thường, không log gì cả, và cửa hậu mở suốt.
   *
   * Sinh chuỗi: openssl rand -base64 48
   */
  JWT_ACCESS_SECRET: z.string().min(32, 'cần ít nhất 32 ký tự'),

  /*
   * Hai secret PHẢI khác nhau.
   *
   * Dùng chung một chuỗi thì access token đem đi làm refresh token được và
   * ngược lại — người dùng có thể lấy access token (nằm trong bộ nhớ trình
   * duyệt, JavaScript đọc được) rồi gọi /refresh để tự gia hạn vô thời hạn,
   * phá sạch ý nghĩa của việc cho access token hạn ngắn.
   */
  JWT_REFRESH_SECRET: z.string().min(32, 'cần ít nhất 32 ký tự'),

  /*
   * Hạn của access token. Ngắn là có chủ đích: token này không tra được vào
   * đâu để thu hồi, nên cách duy nhất giới hạn thiệt hại khi lộ là để nó hết
   * hạn nhanh. 15 phút đủ ngắn, và người dùng không thấy phiền vì web tự gọi
   * /refresh khi gặp 401.
   */
  ACCESS_TTL: z.string().default('15m'),

  /* Hạn của refresh token — cũng là thời gian tối đa không đăng nhập lại. */
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /*
   * Khoá gửi email. Không mặc định: quên khai thì phải vỡ lúc khởi động, chứ
   * không phải lúc sinh viên đầu tiên bấm "Gửi mã xác thực".
   */
  RESEND_API_KEY: z.string().min(1),

  /* Địa chỉ web, dùng ghép link trong email. */
  APP_URL: z.string().url(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  logger.error('Biến môi trường không hợp lệ, dừng khởi động', { issues })
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === 'production'

/** Tách chuỗi CORS_ORIGIN thành mảng để so khớp từng origin. */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/** Phiên bản app, hiện ra ở /api/health để biết Render đang chạy bản nào. */
export const APP_VERSION = '0.1.0'
