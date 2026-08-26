import { Link, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  Loader2,
  MapPin,
  Send,
  Users,
  Wallet,
} from 'lucide-react'
import { SCHEDULE_TYPE_LABELS, type AvailabilitySlot } from '@uniwork/shared'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { BadgePhuHop } from '@/components/BadgePhuHop'
import { LuoiKhungGio } from '@/components/LuoiKhungGio'
import { NutLuuTin } from '@/components/NutLuuTin'
import { useAvailability } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { usePublicJob } from '@/hooks/usePublicJobs'
import { cn, formatSalary } from '@/lib/utils'

/** Chữ cái đầu + màu suy từ tên, giống thẻ tin — xem giải thích ở `JobCard`. */
const MAU_AVATAR = ['bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-500']

function mauTheoTen(ten: string) {
  const tong = [...ten].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return MAU_AVATAR[tong % MAU_AVATAR.length]
}

/**
 * Chi tiết một tin tuyển dụng (T85).
 *
 * ---------------------------------------------------------------------------
 * LỊCH RẢNH ĐỐI CHIẾU LÀ DỮ LIỆU THẬT, KHÔNG PHẢI MẪU
 * ---------------------------------------------------------------------------
 * Bản trước vẽ một mảng lịch rảnh ghi cứng trong file và nói "phần tô xanh là
 * giờ bạn đang rảnh" — với mọi người xem, kể cả người chưa đăng nhập. Giờ lấy
 * từ `GET /api/toi/lich-ranh` của chính người đang xem, và chỉ hiện phần đối
 * chiếu khi có dữ liệu thật để đối chiếu.
 *
 * Sinh viên chưa khai lịch thì hiện lời mời đi khai, thay vì một lưới trống
 * không giải thích gì.
 */
export function JobDetail() {
  // `:id` luôn là đoạn cuối của đường dẫn, ở cả hai route khai trong `App.tsx`
  // — có slug hay không. Không phải cắt chuỗi gì cả; phần slug (nếu có) nằm ở
  // `params.slug` và trang này không cần tới nó.
  const { id } = useParams()
  const { data: job, isLoading, isError } = usePublicJob(id)

  const { user } = useAuth()
  const laSinhVien = user?.role === 'STUDENT'

  // Chỉ gọi khi người xem là sinh viên: nhà tuyển dụng và khách không có lịch
  // rảnh, gọi vào chỉ nhận 403 rồi hiện lỗi cho một thứ không liên quan tới họ.
  const { data: lichRanh } = useAvailability({ enabled: laSinhVien })

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Không tìm thấy tin này</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tin có thể đã được gỡ xuống, đã đóng, hoặc đường dẫn không đúng.
        </p>
        <Link
          to="/viec-lam"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Về danh sách việc làm
        </Link>
      </div>
    )
  }

  const oRanh = (lichRanh?.slots ?? []) as AvailabilitySlot[]
  const daKhaiLich = oRanh.length > 0

  /** Số ca của tin mà sinh viên rảnh — con số đáng nói nhất trên trang này. */
  const soCaTrung = job.shifts.filter((ca) =>
    oRanh.some((o) => o.dayOfWeek === ca.dayOfWeek && o.slot === ca.slot),
  ).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link to="/viec-lam" className="transition-colors hover:text-brand-600">
          Việc làm
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{job.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex gap-4">
              <div
                className={cn(
                  'grid h-16 w-16 shrink-0 place-items-center rounded-xl text-2xl font-bold text-white',
                  mauTheoTen(job.employer.companyName),
                )}
              >
                {job.employer.companyName.trim().slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
                <p className="mt-1 flex items-center gap-1 text-slate-600">
                  {job.employer.companyName}
                  {job.employer.verified && <BadgeCheck size={16} className="text-brand-500" />}
                </p>
                {job.employerWebsite && (
                  <a
                    href={job.employerWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-brand-600 transition-colors hover:text-brand-700"
                  >
                    <ExternalLink size={13} />
                    Website doanh nghiệp
                  </a>
                )}
              </div>
            </div>

            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              {[
                {
                  icon: Wallet,
                  label: 'Mức lương',
                  value: formatSalary(
                    job.salaryMin,
                    job.salaryMax,
                    job.salaryUnit,
                    job.salaryNegotiable,
                  ),
                },
                {
                  icon: MapPin,
                  label: 'Khu vực',
                  value: `${job.district}, ${job.city}`,
                },
                { icon: Users, label: 'Số lượng', value: `${job.quantity} người` },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <item.icon size={18} className="mt-0.5 shrink-0 text-brand-500" />
                  <div>
                    <dt className="text-xs text-slate-400">{item.label}</dt>
                    <dd className="text-sm font-semibold text-slate-800">{item.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Khung giờ cần người" />
            <div className="px-5 py-4">
              {/*
                Cố ý KHÔNG gọi đây là "ca làm việc".

                `TimeSlot` là khung khai báo chuẩn hoá để hai bên ghép lịch, chứ
                không phải giờ vào ca của quán — xem `TIME_SLOTS` phía shared.
                Quán cần người 10:00–16:00 sẽ khai cả Sáng lẫn Chiều; gọi đó là
                "ca làm" thì sinh viên đọc thành một ca 12 tiếng.
              */}
              <p className="mb-4 text-sm text-slate-500">
                {daKhaiLich
                  ? 'Ô xanh đậm là khung giờ tin này cần người làm được. Ô viền đứt là khung bạn đã khai rảnh.'
                  : 'Ô xanh đậm là khung giờ tin này cần người làm được.'}
              </p>
              <p className="mb-4 text-xs text-slate-400">
                Đây là khung để đối chiếu lịch, không phải giờ vào ca. Giờ làm cụ
                thể do bạn và nhà tuyển dụng trao đổi khi phỏng vấn.
              </p>

              <LuoiKhungGio
                ariaLabel="Ca làm của tin"
                value={job.shifts}
                overlay={daKhaiLich ? oRanh : undefined}
              />

              {laSinhVien && !daKhaiLich && (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  Bạn chưa khai lịch rảnh nên chưa đối chiếu được.{' '}
                  <Link to="/lich-ranh" className="font-medium text-brand-600 hover:text-brand-700">
                    Khai lịch rảnh
                  </Link>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Mô tả công việc" />
            <div className="space-y-5 px-5 py-4 text-sm leading-relaxed text-slate-600">
              {/* Giữ nguyên xuống dòng người đăng gõ — gộp thành một khối liền
                  là làm khó chính người phải đọc. */}
              <p className="whitespace-pre-wrap">{job.description}</p>

              {job.requirements.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">Yêu cầu</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {job.requirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.benefits.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">Quyền lợi</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {job.benefits.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.skills.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">Kỹ năng yêu cầu</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((s) => (
                      <Badge key={s.id} tone="brand">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {job.employerAddress && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">Địa chỉ làm việc</h3>
                  <p>{job.employerAddress}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            {/*
              Điểm phù hợp giờ do SERVER tính (`job.matchScore`), không còn đếm
              tay ở đây nữa. Một công thức ở một chỗ: thẻ tin trong danh sách,
              trang này, và trang tin đã lưu đều hiện đúng cùng con số.

              Vẫn giữ dòng "x/y ca" bên dưới vì phần trăm không nói được quy mô:
              50% của một tin 2 ca khác hẳn 50% của một tin 8 ca.
            */}
            {job.matchScore !== null && (
              <div className="mb-4 flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 p-3">
                <BadgePhuHop job={job} to />
                <span className="text-xs text-slate-500">
                  {soCaTrung}/{job.shifts.length} ca của tin bạn đang rảnh
                </span>
              </div>
            )}

            {/* Ứng tuyển thuộc Sprint 4 — giữ nút để thấy trước hình dạng trang,
                nhưng vô hiệu hoá và nói rõ, không để bấm vào rồi không có gì. */}
            <Button size="lg" className="w-full" disabled>
              <Send size={16} />
              Ứng tuyển ngay
            </Button>
            <p className="mt-1.5 text-center text-xs text-slate-400">Có ở Sprint 4</p>

            {/* Đặt ngay dưới nút ứng tuyển: khi chưa nộp được (Sprint 4), lưu
                lại là hành động duy nhất người dùng thật sự làm được ở đây. */}
            <div className="mt-2">
              <NutLuuTin job={job} coChu />
            </div>

            <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-slate-500">Loại thời gian</span>
                <span className="font-medium text-slate-800">
                  {SCHEDULE_TYPE_LABELS[job.scheduleType]}
                </span>
              </li>
              {job.commitmentMonths && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Cam kết</span>
                  <span className="font-medium text-slate-800">{job.commitmentMonths} tháng</span>
                </li>
              )}
              {job.minShiftsPerWeek && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Tối thiểu</span>
                  <span className="font-medium text-slate-800">
                    {job.minShiftsPerWeek} ca/tuần
                  </span>
                </li>
              )}
              {job.workDate && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Ngày làm</span>
                  <span className="font-medium text-slate-800">
                    {new Date(job.workDate).toLocaleDateString('vi-VN')}
                  </span>
                </li>
              )}
              {job.startDate && job.endDate && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Thời gian</span>
                  <span className="font-medium text-slate-800">
                    {new Date(job.startDate).toLocaleDateString('vi-VN')} –{' '}
                    {new Date(job.endDate).toLocaleDateString('vi-VN')}
                  </span>
                </li>
              )}
              <li className="flex items-center justify-between">
                <span className="text-slate-500">Hạn nộp</span>
                <span className="font-medium text-slate-800">
                  {new Date(job.deadline).toLocaleDateString('vi-VN')}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-500">Lượt xem</span>
                <span className="font-medium text-slate-800 tabular-nums">{job.viewCount}</span>
              </li>
            </ul>

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <CalendarClock size={14} className="mt-0.5 shrink-0" />
              Thông tin liên hệ của bạn chỉ được gửi cho nhà tuyển dụng khi hồ sơ vào vòng trong.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
