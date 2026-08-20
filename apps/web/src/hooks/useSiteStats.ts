import { useQuery } from '@tanstack/react-query'
import type { SiteStatsResponse } from '@uniwork/shared'

/**
 * Số liệu trang chủ.
 *
 * ============================================================================
 * CHỖ CẮM SERVICE ĐẾM THẬT — đọc kỹ đoạn này trước khi sửa
 * ============================================================================
 *
 * Hiện chưa có endpoint đếm, nên hook trả về số mô phỏng bên dưới. Toàn bộ phần
 * cần đổi khi api có `GET /api/thong-ke` gói gọn trong hàm `useSiteStats`:
 *
 *   1. Đổi `queryFn` thành:  () => apiFetch<SiteStatsResponse>('/api/thong-ke')
 *   2. Bỏ dòng `initialData`, rồi trả về cả `isPending` để giao diện biết lúc
 *      nào đang tải. Giữ `initialData` lại là tự bắn vào chân: người dùng sẽ
 *      thấy số bịa chạy lên trước, rồi giật sang số thật khi request về.
 *   3. Xoá hằng MOCK_SITE_STATS.
 *
 * KHÔNG chỗ nào khác trong web được ghi cứng mấy con số này. Trang chủ đọc
 * chúng qua tên trường, nên đổi nguồn dữ liệu không phải sửa JSX.
 *
 * Hình dạng dữ liệu khai ở packages/shared (`SiteStatsResponse`) chứ không phải
 * ở file này — để phía api viết endpoint theo đúng cùng một kiểu, và lệch nhau
 * là TypeScript báo ngay.
 */

/**
 * Số mô phỏng phục vụ trình bày đồ án.
 *
 * Chọn số lẻ (3.342 chứ không phải 3.500) là có chủ đích: số tròn trịa trông
 * như bịa, số lẻ trông như đếm được. Nhưng giao diện vẫn ghi rõ đây là số mô
 * phỏng ở khối "Con số ấn tượng" — trình bày đồ án bằng số bịa mà không nói
 * là bịa thì không ổn.
 */
const MOCK_SITE_STATS: SiteStatsResponse = {
  computedAt: '2026-08-13T02:00:00.000Z',

  market: {
    applicationsThisWeek: 3_342,
    matchedHours: 48_692,
    jobViews: 16_996,
    changePercent: 12,
    weeklyApplications: [42, 58, 35, 72, 64, 88, 76, 95, 61, 80, 54, 90],
  },

  lifetime: {
    jobSearches: 540_000,
    studentProfiles: 200_000,
    matchedHours: 2_000_000,
    jobViews: 1_200_000,
  },

  activeStudentsThisWeek: 12_480,
}

export function useSiteStats(): SiteStatsResponse {
  const { data } = useQuery({
    queryKey: ['site-stats'],

    // (1) Đổi dòng này thành lời gọi apiFetch khi endpoint sẵn sàng.
    queryFn: async () => MOCK_SITE_STATS,

    // Số liệu này được tính sẵn theo chu kỳ chứ không đổi từng giây, nên hỏi
    // lại mỗi 5 phút là quá đủ. Mặc định của TanStack Query là hỏi lại mỗi lần
    // cửa sổ lấy lại focus — với số liệu kiểu này thì chỉ tổ tốn request.
    staleTime: 5 * 60_000,

    // (2) Bỏ dòng này khi có endpoint thật.
    //
    // Nó tồn tại để `data` luôn có giá trị, nhờ đó trang chủ không phải viết
    // nhánh "chưa có dữ liệu" cho thứ hiện chưa bao giờ vắng mặt.
    initialData: MOCK_SITE_STATS,
  })

  return data
}
