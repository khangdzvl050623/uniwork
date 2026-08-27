import { Bookmark } from 'lucide-react'
import type { PublicJobSummary } from '@uniwork/shared'
import { useAuth } from '@/hooks/useAuth'
import { useSavedJobIds, useToggleSaveJob } from '@/hooks/useSavedJobs'
import { cn } from '@/lib/utils'

interface Props {
  job: PublicJobSummary
  /** Bản to có chữ, dùng ở cột phải trang chi tiết. Mặc định là nút icon tròn. */
  coChu?: boolean
}

/**
 * Nút lưu tin (dấu trang).
 *
 * ---------------------------------------------------------------------------
 * CHỈ SINH VIÊN ĐÃ ĐĂNG NHẬP MỚI THẤY NÚT NÀY
 * ---------------------------------------------------------------------------
 * Ẩn hẳn với khách và nhà tuyển dụng, KHÔNG hiện dạng vô hiệu hoá kèm chú thích
 * như nút "Ứng tuyển" ở trang chi tiết. Hai chuyện khác nhau: "Ứng tuyển" mờ đi
 * vì tính năng CHƯA LÀM XONG — ai cũng sẽ dùng được nó ở Sprint 4. Còn dấu
 * trang thì đã xong, chỉ là nhà tuyển dụng không có nhu cầu lưu tin của chính
 * nghề mình. Hiện một nút vĩnh viễn bấm không được là nói dối về hệ thống.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CÓ `relative z-10`, VÀ ĐỪNG GỠ ĐI
 * ---------------------------------------------------------------------------
 * `JobCard` dùng thủ thuật "thẻ bấm được": tiêu đề là một `<Link>` mang
 * `before:absolute before:inset-0`, phủ một lớp trong suốt kín cả thẻ để bấm
 * chỗ nào cũng mở được tin. Lớp phủ đó nằm TRÊN mọi thứ trong thẻ theo thứ tự
 * vẽ mặc định — kể cả nút này.
 *
 * Không có `relative z-10` thì nút vẫn hiện ra bình thường, vẫn đổi màu khi rê
 * chuột, nhưng mọi cú bấm đều rơi vào lớp phủ và người dùng bị chuyển sang
 * trang chi tiết thay vì lưu tin. Lỗi kiểu này không có biểu hiện gì lúc nhìn.
 */
export function NutLuuTin({ job, coChu }: Props) {
  const { user } = useAuth()
  const daLuu = useSavedJobIds()
  const toggle = useToggleSaveJob()

  if (user?.role !== 'STUDENT') return null

  const dangLuu = daLuu.has(job.id)

  const bam = (e: React.MouseEvent) => {
    // Thẻ tin bọc ngoài là một liên kết. Không chặn thì bấm nút xong trang tự
    // nhảy sang chi tiết tin — thao tác lưu vẫn chạy nhưng người dùng bị lôi đi
    // khỏi danh sách đang lướt dở.
    e.preventDefault()
    e.stopPropagation()
    toggle.mutate({ job, saved: !dangLuu })
  }

  return (
    <button
      type="button"
      onClick={bam}
      // `aria-pressed` chứ không đổi `aria-label` theo trạng thái: trình đọc màn
      // hình đọc được "đang bật/tắt" mà tên nút vẫn ổn định, nên người dùng
      // không nghe thấy nút đổi tên mỗi lần bấm.
      aria-pressed={dangLuu}
      aria-label={`Lưu tin ${job.title}`}
      title={dangLuu ? 'Bỏ lưu tin này' : 'Lưu tin này'}
      className={cn(
        'relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        coChu
          ? 'w-full justify-center border px-4 py-2.5 text-sm font-medium'
          : 'h-9 w-9 justify-center',
        dangLuu
          ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
          : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600',
      )}
    >
      {/*
        Tô đặc khi đã lưu, chỉ viền khi chưa. Đây là tín hiệu chính — màu nền
        thay đổi rất nhạt, mà người dùng liếc qua danh sách 20 thẻ cần phân biệt
        được ngay tin nào mình đã đánh dấu.
      */}
      <Bookmark size={coChu ? 16 : 17} fill={dangLuu ? 'currentColor' : 'none'} />
      {coChu && (dangLuu ? 'Đã lưu' : 'Lưu tin')}
    </button>
  )
}
