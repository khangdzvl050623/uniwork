import { prisma } from '../src/lib/prisma.js'
import { hashPassword } from '../src/lib/password.js'

/**
 * Tạo (hoặc thăng cấp) một tài khoản ADMIN.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CẦN SCRIPT RIÊNG — KHÔNG CÓ ĐƯỜNG NÀO KHÁC TẠO ĐƯỢC ADMIN
 * ---------------------------------------------------------------------------
 * `POST /api/auth/dang-ky` chỉ nhận `role` trong `SIGNUP_ROLES` (STUDENT hoặc
 * EMPLOYER) — cố ý, vì để form đăng ký công khai tự nhận vai ADMIN là giao
 * quyền quản trị cho bất kỳ ai gõ đúng URL.
 *
 * `prisma/seed.ts` có tạo tài khoản admin demo, nhưng chỉ khi `DATABASE_URL`
 * trỏ vào máy local (`laDatabaseNoiBo()`) — trên Neon production thì seed
 * dừng lại sau khi nạp danh mục kỹ năng, không đụng gì tới tài khoản. Nghĩa là
 * **production không có admin nào cho tới khi ai đó chạy đúng script này**.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CHẠY QUA `tsx`, KHÔNG PHẢI QUA MỘT ENDPOINT API
 * ---------------------------------------------------------------------------
 * Dựng thêm một endpoint `POST /api/admin/tao` chỉ để dùng đúng một lần lúc
 * khởi tạo hệ thống là thêm bề mặt tấn công sống mãi mãi. Chạy script tay thì
 * không có URL nào tồn tại để ai đó dò ra.
 *
 * ---------------------------------------------------------------------------
 * CHẠY Ở ĐÂU — KHÔNG PHẢI RENDER SHELL
 * ---------------------------------------------------------------------------
 * Gói free của Render không có Shell/SSH (đã xác nhận thật khi thử: "Free
 * instances... do not support SSH access"). Tài khoản admin ĐẦU TIÊN không cần
 * script này nữa — server tự tạo lúc khởi động nếu chưa có, xem
 * `src/lib/bootstrap-admin.ts` và biến `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
 *
 * Script này giờ chỉ còn dùng để tạo THÊM admin khác, hoặc đổi vai trò một tài
 * khoản có sẵn thành ADMIN, chạy từ máy local — trỏ `DATABASE_URL` trong
 * `apps/api/.env` vào đúng database muốn sửa (Neon production hoặc local đều
 * được, tuỳ bạn đổi giá trị trong file đó trước khi chạy):
 *
 *   pnpm --filter @uniwork/api db:tao-admin -- ten@email.com "MatKhauManh123"
 *
 * Idempotent: chạy lại với cùng email chỉ cập nhật mật khẩu/vai trò của đúng
 * người đó, không tạo trùng, không đụng tài khoản khác.
 */
async function main() {
  /*
   * Lọc bỏ mọi dấu "--" trong tham số.
   *
   * `pnpm run <script> -- a b` đôi khi chuyển tiếp CẢ dấu "--" vào argv thay vì
   * chỉ dùng nó để tách tham số của pnpm khỏi tham số của script (khác hành vi
   * của npm) — tuỳ phiên bản. Không lọc thì "--" bị hiểu nhầm là email.
   */
  const [email, password] = process.argv.slice(2).filter((arg) => arg !== '--')

  if (!email || !password) {
    console.error('Dùng: tsx scripts/tao-admin.ts <email> <mat-khau>')
    console.error('Ví dụ: tsx scripts/tao-admin.ts admin@uniwork.dev "MatKhauManh123"')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Mật khẩu cần ít nhất 8 ký tự — khớp luật ở packages/shared/src/validation.ts')
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: 'ADMIN', passwordHash },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      // Admin không cần đi qua luồng OTP xác thực email — người tự tay chạy
      // script này (có quyền sửa trực tiếp database) đã là người có quyền cao
      // nhất rồi.
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true, role: true },
  })

  console.log('Đã sẵn sàng tài khoản admin:')
  console.log(`  email: ${user.email}`)
  console.log(`  role:  ${user.role}`)
  console.log(`  id:    ${user.id}`)
}

main()
  .catch((err) => {
    console.error('Lỗi:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
