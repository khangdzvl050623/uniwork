import { Link } from 'react-router-dom'
import { BookmarkX, Loader2 } from 'lucide-react'
import { JobCard } from '@/components/JobCard'
import { useSavedJobs } from '@/hooks/useSavedJobs'

/**
 * Tin đã lưu của sinh viên (Sprint 3).
 *
 * ---------------------------------------------------------------------------
 * TIN ĐÃ ĐÓNG VẪN NẰM Ở ĐÂY, CHỈ BỊ LÀM MỜ
 * ---------------------------------------------------------------------------
 * Server cố ý trả về cả tin không còn nhận hồ sơ (`stillOpen: false`). Lọc
 * chúng đi ở đây sẽ hoàn tác đúng quyết định đó: tin sinh viên tự tay lưu bỗng
 * biến mất, và họ không có cách nào biết là vì tin đã đóng hay vì mình bấm
 * nhầm. Làm mờ kèm nhãn thì câu hỏi "tin tôi lưu hôm qua đâu rồi" có câu trả
 * lời ngay trên màn hình.
 *
 * Vẫn giữ nút bỏ lưu hoạt động bình thường trên tin đã đóng — người dùng phải
 * dọn được danh sách của mình.
 */
export function SavedJobs() {
  const { data, isLoading, isError } = useSavedJobs()

  const danhSach = data?.savedJobs ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Tin đã lưu</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isLoading ? 'Đang tải…' : `${danhSach.length} tin`}
      </p>

      {isLoading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 size={26} className="animate-spin text-brand-600" />
        </div>
      )}

      {isError && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Không tải được danh sách tin đã lưu. Kiểm tra kết nối rồi thử lại.
        </p>
      )}

      {!isLoading && !isError && danhSach.length === 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <BookmarkX size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-600">Bạn chưa lưu tin nào.</p>
          <Link
            to="/viec-lam"
            className="mt-2 inline-block text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Xem việc làm đang tuyển →
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {danhSach.map((muc) => (
          <div key={muc.job.id}>
            {!muc.stillOpen && (
              <p className="mb-1 text-xs font-medium text-amber-700">
                Tin này không còn nhận hồ sơ
              </p>
            )}
            {/*
              Làm mờ bằng `opacity` chứ không đổi màu bên trong thẻ: thẻ tin
              dùng chung với trang việc làm, thêm một biến thể "đã đóng" vào nó
              là bắt một component đang dùng ở ba nơi phải biết về trạng thái
              chỉ tồn tại ở một nơi.
            */}
            <div className={muc.stillOpen ? undefined : 'opacity-60'}>
              <JobCard job={muc.job} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
