import { generateText } from 'ai'
import { aiConfig, modelChat } from './index.js'

/**
 * Gọi một lượt ngắn để xác nhận khoá và model chạy được.
 *
 * Sống ở package này chứ không ở `apps/api/scripts` vì `apps/api` KHÔNG được
 * import `ai` trực tiếp — mọi lời gọi model đi qua đây, để sau này gắn rate
 * limiter và circuit breaker vào một chỗ.
 */
export interface KetQuaKiemTra {
  ms: number
  tokenVao: number
  tokenRa: number
  traLoi: string
}

export async function kiemTraKetNoi(): Promise<KetQuaKiemTra> {
  const t0 = Date.now()
  const kq = await generateText({
    model: modelChat(),
    prompt: 'Trả lời đúng một câu ngắn: UniWork là nền tảng gì?',
    maxOutputTokens: aiConfig.maxOutputTokens,
    abortSignal: AbortSignal.timeout(aiConfig.requestTimeoutMs),
  })

  return {
    ms: Date.now() - t0,
    tokenVao: kq.usage.inputTokens ?? 0,
    tokenRa: kq.usage.outputTokens ?? 0,
    traLoi: kq.text.trim(),
  }
}
