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

/**
 * Bật/tắt chip "Từ khoá phổ biến" ở trang chủ.
 *
 * Endpoint riêng `/:id/noi-bat` nên KHÔNG phải gửi kèm tên. Gộp vào `PUT /:id`
 * thì mỗi lần tick sẽ ghi đè cả `name`, và hai admin cùng mở bảng là một người
 * lặng lẽ khôi phục tên mà người kia vừa sửa.
 *
 * `lamCuCaHaiDanhMuc` quan trọng ở đây hơn mọi mutation khác: trang chủ đọc
 * `GET /api/skills` với `staleTime` 30 phút. Không làm cũ cache đó thì admin
 * tick xong mở trang chủ vẫn thấy y như cũ và tưởng nút hỏng.
 *
 * ⚠ PHẠM VI: chỉ trong TRÌNH DUYỆT CỦA ADMIN.
 *
 * Cache của TanStack Query nằm trong bộ nhớ từng tab, không có kênh nào đẩy
 * sang máy người khác. Sinh viên đang mở trang chủ vẫn giữ danh mục cũ tới hết
 * 30 phút `staleTime`, hoặc tới lần tải lại trang gần nhất — tuỳ cái nào đến
 * trước. Đây KHÔNG phải cơ chế cập nhật tức thời giữa nhiều người dùng, và
 * đừng ai mô tả nó như vậy trong tài liệu bàn giao.
 */
export function useSetSkillFeatured() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      apiFetch<AdminSkillResponse>(`/api/admin/ky-nang/${id}/noi-bat`, {
        method: 'PUT',
        body: JSON.stringify({ featured }),
      }),

    onSuccess: (updated) => {
      queryClient.setQueryData<AdminSkillListResponse>(KHOA_KY_NANG, (cu) => {
        if (!cu) return cu
        // Không sắp lại: thứ tự vẫn theo tên, mà tên thì không đổi. Sắp lại ở
        // đây chỉ làm hàng vừa tick nhảy chỗ không có lý do.
        return { skills: cu.skills.map((s) => (s.id === updated.id ? updated : s)) }
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
