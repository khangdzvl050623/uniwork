import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateJobInput,
  EmployerJobListResponse,
  EmployerJobResponse,
} from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

const KHOA_TIN = ['ntd', 'tin-tuyen-dung'] as const

/** Khoá của danh sách việc làm công khai — sửa tin có thể làm nó cũ theo. */
const KHOA_CONG_KHAI = ['viec-lam'] as const

export function useMyJobs() {
  return useQuery({
    queryKey: KHOA_TIN,
    queryFn: () => apiFetch<EmployerJobListResponse>('/api/ntd/tin-tuyen-dung'),
  })
}

/**
 * Một tin cụ thể, để đổ vào form sửa.
 *
 * `enabled` tắt khi không có id: form đăng tin mới dùng chung component với
 * form sửa, và lúc tạo mới thì không có gì để tải.
 */
export function useMyJob(jobId?: string) {
  return useQuery({
    queryKey: [...KHOA_TIN, jobId],
    queryFn: () => apiFetch<EmployerJobResponse>(`/api/ntd/tin-tuyen-dung/${jobId}`),
    enabled: Boolean(jobId),
  })
}

/**
 * Làm cũ mọi truy vấn liên quan sau khi ghi.
 *
 * Không vá thẳng vào cache như các hook khác trong dự án, và đây là chỗ khác
 * biệt đáng nói: một thao tác trên tin có thể đổi cả thứ KHÔNG nằm trong
 * response. Sửa tin đang `OPEN` thì server tự đưa nó về `PENDING` — tin đó biến
 * mất khỏi trang việc làm công khai, mà response chỉ trả về đúng một tin.
 *
 * Vá tay thì phải nhớ hết những hệ quả gián tiếp ấy ở phía web; gọi lại cho
 * chắc thì server vẫn là nơi duy nhất giữ sự thật.
 */
function lamCuMoiThu(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: KHOA_TIN })
  void queryClient.invalidateQueries({ queryKey: KHOA_CONG_KHAI })
}

export function useCreateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateJobInput) =>
      apiFetch<EmployerJobResponse>('/api/ntd/tin-tuyen-dung', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => lamCuMoiThu(queryClient),
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: CreateJobInput & { id: string }) =>
      apiFetch<EmployerJobResponse>(`/api/ntd/tin-tuyen-dung/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => lamCuMoiThu(queryClient),
  })
}

/** Xoá hẳn. Server chỉ cho phép với tin `DRAFT`/`PENDING`. */
export function useDeleteJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/ntd/tin-tuyen-dung/${id}`, { method: 'DELETE' }),
    onSuccess: () => lamCuMoiThu(queryClient),
  })
}

/** Gỡ một tin đã duyệt xuống. Khác xoá: bản ghi và đơn ứng tuyển vẫn còn. */
export function useCloseJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<EmployerJobResponse>(`/api/ntd/tin-tuyen-dung/${id}/dong`, { method: 'POST' }),
    onSuccess: () => lamCuMoiThu(queryClient),
  })
}

/** Gửi tin đi duyệt. Đòi hồ sơ doanh nghiệp đã được xác minh. */
export function useSubmitJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<EmployerJobResponse>(`/api/ntd/tin-tuyen-dung/${id}/gui-duyet`, { method: 'POST' }),
    onSuccess: () => lamCuMoiThu(queryClient),
  })
}
