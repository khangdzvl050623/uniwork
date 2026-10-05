import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { CO_KHOA_THAT, aiConfig } from './config.js'

/**
 * Nơi DUY NHẤT tạo ra model instance.
 *
 * Mọi lời gọi tới nhà cung cấp đi qua đây, để sau này gắn rate limiter và
 * circuit breaker vào một chỗ thay vì rải khắp code.
 */

let cache: LanguageModel | null = null

/**
 * Model cho chat.
 *
 * Ném lỗi khi chưa cấu hình khoá — nơi gọi phải kiểm `CO_KHOA_THAT` trước và
 * trả 503 cho người dùng, chứ không để lỗi này nổi lên thành 500.
 */
export function modelChat(): LanguageModel {
  // Cache có trước khi kiểm khoá chỉ khi test đã gắn mạng giả (`_datMangGia`):
  // đường thật chỉ ghi cache SAU khi qua được lần kiểm bên dưới.
  if (cache) return cache

  if (!CO_KHOA_THAT) {
    throw new Error(
      'Chưa cấu hình GOOGLE_GENERATIVE_AI_API_KEY. ' +
        'Kiểm `CO_KHOA_THAT` trước khi gọi modelChat().',
    )
  }

  // Tạo một lần rồi dùng lại: provider giữ sẵn kết nối HTTP bên trong, tạo mới
  // mỗi request là bỏ phí connection pool đó.
  cache = dungModel(aiConfig.googleApiKey, globalThis.fetch)
  return cache
}

/** Cách dựng DUY NHẤT — đường chạy thật và test đi qua cùng một hàm. */
function dungModel(apiKey: string, mang: typeof fetch): LanguageModel {
  return createGoogleGenerativeAI({ apiKey, fetch: mang })(aiConfig.chatModel)
}

/** Chỉ dùng trong test — xoá cache giữa các ca. */
export function resetProviderCache(): void {
  cache = null
}

/**
 * Chỉ dùng trong test — model Google THẬT, chỉ thay lớp mạng.
 *
 * Giả cả model (`MockLanguageModel`) thì test chỉ chứng minh được điều ta TIN
 * về AI SDK. Mạch ngắt từng hỏng đúng chỗ đó: ta tin 429 được ném ra, còn AI
 * SDK thật thì gói nó vào stream. Thay lớp mạng thì mọi tầng phía trên — Google
 * provider, `streamText`, cách lỗi đi qua stream — đều là bản thật.
 */
export function _datMangGia(mang: typeof fetch): void {
  cache = dungModel('khoa-gia-cho-test', mang)
}
