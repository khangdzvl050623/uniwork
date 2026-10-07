import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  Headset,
  Loader2,
  MapPin,
  MessagesSquare,
  Send,
  ShieldAlert,
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
import { DialogUngTuyen } from '@/components/DialogUngTuyen'
import { DialogBaoCao } from '@/components/bao-cao/DialogBaoCao'
import { DialogHoiNTD } from '@/components/hoi-thoai/DialogHoiNTD'
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

  const [moUngTuyen, setMoUngTuyen] = useState(false)
  const [moHoiNTD, setMoHoiNTD] = useState(false)
  const [moBaoCao, setMoBaoCao] = useState(false)
  // Đường dẫn hiện tại để quay lại đúng tin này sau khi đăng nhập.
  const duongDan = useLocation().pathname
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
      <div className="mx-auto max-w-2xl px-4 py-10 text-center sm:py-16">
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <nav className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link
          to="/viec-lam"
          className="rounded-full bg-slate-100/80 px-3 py-1 text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
        >
          ← Danh sách việc làm
        </Link>
        <span className="text-slate-300">/</span>
        <span className="truncate font-semibold text-slate-700">{job.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="space-y-5">
          <Card className="overflow-hidden border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/50 p-6 sm:p-7 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className={cn(
                  'grid h-16 w-16 sm:h-18 sm:w-18 shrink-0 place-items-center rounded-2xl text-2xl font-black text-white shadow-md ring-4 ring-white/90',
                  mauTheoTen(job.employer.companyName),
                )}
              >
                {job.employer.companyName.trim().slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-snug">
                  {job.title}
                </h1>
                <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-slate-600">
                  {job.employer.companyName}
                  {job.employer.verified && <BadgeCheck size={17} className="text-brand-500" />}
                </p>
                {job.employerWebsite && (
                  <a
                    href={job.employerWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline"
                  >
                    <ExternalLink size={12} />
                    Website doanh nghiệp
                  </a>
                )}
              </div>
            </div>

            <dl className="mt-6 grid gap-3 border-t border-slate-100/90 pt-5 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-3.5 shadow-2xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Wallet size={16} />
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-emerald-800">Mức lương</dt>
                  <dd className="truncate text-sm font-extrabold text-emerald-950">
                    {formatSalary(
                      job.salaryMin,
                      job.salaryMax,
                      job.salaryUnit,
                      job.salaryNegotiable,
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 shadow-2xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <MapPin size={16} />
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-slate-400">Khu vực</dt>
                  <dd className="truncate text-sm font-bold text-slate-800">
                    {job.district}, {job.city}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 shadow-2xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-slate-400">Số lượng cần</dt>
                  <dd className="truncate text-sm font-bold text-slate-800">{job.quantity} người</dd>
                </div>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Khung giờ cần người" />
            <div className="px-6 py-5">
              <p className="mb-3 text-sm text-slate-600 font-medium">
                {daKhaiLich
                  ? 'Ô xanh đậm là khung giờ tin này cần người làm được. Ô viền đứt là khung bạn đã khai rảnh.'
                  : 'Ô xanh đậm là khung giờ tin này cần người làm được.'}
              </p>
              <p className="mb-4 text-xs text-slate-400">
                Đây là khung để đối chiếu lịch, không phải giờ vào ca. Giờ làm cụ thể do bạn và nhà
                tuyển dụng trao đổi khi phỏng vấn.
              </p>

              <LuoiKhungGio
                ariaLabel="Ca làm của tin"
                value={job.shifts}
                overlay={daKhaiLich ? oRanh : undefined}
              />

              {laSinhVien && !daKhaiLich && (
                <p className="mt-4 rounded-xl border border-brand-200/70 bg-brand-50/60 p-3.5 text-sm text-brand-900">
                  Bạn chưa khai lịch rảnh nên chưa đối chiếu được.{' '}
                  <Link to="/lich-ranh" className="font-bold text-brand-700 hover:text-brand-800 underline">
                    Khai lịch rảnh ngay
                  </Link>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Mô tả công việc" />
            <div className="space-y-6 px-6 py-5 text-sm leading-relaxed text-slate-600">
              <p className="whitespace-pre-wrap">{job.description}</p>

              {job.requirements.length > 0 && (
                <div>
                  <h3 className="mb-2 font-bold text-slate-900">Yêu cầu công việc</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-600">
                    {job.requirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.benefits.length > 0 && (
                <div>
                  <h3 className="mb-2 font-bold text-slate-900">Quyền lợi được hưởng</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-600">
                    {job.benefits.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.skills.length > 0 && (
                <div>
                  <h3 className="mb-2.5 font-bold text-slate-900">Kỹ năng yêu cầu</h3>
                  <div className="flex flex-wrap gap-2">
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
                  <h3 className="mb-2 font-bold text-slate-900">Địa chỉ làm việc</h3>
                  <p className="text-slate-700">{job.employerAddress}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[2.25rem] bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200/60 p-1.5 ring-1 ring-slate-200/80 shadow-xl">
            <div className="rounded-[1.85rem] bg-white p-5 sm:p-6 shadow-xs">
              {job.matchScore !== null && (
                <div className="mb-4 flex flex-col items-center gap-1.5 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/70 via-teal-50/40 to-emerald-50/30 p-3.5 shadow-2xs">
                  <BadgePhuHop job={job} to />
                  <span className="text-xs font-semibold text-slate-600">
                    {soCaTrung}/{job.shifts.length} ca của tin bạn đang rảnh
                  </span>
                </div>
              )}

              {laSinhVien ? (
                <>
                  <Button
                    variant="gradient"
                    size="lg"
                    className="h-12 w-full rounded-xl font-bold shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-brand-600/30 active:scale-98 transition-all duration-200"
                    onClick={() => setMoUngTuyen(true)}
                  >
                    <Send size={16} />
                    Ứng tuyển ngay
                  </Button>
                  <DialogUngTuyen job={job} open={moUngTuyen} onOpenChange={setMoUngTuyen} />
                </>
              ) : !user ? (
                <Link to={`/dang-nhap?tiep=${encodeURIComponent(duongDan)}`} className="block">
                  <Button
                    variant="gradient"
                    size="lg"
                    className="h-12 w-full rounded-xl font-bold shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-brand-600/30 active:scale-98 transition-all duration-200"
                  >
                    <Send size={16} />
                    Đăng nhập để ứng tuyển
                  </Button>
                </Link>
              ) : null}

              <div className={laSinhVien || !user ? 'mt-2.5' : ''}>
                <NutLuuTin job={job} coChu />
              </div>

              {laSinhVien && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => setMoHoiNTD(true)}
                  >
                    <MessagesSquare size={16} />
                    Hỏi nhà tuyển dụng
                  </Button>
                  <DialogHoiNTD
                    jobId={job.id}
                    tenTin={job.title}
                    congTy={job.employer.companyName}
                    open={moHoiNTD}
                    onOpenChange={setMoHoiNTD}
                  />

                  <div className="flex gap-2">
                    <Link to="/ho-tro" className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full rounded-xl">
                        <Headset size={15} />
                        Hỗ trợ
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-xl text-rose-700 hover:bg-rose-50"
                      onClick={() => setMoBaoCao(true)}
                    >
                      <ShieldAlert size={15} />
                      Báo cáo tin
                    </Button>
                  </div>
                  <DialogBaoCao
                    jobId={job.id}
                    tenTin={job.title}
                    open={moBaoCao}
                    onOpenChange={setMoBaoCao}
                  />
                </div>
              )}

              <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Loại thời gian</span>
                  <span className="font-semibold text-slate-800">
                    {SCHEDULE_TYPE_LABELS[job.scheduleType]}
                  </span>
                </li>
                {job.commitmentMonths && (
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Cam kết</span>
                    <span className="font-semibold text-slate-800">{job.commitmentMonths} tháng</span>
                  </li>
                )}
                {job.minShiftsPerWeek && (
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Tối thiểu</span>
                    <span className="font-semibold text-slate-800">{job.minShiftsPerWeek} ca/tuần</span>
                  </li>
                )}
                {job.workDate && (
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Ngày làm</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(job.workDate).toLocaleDateString('vi-VN')}
                    </span>
                  </li>
                )}
                {job.startDate && job.endDate && (
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Thời gian</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(job.startDate).toLocaleDateString('vi-VN')} –{' '}
                      {new Date(job.endDate).toLocaleDateString('vi-VN')}
                    </span>
                  </li>
                )}
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Hạn nộp</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(job.deadline).toLocaleDateString('vi-VN')}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-500">Lượt xem</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{job.viewCount}</span>
                </li>
              </ul>

              <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50/80 p-3 text-xs text-slate-500 border border-slate-100">
                <CalendarClock size={14} className="mt-0.5 shrink-0 text-brand-600" />
                Số điện thoại và email của bạn chỉ được gửi cho nhà tuyển dụng khi họ mời bạn phỏng
                vấn.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
