import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Clock3, Lock, Loader2, Mail, Phone, RotateCcw } from 'lucide-react'
import {
  APPLICATION_STATUS_LABELS,
  TRANG_THAI_KET_THUC,
  duongDanTin,
  type ApplicationStatus,
  type StudentApplicationItem,
} from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChipPhuHop } from '@/components/ChipPhuHop'
import { useMyApplications, useWithdrawApplication } from '@/hooks/useApplications'

const statusTone: Record<ApplicationStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  VIEWED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  WITHDRAWN: 'bg-slate-100 text-slate-600',
}

/** Cùng một luật với server — đọc chung `TRANG_THAI_KET_THUC`, không chép tay. */
function coTheRut(status: ApplicationStatus) {
  return !TRANG_THAI_KET_THUC.includes(status)
}

function Timeline({ application }: { application: StudentApplicationItem }) {
  return (
    <ol className="mt-5 space-y-4 border-l border-slate-200 pl-5">
      {application.events.map((event, index) => (
        <li key={`${event.createdAt}-${index}`} className="relative">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[event.status]}`}
            >
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
  // `Dialog` chứ không `window.confirm`: hộp thoại của trình duyệt không theo
  // giao diện, không dịch được câu chữ, và chặn cả luồng trong lúc chờ. Mọi chỗ
  // xác nhận khác của dự án đều dùng `Dialog`.
  const [moXacNhan, setMoXacNhan] = useState(false)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap">
        <div>
          {/* `duongDanTin` để URL mang cả slug tiêu đề lẫn id, giống mọi thẻ tin
              khác. Dùng id trần vẫn vào được (route giữ cả hai dạng) nhưng người
              dùng chép link đi thì mất hết ngữ nghĩa. */}
          <Link
            to={`/viec-lam/${duongDanTin({ id: application.jobId, title: application.jobTitle })}`}
            className="text-lg font-semibold text-slate-900 hover:text-brand-700"
          >
            {application.jobTitle}
          </Link>
          <p className="mt-1 text-sm text-slate-500">{application.companyName}</p>
          <span
            className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[application.status]}`}
          >
            {APPLICATION_STATUS_LABELS[application.status]}
          </span>
        </div>
        {coTheRut(application.status) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setMoXacNhan(true)}
            disabled={withdraw.isPending}
            className="text-rose-600 hover:text-rose-700"
          >
            <RotateCcw size={15} />
            {withdraw.isPending ? 'Đang rút…' : 'Rút đơn'}
          </Button>
        )}
      </div>
      {/*
        Hiện CHI TIẾT từng thành phần, không hiện con số tổng hợp.

        "Điểm phù hợp 47" không cho sinh viên biết phải làm gì để nó lên; còn
        "3/4 ca · 1/2 kỹ năng" thì hành động được. Con số tổng hợp vẫn tồn tại
        nhưng vai trò của nó là khoá sắp xếp ở tầng SQL.
      */}
      {application.matchBreakdown && (
        <div className="mt-4">
          <ChipPhuHop breakdown={application.matchBreakdown} />
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock3 size={13} />
            Tính theo lịch rảnh lúc bạn nộp đơn — đổi lịch sau đó không làm số này đổi
          </p>
        </div>
      )}
      <Timeline application={application} />

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
        <p className="text-sm font-semibold text-slate-800">Liên hệ nhà tuyển dụng</p>
        {application.employerContact ? (
          <div className="mt-2 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {application.employerContact.phone && (
              <a
                href={`tel:${application.employerContact.phone}`}
                className="flex min-w-0 items-center gap-1.5 hover:text-brand-700 hover:underline"
              >
                <Phone size={14} className="shrink-0" />
                <span className="break-all">{application.employerContact.phone}</span>
              </a>
            )}
            <a
              href={`mailto:${application.employerContact.email}`}
              className="flex min-w-0 items-center gap-1.5 hover:text-brand-700 hover:underline"
            >
              <Mail size={14} className="shrink-0" />
              <span className="break-all">{application.employerContact.email}</span>
            </a>
          </div>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
            <Lock size={13} className="mt-0.5 shrink-0" />
            Thông tin liên hệ sẽ mở khi nhà tuyển dụng mời bạn phỏng vấn.
          </p>
        )}
      </div>

      <Dialog open={moXacNhan} onOpenChange={setMoXacNhan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rút đơn ứng tuyển?</DialogTitle>
            <DialogDescription>
              Đơn cho “{application.jobTitle}” sẽ chuyển sang <strong>Đã rút</strong> và nhà tuyển
              dụng nhận được thông báo. Bạn không nộp lại tin này được nữa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoXacNhan(false)}
              disabled={withdraw.isPending}
            >
              Giữ đơn
            </Button>
            <Button
              onClick={() =>
                withdraw.mutate(application.id, { onSuccess: () => setMoXacNhan(false) })
              }
              disabled={withdraw.isPending}
            >
              {withdraw.isPending && <Loader2 size={15} className="animate-spin" />}
              Rút đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

export function MyApplications() {
  const { data, isPending, isError } = useMyApplications()
  const applications = data?.applications ?? []

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Đơn của tôi</h1>
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
