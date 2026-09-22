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
  if (!CO_KHOA_THAT) {
    throw new Error(
      'Chưa cấu hình GOOGLE_GENERATIVE_AI_API_KEY. ' +
        'Kiểm `CO_KHOA_THAT` trước khi gọi modelChat().',
    )
  }

  // Tạo một lần rồi dùng lại: provider giữ sẵn kết nối HTTP bên trong, tạo mới
  // mỗi request là bỏ phí connection pool đó.
  cache ??= createGoogleGenerativeAI({ apiKey: aiConfig.googleApiKey })(aiConfig.chatModel)
  return cache
}

/** Chỉ dùng trong test — xoá cache giữa các ca. */
export function resetProviderCache(): void {
  cache = null
}
