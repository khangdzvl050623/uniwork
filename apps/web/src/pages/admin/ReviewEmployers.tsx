import { useMemo, useState } from 'react'
import { Check, MapPin, X } from 'lucide-react'
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
import { DOCUMENT_LABELS, PENDING_EMPLOYERS, type EmployerReviewStatus } from '@/data/adminMock'

type Filter = 'ALL' | EmployerReviewStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Chờ xác minh' },
  { value: 'APPROVED', label: 'Đã xác minh' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'ALL', label: 'Tất cả' },
]

const STATUS_META: Record<EmployerReviewStatus, { tone: 'ok' | 'wait' | 'bad'; label: string }> = {
  PENDING: { tone: 'wait', label: 'Chờ xác minh' },
  APPROVED: { tone: 'ok', label: 'Đã xác minh' },
  REJECTED: { tone: 'bad', label: 'Từ chối' },
}

/**
 * Duyệt nhà tuyển dụng.
 *
 * Cột giấy tờ là phần đáng chú ý: hiện đủ ba loại BA đã chốt kèm dấu đã nộp hay
 * chưa, thay vì chỉ đếm "2/3". Admin nhìn phát biết thiếu đúng loại nào mà không
 * phải bấm vào xem — đó là cả lý do bảng này tồn tại.
 *
 * Nút Duyệt tự khoá khi hồ sơ còn thiếu giấy tờ. Chặn ngay ở giao diện rẻ hơn
 * nhiều so với để bấm rồi server trả lỗi, và cũng nói rõ hơn về quy tắc nghiệp
 * vụ. Phía API vẫn phải kiểm lại — kiểm ở giao diện là để hướng dẫn, không phải
 * để bảo vệ.
 */
export function ReviewEmployers() {
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [query, setQuery] = useState('')
  const [decisions, setDecisions] = useState<Record<string, EmployerReviewStatus>>({})

  const employers = useMemo(
    () => PENDING_EMPLOYERS.map((e) => ({ ...e, status: decisions[e.id] ?? e.status })),
    [decisions],
  )

  const counts = useMemo(
    () => ({
      ALL: employers.length,
      PENDING: employers.filter((e) => e.status === 'PENDING').length,
      APPROVED: employers.filter((e) => e.status === 'APPROVED').length,
      REJECTED: employers.filter((e) => e.status === 'REJECTED').length,
    }),
    [employers],
  )

  const rows = employers.filter((e) => {
    if (filter !== 'ALL' && e.status !== filter) return false
    if (!query) return true
    return `${e.name} ${e.taxCode} ${e.contact}`.toLowerCase().includes(query.toLowerCase())
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Duyệt nhà tuyển dụng"
        subtitle={`${counts.PENDING} hồ sơ đang chờ xác minh giấy tờ`}
      />

      <TableShell>
        <Toolbar placeholder="Tìm theo tên, mã số thuế, email…" value={query} onChange={setQuery}>
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
        </Toolbar>

        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <Th>Doanh nghiệp</Th>
              <Th>Mã số thuế</Th>
              <Th>Giấy tờ đã nộp</Th>
              <Th>Tin đang mở</Th>
              <Th>Gửi lúc</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7}>Không có hồ sơ nào khớp bộ lọc hiện tại.</EmptyRow>
            )}

            {rows.map((emp, i) => {
              const complete = emp.documents.every((d) => d.uploaded)

              return (
                <tr
                  key={emp.id}
                  className="dash-row dash-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.name} />
                      <div className="min-w-0">
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-dash-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="truncate">{emp.contact}</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={11} />
                            {emp.district}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Td>

                  <Td className="tabular-nums whitespace-nowrap">{emp.taxCode}</Td>

                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {emp.documents.map((doc) => (
                        <span
                          key={doc.type}
                          className={
                            doc.uploaded
                              ? 'bg-dash-ok/12 text-dash-ok inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap'
                              : 'bg-dash-bad/12 text-dash-bad inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap'
                          }
                        >
                          {doc.uploaded ? <Check size={10} /> : <X size={10} />}
                          {DOCUMENT_LABELS[doc.type]}
                        </span>
                      ))}
                    </div>
                  </Td>

                  <Td className="tabular-nums">{emp.openJobs}</Td>
                  <Td className="text-dash-muted whitespace-nowrap">{emp.submittedAt}</Td>
                  <Td>
                    <StatusBadge tone={STATUS_META[emp.status].tone}>
                      {STATUS_META[emp.status].label}
                    </StatusBadge>
                  </Td>

                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {emp.status === 'PENDING' ? (
                        <>
                          {complete ? (
                            <RowAction
                              tone="ok"
                              onClick={() => setDecisions((d) => ({ ...d, [emp.id]: 'APPROVED' }))}
                            >
                              Xác minh
                            </RowAction>
                          ) : (
                            <span
                              title="Chưa nộp đủ ba loại giấy tờ"
                              className="text-dash-muted cursor-not-allowed px-2.5 py-1.5 text-xs whitespace-nowrap opacity-60"
                            >
                              Thiếu giấy tờ
                            </span>
                          )}
                          <RowAction
                            tone="bad"
                            onClick={() => setDecisions((d) => ({ ...d, [emp.id]: 'REJECTED' }))}
                          >
                            Từ chối
                          </RowAction>
                        </>
                      ) : (
                        <RowAction
                          onClick={() => setDecisions((d) => ({ ...d, [emp.id]: 'PENDING' }))}
                        >
                          Hoàn tác
                        </RowAction>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="text-dash-muted flex items-center justify-between gap-3 p-4 text-xs">
          <span>
            Hiện {rows.length} trên {employers.length} hồ sơ
          </span>
          <span>Quyết định lưu tạm trong phiên, chưa gọi API</span>
        </div>
      </TableShell>
    </div>
  )
}
