import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminEmployerListResponse,
  AdminEmployerResponse,
  DocumentType,
  DocumentViewUrlResponse,
  ReviewDocumentInput,
} from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

const KHOA_NTD = ['admin', 'nha-tuyen-dung'] as const

export function useAdminEmployers() {
  return useQuery({
    queryKey: KHOA_NTD,
    queryFn: () => apiFetch<AdminEmployerListResponse>('/api/admin/nha-tuyen-dung'),
  })
}

/**
 * Vá thẳng một hồ sơ vào cache thay vì gọi lại cả danh sách.
 *
 * Cả hai mutation dưới đây đều trả về đúng hồ sơ vừa đổi, nên gọi lại
 * `GET /nha-tuyen-dung` chỉ để nhận lại gần như cùng dữ liệu là một vòng mạng
 * thừa — và làm bảng nhấp nháy vì mọi hàng render lại.
 */
function dungChungOnSuccess(queryClient: ReturnType<typeof useQueryClient>) {
  return (updated: AdminEmployerResponse) => {
    queryClient.setQueryData<AdminEmployerListResponse>(KHOA_NTD, (cu) => {
      if (!cu) return cu
      return { employers: cu.employers.map((e) => (e.id === updated.id ? updated : e)) }
    })
  }
}

/** Duyệt hoặc từ chối một giấy tờ. */
export function useReviewDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      type,
      ...body
    }: ReviewDocumentInput & { id: string; type: DocumentType }) =>
      apiFetch<AdminEmployerResponse>(`/api/admin/nha-tuyen-dung/${id}/giay-to/${type}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: dungChungOnSuccess(queryClient),
  })
}

/** Chốt hoặc thu hồi xác minh của cả hồ sơ. */
export function useVerifyEmployer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      apiFetch<AdminEmployerResponse>(`/api/admin/nha-tuyen-dung/${id}/xac-minh`, {
        method: 'PUT',
        body: JSON.stringify({ verified }),
      }),
    onSuccess: dungChungOnSuccess(queryClient),
  })
}

/**
 * Xin URL xem một giấy tờ rồi mở tab mới.
 *
 * KHÔNG dùng `useQuery`: URL chỉ sống vài phút, cache lại thì lần bấm sau mở ra
 * một địa chỉ đã hết hạn. Mỗi lần xem là một lần xin mới — đúng ý đồ của chế độ
 * `authenticated` bên Cloudinary.
 */
export function useXemGiayTo() {
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: DocumentType }) =>
      apiFetch<DocumentViewUrlResponse>(
        `/api/admin/nha-tuyen-dung/${id}/giay-to/${type}/xem`,
      ),
    onSuccess: ({ url }) => {
      // noopener: tab mới không giữ được tham chiếu ngược tới trang quản trị.
      window.open(url, '_blank', 'noopener,noreferrer')
    },
  })
}
