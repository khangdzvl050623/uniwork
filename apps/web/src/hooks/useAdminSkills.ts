import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminSkillListResponse, AdminSkillResponse } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

const KHOA_KY_NANG = ['admin', 'ky-nang'] as const

export function useAdminSkills() {
  return useQuery({
    queryKey: KHOA_KY_NANG,
    queryFn: () => apiFetch<AdminSkillListResponse>('/api/admin/ky-nang'),
  })
}

/**
 * Danh mục kỹ năng cũng được `GET /api/skills` dùng ở nơi khác (form đăng tin,
 * bộ lọc). Sửa danh mục ở khu quản trị phải làm cả cache đó cũ theo, nếu không
 * người dùng vừa thêm kỹ năng xong mở form đăng tin vẫn không thấy nó.
 */
function lamCuCaHaiDanhMuc(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['skills'] })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<AdminSkillResponse>('/api/admin/ky-nang', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    onSuccess: (created) => {
      queryClient.setQueryData<AdminSkillListResponse>(KHOA_KY_NANG, (cu) => {
        if (!cu) return cu
        // Chèn rồi sắp lại theo tên, khớp `orderBy` của server. Đẩy lên đầu
        // danh sách thì hàng vừa thêm nhảy chỗ khác ngay lần tải lại kế tiếp.
        return {
          skills: [...cu.skills, created].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
        }
      })
      lamCuCaHaiDanhMuc(queryClient)
    },
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<AdminSkillResponse>(`/api/admin/ky-nang/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),

    onSuccess: (updated) => {
      queryClient.setQueryData<AdminSkillListResponse>(KHOA_KY_NANG, (cu) => {
        if (!cu) return cu
        return {
          skills: cu.skills
            .map((s) => (s.id === updated.id ? updated : s))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
        }
      })
      lamCuCaHaiDanhMuc(queryClient)
    },
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    // Server trả `{ id }` chứ không phải 204 rỗng — `apiFetch` gọi
    // `response.json()` vô điều kiện nên 204 sẽ thành lỗi parse.
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/admin/ky-nang/${id}`, { method: 'DELETE' }),

    onSuccess: ({ id }) => {
      queryClient.setQueryData<AdminSkillListResponse>(KHOA_KY_NANG, (cu) => {
        if (!cu) return cu
        return { skills: cu.skills.filter((s) => s.id !== id) }
      })
      lamCuCaHaiDanhMuc(queryClient)
    },
  })
}
