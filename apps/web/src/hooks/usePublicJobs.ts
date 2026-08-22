import { useQuery } from '@tanstack/react-query'
import type { PublicJobDetail, PublicJobListResponse, PublicJobQuery } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

/**
 * Việc làm công khai — dữ liệu NGƯỜI KHÁC thay đổi.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO ĐẶT `staleTime` RIÊNG, KHÁC MẶC ĐỊNH 60 GIÂY
 * ---------------------------------------------------------------------------
 * Mọi truy vấn khác trong dự án đọc dữ liệu CỦA CHÍNH NGƯỜI ĐANG XEM — hồ sơ
 * tôi, tin của tôi, lịch rảnh của tôi. Ai đổi thì chính người đó đổi, nên vá
 * cache tại chỗ sau mutation là đủ và 60 giây là hợp lý.
 *
 * Danh sách việc làm thì ngược lại: nó đổi khi ADMIN duyệt một tin, hoặc khi
 * nhà tuyển dụng đóng tin. Sinh viên đang mở trang không hề biết, và
 * `invalidateQueries` bên trình duyệt của admin không chạm tới họ được — cache
 * của mỗi trình duyệt là riêng.
 *
 * Nên với dữ liệu này, `staleTime` NGẮN là thứ duy nhất có tác dụng: sau 15
 * giây, lần điều hướng hay focus tiếp theo sẽ lấy dữ liệu mới. Đừng "dọn dẹp"
 * cho thống nhất với mặc định — đó là hai loại dữ liệu khác nhau.
 */
const TUOI_TOI_DA = 15_000

function chuoiTruyVan(query: PublicJobQuery): string {
  const p = new URLSearchParams()
  if (query.city) p.set('city', query.city)
  if (query.district) p.set('district', query.district)
  if (query.scheduleType) p.set('scheduleType', query.scheduleType)

  const s = p.toString()
  return s ? `?${s}` : ''
}

export function usePublicJobs(query: PublicJobQuery = {}) {
  return useQuery({
    // Bộ lọc nằm trong khoá: đổi quận là một truy vấn khác, không phải cùng một
    // truy vấn với dữ liệu mới. Thiếu nó thì kết quả quận cũ nằm lại trên màn
    // hình cho tới khi request mới về.
    queryKey: ['viec-lam', query],
    queryFn: () => apiFetch<PublicJobListResponse>(`/api/viec-lam${chuoiTruyVan(query)}`),
    staleTime: TUOI_TOI_DA,
  })
}

export function usePublicJob(jobId?: string) {
  return useQuery({
    queryKey: ['viec-lam', 'chi-tiet', jobId],
    queryFn: () => apiFetch<PublicJobDetail>(`/api/viec-lam/${jobId}`),
    enabled: Boolean(jobId),
    staleTime: TUOI_TOI_DA,
  })
}
