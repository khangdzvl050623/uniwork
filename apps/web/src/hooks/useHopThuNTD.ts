import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { moSocket } from '@/lib/socket'

/**
 * Hộp thư trao đổi của nhà tuyển dụng, và ba chuyển đổi họ được phép làm.
 *
 * Danh sách và nội dung hội thoại là HAI nguồn dữ liệu tách rời: danh sách qua
 * React Query (có cache, có `invalidate` sau mỗi hành động), nội dung qua
 * `useKenhHoiThoai` (socket, không cache). Gộp lại thì mỗi tin nhắn tới sẽ làm
 * bẩn cache của danh sách và kéo theo một lần gọi lại API không cần thiết.
 */

export const KHOA_HOP_THU_NTD = ['ntd', 'hop-thu'] as const
const KHOA = KHOA_HOP_THU_NTD

export interface MucHopThu {
  sessionId: string
  jobId: string | null
  tenTin: string | null
  /** "N.V.A" — hộp thư CỐ Ý không hiện tên đầy đủ, xem `handoff.service.ts`. */
  hoTenVietTat: string
  state: string
  lastMessageAt: string
}

/**
 * Sinh viên vừa chuyển một hội thoại sang → hộp thư sáng lên ngay.
 *
 * Server phát vào phòng `ntd:<employerProfileId>`; socket tự vào phòng đó lúc
 * kết nối nếu vai là EMPLOYER. Đây là tin về hội thoại CHƯA mở, nên không đi
 * qua `hoi-thoai:vao` được.
 */
function useYeuCauMoi() {
  const qc = useQueryClient()
  useEffect(() => {
    const s = moSocket()
    const moi = () => void qc.invalidateQueries({ queryKey: KHOA })
    s.on('ntd:hoi-thoai-cho', moi)
    return () => {
      s.off('ntd:hoi-thoai-cho', moi)
    }
  }, [qc])
}

export function useHopThuNTD() {
  useYeuCauMoi()

  return useQuery({
    queryKey: KHOA,
    queryFn: () => apiFetch<{ hoiThoai: MucHopThu[] }>('/api/ntd/hoi-thoai'),
    /*
     * Làm mới mỗi 60 giây.
     *
     * Socket đã lo tin nhắn của hội thoại ĐANG MỞ. Cái nó không lo là một
     * yêu cầu MỚI rơi vào hộp thư khi nhà tuyển dụng chưa mở hội thoại nào —
     * lúc đó chưa có phòng nào để mà phát. Một lần hỏi mỗi phút là đủ rẻ, và
     * đúng nhịp của việc này (không ai chờ giây trước màn hình hộp thư).
     */
    refetchInterval: 60_000,
  })
}

/** Ba chuyển đổi của nhà tuyển dụng. Mỗi cái một endpoint — xem `chat.routes.ts`. */
export function useChuyenDoiHopThu() {
  const qc = useQueryClient()

  const lamMoi = () => void qc.invalidateQueries({ queryKey: KHOA })

  const tiepNhan = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/tiep-nhan`, { method: 'POST' }),
    onSuccess: lamMoi,
  })

  const tuChoi = useMutation({
    mutationFn: ({ sessionId, lyDo }: { sessionId: string; lyDo: string }) =>
      apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/tu-choi`, {
        method: 'POST',
        body: JSON.stringify({ lyDo }),
      }),
    onSuccess: lamMoi,
  })

  const ketThuc = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/ket-thuc`, { method: 'POST' }),
    onSuccess: lamMoi,
  })

  return { tiepNhan, tuChoi, ketThuc }
}
