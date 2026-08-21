import { Fragment, useMemo, useState } from 'react'
import { Check, ChevronDown, Clock, Eye, Loader2, MapPin, X } from 'lucide-react'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type AdminEmployerResponse,
  type DocumentType,
  type EmployerDocumentResponse,
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
import {
  useAdminEmployers,
  useReviewDocument,
  useVerifyEmployer,
  useXemGiayTo,
} from '@/hooks/useAdminEmployers'
import { cn } from '@/lib/utils'

/**
 * Duyệt nhà tuyển dụng — phần còn thiếu của T57.
 *
 * T57 cho nhà tuyển dụng nộp ba loại giấy tờ nhưng chưa có đường nào để admin
 * duyệt, nên `verifiedAt` vĩnh viễn null và (theo thiết kế schema) tin của họ
 * không bao giờ hiện công khai được. Trang này nối lại chỗ đứt đó.
 *
 * Hai tầng quyết định, cố ý tách rời:
 * 1. Duyệt/từ chối TỪNG giấy tờ — ghi nhận chứng cứ.
 * 2. Xác minh cả hồ sơ — kết luận, chỉ mở khi cả ba giấy tờ đã duyệt.
 *
 * Nhờ tách vậy mà "thu hồi xác minh" (chế tài với NTD có dấu hiệu lừa đảo) không
 * đòi phải bịa ra một lý do từ chối giấy tờ nào cả.
 */

type TrangThaiDuyet = 'PENDING' | 'APPROVED' | 'REJECTED'
type Filter = 'ALL' | TrangThaiDuyet

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Chờ xác minh' },
  { value: 'APPROVED', label: 'Đã xác minh' },
  { value: 'REJECTED', label: 'Có giấy tờ bị từ chối' },
  { value: 'ALL', label: 'Tất cả' },
]

const STATUS_META: Record<TrangThaiDuyet, { tone: 'ok' | 'wait' | 'bad'; label: string }> = {
  PENDING: { tone: 'wait', label: 'Chờ xác minh' },
  APPROVED: { tone: 'ok', label: 'Đã xác minh' },
  REJECTED: { tone: 'bad', label: 'Cần nộp lại' },
}

/**
 * Trạng thái hiển thị của cả hồ sơ, suy ra từ dữ liệu thật.
 *
 * Không lưu thành một cột riêng trong database: nó luôn suy được từ `verifiedAt`
 * và trạng thái từng giấy tờ. Thêm cột thứ ba là thêm một thứ có thể lệch với
 * hai thứ kia.
 */
function trangThaiCua(e: AdminEmployerResponse): TrangThaiDuyet {
  if (e.verifiedAt) return 'APPROVED'
  if (e.documents.some((d) => d.status === 'REJECTED')) return 'REJECTED'
  return 'PENDING'
}

function daDuyetDu(e: AdminEmployerResponse): boolean {
  return DOCUMENT_TYPES.every((t) => e.documents.some((d) => d.type === t && d.status === 'APPROVED'))
}

export function ReviewEmployers() {
  const { data, isLoading } = useAdminEmployers()
  const xacMinh = useVerifyEmployer()

  const [filter, setFilter] = useState<Filter>('PENDING')
  const [query, setQuery] = useState('')

  /** id hồ sơ đang mở bảng giấy tờ. Chỉ mở một hàng — mở nhiều thì mất mạch đọc. */
  const [moRong, setMoRong] = useState<string | null>(null)
  const [dangXacMinh, setDangXacMinh] = useState<string | null>(null)

  const employers = useMemo(() => data?.employers ?? [], [data])

  const counts = useMemo(() => {
    const c = { ALL: employers.length, PENDING: 0, APPROVED: 0, REJECTED: 0 }
    for (const e of employers) c[trangThaiCua(e)] += 1
    return c
  }, [employers])

  const rows = employers.filter((e) => {
    if (filter !== 'ALL' && trangThaiCua(e) !== filter) return false
    if (!query) return true
    return `${e.companyName} ${e.email} ${e.contactName ?? ''} ${e.address ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  })

  function doiXacMinh(e: AdminEmployerResponse) {
    setDangXacMinh(e.id)
    xacMinh.mutate(
      { id: e.id, verified: e.verifiedAt === null },
      { onSettled: () => setDangXacMinh(null) },
    )
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
        title="Duyệt nhà tuyển dụng"
        subtitle={`${counts.PENDING} hồ sơ đang chờ xác minh giấy tờ`}
      />

      <TableShell>
        <Toolbar placeholder="Tìm theo tên, email, người liên hệ…" value={query} onChange={setQuery}>
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
        </Toolbar>

        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <Th>Doanh nghiệp</Th>
              <Th>Giấy tờ đã nộp</Th>
              <Th>Gửi lúc</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5}>Không có hồ sơ nào khớp bộ lọc hiện tại.</EmptyRow>
            )}

            {rows.map((emp, i) => {
              const trangThai = trangThaiCua(emp)
              const duGiay = daDuyetDu(emp)
              const dangMo = moRong === emp.id
              const banRon = dangXacMinh === emp.id

              return (
                /* Key nằm trên Fragment, không phải trên <tr>: mỗi hồ sơ sinh ra
                   HAI hàng (hàng chính + hàng giấy tờ mở rộng), nên đơn vị lặp
                   là cả cụm chứ không phải từng hàng. */
                <Fragment key={emp.id}>
                  <tr
                    className="dash-row dash-in"
                    style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.companyName} />
                        <div className="min-w-0">
                          <p className="font-medium">{emp.companyName}</p>
                          <p className="text-dash-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                            <span className="truncate">{emp.email}</span>
                            {emp.address && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} />
                                {emp.address}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {DOCUMENT_TYPES.map((type) => (
                          <ChipGiayTo
                            key={type}
                            type={type}
                            doc={emp.documents.find((d) => d.type === type)}
                          />
                        ))}
                      </div>
                    </Td>

                    <Td className="text-dash-muted whitespace-nowrap tabular-nums">
                      {new Date(emp.createdAt).toLocaleDateString('vi-VN')}
                    </Td>

                    <Td>
                      <StatusBadge tone={STATUS_META[trangThai].tone}>
                        {STATUS_META[trangThai].label}
                      </StatusBadge>
                    </Td>

                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <RowAction onClick={() => setMoRong(dangMo ? null : emp.id)}>
                          <span className="flex items-center gap-1">
                            Giấy tờ
                            <ChevronDown
                              size={13}
                              className={cn(
                                'transition-transform duration-200 ease-out',
                                dangMo && 'rotate-180',
                              )}
                            />
                          </span>
                        </RowAction>

                        {emp.verifiedAt ? (
                          <RowAction tone="bad" onClick={() => doiXacMinh(emp)} disabled={banRon}>
                            {banRon ? <Loader2 size={13} className="animate-spin" /> : 'Thu hồi'}
                          </RowAction>
                        ) : duGiay ? (
                          <RowAction tone="ok" onClick={() => doiXacMinh(emp)} disabled={banRon}>
                            {banRon ? <Loader2 size={13} className="animate-spin" /> : 'Xác minh'}
                          </RowAction>
                        ) : (
                          /* Khoá ở giao diện là để hướng dẫn, không phải để bảo
                             vệ — API vẫn kiểm lại đủ ba giấy tờ đã duyệt. */
                          <span
                            title="Cần cả ba loại giấy tờ đã được duyệt"
                            className="text-dash-muted cursor-not-allowed px-2.5 py-1.5 text-xs whitespace-nowrap opacity-60"
                          >
                            Chưa đủ
                          </span>
                        )}
                      </div>
                    </Td>
                  </tr>

                  {dangMo && (
                    <tr>
                      <td colSpan={5} className="border-dash-line bg-dash-raised/40 border-b p-0">
                        <BangGiayTo employer={emp} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        <div className="text-dash-muted p-4 text-xs">
          Hiện {rows.length} trên {employers.length} hồ sơ
        </div>
      </TableShell>
    </div>
  )
}

/* ------------------------------------------------------------ giấy tờ --- */

const CHIP_META: Record<
  EmployerDocumentResponse['status'] | 'MISSING',
  { className: string; icon: typeof Check }
> = {
  APPROVED: { className: 'bg-dash-ok/12 text-dash-ok', icon: Check },
  PENDING: { className: 'bg-dash-wait/12 text-dash-wait', icon: Clock },
  REJECTED: { className: 'bg-dash-bad/12 text-dash-bad', icon: X },
  MISSING: { className: 'bg-dash-raised text-dash-muted', icon: X },
}

function ChipGiayTo({ type, doc }: { type: DocumentType; doc?: EmployerDocumentResponse }) {
  const meta = CHIP_META[doc?.status ?? 'MISSING']
  const Icon = meta.icon

  return (
    <span
      title={doc ? undefined : 'Chưa nộp'}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        meta.className,
      )}
    >
      <Icon size={10} />
      {DOCUMENT_TYPE_LABELS[type]}
    </span>
  )
}

/** Bảng duyệt từng giấy tờ, hiện ra khi mở rộng một hàng. */
function BangGiayTo({ employer }: { employer: AdminEmployerResponse }) {
  const duyet = useReviewDocument()
  const xem = useXemGiayTo()

  /** Loại giấy tờ đang mở ô nhập lý do từ chối. */
  const [dangTuChoi, setDangTuChoi] = useState<DocumentType | null>(null)
  const [lyDo, setLyDo] = useState('')
  const [dangXuLy, setDangXuLy] = useState<DocumentType | null>(null)

  function guiQuyetDinh(type: DocumentType, status: 'APPROVED' | 'REJECTED', reviewNote?: string) {
    setDangXuLy(type)
    duyet.mutate(
      { id: employer.id, type, status, reviewNote },
      {
        onSettled: () => setDangXuLy(null),
        onSuccess: () => {
          setDangTuChoi(null)
          setLyDo('')
        },
      },
    )
  }

  return (
    <div className="space-y-2 px-4 py-4 sm:px-6">
      {DOCUMENT_TYPES.map((type) => {
        const doc = employer.documents.find((d) => d.type === type)
        const banRon = dangXuLy === type

        return (
          <div
            key={type}
            className="border-dash-line bg-dash-bg flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[type]}</p>
              {doc ? (
                <p className="text-dash-muted mt-0.5 text-xs">
                  Nộp {new Date(doc.submittedAt).toLocaleDateString('vi-VN')}
                  {doc.reviewNote && (
                    <span className="text-dash-bad"> · Đã từ chối: {doc.reviewNote}</span>
                  )}
                </p>
              ) : (
                <p className="text-dash-muted mt-0.5 text-xs">Nhà tuyển dụng chưa nộp loại này</p>
              )}
            </div>

            <ChipGiayTo type={type} doc={doc} />

            {doc && (
              <div className="flex items-center gap-1">
                <RowAction
                  onClick={() => xem.mutate({ id: employer.id, type })}
                  disabled={xem.isPending}
                >
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    Xem
                  </span>
                </RowAction>

                <RowAction
                  tone="ok"
                  onClick={() => guiQuyetDinh(type, 'APPROVED')}
                  disabled={banRon || doc.status === 'APPROVED'}
                >
                  {banRon ? <Loader2 size={13} className="animate-spin" /> : 'Duyệt'}
                </RowAction>

                <RowAction
                  tone="bad"
                  onClick={() => {
                    setDangTuChoi(dangTuChoi === type ? null : type)
                    setLyDo(doc.reviewNote ?? '')
                  }}
                  disabled={banRon}
                >
                  Từ chối
                </RowAction>
              </div>
            )}

            {dangTuChoi === type && (
              /* Lý do là BẮT BUỘC — API từ chối request không có nó. Từ chối im
                 lặng đẩy nhà tuyển dụng vào chỗ nộp lại đúng file cũ vì không
                 biết mình sai ở đâu. */
              <div className="flex w-full items-center gap-2 pt-1">
                <input
                  autoFocus
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                  placeholder="Lý do từ chối — nhà tuyển dụng sẽ đọc được dòng này"
                  maxLength={500}
                  className="border-dash-line bg-dash-surface focus:border-dash-accent/60 placeholder:text-dash-muted min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                />
                <RowAction
                  tone="bad"
                  onClick={() => guiQuyetDinh(type, 'REJECTED', lyDo.trim())}
                  disabled={!lyDo.trim() || banRon}
                >
                  Gửi từ chối
                </RowAction>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
