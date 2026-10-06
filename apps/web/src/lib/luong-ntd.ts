import { ApiClientError } from '@/lib/api'

/**
 * Id luồng đang có với nhà tuyển dụng, đọc từ lỗi "báo trùng" của `/hoi-ntd`.
 *
 * Kế hoạch nói nút trao đổi "mở hội thoại hiện có hoặc gửi yêu cầu mới". Server
 * từ chối gửi yêu cầu thứ hai — không ghi thêm lời mở đầu vào giữa cuộc trò
 * chuyện — nhưng trả kèm id luồng, để giao diện đưa người dùng tới đúng chỗ
 * thay vì để họ đứng trước một câu báo lỗi.
 */
export function luongDangCo(e: unknown): string | null {
  if (!(e instanceof ApiClientError) || e.code !== 'CONFLICT') return null
  return e.details?.sessionId?.[0] ?? null
}
