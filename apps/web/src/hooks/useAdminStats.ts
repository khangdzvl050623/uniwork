import { useQuery } from '@tanstack/react-query'
import type { AdminStatsResponse, KpiMetric, StatsRange } from '@uniwork/shared'

/**
 * Số liệu trang tổng quan khu quản trị.
 *
 * ============================================================================
 * CHỖ CẮM SERVICE ĐẾM THẬT
 * ============================================================================
 *
 * Cùng khuôn với useSiteStats. Khi api có `GET /api/admin/thong-ke`:
 *
 *   1. Đổi `queryFn` thành:
 *        () => apiFetch<AdminStatsResponse>(`/api/admin/thong-ke?range=${range}`)
 *   2. Bỏ `initialData` và trả thêm `isPending` để giao diện dựng khung chờ.
 *   3. Xoá phần sinh số mô phỏng bên dưới.
 *
 * `range` đã nằm trong queryKey, nên TanStack Query tự lưu riêng từng khoảng
 * lọc. Người dùng bấm qua lại 7 ngày / 30 ngày thì lần thứ hai lấy từ bộ nhớ
 * đệm chứ không gọi lại server — và biểu đồ vẫn biến hình mượt vì dữ liệu có
 * ngay, không có quãng trống chờ mạng.
 */

/**
 * Sinh chuỗi số mô phỏng có dáng dấp thật.
 *
 * Dùng hàm sin thay vì Math.random vì hai lý do. Một: random thì mỗi lần React
 * vẽ lại là biểu đồ nhảy sang hình khác, không xem được. Hai: dữ liệu thật có
 * nhịp lên xuống theo tuần chứ không nhiễu đều, nên đường hình sin trông giống
 * thật hơn hẳn một dãy số ngẫu nhiên.
 */
function series(length: number, base: number, swing: number, seed: number): number[] {
  return Array.from({ length }, (_, i) =>
    Math.max(0, Math.round(base + Math.sin((i + seed) / 2.4) * swing + (i / length) * base * 0.35)),
  )
}

const POINTS: Record<StatsRange, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 12 }

function labels(range: StatsRange): string[] {
  const n = POINTS[range]
  if (range === '1y') {
    return Array.from({ length: n }, (_, i) => `Th${i + 1}`)
  }
  return Array.from({ length: n }, (_, i) => `${i + 1}`)
}

function kpi(range: StatsRange, base: number, swing: number, seed: number): KpiMetric {
  const data = series(POINTS[range], base, swing, seed)
  const value = data[data.length - 1]
  const previous = data[0] || 1
  return {
    value,
    changePercent: Math.round(((value - previous) / previous) * 100),
    series: data,
  }
}

function mockAdminStats(range: StatsRange): AdminStatsResponse {
  const n = POINTS[range]
  return {
    computedAt: '2026-08-16T02:00:00.000Z',
    range,
    pendingJobs: kpi(range, 34, 9, 1),
    pendingEmployers: kpi(range, 12, 5, 4),
    students: kpi(range, 2_480, 210, 2),
    employers: kpi(range, 318, 26, 7),
    trend: {
      labels: labels(range),
      newJobs: series(n, 42, 14, 0),
      applications: series(n, 96, 28, 3),
    },
    scheduleMix: [
      { type: 'RECURRING', count: 184 },
      { type: 'ONE_TIME', count: 96 },
      { type: 'SEASONAL', count: 58 },
    ],
    reviewGoals: [
      { label: 'Tin tuyển dụng đã duyệt', current: 148, target: 200 },
      { label: 'Hồ sơ doanh nghiệp đã xác minh', current: 63, target: 80 },
      { label: 'Báo cáo vi phạm đã xử lý', current: 27, target: 30 },
    ],
  }
}

export function useAdminStats(range: StatsRange): AdminStatsResponse {
  const { data } = useQuery({
    queryKey: ['admin-stats', range],

    // (1) Đổi dòng này thành lời gọi apiFetch khi endpoint sẵn sàng.
    queryFn: async () => mockAdminStats(range),

    staleTime: 60_000,

    // (2) Bỏ dòng này khi có endpoint thật.
    initialData: () => mockAdminStats(range),
  })

  return data
}
