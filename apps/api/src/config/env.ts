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

/**
 * Coi chuỗi RỖNG cũng là "chưa khai" — thay thẳng bằng giá trị mặc định trước
 * khi đưa vào kiểm.
 *
 * ---------------------------------------------------------------------------
 * BUG THẬT ĐÃ GẶP: `.default()` của Zod chỉ kích hoạt khi giá trị là
 * `undefined` — KHÔNG kích hoạt khi giá trị là chuỗi rỗng `''`.
 * ---------------------------------------------------------------------------
 * `.env.example` hướng dẫn "để trống thì dùng mặc định" cho vài biến (Google,
 * admin). Nhưng để trống một dòng `KEY=` trong `.env` thì `dotenv` gán
 * `process.env.KEY = ''` — một chuỗi RỖNG, không phải biến vắng mặt. Với schema
 * `z.string().email().default(...)`, chuỗi rỗng đi thẳng vào `.email()` và bị
 * từ chối — server từ chối khởi động, đúng ngay sau khi làm theo hướng dẫn của
 * chính tài liệu.
 *
 * Thử bọc bằng `z.preprocess((v) => v === '' ? undefined : v, schema.default(...))`
 * TƯỞNG là đủ nhưng KHÔNG chạy đúng — `.default()` áp lên kết quả `preprocess`
 * không kích hoạt như mong đợi. Cách chắc chắn hoạt động: `preprocess` tự thay
 * luôn giá trị mặc định, không nhờ `.default()` nữa.
 */
function chuoiCoMacDinh<T extends z.ZodTypeAny>(kiemTra: T, macDinh: string) {
  return z.preprocess((v) => (v === '' || v === undefined ? macDinh : v), kiemTra)
}
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
   * Hạn của access token. Ngắn là có chủ đích: token này không tra được vào
   * đâu để thu hồi, nên cách duy nhất giới hạn thiệt hại khi lộ là để nó hết
   * hạn nhanh. 15 phút đủ ngắn, và người dùng không thấy phiền vì web tự gọi
   * /refresh khi gặp 401.
   */
  ACCESS_TTL: z.string().default('15m'),

  /*
   * Hạn của refresh token, tính bằng ngày.
   *
   * 7 ngày, và con số này TRƯỢT THEO HOẠT ĐỘNG chứ không phải đếm từ lần đăng
   * nhập: mỗi lần refresh cấp token mới với hạn 7 ngày mới. Nên người dùng vào
   * app hàng tuần sẽ không bao giờ bị đăng xuất; chỉ ai bỏ đi trọn 7 ngày mới
   * phải đăng nhập lại.
   *
   * Lưu ý về vai trò của con số này: nó KHÔNG quyết định tốc độ thu hồi. Token
   * nằm trong database nên thu hồi là tức thì, bất kể hạn còn bao lâu — đó là
   * lý do refresh token cố ý không dùng JWT. Cái nó giới hạn là quãng thời gian
   * một token bị trộm mà chưa ai phát hiện còn dùng được. Hai lớp bảo vệ chính
   * vẫn là xoay vòng và phát hiện dùng lại, xem auth.service.ts.
   */
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /*
   * Khoá gửi email. Không mặc định: quên khai thì phải vỡ lúc khởi động, chứ
   * không phải lúc sinh viên đầu tiên bấm "Gửi mã xác thực".
   *
   * Đây là API key (dạng `xkeysib-...`), KHÔNG phải SMTP key (`xsmtpsib-...`).
   * Hai thứ khác nhau: SMTP key dùng cho giao thức SMTP cổng 587, còn ta gọi
   * REST API nên cần API key. Đưa nhầm loại thì Brevo trả 401.
   */
  BREVO_API_KEY: z.string().min(1),

  /*
   * Địa chỉ đứng tên gửi email.
   *
   * Là biến môi trường chứ không ghi cứng trong code vì hai lý do:
   *
   * - Brevo TỪ CHỐI gửi nếu địa chỉ này chưa được xác thực trong tài khoản
   *   (Settings → Senders). Mỗi người trong nhóm xác thực email của mình, nên
   *   giá trị khác nhau tuỳ máy.
   * - Đó thường là email cá nhân. Ghi cứng vào repo công khai là đem địa chỉ
   *   thật của một người đi phát cho máy quét spam.
   */
  MAIL_FROM: z.string().email('phải là một địa chỉ email hợp lệ'),

  /* Địa chỉ web, dùng ghép link trong email. */
  APP_URL: z.string().url(),

  /*
   * Địa chỉ công khai của chính API này.
   *
   * Cần vì Google OAuth bắt khai `redirect_uri` tuyệt đối, và chuỗi đó phải
   * TRÙNG KHÍT với chuỗi đã khai trong Google Cloud Console — lệch một dấu gạch
   * chéo là Google từ chối với lỗi `redirect_uri_mismatch`.
   *
   * Không suy ra được từ request: sau proxy của Render thì `req.host` là tên
   * miền nội bộ, không phải tên miền người dùng nhìn thấy.
   */
  API_URL: z.string().url().default('http://localhost:4000'),

  /*
   * Ba biến Cloudinary — nơi lưu CV thật (T56).
   *
   * CỐ TÌNH không mặc định, cùng lý do BREVO_API_KEY: đây là bí mật, và Render
   * có filesystem tạm nên không thể lưu CV lên đĩa của service — thiếu ba biến
   * này thì tính năng upload không có cách nào chạy đúng, phải chết ngay lúc
   * khởi động thay vì lộ ra lúc sinh viên đầu tiên bấm "Tải CV lên".
   */
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  /*
   * Đăng nhập Google.
   *
   * KHÁC các biến bí mật ở trên: hai biến này CÓ giá trị mặc định rỗng, và đó
   * là chủ đích. Đăng nhập Google là tính năng THÊM — thiếu khoá thì chỉ nút
   * "Đăng nhập bằng Google" biến mất, còn đăng nhập bằng mật khẩu vẫn chạy
   * bình thường. Bắt buộc phải có sẽ khiến cả nhóm không chạy được dự án chỉ
   * vì chưa ai tạo project trên Google Cloud.
   *
   * Ngược lại, JWT_ACCESS_SECRET mà thiếu thì không có gì chạy được cả — nên
   * biến đó không có mặc định.
   */
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  /*
   * Tài khoản admin tự tạo lúc khởi động, nếu chưa có ai (xem lib/bootstrap-admin.ts).
   *
   * ---------------------------------------------------------------------------
   * VÌ SAO CẦN CÁI NÀY
   * ---------------------------------------------------------------------------
   * Không có đường nào khác tạo được tài khoản ADMIN trên production: form đăng
   * ký công khai cố ý chỉ nhận vai STUDENT/EMPLOYER, và `prisma/seed.ts` bỏ qua
   * mọi tài khoản demo khi `DATABASE_URL` không trỏ vào máy local. Gói free của
   * Render lại không có Shell để tự chạy script tay. Không có cơ chế này thì
   * production vĩnh viễn không admin nào đăng nhập được.
   *
   * ---------------------------------------------------------------------------
   * CẢNH BÁO BẢO MẬT — ĐÂY LÀ ĐÁNH ĐỔI CÓ CHỦ Ý, KHÔNG PHẢI SƠ SUẤT
   * ---------------------------------------------------------------------------
   * Giá trị mặc định bên dưới nằm trong mã nguồn của một repo GitHub PUBLIC —
   * bất kỳ ai cũng đọc được. Đổi mật khẩu qua "Quên mật khẩu" NGAY sau lần đăng
   * nhập đầu tiên trên production. Muốn an toàn hơn ngay từ đầu thì khai đè hai
   * biến này trên Render Dashboard trước khi service chạy lần đầu.
   */
  ADMIN_EMAIL: chuoiCoMacDinh(z.string().email(), 'AdminUniWork@gmail.com'),
  ADMIN_PASSWORD: chuoiCoMacDinh(z.string().min(1), 'admin@123'),
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
