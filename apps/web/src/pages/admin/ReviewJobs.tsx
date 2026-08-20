import { useMemo, useState } from 'react'
import { AlertTriangle, MapPin, Users } from 'lucide-react'
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
import { PENDING_JOBS, type JobReviewStatus } from '@/data/adminMock'
import { SCHEDULE_TYPE_LABELS } from '@/data/mock'
import { cn } from '@/lib/utils'

type Filter = 'ALL' | JobReviewStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'ALL', label: 'Tất cả' },
]

const STATUS_META: Record<JobReviewStatus, { tone: 'ok' | 'wait' | 'bad'; label: string }> = {
  PENDING: { tone: 'wait', label: 'Chờ duyệt' },
  APPROVED: { tone: 'ok', label: 'Đã duyệt' },
  REJECTED: { tone: 'bad', label: 'Từ chối' },
}

/**
 * Duyệt tin tuyển dụng.
 *
 * Quyết định duyệt/từ chối hiện chỉ đổi state trong bộ nhớ — chưa gọi API. Nhưng
 * luồng thì đúng như đã chốt: tin ở trạng thái PENDING, admin đọc các cờ cảnh
 * báo hệ thống tự gắn rồi chuyển sang APPROVED hoặc REJECTED, và bộ lọc phía
 * trên đếm lại ngay. Nhờ vậy xem trước được cảm giác dùng thật trước khi có
 * endpoint.
 */
export function ReviewJobs() {
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [query, setQuery] = useState('')
  const [decisions, setDecisions] = useState<Record<string, JobReviewStatus>>({})

  const jobs = useMemo(
    () => PENDING_JOBS.map((j) => ({ ...j, status: decisions[j.id] ?? j.status })),
    [decisions],
  )

  const counts = useMemo(
    () => ({
      ALL: jobs.length,
      PENDING: jobs.filter((j) => j.status === 'PENDING').length,
      APPROVED: jobs.filter((j) => j.status === 'APPROVED').length,
      REJECTED: jobs.filter((j) => j.status === 'REJECTED').length,
    }),
    [jobs],
  )

  const rows = jobs.filter((j) => {
    if (filter !== 'ALL' && j.status !== filter) return false
    if (!query) return true
    const haystack = `${j.title} ${j.company} ${j.district}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Duyệt tin tuyển dụng" subtitle={`${counts.PENDING} tin đang chờ xử lý`} />

      <TableShell>
        <Toolbar
          placeholder="Tìm theo tiêu đề, doanh nghiệp, khu vực…"
          value={query}
          onChange={setQuery}
        >
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
        </Toolbar>

        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr>
              <Th>Tin tuyển dụng</Th>
              <Th>Loại ca</Th>
              <Th>Mức lương</Th>
              <Th>Cần</Th>
              <Th>Gửi lúc</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7}>Không có tin nào khớp bộ lọc hiện tại.</EmptyRow>
            )}

            {rows.map((job, i) => (
              <tr
                key={job.id}
                className="dash-row dash-in"
                // So le 26ms — đủ để mắt đọc ra bảng đang được dựng theo thứ tự
                // từ trên xuống, chưa đủ lâu để ai phải ngồi chờ hàng cuối.
                style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
              >
                <Td>
                  <div className="flex items-start gap-3">
                    <Avatar name={job.company} />
                    <div className="min-w-0">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-dash-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        <span>{job.company}</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {job.district}
                        </span>
                      </p>

                      {job.flags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {job.flags.map((flag) => (
                            <span
                              key={flag}
                              className="bg-dash-bad/12 text-dash-bad inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                            >
                              <AlertTriangle size={10} />
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Td>

                <Td className="text-dash-muted whitespace-nowrap">
                  {SCHEDULE_TYPE_LABELS[job.scheduleType]}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{job.salaryText}</Td>
                <Td className="text-dash-muted whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Users size={12} />
                    {job.quantity}
                  </span>
                </Td>
                <Td className="text-dash-muted whitespace-nowrap">{job.submittedAt}</Td>
                <Td>
                  <StatusBadge tone={STATUS_META[job.status].tone}>
                    {STATUS_META[job.status].label}
                  </StatusBadge>
                </Td>

                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    {job.status === 'PENDING' ? (
                      <>
                        <RowAction
                          tone="ok"
                          onClick={() => setDecisions((d) => ({ ...d, [job.id]: 'APPROVED' }))}
                        >
                          Duyệt
                        </RowAction>
                        <RowAction
                          tone="bad"
                          onClick={() => setDecisions((d) => ({ ...d, [job.id]: 'REJECTED' }))}
                        >
                          Từ chối
                        </RowAction>
                      </>
                    ) : (
                      <RowAction
                        onClick={() => setDecisions((d) => ({ ...d, [job.id]: 'PENDING' }))}
                      >
                        Hoàn tác
                      </RowAction>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={cn('text-dash-muted flex items-center justify-between gap-3 p-4 text-xs')}>
          <span>
            Hiện {rows.length} trên {jobs.length} tin
          </span>
          <span>Quyết định lưu tạm trong phiên, chưa gọi API</span>
        </div>
      </TableShell>
    </div>
  )
}
