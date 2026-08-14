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
