import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Bộ luật nền, dùng cho mọi package trong repo.
 *
 * Thứ tự trong mảng rất quan trọng: config đứng sau ghi đè config đứng trước.
 * `prettier` phải nằm CUỐI CÙNG vì nhiệm vụ của nó là tắt hết các luật định dạng
 * của ESLint — để Prettier lo phần hình thức, ESLint chỉ lo phần đúng/sai.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/.turbo/**', '**/node_modules/**', '**/coverage/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Biến/tham số bắt đầu bằng _ là cố ý không dùng, đừng báo.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Cho phép console.warn/error, chặn console.log sót lại trong code.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  prettier,
)
