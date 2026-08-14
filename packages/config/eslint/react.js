import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import base from './base.js'

/**
 * Bộ luật cho app chạy trên trình duyệt: kế thừa base rồi thêm phần React.
 *
 * - react-hooks: bắt lỗi sai quy tắc Hooks (gọi hook trong if, thiếu dependency
 *   trong useEffect). Đây là nhóm lỗi chạy mới lộ, ESLint bắt được từ lúc viết.
 * - react-refresh: cảnh báo khi một file vừa export component vừa export thứ
 *   khác, làm hot reload phải tải lại cả trang thay vì thay mỗi component.
 */
export default [
  ...base,

  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
