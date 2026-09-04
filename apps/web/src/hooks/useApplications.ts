import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApplicantListResponse,
  ApplicantQuery,
  ApplicationStatus,
  CreateApplicationInput,
  CreateApplicationResponse,
  StudentApplicationListResponse,
  WithdrawApplicationResponse,
  UpdateApplicationStatusResponse,
} from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

const KHOA_DON = ['toi', 'don-ung-tuyen'] as const
const KHOA_UNG_VIEN = ['ntd', 'ung-vien'] as const

export function useMyApplications() {
  return useQuery({
    queryKey: KHOA_DON,
    queryFn: () =>
      apiFetch<StudentApplicationListResponse>('/api/toi/don-ung-tuyen'),
    staleTime: 0,
  })
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (applicationId: string) =>
      apiFetch<WithdrawApplicationResponse>(`/api/toi/don-ung-tuyen/${applicationId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_DON })
    },
  })
}

/**
 * Nộp đơn ứng tuyển.
 *
 * KHÔNG cập nhật lạc quan, khác hẳn `useToggleSaveJob`.
 *
 * Dấu trang là thao tác bấm đi bấm lại trong lúc lướt, sai thì bấm lại là xong —
 * nên vá cache trước rồi hỏi server sau là đúng. Nộp đơn thì ngược lại: làm một
 * lần, không rút lại bằng cách bấm lần nữa, và có tới bốn cách hỏng mà chỉ server
 * biết (chưa xác thực email, tin vừa đóng, quá hạn, đã nộp rồi).
 *
 * Vẽ "đã nộp" trước rồi lát sau hiện lỗi là kiểu dối người dùng tệ nhất — họ đã
 * rời trang với niềm tin sai.
 */
export function useApply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateApplicationInput) =>
      apiFetch<CreateApplicationResponse>('/api/toi/don-ung-tuyen', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_DON })
    },
  })
}

/**
 * Ứng viên của một tin.
 *
 * `enabled` tắt khi chưa chọn tin: trang `/ntd/ung-vien` vào được từ menu mà
 * không mang jobId, và lúc đó nó hiện danh sách tin để chọn chứ không gọi một
 * endpoint thiếu tham số.
 *
 * `staleTime: 0` (mặc định của dự án là 60 giây, xem `lib/query.ts`): đây là
 * màn hình người ta ngồi thao tác liên tục — đổi trạng thái, quay lại, đổi tiếp
 * — nên dữ liệu cũ 60 giây sẽ hiện sai ngay trước mắt.
 */
export function useApplicants(jobId: string | undefined, query: ApplicantQuery = {}) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.sort) params.set('sort', query.sort)
  const duoi = params.toString()

  return useQuery({
    queryKey: [...KHOA_UNG_VIEN, jobId, query.status ?? null, query.sort ?? null],
    queryFn: () =>
      apiFetch<ApplicantListResponse>(
        `/api/ntd/tin-tuyen-dung/${jobId}/ung-vien${duoi ? `?${duoi}` : ''}`,
      ),
    enabled: Boolean(jobId),
    staleTime: 0,
  })
}

/**
 * Đổi trạng thái một đơn.
 *
 * Làm cũ TOÀN BỘ nhánh `KHOA_UNG_VIEN` chứ không vá đúng hàng vừa đổi: một lần
 * đổi làm lệch cả bộ đếm trên tab lẫn thứ tự sắp xếp lẫn tập hợp của mọi tab
 * đang cache. Vá tay từng thứ đó là ba chỗ để quên; tải lại một lượt thì đúng
 * chắc chắn, và màn hình này không phải chỗ người dùng bấm liên tục như dấu trang.
 */
export function useUpdateApplicationStatus(jobId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      applicationId,
      status,
      note,
    }: {
      applicationId: string
      status: ApplicationStatus
      note?: string | null
    }) =>
      apiFetch<UpdateApplicationStatusResponse>(
        `/api/ntd/tin-tuyen-dung/${jobId}/ung-vien/${applicationId}/trang-thai`,
        { method: 'PUT', body: JSON.stringify({ status, note }) },
      ),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_UNG_VIEN })
    },
  })
}
