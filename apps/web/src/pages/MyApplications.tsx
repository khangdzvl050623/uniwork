import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Clock3, Loader2, RotateCcw } from 'lucide-react'
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type StudentApplicationItem,
} from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { useMyApplications, useWithdrawApplication } from '@/hooks/useApplications'

const statusTone: Record<ApplicationStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  VIEWED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  WITHDRAWN: 'bg-slate-100 text-slate-600',
}

function coTheRut(status: ApplicationStatus) {
  return status !== 'ACCEPTED' && status !== 'REJECTED' && status !== 'WITHDRAWN'
}

function Timeline({ application }: { application: StudentApplicationItem }) {
  return (
    <ol className="mt-5 space-y-4 border-l border-slate-200 pl-5">
      {application.events.map((event, index) => (
        <li key={`${event.createdAt}-${index}`} className="relative">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[event.status]}`}>
              {APPLICATION_STATUS_LABELS[event.status]}
            </span>
            <time className="text-xs text-slate-400">
              {new Date(event.createdAt).toLocaleString('vi-VN')}
            </time>
          </div>
          {event.note && <p className="mt-1 text-sm text-slate-600">{event.note}</p>}
        </li>
      ))}
    </ol>
  )
}

function ApplicationCard({ application }: { application: StudentApplicationItem }) {
  const withdraw = useWithdrawApplication()
  const rutDon = () => {
    if (!window.confirm('Bạn chắc chắn muốn rút đơn này?')) return
    withdraw.mutate(application.id)
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/viec-lam/${application.jobId}`} className="text-lg font-semibold text-slate-900 hover:text-brand-700">
            {application.jobTitle}
          </Link>
          <p className="mt-1 text-sm text-slate-500">{application.companyName}</p>
          <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[application.status]}`}>
            {APPLICATION_STATUS_LABELS[application.status]}
          </span>
        </div>
        {coTheRut(application.status) && (
          <Button
            type="button"
            variant="outline"
            onClick={rutDon}
            disabled={withdraw.isPending}
            className="text-rose-600 hover:text-rose-700"
          >
            <RotateCcw size={15} />
            {withdraw.isPending ? 'Đang rút…' : 'Rút đơn'}
          </Button>
        )}
      </div>
      {application.matchBreakdown && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 size={13} />
          Điểm phù hợp {application.matchScore ?? '—'} · tính theo lịch rảnh lúc bạn nộp đơn
        </p>
      )}
      <Timeline application={application} />
    </article>
  )
}

export function MyApplications() {
  const { data, isPending, isError } = useMyApplications()
  const applications = data?.applications ?? []

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Đơn của tôi</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isPending ? 'Đang tải…' : `${applications.length} đơn ứng tuyển`}
      </p>

      {isPending && (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand-600" />
        </div>
      )}
      {isError && (
        <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Không tải được danh sách đơn ứng tuyển. Vui lòng thử lại.
        </p>
      )}
      {!isPending && !isError && applications.length === 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <BriefcaseBusiness size={30} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-600">Bạn chưa nộp đơn nào.</p>
          <Link to="/viec-lam" className="mt-2 inline-block text-sm font-medium text-brand-700">
            Tìm việc phù hợp →
          </Link>
        </div>
      )}
      <div className="mt-6 space-y-4">
        {applications.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
      </div>
    </main>
  )
}
