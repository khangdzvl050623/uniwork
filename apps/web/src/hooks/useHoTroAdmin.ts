import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { moSocket } from '@/lib/socket'

/** Hàng đợi hỗ trợ của admin, và hai hành động họ được phép làm trên đó. */

const KHOA = ['admin', 'ho-tro'] as const

export interface MucHangDoiHoTro {
  sessionId: string
  /** Vai của NGƯỜI XIN hỗ trợ — sinh viên hay nhà tuyển dụng cần hai giọng khác nhau. */
  ownerVai: string
  state: string
  /** Câu người dùng mô tả lúc bấm xin hỗ trợ. `null` nếu họ để trống. */
  moTaDau: string | null
  handoffRequestedAt: string | null
  lastMessageAt: string
}

/**
 * Yêu cầu hỗ trợ mới → làm mới hàng đợi ngay.
 *
 * Server phát vào phòng `admin:ho-tro`, và socket tự vào phòng đó lúc kết nối
 * nếu vai là ADMIN (xem `socket.gateway.ts`). Không cần `hoi-thoai:vao` vì
 * đây là tin về hội thoại CHƯA mở.
 *
 * Vẫn giữ `refetchInterval` song song: socket rớt thì hàng đợi chỉ chậm 30
 * giây, không chết hẳn.
 */
function useYeuCauMoi() {
  const qc = useQueryClient()
  useEffect(() => {
    const s = moSocket()
    const moi = () => void qc.invalidateQueries({ queryKey: KHOA })
    s.on('ho-tro:yeu-cau-moi', moi)
    return () => {
      s.off('ho-tro:yeu-cau-moi', moi)
    }
  }, [qc])
}

export function useHangDoiHoTro() {
  useYeuCauMoi()

  return useQuery({
    queryKey: KHOA,
    queryFn: () => apiFetch<{ hoTro: MucHangDoiHoTro[] }>('/api/admin/ho-tro'),
    /*
     * 30 giây — ngắn hơn hộp thư nhà tuyển dụng (60 s) vì đây là hàng đợi
     * TRỰC: người bên kia đang ngồi chờ có ai trả lời. Ngắn hơn nữa thì thành
     * gõ liên tục vào database mà chẳng ai đọc nhanh đến thế.
     */
    refetchInterval: 30_000,
  })
}

export function useChuyenDoiHoTro() {
  const qc = useQueryClient()
  const lamMoi = () => void qc.invalidateQueries({ queryKey: KHOA })

  /**
   * Tiếp nhận — và đây là chỗ CHỐNG HAI ADMIN CÙNG TRẢ LỜI.
   *
   * Server đặt `handoffAdminUserId` trong cùng một `updateMany` với điều kiện
   * trạng thái nguồn, nên người thứ hai nhận lỗi rõ ràng chứ không lặng lẽ
   * cùng nhảy vào một cuộc trò chuyện.
   */
  const tiepNhan = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ state: string }>(`/api/admin/ho-tro/${sessionId}/tiep-nhan`, { method: 'POST' }),
    onSuccess: lamMoi,
  })

  const ketThuc = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/ket-thuc`, { method: 'POST' }),
    onSuccess: lamMoi,
  })

  return { tiepNhan, ketThuc }
}
