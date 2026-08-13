import { Link } from 'react-router-dom'
import { BadgeCheck, Bookmark, Clock, MapPin, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { DAY_LABELS, SCHEDULE_TYPE_LABELS, TIME_SLOTS, type Job } from '@/data/mock'
import { cn, formatSalary } from '@/lib/utils'

function shiftSummary(job: Job) {
  const days = [...new Set(job.shifts.map((s) => s.dayOfWeek))]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => DAY_LABELS[d])
  const slots = [...new Set(job.shifts.map((s) => s.slot))].map(
    (id) => TIME_SLOTS.find((t) => t.id === id)!.label,
  )
  return `${days.join(', ')} · ca ${slots.join(', ').toLowerCase()}`
}

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="group relative rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        <div
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-lg text-lg font-bold text-white',
            job.companyColor,
          )}
        >
          {job.companyInitial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 font-semibold text-slate-900 group-hover:text-brand-700">
              <Link to={`/viec-lam/${job.id}`} className="before:absolute before:inset-0">
                {job.title}
              </Link>
            </h3>
            <button
              className="relative z-10 shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-brand-600"
              aria-label="Lưu tin"
            >
              <Bookmark size={18} />
            </button>
          </div>

          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            {job.company}
            {job.verified && <BadgeCheck size={14} className="text-brand-500" />}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Wallet size={14} className="text-slate-400" />
              <strong className="font-semibold text-emerald-600">
                {formatSalary(job.salaryMin, job.salaryMax, job.salaryUnit)}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" />
              {job.district}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} className="text-slate-400" />
              {shiftSummary(job)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{SCHEDULE_TYPE_LABELS[job.scheduleType]}</Badge>
            {job.commitmentMonths && <Badge>Cam kết {job.commitmentMonths} tháng</Badge>}
            {job.skills.slice(0, 2).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
            <span className="ml-auto text-xs text-slate-400">{job.postedAt}</span>
          </div>
        </div>
      </div>

      <MatchBar score={job.matchScore} />
    </article>
  )
}

/** Điểm phù hợp = kỹ năng khớp + ca khớp + mức đáp ứng cam kết (README mục 5). */
function MatchBar({ score }: { score: number }) {
  const tone = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-accent-500' : 'bg-slate-300'
  const label = score >= 85 ? 'Rất phù hợp lịch của bạn' : score >= 70 ? 'Khá phù hợp' : 'Ít phù hợp'

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-500">
        {label} · {score}%
      </span>
    </div>
  )
}
