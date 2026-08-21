import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Test cho phía web.
 *
 * `happy-dom` thay vì `jsdom`: nhanh hơn đáng kể và đủ dùng cho những gì test ở
 * đây (sự kiện bàn phím, dán, focus). Thứ jsdom hơn — dựng layout, đo kích
 * thước — không có test nào cần.
 */
export default defineConfig({
  resolve: {
    // Phải khai lại alias `@` ở đây: vitest.config.ts không đọc vite.config.ts,
    // nên thiếu dòng này thì mọi import '@/...' trong test đều không phân giải được.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Dọn DOM giữa các ca test. Không có thì component của ca trước còn nằm lại
    // và `getByRole` tìm thấy hai kết quả rồi báo lỗi rất khó hiểu.
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
