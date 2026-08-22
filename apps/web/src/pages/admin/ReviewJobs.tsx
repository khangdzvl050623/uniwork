import { Fragment, useMemo, useState } from 'react'
import { BadgeCheck, ChevronDown, Loader2, MapPin, Users } from 'lucide-react'
import {
  SALARY_UNIT_LABELS,
  SCHEDULE_TYPE_LABELS,
  TIME_SLOT_LABELS,
  type AdminJobResponse,
  type JobStatus,
} from '@uniwork/shared'
import { StatusBadge } from '@/components/admin/Charts'
import {
  Avatar,
  EmptyRow,
  FilterChips,
  PageHeader,
  RowAction,
  TableShell,
  Td,
  Th,
  Toolbar,
} from '@/components/admin/Table'
import { useAdminJobs, useReviewJob } from '@/hooks/useAdminJobs'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

const FILTERS: { value: JobStatus; label: string }[] = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'OPEN', label: 'Đang hiển thị' },
  { value: 'DRAFT', label: 'Nháp / bị từ chối' },
  { value: 'CLOSED', label: 'Đã đóng' },
]

const STATUS_TONE: Record<JobStatus, 'ok' | 'wait' | 'bad'> = {
  PENDING: 'wait',
  OPEN: 'ok',
  DRAFT: 'wait',
  CLOSED: 'bad',
}

/** "25.000 – 30.000đ/giờ" hoặc "Thoả thuận/giờ". */
function moTaLuong(job: AdminJobResponse): string {
  const donVi = SALARY_UNIT_LABELS[job.salaryUnit]
  if (job.salaryNegotiable) return `Thoả thuận/${donVi}`
  return `${job.salaryMin?.toLocaleString('vi-VN')} – ${job.salaryMax?.toLocaleString('vi-VN')}đ/${donVi}`
}

/**
 * Duyệt tin tuyển dụng (T83).
 *
 * ---------------------------------------------------------------------------
 * BẢNG NÀY MỞ RỘNG ĐƯỢC, VÀ ĐÓ LÀ ĐIỂM CHÍNH
 * ---------------------------------------------------------------------------
 * Lý do khâu duyệt tồn tại là chặn tin lừa đảo, mà tin lừa đảo nằm trong MÔ TẢ —
 * không phải ở tiêu đề hay mức lương. Một bảng chỉ hiện tiêu đề và lương thì
 * admin không có gì để phán đoán ngoài cảm tính, và sẽ bấm duyệt tất.
 *
 * Nên hàng mở rộng cho đọc nguyên mô tả, yêu cầu, quyền lợi và ca làm. API đã
 * trả sẵn toàn bộ trong danh sách (xem `AdminJobResponse`) nên mở ra không tốn
 * thêm một lần gọi nào.
 *
 * Cố ý KHÔNG có cột "cờ cảnh báo tự động" như bản dựng giả trước đây: hệ thống
 * chưa có cơ chế nào gắn cờ, hiện một cột trống rỗng chỉ làm admin tưởng đã có
 * ai đó sàng lọc hộ.
 */
export function ReviewJobs() {
  const [status, setStatus] = useState<JobStatus>('PENDING')
  const [query, setQuery] = useState('')
  const [moRong, setMoRong] = useState<string | null>(null)

  const { data, isLoading } = useAdminJobs(status)
  const duyet = useReviewJob()

  /** Tin đang mở ô nhập lý do từ chối. */
  const [dangTuChoi, setDangTuChoi] = useState<string | null>(null)
  const [lyDo, setLyDo] = useState('')
  const [dangXuLy, setDangXuLy] = useState<string | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  const jobs = useMemo(() => data?.jobs ?? [], [data])

  const rows = jobs.filter((j) =>
    `${j.title} ${j.employer.companyName} ${j.district}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  async function quyetDinh(job: AdminJobResponse, dongY: boolean) {
    setLoi(null)
    setDangXuLy(job.id)
    try {
      await duyet.mutateAsync(
        dongY
          ? { id: job.id, decision: 'APPROVE' }
          : { id: job.id, decision: 'REJECT', rejectionReason: lyDo.trim() },
      )
      setDangTuChoi(null)
      setLyDo('')
    } catch (err) {
      if (err instanceof ApiClientError) setLoi(err.message)
    } finally {
      setDangXuLy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={26} className="text-dash-muted animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Duyệt tin tuyển dụng"
        subtitle={
          status === 'PENDING'
            ? `${jobs.length} tin đang chờ duyệt`
            : `${jobs.length} tin — ${FILTERS.find((f) => f.value === status)?.label}`
        }
      />

      {loi && (
        <p className="border-dash-bad/40 bg-dash-bad/10 text-dash-bad rounded-lg border px-4 py-3 text-sm">
          {loi}
        </p>
      )}

      <TableShell>
        <Toolbar
          placeholder="Tìm theo tiêu đề, doanh nghiệp, khu vực…"
          value={query}
          onChange={setQuery}
        >
          <FilterChips options={FILTERS} value={status} onChange={setStatus} />
        </Toolbar>

        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <Th>Tin tuyển dụng</Th>
              <Th>Loại ca</Th>
              <Th>Lương</Th>
              <Th>Cần</Th>
              <Th>Gửi lúc</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7}>
                {status === 'PENDING'
                  ? 'Không có tin nào đang chờ duyệt.'
                  : 'Không có tin nào khớp bộ lọc hiện tại.'}
              </EmptyRow>
            )}

            {rows.map((job, i) => {
              const dangMo = moRong === job.id
              const banRon = dangXuLy === job.id

              return (
                <Fragment key={job.id}>
                  <tr className="dash-row dash-in" style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={job.employer.companyName} />
                        <div className="min-w-0">
                          <p className="font-medium">{job.title}</p>
                          <p className="text-dash-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                            <span className="inline-flex items-center gap-1">
                              {job.employer.companyName}
                              {/* NTD chưa xác minh mà tin lọt tới đây là bất thường —
                                  gửi duyệt đã đòi verifiedAt. Hiện dấu để admin soi kỹ. */}
                              {job.employer.verifiedAt && (
                                <BadgeCheck size={12} className="text-dash-ok" />
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              {job.district}
                            </span>
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td className="text-dash-muted whitespace-nowrap">
                      {SCHEDULE_TYPE_LABELS[job.scheduleType]}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{moTaLuong(job)}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users size={12} className="text-dash-muted" />
                        {job.quantity}
                      </span>
                    </Td>
                    <Td className="text-dash-muted whitespace-nowrap tabular-nums">
                      {new Date(job.updatedAt).toLocaleDateString('vi-VN')}
                    </Td>
                    <Td>
                      <StatusBadge tone={STATUS_TONE[job.status]}>
                        {FILTERS.find((f) => f.value === job.status)?.label ?? job.status}
                      </StatusBadge>
                    </Td>

                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <RowAction onClick={() => setMoRong(dangMo ? null : job.id)}>
                          <span className="flex items-center gap-1">
                            Nội dung
                            <ChevronDown
                              size={13}
                              className={cn(
                                'transition-transform duration-200 ease-out',
                                dangMo && 'rotate-180',
                              )}
                            />
                          </span>
                        </RowAction>

                        {job.status === 'PENDING' && (
                          <>
                            <RowAction
                              tone="ok"
                              onClick={() => void quyetDinh(job, true)}
                              disabled={banRon}
                            >
                              {banRon ? <Loader2 size={13} className="animate-spin" /> : 'Duyệt'}
                            </RowAction>
                            <RowAction
                              tone="bad"
                              onClick={() => {
                                setDangTuChoi(dangTuChoi === job.id ? null : job.id)
                                setLyDo('')
                                setMoRong(job.id)
                              }}
                              disabled={banRon}
                            >
                              Từ chối
                            </RowAction>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>

                  {(dangMo || dangTuChoi === job.id) && (
                    <tr>
                      <td colSpan={7} className="border-dash-line bg-dash-raised/40 border-b p-0">
                        <NoiDungTin
                          job={job}
                          dangTuChoi={dangTuChoi === job.id}
                          lyDo={lyDo}
                          onDoiLyDo={setLyDo}
                          onGuiTuChoi={() => void quyetDinh(job, false)}
                          banRon={banRon}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}

/** Nội dung đầy đủ của tin — thứ admin thật sự cần đọc để phán đoán. */
function NoiDungTin({
  job,
  dangTuChoi,
  lyDo,
  onDoiLyDo,
  onGuiTuChoi,
  banRon,
}: {
  job: AdminJobResponse
  dangTuChoi: boolean
  lyDo: string
  onDoiLyDo: (v: string) => void
  onGuiTuChoi: () => void
  banRon: boolean
}) {
  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div>
        <p className="text-dash-muted mb-1 text-xs font-semibold tracking-wide uppercase">
          Mô tả công việc
        </p>
        {/* `whitespace-pre-wrap` giữ nguyên xuống dòng người đăng gõ. Gộp hết
            thành một khối liền là làm khó chính người phải đọc nó. */}
        <p className="text-sm whitespace-pre-wrap">{job.description}</p>
      </div>

      {job.requirements.length > 0 && (
        <div>
          <p className="text-dash-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Yêu cầu
          </p>
          <ul className="list-inside list-disc text-sm">
            {job.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {job.benefits.length > 0 && (
        <div>
          <p className="text-dash-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Quyền lợi
          </p>
          <ul className="list-inside list-disc text-sm">
            {job.benefits.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-dash-muted">Ca làm: </span>
          {job.shifts.length} ca —{' '}
          {[...new Set(job.shifts.map((s) => s.slot))]
            .map((s) => TIME_SLOT_LABELS[s].label)
            .join(', ')}
        </span>
        <span>
          <span className="text-dash-muted">Hạn nộp: </span>
          {new Date(job.deadline).toLocaleDateString('vi-VN')}
        </span>
        {job.skills.length > 0 && (
          <span>
            <span className="text-dash-muted">Kỹ năng: </span>
            {job.skills.map((s) => s.name).join(', ')}
          </span>
        )}
      </div>

      {dangTuChoi && (
        /* Lý do là BẮT BUỘC — API từ chối request không có nó. Từ chối im lặng
           đẩy nhà tuyển dụng vào chỗ gửi lại đúng tin cũ vì không biết sai đâu,
           và làm nghẽn chính hàng đợi này. */
        <div className="border-dash-line flex flex-wrap items-center gap-2 border-t pt-3">
          <input
            autoFocus
            value={lyDo}
            onChange={(e) => onDoiLyDo(e.target.value)}
            placeholder="Lý do từ chối — nhà tuyển dụng sẽ đọc được dòng này"
            maxLength={500}
            className="border-dash-line bg-dash-surface focus:border-dash-accent/60 placeholder:text-dash-muted min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
          />
          <RowAction tone="bad" onClick={onGuiTuChoi} disabled={!lyDo.trim() || banRon}>
            {banRon ? <Loader2 size={13} className="animate-spin" /> : 'Gửi từ chối'}
          </RowAction>
        </div>
      )}
    </div>
  )
}
