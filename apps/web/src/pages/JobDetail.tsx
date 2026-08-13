import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, CalendarClock, MapPin, Send, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ScheduleGrid, ScheduleLegend } from '@/components/ScheduleGrid'
import { JOBS, SCHEDULE_TYPE_LABELS, type Shift } from '@/data/mock'
import { cn, formatSalary } from '@/lib/utils'

/** Lịch rảnh giả của sinh viên đang đăng nhập, để đối chiếu với ca làm của tin. */
const MY_AVAILABILITY: Shift[] = [
  { dayOfWeek: 2, slot: 'evening' },
  { dayOfWeek: 3, slot: 'evening' },
  { dayOfWeek: 4, slot: 'evening' },
  { dayOfWeek: 6, slot: 'evening' },
  { dayOfWeek: 6, slot: 'afternoon' },
]

export function JobDetail() {
  const { id } = useParams()
  const job = JOBS.find((j) => j.id === id) ?? JOBS[0]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link to="/viec-lam" className="hover:text-brand-600">
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
                  job.companyColor,
                )}
              >
                {job.companyInitial}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
                <p className="mt-1 flex items-center gap-1 text-slate-600">
                  {job.company}
                  {job.verified && <BadgeCheck size={16} className="text-brand-500" />}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              {[
                { icon: Wallet, label: 'Mức lương', value: formatSalary(job.salaryMin, job.salaryMax, job.salaryUnit) },
                { icon: MapPin, label: 'Khu vực', value: `${job.district}, ${job.city}` },
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
            <CardHeader title="Ca làm việc" />
            <div className="px-5 py-4">
              <p className="mb-4 text-sm text-slate-500">
                Phần tô xanh lá là giờ bạn đang rảnh — ô xanh đậm là ca tin này cần.
              </p>
              <ScheduleGrid selected={job.shifts} overlay={MY_AVAILABILITY} />
              <ScheduleLegend withOverlay />
            </div>
          </Card>

          <Card>
            <CardHeader title="Mô tả công việc" />
            <div className="space-y-5 px-5 py-4 text-sm leading-relaxed text-slate-600">
              <p>{job.description}</p>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Yêu cầu</h3>
                <ul className="list-disc space-y-1 pl-5">
                  {job.requirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Quyền lợi</h3>
                <ul className="list-disc space-y-1 pl-5">
                  {job.benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Kỹ năng yêu cầu</h3>
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600">{job.matchScore}%</div>
              <div className="text-xs font-medium text-emerald-700">phù hợp với hồ sơ của bạn</div>
            </div>

            <Button size="lg" className="w-full">
              <Send size={16} />
              Ứng tuyển ngay
            </Button>
            <Button variant="outline" className="mt-2 w-full">
              Lưu tin
            </Button>

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
              <li className="flex items-center justify-between">
                <span className="text-slate-500">Hạn nộp</span>
                <span className="font-medium text-slate-800">{job.deadline}</span>
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
