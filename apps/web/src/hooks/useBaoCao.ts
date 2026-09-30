import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JobReportReasonValue } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

/** Báo cáo tin tuyển dụng — cả phía người gửi lẫn phía admin duyệt. */

export type TrangThaiBaoCao = 'CHO_XU_LY' | 'DANG_XEM' | 'DA_XU_LY' | 'BAC_BO'

export interface BaoCaoItem {
  id: string
  jobId: string
  reason: JobReportReasonValue
  moTa: string
  status: TrangThaiBaoCao
  /** Câu admin viết khi đóng. Người gửi đọc đúng câu này. */
  ketLuan: string | null
  createdAt: string
  handledAt: string | null
}

/**
 * Bản chụp tin tại thời điểm bị báo cáo.
 *
 * Đây là phần quan trọng nhất của cả tính năng: nhà tuyển dụng sửa được tin
 * sau khi bị báo. Không chụp lại thì mọi báo cáo về nội dung đều vô hiệu hoá
 * được bằng một lần bấm Sửa — và người báo cáo là bên trông như đang nói dối.
 */
export interface AnhChupTin {
  title: string
  description: string
  city: string
  district: string
  salaryNegotiable: boolean
  salaryMin: number | null
  salaryMax: number | null
  salaryUnit: string
  status: string
  congTy: string
  chupLuc: string
}

export interface BaoCaoChoAdmin extends BaoCaoItem {
  anhChupTin: AnhChupTin
  /** Số lượt báo cáo ĐANG MỞ của chính tin này — để xếp ưu tiên, KHÔNG để kết luận. */
  soLuotDangMo: number
  tinConMo: boolean
}

/* ------------------------------------------------------------ người gửi -- */

const KHOA_CUA_TOI = ['bao-cao', 'cua-toi'] as const

export function useBaoCaoCuaToi() {
  return useQuery({
    queryKey: KHOA_CUA_TOI,
    queryFn: () => apiFetch<{ baoCao: BaoCaoItem[] }>('/api/toi/bao-cao'),
  })
}

export interface GuiBaoCaoInput {
  jobId: string
  clientReportId: string
  reason: JobReportReasonValue
  moTa: string
}

export function useGuiBaoCao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: GuiBaoCaoInput) =>
      apiFetch<{ baoCao: BaoCaoItem; daCo: boolean }>('/api/toi/bao-cao', {
        method: 'POST',
        body: JSON.stringify(v),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KHOA_CUA_TOI }),
  })
}

/* ---------------------------------------------------------------- admin -- */

const KHOA_ADMIN = ['admin', 'bao-cao'] as const

export function useHangDoiBaoCao(status?: TrangThaiBaoCao) {
  return useQuery({
    queryKey: [...KHOA_ADMIN, status ?? 'dang-mo'],
    queryFn: () =>
      apiFetch<{ baoCao: BaoCaoChoAdmin[] }>(
        status ? `/api/admin/bao-cao?status=${status}` : '/api/admin/bao-cao',
      ),
  })
}

export function useXuLyBaoCao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      ketLuan,
    }: {
      id: string
      status: Exclude<TrangThaiBaoCao, 'CHO_XU_LY'>
      ketLuan: string
    }) =>
      apiFetch<{ baoCao: BaoCaoItem }>(`/api/admin/bao-cao/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, ketLuan }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KHOA_ADMIN }),
  })
}
