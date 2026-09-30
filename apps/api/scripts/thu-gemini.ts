/**
 * Kiểm nhanh: khoá Gemini có chạy không, model nào, tốn bao nhiêu token.
 *
 * Chạy:  pnpm --filter @uniwork/api thu-gemini
 *
 * KHÔNG phải test tự động — nó gọi mạng thật và tốn quota. Chạy tay khi cần
 * xác nhận cấu hình, không đưa vào CI.
 */
import 'dotenv/config'
import { CO_KHOA_THAT, aiConfig, kiemTraKetNoi, ngayPacific, ngayVN } from '@uniwork/ai-runtime'

if (!CO_KHOA_THAT) {
  console.error(`
Chưa có GOOGLE_GENERATIVE_AI_API_KEY trong apps/api/.env

  1. Lấy khoá: https://aistudio.google.com/apikey
  2. Thêm vào apps/api/.env:
     GOOGLE_GENERATIVE_AI_API_KEY=AIza...
`)
  process.exit(1)
}

console.log(`model   : ${aiConfig.chatModel}`)
console.log(`ngày VN : ${ngayVN()}    ← quota người dùng reset theo mốc này`)
console.log(`ngày PT : ${ngayPacific()}    ← hạn mức Google reset theo mốc này`)
console.log('')

const kq = await kiemTraKetNoi()
console.log(`✓ ${kq.ms} ms · ${kq.tokenVao} token vào / ${kq.tokenRa} ra`)
console.log(`  ${kq.traLoi}`)
