import { env } from '../config/env.js'
import { hashPassword } from './password.js'
import { logger } from './logger.js'
import { prisma } from './prisma.js'

/**
 * Tự tạo một tài khoản ADMIN lúc khởi động, nếu chưa có ai.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CẦN CÁI NÀY — xem giải thích đầy đủ ở `config/env.ts` cạnh
 * `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * QUY TẮC QUAN TRỌNG NHẤT: CHỈ TẠO, KHÔNG BAO GIỜ CẬP NHẬT
 * ---------------------------------------------------------------------------
 * Render khởi động lại service ở RẤT NHIỀU tình huống — mỗi lần ngủ dậy, mỗi
 * lần deploy, mỗi lần sập rồi tự phục hồi. Nếu hàm này *cập nhật* mật khẩu mỗi
 * lần chạy, thì việc đầu tiên chủ admin làm sau khi đăng nhập — đổi mật khẩu —
 * sẽ bị xoá sạch ở lần khởi động kế tiếp, và họ không hiểu vì sao mình bị đăng
 * xuất khỏi tài khoản "vừa đổi mật khẩu xong".
 *
 * Nên: thấy email đã tồn tại là DỪNG NGAY, không đụng vào bất kỳ cột nào của
 * hàng đó — kể cả khi giá trị `ADMIN_PASSWORD` trong môi trường đã đổi khác.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO GỌI KHÔNG CHỜ (fire-and-forget) Ở `index.ts`
 * ---------------------------------------------------------------------------
 * Việc này không được phép trì hoãn `server.listen()`. Render quét cổng mở
 * ngay sau khi tiến trình chạy; server phải nghe cổng trước, còn việc tạo admin
 * chạy song song. Lỗi ở đây (Neon chưa sẵn sàng lúc cold start chẳng hạn) chỉ
 * nên ghi log, không được làm sập cả server.
 */
export async function taoAdminMacDinhNeuChua(): Promise<void> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase()

  const daCo = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (daCo) return

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD)

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      // Không cần qua luồng OTP — tài khoản này được tạo bởi chính hệ thống,
      // không phải một người lạ tự đăng ký.
      emailVerifiedAt: new Date(),
    },
  })

  logger.warn(
    'Đã tự tạo tài khoản admin mặc định. ĐỔI MẬT KHẨU NGAY qua "Quên mật khẩu" sau khi đăng nhập lần đầu — mật khẩu mặc định nằm trong mã nguồn công khai.',
    { email },
  )
}
