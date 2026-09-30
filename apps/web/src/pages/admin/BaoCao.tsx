import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react'
import { JOB_REPORT_REASON_LABELS, SALARY_UNIT_LABELS, type SalaryUnit } from '@uniwork/shared'
import { StatusBadge } from '@/components/admin/Charts'
import { EmptyRow, FilterChips, PageHeader, RowAction, TableShell, Td, Th } from '@/components/admin/Table'
import {
  useHangDoiBaoCao,
  useXuLyBaoCao,
  type BaoCaoChoAdmin,
  type TrangThaiBaoCao,
} from '@/hooks/useBaoCao'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Duyệt báo cáo tin tuyển dụng.
 *
 * ===========================================================================
 * HÀNG MỞ RỘNG LÀ LÝ DO MÀN HÌNH NÀY TỒN TẠI
 * ===========================================================================
 * Quyết định ở đây là "gỡ một tin thật" hay "bỏ qua một tin lừa đảo". Cả hai
 * đều đắt, và không cái nào quyết được từ một dòng bảng.
 *
 * Nên hàng mở ra cho đọc NGUYÊN bản chụp lúc bị báo — không phải tin hiện tại.
 * Nhà tuyển dụng sửa tin sau khi bị báo cáo là chuyện bình thường; so hai bản
 * mới thấy được điều đó, mà API đã trả sẵn bản chụp nên mở ra không tốn thêm
 * lần gọi nào.
 *
 * ---------------------------------------------------------------------------
 * `soLuotDangMo` ĐỂ XẾP ƯU TIÊN, KHÔNG ĐỂ KẾT LUẬN
 * ---------------------------------------------------------------------------
 * Mười lượt báo cáo có thể là mười người thật, cũng có thể là một nhóm nhắn
 * nhau cùng bấm. Con số ấy nói "đọc cái này trước", không nói "cái này sai".
 *
 * ---------------------------------------------------------------------------
 * MÀN HÌNH NÀY KHÔNG ĐÓNG TIN
 * ---------------------------------------------------------------------------
 * Đóng tin là hành động riêng ở `/admin/duyet-tin`. Gộp vào đây thì một lần
 * bấm nhầm gỡ luôn một tin hợp lệ, và không có bước nào để dừng lại.
 */

const BO_LOC: { value: TrangThaiBaoCao | 'DANG_MO'; label: string }[] = [
  { value: 'DANG_MO', label: 'Đang mở' },
  { value: 'CHO_XU_LY', label: 'Chờ xử lý' },
  { value: 'DANG_XEM', label: 'Đang xem' },
  { value: 'DA_XU_LY', label: 'Đã xử lý' },
  { value: 'BAC_BO', label: 'Bác bỏ' },
]

const NHAN: Record<TrangThaiBaoCao, { chu: string; tone: 'ok' | 'wait' | 'bad' }> = {
  CHO_XU_LY: { chu: 'Chờ xử lý', tone: 'wait' },
  DANG_XEM: { chu: 'Đang xem', tone: 'wait' },
  DA_XU_LY: { chu: 'Đã xử lý', tone: 'ok' },
  BAC_BO: { chu: 'Bác bỏ', tone: 'bad' },
}

function ngay(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function moTaLuong(a: BaoCaoChoAdmin['anhChupTin']): string {
  const donVi = SALARY_UNIT_LABELS[a.salaryUnit as SalaryUnit] ?? a.salaryUnit
  if (a.salaryNegotiable) return `Thoả thuận/${donVi}`
  const tu = a.salaryMin?.toLocaleString('vi-VN') ?? '?'
  const den = a.salaryMax?.toLocaleString('vi-VN') ?? '?'
  return `${tu} – ${den}đ/${donVi}`
}

export function AdminBaoCao() {
  const [loc, setLoc] = useState<TrangThaiBaoCao | 'DANG_MO'>('DANG_MO')
  const [moRong, setMoRong] = useState<string | null>(null)

  const { data, isLoading } = useHangDoiBaoCao(loc === 'DANG_MO' ? undefined : loc)
  const xuLy = useXuLyBaoCao()

  const ds = data?.baoCao ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo tin tuyển dụng"
        subtitle="Đọc bản chụp lúc bị báo, không phải tin hiện tại — tin có thể đã được sửa."
      />

      <TableShell>
        <div className="border-dash-line border-b p-4">
          <FilterChips options={BO_LOC} value={loc} onChange={setLoc} />
        </div>

        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr>
              <Th>Tin bị báo</Th>
              <Th>Lý do</Th>
              <Th className="text-center">Lượt mở</Th>
              <Th>Gửi lúc</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <Loader2 size={20} className="text-dash-accent mx-auto animate-spin" />
                  <span className="sr-only">Đang tải báo cáo</span>
                </td>
              </tr>
            )}

            {!isLoading && ds.length === 0 && (
              <EmptyRow colSpan={6}>Không có báo cáo nào ở mục này.</EmptyRow>
            )}

            {ds.map((r) => (
              <Fragment key={r.id}>
                <tr className="dash-row">
                  <Td>
                    <button
                      type="button"
                      onClick={() => setMoRong((v) => (v === r.id ? null : r.id))}
                      aria-expanded={moRong === r.id}
                      className="flex max-w-xs items-center gap-1.5 text-left"
                    >
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={cn(
                          'text-dash-muted shrink-0 transition-transform duration-150',
                          moRong === r.id && 'rotate-180',
                        )}
                      />
                      <span className="truncate font-medium">{r.anhChupTin.title}</span>
                    </button>
                    <p className="text-dash-muted mt-0.5 truncate text-xs">
                      {r.anhChupTin.congTy}
                      {!r.tinConMo && ' · tin đã đóng'}
                    </p>
                  </Td>
                  <Td>{JOB_REPORT_REASON_LABELS[r.reason]}</Td>
                  <Td className="text-center tabular-nums">{r.soLuotDangMo}</Td>
                  <Td className="whitespace-nowrap">{ngay(r.createdAt)}</Td>
                  <Td>
                    <StatusBadge tone={NHAN[r.status].tone}>{NHAN[r.status].chu}</StatusBadge>
                  </Td>
                  <Td className="text-right">
                    <RowAction onClick={() => setMoRong((v) => (v === r.id ? null : r.id))}>
                      {moRong === r.id ? 'Thu gọn' : 'Xem & xử lý'}
                    </RowAction>
                  </Td>
                </tr>

                {moRong === r.id && (
                  <tr>
                    <td colSpan={6} className="bg-dash-raised/50 px-4 py-4">
                      <ChiTiet
                        r={r}
                        dangChay={xuLy.isPending}
                        onXuLy={(status, ketLuan) =>
                          xuLy.mutateAsync({ id: r.id, status, ketLuan })
                        }
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}

/* -------------------------------------------------------------- chi tiết -- */

function ChiTiet({
  r,
  dangChay,
  onXuLy,
}: {
  r: BaoCaoChoAdmin
  dangChay: boolean
  onXuLy: (status: 'DANG_XEM' | 'DA_XU_LY' | 'BAC_BO', ketLuan: string) => Promise<unknown>
}) {
  const [ketLuan, setKetLuan] = useState(r.ketLuan ?? '')
  const [loi, setLoi] = useState<string | null>(null)
  const daDong = r.status === 'DA_XU_LY' || r.status === 'BAC_BO'

  async function bam(status: 'DANG_XEM' | 'DA_XU_LY' | 'BAC_BO') {
    setLoi(null)
    /*
     * Chặn ở CLIENT trước khi gọi, dù server cũng chặn.
     *
     * Không phải để bảo mật — để người dùng biết ngay tại ô mình đang gõ, chứ
     * không phải sau một vòng mạng và một thông báo lỗi ở chỗ khác.
     */
    if (status !== 'DANG_XEM' && ketLuan.trim() === '') {
      setLoi('Phải ghi kết luận — người báo cáo sẽ đọc đúng câu này.')
      return
    }
    try {
      await onXuLy(status, ketLuan)
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không lưu được')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section>
        <h3 className="text-dash-muted text-xs font-semibold tracking-wide uppercase">
          Người báo cáo viết
        </h3>
        <p className="text-dash-text mt-1.5 text-sm whitespace-pre-wrap">{r.moTa}</p>

        <h3 className="text-dash-muted mt-4 text-xs font-semibold tracking-wide uppercase">
          Bản chụp lúc bị báo · {ngay(r.anhChupTin.chupLuc)}
        </h3>
        <dl className="text-dash-text mt-1.5 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-dash-muted shrink-0">Nơi làm:</dt>
            <dd>
              {r.anhChupTin.district}, {r.anhChupTin.city}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-dash-muted shrink-0">Lương:</dt>
            <dd>{moTaLuong(r.anhChupTin)}</dd>
          </div>
        </dl>
        <p className="text-dash-text bg-dash-surface border-dash-line mt-2 max-h-52 overflow-y-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {r.anhChupTin.description}
        </p>

        <Link
          to={`/viec-lam/${r.jobId}`}
          target="_blank"
          rel="noreferrer"
          className="text-dash-accent mt-2 inline-flex items-center gap-1 text-xs hover:underline"
        >
          Xem tin hiện tại
          <ExternalLink size={12} aria-hidden="true" />
        </Link>
      </section>

      <section>
        <label htmlFor={`ket-luan-${r.id}`} className="text-dash-text text-sm font-medium">
          Kết luận
        </label>
        <p className="text-dash-muted mt-0.5 text-xs">
          Người báo cáo nhận thông báo kèm đúng câu này. Bắt buộc khi đóng báo cáo.
        </p>
        <textarea
          id={`ket-luan-${r.id}`}
          rows={5}
          value={ketLuan}
          maxLength={2000}
          disabled={daDong}
          onChange={(e) => setKetLuan(e.target.value)}
          placeholder="Ví dụ: đã xác minh, tin yêu cầu đặt cọc trái quy định và đã được gỡ."
          className="border-dash-line bg-dash-surface text-dash-text focus:border-dash-accent mt-2 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-60"
        />

        {loi && (
          <p role="alert" className="text-dash-bad mt-2 text-sm">
            {loi}
          </p>
        )}

        {daDong ? (
          <p className="text-dash-muted mt-3 text-sm">
            Đã đóng lúc {r.handledAt ? ngay(r.handledAt) : '—'}. Không sửa lại được.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.status === 'CHO_XU_LY' && (
              <RowAction disabled={dangChay} onClick={() => void bam('DANG_XEM')}>
                Đánh dấu đang xem
              </RowAction>
            )}
            <RowAction tone="ok" disabled={dangChay} onClick={() => void bam('DA_XU_LY')}>
              Đã xử lý
            </RowAction>
            <RowAction tone="bad" disabled={dangChay} onClick={() => void bam('BAC_BO')}>
              Bác bỏ
            </RowAction>
          </div>
        )}
      </section>
    </div>
  )
}
