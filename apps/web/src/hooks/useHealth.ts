import { useQuery } from '@tanstack/react-query'
import type { HealthResponse } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

/**
 * Gọi /api/health để biết backend có sống không.
 *
 * Đây cũng là cú "đánh thức sớm": Render free ngủ sau 15 phút và mất tới ~50
 * giây để dậy. Gọi ngay lúc web vừa mở thì instance kịp khởi động trong lúc
 * người dùng còn đang đọc trang chủ, thay vì đợi tới khi họ bấm tìm việc.
 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/api/health'),

    // Chỉ hỏi lại sau 30 giây, không cần biết liên tục.
    staleTime: 30_000,

    // Lần gọi đầu sau khi Render ngủ dậy rất hay timeout. Kiên nhẫn hơn mặc
    // định vì đây chính là lúc cần đánh thức server.
    retry: 3,
  })
}
