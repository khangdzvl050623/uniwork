import base from '@uniwork/config/eslint/base'

export default [
  ...base,
  {
    // Script chạy tay ở terminal, không phải code chạy trong server.
    //
    // Quy tắc no-console tồn tại để ép code server dùng logger có cấu trúc,
    // nhờ vậy log trên Render mới lọc và tìm kiếm được. Seed thì ngược lại:
    // người đọc là bạn, đang ngồi nhìn terminal, nên console.log mới đúng —
    // gói nó vào JSON log chỉ làm khó đọc hơn.
    files: ['prisma/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]
