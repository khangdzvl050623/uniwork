import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminUserListResponse, AdminUserResponse, UserStatus } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

const KHOA_NGUOI_DUNG = ['admin', 'nguoi-dung'] as const

export function useAdminUsers() {
  return useQuery({
    queryKey: KHOA_NGUOI_DUNG,
    queryFn: () => apiFetch<AdminUserListResponse>('/api/admin/nguoi-dung'),
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      apiFetch<AdminUserResponse>(`/api/admin/nguoi-dung/${id}/trang-thai`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),

    /*
     * Cập nhật thẳng vào cache thay vì gọi lại danh sách.
     *
     * Server đã trả về đúng hàng vừa đổi — gọi lại toàn bộ `GET /nguoi-dung`
     * chỉ để nhận lại gần như cùng dữ liệu là một vòng mạng thừa, và trên bảng
     * vài trăm dòng thì còn làm giao diện giật khi toàn bộ danh sách render lại.
     */
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminUserListResponse>(KHOA_NGUOI_DUNG, (cu) => {
        if (!cu) return cu
        return { users: cu.users.map((u) => (u.id === updated.id ? updated : u)) }
      })
    },
  })
}
