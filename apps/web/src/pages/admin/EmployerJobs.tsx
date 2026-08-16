import { useMemo, useState } from 'react'
import { Eye, FileText, Send, UserCheck } from 'lucide-react'
import { StatusBadge } from '@/components/admin/Charts'
import { KpiCard } from '@/components/admin/KpiCard'
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
import {
  APPLICATION_STATUS_LABELS,
  EMPLOYER_APPLICANTS,
  EMPLOYER_JOBS,
  JOB_STATUS_LABELS,
  type ApplicationStatus,
  type EmployerJob,
} from '@/data/adminMock'
import { SCHEDULE_TYPE_LABELS } from '@/data/mock'
import { cn } from '@/lib/utils'

const JOB_STATUS_TONE: Record<EmployerJob['status'], 'ok' | 'wait' | 'bad'> = {
  OPEN: 'ok',
  PENDING: 'wait',
  DRAFT: 'wait',
  CLOSED: 'bad',
}

const APPLICATION_TONE: Record<ApplicationStatus, 'ok' | 'wait' | 'bad'> = {
  SUBMITTED: 'wait',
  REVIEWING: 'wait',
  ACCEPTED: 'ok',
  REJECTED: 'bad',
}

type Tab = 'jobs' | 'applicants'

/**
 * Trang quản lý của nhà tuyển dụng.
 *
 * Dùng chung khung và bảng màu với khu admin vì đây cũng là màn hình làm việc —
 * NTD vào đây để xử lý danh sách, không phải để bị thuyết phục. Khác admin ở
 * phạm vi: NTD chỉ thấy tin và ứng viên của chính mình.
 *
 * Số ở các ô KPI cộng từ chính mảng tin bên dưới chứ không ghi cứng riêng. Nhờ
 * vậy không bao giờ có chuyện ô KPI nói một đằng, bảng nói một nẻo — lỗi rất
 * hay gặp ở dashboard khi hai chỗ lấy số từ hai nguồn khác nhau.
 */
export function EmployerDashboard() {
  const [tab, setTab] = useState<Tab>('jobs')
  const [query, setQuery] = useState('')

  const totals = useMemo(() => {
    const open = EMPLOYER_JOBS.filter((j) => j.status === 'OPEN')
    return {
      open: open.length,
      views: EMPLOYER_JOBS.reduce((sum, j) => sum + j.views, 0),
      applications: EMPLOYER_JOBS.reduce((sum, j) => sum + j.applications, 0),
      newApplicants: EMPLOYER_APPLICANTS.filter((a) => a.status === 'SUBMITTED').length,
    }
  }, [])

  const jobRows = EMPLOYER_JOBS.filter((j) => j.title.toLowerCase().includes(query.toLowerCase()))
  const applicantRows = EMPLOYER_APPLICANTS.filter((a) =>
    `${a.name} ${a.school} ${a.jobTitle}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tin đăng của tôi"
        subtitle="The Corner Coffee · đã xác minh giấy tờ"
        action={
          <button className="bg-dash-accent text-dash-accent-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97]">
            <FileText size={16} />
            Đăng tin mới
          </button>
        }
      />

      {/* Chuỗi số cho sparkline là mô phỏng — mảng tin hiện chỉ có tổng, chưa có
          lịch sử theo ngày. Khi API trả về chuỗi thật thì thay đúng chỗ này. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tin đang mở"
          metric={{ value: totals.open, changePercent: 0, series: [1, 2, 2, 3, 2, 2] }}
          icon={FileText}
          color="var(--color-dash-accent)"
        />
        <KpiCard
          label="Lượt xem tin"
          metric={{
            value: totals.views,
            changePercent: 18,
            series: [820, 940, 1010, 1180, 1320, 1420],
          }}
          icon={Eye}
          color="var(--color-dash-blue)"
        />
        <KpiCard
          label="Lượt ứng tuyển"
          metric={{
            value: totals.applications,
            changePercent: 9,
            series: [42, 58, 71, 88, 104, 121],
          }}
          icon={Send}
          color="var(--color-dash-teal)"
        />
        <KpiCard
          label="Ứng viên mới chưa xem"
          metric={{ value: totals.newApplicants, changePercent: -12, series: [4, 3, 5, 2, 3, 1] }}
          icon={UserCheck}
          color="var(--color-dash-violet)"
          invertTone
        />
      </div>

      <TableShell>
        <Toolbar
          placeholder={tab === 'jobs' ? 'Tìm tin đăng…' : 'Tìm ứng viên…'}
          value={query}
          onChange={setQuery}
        >
          <FilterChips
            options={[
              { value: 'jobs', label: 'Tin đăng' },
              { value: 'applicants', label: 'Ứng viên' },
            ]}
            value={tab}
            onChange={setTab}
            counts={{ jobs: EMPLOYER_JOBS.length, applicants: EMPLOYER_APPLICANTS.length }}
          />
        </Toolbar>

        {tab === 'jobs' ? (
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                <Th>Tin tuyển dụng</Th>
                <Th>Loại ca</Th>
                <Th>Lượt xem</Th>
                <Th>Ứng tuyển</Th>
                <Th>Hạn nộp</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Hành động</Th>
              </tr>
            </thead>
            <tbody>
              {jobRows.length === 0 && <EmptyRow colSpan={7}>Không có tin nào khớp.</EmptyRow>}

              {jobRows.map((job, i) => (
                <tr
                  key={job.id}
                  className="dash-row dash-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                >
                  <Td>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-dash-muted mt-0.5 text-xs">Cần {job.quantity} người</p>
                  </Td>
                  <Td className="text-dash-muted whitespace-nowrap">
                    {SCHEDULE_TYPE_LABELS[job.scheduleType]}
                  </Td>
                  <Td className="tabular-nums">{job.views.toLocaleString('vi-VN')}</Td>
                  <Td className="tabular-nums">{job.applications}</Td>
                  <Td className="text-dash-muted whitespace-nowrap tabular-nums">{job.deadline}</Td>
                  <Td>
                    <StatusBadge tone={JOB_STATUS_TONE[job.status]}>
                      {JOB_STATUS_LABELS[job.status]}
                    </StatusBadge>
                  </Td>
                  <Td className="text-right">
                    <RowAction>Sửa</RowAction>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                <Th>Ứng viên</Th>
                <Th>Ứng tuyển vị trí</Th>
                <Th>Độ phù hợp lịch</Th>
                <Th>Nộp lúc</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Hành động</Th>
              </tr>
            </thead>
            <tbody>
              {applicantRows.length === 0 && (
                <EmptyRow colSpan={6}>Không có ứng viên nào khớp.</EmptyRow>
              )}

              {applicantRows.map((app, i) => (
                <tr
                  key={app.id}
                  className="dash-row dash-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={app.name} />
                      <div className="min-w-0">
                        <p className="font-medium">{app.name}</p>
                        <p className="text-dash-muted mt-0.5 truncate text-xs">
                          {app.school} · {app.year}
                        </p>
                      </div>
                    </div>
                  </Td>

                  <Td className="text-dash-muted">{app.jobTitle}</Td>

                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="bg-dash-raised h-1.5 w-20 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${app.matchScore}%`,
                            background:
                              app.matchScore >= 85
                                ? 'var(--dash-ok)'
                                : app.matchScore >= 70
                                  ? 'var(--dash-wait)'
                                  : 'var(--dash-muted)',
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums">{app.matchScore}%</span>
                    </div>
                  </Td>

                  <Td className="text-dash-muted whitespace-nowrap">{app.appliedAt}</Td>
                  <Td>
                    <StatusBadge tone={APPLICATION_TONE[app.status]}>
                      {APPLICATION_STATUS_LABELS[app.status]}
                    </StatusBadge>
                  </Td>

                  <Td className="text-right">
                    <div className={cn('flex justify-end gap-1')}>
                      <RowAction tone="ok">Nhận</RowAction>
                      <RowAction tone="bad">Từ chối</RowAction>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>
    </div>
  )
}
