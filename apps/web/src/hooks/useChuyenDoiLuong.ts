import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { KHOA_HOI_THOAI_CUA_TOI } from '@/hooks/useHoiThoaiCuaToi'

/**
 * Hai hành động người sở hữu luồng làm được: huỷ yêu cầu đang chờ, và kết thúc.
 *
 * Huỷ ở hai kênh đi hai endpoint khác nhau, và đó KHÔNG phải trùng lặp thừa:
 * `huy-cho` đóng luồng nhà tuyển dụng, `huy-ho-tro` đưa luồng hỗ trợ về
 * `AI_ACTIVE` để người dùng còn tự xoay xở. Gộp thành một đường thì phải đoán
 * đích đến từ `kind`, và cái đoán đó nằm sai chỗ — nó thuộc về máy trạng thái
 * ở server, không thuộc về một hook giao diện.
 */
export function useChuyenDoiLuong() {
  const qc = useQueryClient()
  const lamMoi = () => void qc.invalidateQueries({ queryKey: KHOA_HOI_THOAI_CUA_TOI })

  const huyCho = useMutation({
    mutationFn: ({ sessionId, laHoTro }: { sessionId: string; laHoTro: boolean }) =>
      apiFetch<{ state: string }>(
        `/api/hoi-thoai/${sessionId}/${laHoTro ? 'huy-ho-tro' : 'huy-cho'}`,
        { method: 'POST' },
      ),
    onSuccess: lamMoi,
  })

  const ketThuc = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/ket-thuc`, { method: 'POST' }),
    onSuccess: lamMoi,
  })

  return { huyCho, ketThuc }
}
