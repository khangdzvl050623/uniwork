import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Chạy trên Node chứ không phải môi trường trình duyệt giả lập — đây là
    // backend, không có DOM.
    environment: 'node',

    // Tìm test đặt cạnh code (*.test.ts) thay vì gom vào một thư mục riêng.
    // Ở cạnh nhau thì sửa service là thấy ngay file test của nó.
    include: ['src/**/*.test.ts'],

    // Biến môi trường cho lúc test: cố định để kết quả không đổi theo máy.
    env: {
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',

      /*
       * Sáu biến của Sprint 1. Giá trị giả, nhưng BẮT BUỘC phải có.
       *
       * Test có đường import `health.test.ts → app.ts → config/env.js`, nên
       * chạy test là `env.ts` được nạp thật và nó `process.exit(1)` khi thiếu
       * biến bắt buộc. Thiếu khối này thì CI đỏ dù code hoàn toàn đúng, và
       * thông báo lỗi nằm lẫn trong log rất khó lần ra.
       *
       * Đặt ở đây chứ không ở ci.yml để chạy trên máy và chạy trên CI giống
       * hệt nhau — không có cảnh "máy tôi xanh mà CI đỏ".
       */
      JWT_ACCESS_SECRET: 'test-access-secret-khong-dung-that-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-khac-han-cai-tren-0123456789',
      ACCESS_TTL: '15m',
      REFRESH_TTL_DAYS: '30',
      BREVO_API_KEY: 'test-key',
      APP_URL: 'http://localhost:5173',
      MAIL_FROM: 'test@example.com',
    },
  },
})
