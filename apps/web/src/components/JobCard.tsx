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
import { BadgePhuHop } from '@/components/BadgePhuHop'
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
const MAU_AVATAR = ['bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-500']

function mauTheoTen(ten: string) {
  const tong = [...ten].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return MAU_AVATAR[tong % MAU_AVATAR.length]
}

export function JobCard({ job }: { job: PublicJobSummary }) {
  return (
    <article className="card-lift group relative rounded-[1.25rem] border border-slate-200/80 bg-white p-4.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04),0_1px_3px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-brand-300/80 hover:shadow-[0_12px_24px_-8px_rgba(0,133,122,0.12),0_4px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="flex gap-3.5">
        <div
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white shadow-xs ring-2 ring-white/80 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105',
            mauTheoTen(job.employer.companyName),
          )}
        >
          {chuDau(job.employer.companyName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 font-semibold text-slate-900 transition-colors duration-200 group-hover:text-brand-700">
              {/* Đường dẫn mang cả slug tiêu đề lẫn id — xem `duongDanTin`.
                  Phần chữ chỉ để người đọc và máy tìm kiếm hiểu tin nói về gì;
                  id ở cuối mới là thứ tra cứu. */}
              <Link to={`/viec-lam/${duongDanTin(job)}`} className="before:absolute before:inset-0">
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

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200/70 shadow-2xs">
              <Wallet size={12} className="text-emerald-600" />
              <strong className="font-semibold text-emerald-700">
                {formatSalary(job.salaryMin, job.salaryMax, job.salaryUnit, job.salaryNegotiable)}
              </strong>
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <MapPin size={13} className="text-slate-400" />
              {job.district}
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Clock size={13} className="text-slate-400" />
              {tomTatCa(job)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* Đứng TRƯỚC các badge khác: điểm phù hợp là thứ phân biệt tin này
                với tin kia nhanh nhất khi mắt lướt qua một danh sách dài. Tự ẩn
                khi chưa đo được — xem BadgePhuHop. */}
            <BadgePhuHop job={job} />
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
