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

/**
 * Đổi bộ lọc thành query string.
 *
 * Mỗi tham số chỉ được đặt khi CÓ giá trị thật — không bao giờ gửi chuỗi rỗng.
 * Server đã chặn `?salaryFrom=` thành "bằng 0" rồi, nhưng chặn luôn ở đây để
 * URL sạch và cache key không sinh ra hai biến thể cho cùng một bộ lọc.
 */
function chuoiTruyVan(query: PublicJobQuery): string {
  const p = new URLSearchParams()

  if (query.q) p.set('q', query.q.trim())
  if (query.city) p.set('city', query.city)
  if (query.district) p.set('district', query.district)
  if (query.scheduleType) p.set('scheduleType', query.scheduleType)

  // Chỉ gửi khi BẬT. Gửi `false` cũng cho kết quả đúng (server phân biệt được),
  // nhưng để URL ngắn và dễ đọc khi chia sẻ.
  if (query.matchAvailability) p.set('matchAvailability', 'true')

  if (query.salaryUnit) p.set('salaryUnit', query.salaryUnit)
  if (query.salaryFrom !== undefined) p.set('salaryFrom', String(query.salaryFrom))
  // Chỉ gửi khi TẮT: mặc định của server là giữ tin thoả thuận, nên gửi `true`
  // là thông tin thừa trong URL.
  if (query.includeNegotiable === false) p.set('includeNegotiable', 'false')

  // Ngăn bằng dấu phẩy, khớp `danhSachIdTuyChon` phía shared.
  if (query.skillIds?.length) p.set('skillIds', query.skillIds.join(','))

  if (query.maxShiftsPerWeek !== undefined) {
    p.set('maxShiftsPerWeek', String(query.maxShiftsPerWeek))
  }
  if (query.maxCommitmentMonths !== undefined) {
    p.set('maxCommitmentMonths', String(query.maxCommitmentMonths))
  }

  // `newest` là mặc định của server — không gửi để URL không mang thông tin thừa.
  if (query.sort && query.sort !== 'newest') p.set('sort', query.sort)

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
