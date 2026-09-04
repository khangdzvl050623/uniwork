import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, FileText, Loader2, Send, Trash2, Users, XCircle } from 'lucide-react'
import {
  JOB_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  type EmployerJobResponse,
  type JobStatus,
} from '@uniwork/shared'
import { StatusBadge } from '@/components/admin/Charts'
import { KpiCard } from '@/components/admin/KpiCard'
import {
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
  useCloseJob,
  useDeleteJob,
  useMyJobs,
  useSubmitJob,
} from '@/hooks/useEmployerJobs'
import { useMe } from '@/hooks/useProfile'
import { ApiClientError } from '@/lib/api'

const JOB_STATUS_TONE: Record<JobStatus, 'ok' | 'wait' | 'bad'> = {
  OPEN: 'ok',
  PENDING: 'wait',
  DRAFT: 'wait',
  CLOSED: 'bad',
}

type Tab = 'jobs' | 'applicants'

/**
 * Trang quản lý của nhà tuyển dụng (T74).
 *
 * Dùng chung khung và bảng màu với khu admin vì đây cũng là màn hình làm việc —
 * NTD vào đây để xử lý danh sách, không phải để bị thuyết phục. Khác admin ở
 * phạm vi: NTD chỉ thấy tin của chính mình (server đã lọc theo
 * `employerProfileId`, không phải phía web tự lọc).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CHỈ CÒN HAI Ô KPI
 * ---------------------------------------------------------------------------
 * Bản dựng trước có bốn ô, ba trong bốn là số bịa: "lượt ứng tuyển" và "ứng
 * viên mới" thuộc Sprint 4 nên chưa có dữ liệu, còn `changePercent` và chuỗi
 * sparkline thì ghi cứng trong mã ở CẢ BỐN ô. Một mũi tên xanh "↑18%" bịa đặt
 * nằm cạnh con số thật làm chính con số thật mất đáng tin.
 *
 * Giữ lại đúng hai thứ đếm được từ dữ liệu thật, bỏ mũi tên và sparkline. Ít
 * thông tin hơn, nhưng mọi thứ hiện ra đều đúng. Thêm lại khi có dữ liệu.
 */
export function EmployerDashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useMyJobs()
  const { data: toi } = useMe()

  const xoa = useDeleteJob()
  const dongTin = useCloseJob()
  const guiDuyet = useSubmitJob()

  const [tab, setTab] = useState<Tab>('jobs')
  const [query, setQuery] = useState('')

  /** id tin đang có thao tác chạy dở — khoá nút của đúng hàng đó, không khoá cả bảng. */
  const [dangXuLy, setDangXuLy] = useState<string | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  const jobs = useMemo(() => data?.jobs ?? [], [data])

  const tong = useMemo(
    () => ({
      dangMo: jobs.filter((j) => j.status === 'OPEN').length,
      luotXem: jobs.reduce((s, j) => s + j.viewCount, 0),
    }),
    [jobs],
  )

  const rows = jobs.filter((j) => j.title.toLowerCase().includes(query.toLowerCase()))

  /** Gọi một thao tác trên tin, khoá đúng hàng đó và hiện lỗi server nguyên văn. */
  async function chay(jobId: string, viec: () => Promise<unknown>) {
    setLoi(null)
    setDangXuLy(jobId)
    try {
      await viec()
    } catch (err) {
      // Server đã soạn sẵn câu tiếng Việt nói rõ vướng ở đâu ("Tin đang hiển thị
      // công khai thì không xoá được…"). Viết lại một câu chung chung là vứt đi
      // đúng phần thông tin hữu ích nhất.
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

  const ntd = toi?.employerProfile

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tin đăng của tôi"
        subtitle={
          ntd
            ? `${ntd.companyName} · ${ntd.verifiedAt ? 'đã xác minh giấy tờ' : 'chưa xác minh giấy tờ'}`
            : 'Đang tải hồ sơ doanh nghiệp…'
        }
        action={
          <Link
            to="/ntd/dang-tin"
            className="bg-dash-accent text-dash-accent-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97]"
          >
            <FileText size={16} />
            Đăng tin mới
          </Link>
        }
      />

      {/* Chưa xác minh thì gửi duyệt sẽ bị server từ chối — nói trước ở đây để
          họ không soạn xong cả tin rồi mới biết. */}
      {ntd && !ntd.verifiedAt && (
        <div className="border-dash-wait/40 bg-dash-wait/10 flex items-start gap-3 rounded-xl border p-4">
          <XCircle size={18} className="text-dash-wait mt-0.5 shrink-0" />
          <p className="text-sm">
            Hồ sơ doanh nghiệp chưa được xác minh. Bạn vẫn lưu nháp được, nhưng chưa gửi tin đi
            duyệt.{' '}
            <Link to="/ntd/ho-so" className="text-dash-accent font-medium underline">
              Nộp giấy tờ
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Tin đang hiển thị"
          metric={{ value: tong.dangMo }}
          hint={`trên tổng ${jobs.length} tin`}
          icon={FileText}
          color="var(--dash-accent)"
        />
        <KpiCard
          label="Tổng lượt xem"
          metric={{ value: tong.luotXem }}
          hint="cộng từ tất cả tin của bạn"
          icon={Eye}
          color="var(--dash-blue)"
        />
      </div>

      {loi && (
        <p className="border-dash-bad/40 bg-dash-bad/10 text-dash-bad rounded-lg border px-4 py-3 text-sm">
          {loi}
        </p>
      )}

      <TableShell>
        <Toolbar placeholder="Tìm tin đăng…" value={query} onChange={setQuery}>
          <FilterChips
            options={[
              { value: 'jobs', label: 'Tin đăng' },
              { value: 'applicants', label: 'Ứng viên' },
            ]}
            value={tab}
            onChange={setTab}
            counts={{ jobs: jobs.length }}
          />
        </Toolbar>

        {tab === 'jobs' ? (
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                <Th>Tin tuyển dụng</Th>
                <Th>Loại ca</Th>
                <Th>Lượt xem</Th>
                <Th>Hạn nộp</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Hành động</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={6}>
                  {jobs.length === 0
                    ? 'Bạn chưa đăng tin nào. Bấm "Đăng tin mới" để bắt đầu.'
                    : 'Không có tin nào khớp.'}
                </EmptyRow>
              )}

              {rows.map((job, i) => (
                <HangTin
                  key={job.id}
                  job={job}
                  thuTu={i}
                  banRon={dangXuLy === job.id}
                  onSua={() => navigate(`/ntd/dang-tin?id=${job.id}`)}
                  onGuiDuyet={() => void chay(job.id, () => guiDuyet.mutateAsync(job.id))}
                  onDong={() => void chay(job.id, () => dongTin.mutateAsync(job.id))}
                  onXoa={() => void chay(job.id, () => xoa.mutateAsync(job.id))}
                />
              ))}
            </tbody>
          </table>
        ) : (
          /*
           * Tab ứng viên cần toàn bộ luồng ứng tuyển của Sprint 4 (bảng
           * Application, điểm phù hợp, nhận/từ chối). Giữ nguyên tab thay vì xoá
           * — đúng cách đã làm với ô lọc theo lịch rảnh: dựng lại từ đầu ở sprint
           * sau là phí công hai lần.
           */
          <div className="px-4 py-16 text-center">
            <p className="text-dash-muted text-sm">Danh sách ứng viên có ở Sprint 4</p>
            <p className="text-dash-muted mt-1 text-xs opacity-70">
              Luồng ứng tuyển chưa được xây, nên chưa có đơn nào để hiện.
            </p>
          </div>
        )}
      </TableShell>
    </div>
  )
}

/**
 * Một hàng tin, kèm đúng những hành động hợp lệ với trạng thái của nó.
 *
 * Ẩn nút không dùng được thay vì hiện rồi để server từ chối: bảng này có bốn
 * trạng thái × bốn hành động, hiện hết thì người dùng phải tự nhớ luật. Server
 * vẫn kiểm lại — ẩn ở đây là hướng dẫn, không phải bảo vệ.
 */
function HangTin({
  job,
  thuTu,
  banRon,
  onSua,
  onGuiDuyet,
  onDong,
  onXoa,
}: {
  job: EmployerJobResponse
  thuTu: number
  banRon: boolean
  onSua: () => void
  onGuiDuyet: () => void
  onDong: () => void
  onXoa: () => void
}) {
  const xoaDuoc = job.status === 'DRAFT' || job.status === 'PENDING'
  const suaDuoc = job.status !== 'CLOSED'

  return (
    <tr className="dash-row dash-in" style={{ animationDelay: `${Math.min(thuTu, 12) * 26}ms` }}>
      <Td>
        <p className="font-medium">{job.title}</p>
        <p className="text-dash-muted mt-0.5 text-xs">
          Cần {job.quantity} người
          {job.rejectionReason && (
            <span className="text-dash-bad"> · Bị từ chối: {job.rejectionReason}</span>
          )}
        </p>
      </Td>

      <Td className="text-dash-muted whitespace-nowrap">
        {SCHEDULE_TYPE_LABELS[job.scheduleType]}
      </Td>
      <Td className="tabular-nums">{job.viewCount.toLocaleString('vi-VN')}</Td>
      <Td className="text-dash-muted whitespace-nowrap tabular-nums">
        {new Date(job.deadline).toLocaleDateString('vi-VN')}
      </Td>
      <Td>
        <StatusBadge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</StatusBadge>
      </Td>

      <Td className="text-right">
        <div className="flex justify-end gap-1">
          {/* Đường vào danh sách ứng viên của ĐÚNG tin này.

              Chỉ hiện cho tin đã từng công khai: tin DRAFT/PENDING chưa ai thấy
              nên chắc chắn chưa có đơn nào, mời bấm vào một trang rỗng là một
              cú bấm phí. Tin CLOSED thì vẫn phải vào được — đóng tin không xoá
              đơn, và nhà tuyển dụng còn phải trả lời những người đã nộp. */}
          {(job.status === 'OPEN' || job.status === 'CLOSED') && (
            <Link to={`/ntd/ung-vien?job=${job.id}`}>
              <RowAction>
                <span className="inline-flex items-center gap-1">
                  <Users size={12} />
                  Ứng viên
                </span>
              </RowAction>
            </Link>
          )}

          {suaDuoc && (
            <RowAction onClick={onSua} disabled={banRon}>
              Sửa
            </RowAction>
          )}

          {job.status === 'DRAFT' && (
            <RowAction tone="ok" onClick={onGuiDuyet} disabled={banRon}>
              <span className="inline-flex items-center gap-1">
                {banRon ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Gửi duyệt
              </span>
            </RowAction>
          )}

          {/* Đóng tin là đường ĐÚNG để gỡ một tin đã duyệt xuống — khác xoá ở
              chỗ bản ghi và đơn ứng tuyển vẫn còn. */}
          {job.status === 'OPEN' && (
            <RowAction tone="bad" onClick={onDong} disabled={banRon}>
              {banRon ? <Loader2 size={12} className="animate-spin" /> : 'Đóng tin'}
            </RowAction>
          )}

          {xoaDuoc && (
            <RowAction tone="bad" onClick={onXoa} disabled={banRon}>
              <span className="inline-flex items-center gap-1">
                {banRon ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Xoá
              </span>
            </RowAction>
          )}
        </div>
      </Td>
    </tr>
  )
}
