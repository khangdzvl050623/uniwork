import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  PublicJobSummary,
  SavedJobListResponse,
  SavedJobToggleResponse,
} from '@uniwork/shared'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const KHOA_DA_LUU = ['toi', 'tin-da-luu'] as const

/**
 * Tin đã lưu — dữ liệu CỦA CHÍNH người đang xem.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG DÙNG `staleTime` NGẮN NHƯ `usePublicJobs`
 * ---------------------------------------------------------------------------
 * Danh sách việc làm công khai đổi khi NGƯỜI KHÁC hành động (admin duyệt tin),
 * nên ở đó `staleTime` ngắn là thứ duy nhất cứu được. Danh sách này thì ngược
 * lại: chỉ chính chủ mới thêm/bớt được mục, và mọi thao tác đó đều đi qua
 * `useToggleSaveJob` ngay bên dưới — vá cache tại chỗ là đủ và đúng.
 *
 * Ngoại lệ duy nhất là cờ `stillOpen`: nó đổi khi nhà tuyển dụng đóng tin, tức
 * là do người khác. Nhưng đó là thông tin phụ trên một mục sẵn có, không phải
 * mục xuất hiện/biến mất — để nó cũ vài phút không làm ai hiểu sai, và mặc định
 * 60 giây của dự án đã đủ.
 */
export function useSavedJobs() {
  const { user } = useAuth()

  // Chỉ sinh viên mới có dấu trang. Bật cho vai khác là gọi một endpoint chắc
  // chắn trả 403, mỗi lần vào trang việc làm một lần.
  const laSinhVien = user?.role === 'STUDENT'

  return useQuery({
    queryKey: KHOA_DA_LUU,
    queryFn: () => apiFetch<SavedJobListResponse>('/api/toi/tin-da-luu'),
    enabled: laSinhVien,
  })
}

/**
 * Tập id các tin đã lưu, để mỗi thẻ tin biết mình đang ở trạng thái nào.
 *
 * Dựng từ chính truy vấn danh sách ở trên chứ không thêm một endpoint "chỉ trả
 * id": nút dấu trang xuất hiện ở trang việc làm, trang chi tiết và trang tin đã
 * lưu — cả ba đều dùng chung một truy vấn, nên tải một lần là đủ cho tất cả.
 *
 * `Set` chứ không `Array.includes`: trang việc làm vẽ tới 100 thẻ, mỗi thẻ hỏi
 * một lần. Dò tuyến tính 100 lần trên mảng 100 phần tử là 10.000 phép so sánh
 * mỗi lần vẽ lại, đổi lấy một `Set` dựng một lần.
 */
export function useSavedJobIds(): Set<string> {
  const { data } = useSavedJobs()

  return useMemo(
    () => new Set((data?.savedJobs ?? []).map((m) => m.job.id)),
    [data],
  )
}

/**
 * Bật/tắt dấu trang cho một tin.
 *
 * ---------------------------------------------------------------------------
 * CẬP NHẬT LẠC QUAN, VÀ VÌ SAO CẦN Ở ĐÚNG CHỖ NÀY
 * ---------------------------------------------------------------------------
 * Dấu trang là thao tác người dùng bấm rồi bấm lại liên tục trong lúc lướt.
 * Chờ server trả lời mới đổi màu thì mỗi lần bấm có một khoảng lặng, và trên
 * mạng chậm người dùng sẽ bấm lần hai vì tưởng lần đầu trượt.
 *
 * Nhận cả `job` chứ không chỉ `jobId`: để chèn được mục mới vào cache ngay lập
 * tức thì phải có nội dung tin, mà cả ba nơi gọi đều đang cầm sẵn nó trong tay.
 * Không có nó thì "lạc quan" chỉ làm được nửa việc — bỏ lưu thì mượt, lưu vào
 * thì vẫn phải chờ.
 *
 * `onError` trả lại đúng ảnh chụp trước đó, `onSettled` gọi lại server để chốt.
 * Mục chèn lạc quan mang `stillOpen: true` — đúng trong mọi trường hợp, vì chỉ
 * tin đang `OPEN` mới lưu được (server cũng chặn đúng vậy).
 */
export function useToggleSaveJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ job, saved }: { job: PublicJobSummary; saved: boolean }) =>
      apiFetch<SavedJobToggleResponse>(`/api/toi/tin-da-luu/${job.id}`, {
        // `saved` là trạng thái MONG MUỐN sau thao tác, không phải trạng thái
        // hiện tại — đọc chỗ gọi ra ngay là đang muốn lưu hay bỏ lưu.
        method: saved ? 'POST' : 'DELETE',
      }),

    onMutate: async ({ job, saved }) => {
      // Huỷ mọi lần tải đang bay: một response cũ về sau khi đã vá cache sẽ ghi
      // đè mất thay đổi lạc quan, và nút nhấp nháy về trạng thái cũ.
      await queryClient.cancelQueries({ queryKey: KHOA_DA_LUU })

      const truoc = queryClient.getQueryData<SavedJobListResponse>(KHOA_DA_LUU)

      queryClient.setQueryData<SavedJobListResponse>(KHOA_DA_LUU, (cu) => {
        const danhSach = cu?.savedJobs ?? []

        const moi = saved
          ? // Chèn đầu danh sách vì server sắp theo mốc lưu giảm dần — chèn
            // cuối thì sau lần đồng bộ tiếp theo mục lại nhảy lên đầu.
            [{ job, savedAt: new Date().toISOString(), stillOpen: true }, ...danhSach]
          : danhSach.filter((m) => m.job.id !== job.id)

        return { savedJobs: moi, total: moi.length }
      })

      return { truoc }
    },

    onError: (_err, _bien, context) => {
      if (context?.truoc) queryClient.setQueryData(KHOA_DA_LUU, context.truoc)
    },

    // Chốt lại bằng dữ liệu server dù thành công hay thất bại: mốc `savedAt`
    // lạc quan ở trên là giờ máy người dùng, còn thứ hiện lâu dài phải là giờ
    // server đã ghi.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_DA_LUU })
    },
  })
}
