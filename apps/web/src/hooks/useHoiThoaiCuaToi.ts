import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/**
 * Hội thoại của CHÍNH người đang đăng nhập.
 *
 * Khác hẳn `useHopThuNTD`: cái kia liệt kê hội thoại của NGƯỜI KHÁC mà nhà
 * tuyển dụng được mời vào. Một tài khoản EMPLOYER có cả hai, và hai danh sách
 * đó có quyền đọc khác nhau — nên hai hook, hai khoá cache.
 */

export const KHOA_HOI_THOAI_CUA_TOI = ['hoi-thoai', 'cua-toi'] as const

export type LoaiKenh = 'AI_STUDENT' | 'AI_EMPLOYER' | 'AI_SUPPORT' | 'NTD'

export interface MucHoiThoaiCuaToi {
  sessionId: string
  kind: LoaiKenh
  state: string
  jobId: string | null
  tenTin: string | null
  /** Nơi đã nhận handoff. `null` khi hội thoại chưa chuyển đi đâu. */
  congTy: string | null
  tinCuoi: string | null
  /** Chỉ luồng `NTD`: mình đã chặn nhà tuyển dụng này. */
  daChan: boolean
  lastMessageAt: string
}

export function useHoiThoaiCuaToi() {
  return useQuery({
    queryKey: KHOA_HOI_THOAI_CUA_TOI,
    queryFn: () => apiFetch<{ hoiThoai: MucHoiThoaiCuaToi[] }>('/api/hoi-thoai'),
  })
}
