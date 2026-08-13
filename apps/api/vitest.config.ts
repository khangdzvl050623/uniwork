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
    },
  },
})
