import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AvailabilityResponse,
  AvailabilitySlot,
  DocumentType,
  DocumentViewUrlResponse,
  EmployerProfileResponse,
  MeResponse,
  SkillResponse,
  StudentProfileResponse,
} from '@uniwork/shared'
import { apiFetch } from '@/lib/api'
import { uploadFile } from '@/lib/upload'

/**
 * Truy vấn và cập nhật hồ sơ (T59–T62).
 *
 * Mọi endpoint ở đây đều thao tác trên hồ sơ CỦA CHÍNH người đang đăng nhập —
 * không đường nào truyền id người khác vào được, đúng như thiết kế phía api.
 */

/** Một khoá duy nhất cho hồ sơ, để mọi thao tác ghi làm mới đúng chỗ. */
const KHOA_TOI = ['toi'] as const

export function useMe() {
  return useQuery({
    queryKey: KHOA_TOI,
    queryFn: () => apiFetch<MeResponse>('/api/toi'),
  })
}

/* ------------------------------------------------------- hồ sơ sinh viên -- */

export interface StudentProfileInput {
  university?: string | null
  major?: string | null
  year?: number | null
  bio?: string | null
}

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StudentProfileInput) =>
      apiFetch<StudentProfileResponse>('/api/toi/ho-so-sinh-vien', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KHOA_TOI }),
  })
}

/* -------------------------------------------------------------- kỹ năng -- */

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => apiFetch<SkillResponse[]>('/api/skills'),
    // Danh mục kỹ năng do admin quản lý, gần như không đổi trong một phiên làm
    // việc. Giữ lâu để chuyển qua lại giữa các trang không gọi lại.
    staleTime: 30 * 60_000,
  })
}

export function useUpdateSkills() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (skillIds: string[]) =>
      apiFetch<StudentProfileResponse>('/api/toi/ky-nang', {
        method: 'PUT',
        body: JSON.stringify({ skillIds }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KHOA_TOI }),
  })
}

/* ------------------------------------------------------------------ CV -- */

export function useUploadCv(onProgress?: (phanTram: number) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      // Tên trường phải khớp `uploadMemory.single('cv')` phía api. Sai tên thì
      // multer từ chối với thông báo khá khó hiểu.
      form.append('cv', file)
      return uploadFile<StudentProfileResponse>('/api/toi/cv', form, onProgress)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KHOA_TOI }),
  })
}

/* ------------------------------------------------------------ lịch rảnh -- */

export function useAvailability() {
  return useQuery({
    queryKey: ['lich-ranh'],
    queryFn: () => apiFetch<AvailabilityResponse>('/api/toi/lich-ranh'),
  })
}

export function useUpdateAvailability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slots: AvailabilitySlot[]) =>
      apiFetch<AvailabilityResponse>('/api/toi/lich-ranh', {
        method: 'PUT',
        body: JSON.stringify({ slots }),
      }),
    onSuccess: (data) => {
      // Ghi thẳng kết quả vào cache thay vì gọi lại: server vừa trả về đúng
      // danh sách sau khi lưu, gọi thêm một vòng nữa chỉ để nhận lại cùng dữ
      // liệu là thừa.
      queryClient.setQueryData(['lich-ranh'], data)
    },
  })
}

/* --------------------------------------------------------- hồ sơ NTD ----- */

export interface EmployerProfileInput {
  companyName: string
  description?: string | null
  address?: string | null
  website?: string | null
}

export function useUpdateEmployerProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: EmployerProfileInput) =>
      apiFetch<EmployerProfileResponse>('/api/toi/ho-so-ntd', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KHOA_TOI }),
  })
}

export function useUploadDocument(onProgress?: (phanTram: number) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ type, file }: { type: DocumentType; file: File }) => {
      const form = new FormData()
      form.append('type', type)
      form.append('file', file)
      return uploadFile<EmployerProfileResponse>('/api/toi/giay-to', form, onProgress)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KHOA_TOI }),
  })
}

/**
 * Xin URL xem tạm cho một giấy tờ đã nộp.
 *
 * Là mutation chứ không phải query, dù nó chỉ đọc: URL trả về chỉ sống 5 phút,
 * nên đưa vào cache của TanStack Query là chuẩn bị sẵn một URL hết hạn cho lần
 * bấm sau. Mỗi lần muốn xem phải xin mới.
 */
export function useDocumentViewUrl() {
  return useMutation({
    mutationFn: (type: DocumentType) =>
      apiFetch<DocumentViewUrlResponse>(`/api/toi/giay-to/${type}/xem`),
  })
}
