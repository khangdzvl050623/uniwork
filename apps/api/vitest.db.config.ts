import { defineConfig } from 'vitest/config'

/**
 * Làn test thứ hai — chạy trên PostgreSQL THẬT.
 *
 * Tách khỏi `vitest.config.ts` là cố ý. Bộ test chính giả lập Prisma để chạy
 * được ở mọi nơi kể cả khi không có database nào; đổi lại nó mù hoàn toàn với
 * những thứ chỉ Postgres mới biết — CHECK constraint, khoá ngoại, ràng buộc
 * unique. Gộp chung thì mỗi lập trình viên quên bật Docker sẽ thấy CI đỏ vì lý
 * do chẳng liên quan gì tới code của mình, và rất nhanh sẽ học được thói quen
 * bỏ qua CI đỏ.
 *
 * Chạy: `pnpm test:db` (cần `pnpm db:up` và `pnpm db:seed` trước).
 *
 * Làn này CỐ Ý gãy to khi không có database, không im lặng bỏ qua. Test tự bỏ
 * qua khi thiếu điều kiện là loại tệ nhất: nó biến CI xanh thành lời nói dối.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test-db/**/*.test.ts'],

    // Các test này dùng chung một database, chạy song song thì chúng giẫm lên
    // dữ liệu của nhau.
    fileParallelism: false,

    // Test nạp lại seed tốn vài giây vì phải băm mật khẩu bằng Argon2.
    testTimeout: 120_000,
  },
})
