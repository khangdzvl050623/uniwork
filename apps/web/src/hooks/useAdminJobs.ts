import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminJobListResponse, AdminJobResponse, JobStatus, ReviewJobInput } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

const KHOA_DUYET_TIN = ['admin', 'tin-tuyen-dung'] as const

/** Khoá danh sách việc làm công khai — duyệt một tin là nó xuất hiện ở đó. */
const KHOA_CONG_KHAI = ['viec-lam'] as const

export function useAdminJobs(status: JobStatus = 'PENDING') {
  return useQuery({
    queryKey: [...KHOA_DUYET_TIN, status],
    queryFn: () => apiFetch<AdminJobListResponse>(`/api/admin/tin-tuyen-dung?status=${status}`),
  })
}

/**
 * Duyệt hoặc từ chối một tin.
 *
 * Làm cũ CẢ danh sách công khai, không chỉ hàng đợi duyệt. Duyệt xong là tin
 * xuất hiện ở `/viec-lam` — nếu chỉ làm cũ hàng đợi thì chính admin mở trang
 * việc làm ngay sau đó vẫn không thấy tin mình vừa duyệt, và tưởng thao tác
 * chưa ăn.
 *
 * Lưu ý về giới hạn của cách này: `invalidateQueries` chỉ chạy trong trình duyệt
 * CỦA ADMIN. Sinh viên ngồi máy khác không nhận được gì — với họ, thứ quyết định
 * là `staleTime` của truy vấn công khai (xem T84).
 */
export function useReviewJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...body }: ReviewJobInput & { id: string }) =>
      apiFetch<AdminJobResponse>(`/api/admin/tin-tuyen-dung/${id}/duyet`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_DUYET_TIN })
      void queryClient.invalidateQueries({ queryKey: KHOA_CONG_KHAI })
    },
  })
}
