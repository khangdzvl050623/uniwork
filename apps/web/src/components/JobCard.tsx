import { Link } from 'react-router-dom'
import { BadgeCheck, Clock, MapPin, Wallet } from 'lucide-react'
import {
  DAY_LABELS,
  SCHEDULE_TYPE_LABELS,
  TIME_SLOT_LABELS,
  duongDanTin,
  type PublicJobSummary,
} from '@uniwork/shared'
import { Badge } from '@/components/ui/Badge'
import { NutLuuTin } from '@/components/NutLuuTin'
import { cn, formatSalary } from '@/lib/utils'

/** "T2, T4, T6 · ca tối" — gom ngày và buổi thay vì liệt kê từng ô một. */
function tomTatCa(job: PublicJobSummary) {
  const ngay = [...new Set(job.shifts.map((s) => s.dayOfWeek))]
    // Chủ nhật (0) xếp cuối, đúng cách người Việt đọc lịch.
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => DAY_LABELS[d])

  const buoi = [...new Set(job.shifts.map((s) => s.slot))].map((s) => TIME_SLOT_LABELS[s].label)

  return `${ngay.join(', ')} · ca ${buoi.join(', ').toLowerCase()}`
}

/** Chữ cái đầu tên công ty, dùng làm ảnh đại diện thay cho logo chưa có. */
function chuDau(ten: string) {
  return ten.trim().slice(0, 1).toUpperCase()
}

/**
 * Màu ảnh đại diện suy ra từ chính tên công ty.
 *
 * Cộng mã ký tự rồi chia lấy dư: cùng một tên luôn ra cùng một màu ở mọi trang
 * và sau mọi lần tải lại. Dùng `Math.random` thì mỗi lần vẽ lại là một màu khác,
 * và ảnh đại diện mất luôn tác dụng nhận diện vốn là lý do nó tồn tại.
 *
 * Trước đây màu này do dữ liệu giả mang sẵn (`companyColor`); API thật không trả
 * về màu, và cũng không nên — đó là chuyện trình bày.
 */
const MAU_AVATAR = [
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
]

function mauTheoTen(ten: string) {
  const tong = [...ten].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return MAU_AVATAR[tong % MAU_AVATAR.length]
}

export function JobCard({ job }: { job: PublicJobSummary }) {
  return (
    // card-lift lo phần nâng thẻ và đổ bóng, đồng thời tự tắt khi người dùng bật
    // giảm chuyển động (khai ở index.css).
    <article className="card-lift group relative rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300">
      <div className="flex gap-3">
        <div
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-lg text-lg font-bold text-white',
            mauTheoTen(job.employer.companyName),
          )}
        >
          {chuDau(job.employer.companyName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 font-semibold text-slate-900 group-hover:text-brand-700">
              {/* Đường dẫn mang cả slug tiêu đề lẫn id — xem `duongDanTin`.
                  Phần chữ chỉ để người đọc và máy tìm kiếm hiểu tin nói về gì;
                  id ở cuối mới là thứ tra cứu. */}
              <Link
                to={`/viec-lam/${duongDanTin(job)}`}
                className="before:absolute before:inset-0"
              >
                {job.title}
              </Link>
            </h3>

            {/* Nút tự ẩn khi người xem không phải sinh viên — xem NutLuuTin.
                Nó mang sẵn `relative z-10` để không bị lớp phủ của <Link> ở
                trên nuốt mất cú bấm. */}
            <NutLuuTin job={job} />
          </div>

          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            {job.employer.companyName}
            {job.employer.verified && <BadgeCheck size={14} className="text-brand-500" />}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Wallet size={14} className="text-slate-400" />
              <strong className="font-semibold text-emerald-600">
                {formatSalary(job.salaryMin, job.salaryMax, job.salaryUnit, job.salaryNegotiable)}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" />
              {job.district}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} className="text-slate-400" />
              {tomTatCa(job)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{SCHEDULE_TYPE_LABELS[job.scheduleType]}</Badge>
            {job.commitmentMonths && <Badge>Cam kết {job.commitmentMonths} tháng</Badge>}
            {job.skills.slice(0, 2).map((s) => (
              <Badge key={s.id}>{s.name}</Badge>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {new Date(job.publishedAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>
      </div>

      {/*
        Thanh "điểm phù hợp" đã bị gỡ khỏi đây.
        Điểm đó tính từ giao giữa lịch rảnh của sinh viên và ca làm của tin —
        thuộc Sprint 3. Bản trước hiện một con số lấy từ dữ liệu giả, tức là
        khẳng định "rất phù hợp lịch của bạn" với người hệ thống còn chưa biết
        lịch rảnh. Thà không có còn hơn nói sai.
      */}
    </article>
  )
}
