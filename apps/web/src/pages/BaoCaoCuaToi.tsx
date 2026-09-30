import { Link } from 'react-router-dom'
import { Flag, Loader2 } from 'lucide-react'
import { JOB_REPORT_REASON_LABELS } from '@uniwork/shared'
import { Badge } from '@/components/ui/Badge'
import { useBaoCaoCuaToi, type BaoCaoItem, type TrangThaiBaoCao } from '@/hooks/useBaoCao'

/**
 * Báo cáo mình đã gửi, và kết luận của admin.
 *
 * ===========================================================================
 * MÀN HÌNH NÀY KHÔNG PHẢI TUỲ CHỌN
 * ===========================================================================
 * Thông báo `BAO_CAO_DA_XU_LY` gửi kèm `link: '/bao-cao-cua-toi'`. Không có
 * route đó thì mỗi lần admin xử một báo cáo là một người dùng bấm vào thông
 * báo và rơi vào trang 404 — trong đúng lúc họ đang chờ câu trả lời.
 *
 * Nó cũng đóng một vai trò khác: báo cáo mà không bao giờ biết kết quả thì lần
 * sau người ta không báo nữa.
 */

const NHAN: Record<TrangThaiBaoCao, { chu: string; tone: 'warning' | 'success' | 'danger' }> = {
  CHO_XU_LY: { chu: 'Chờ xử lý', tone: 'warning' },
  DANG_XEM: { chu: 'Admin đang xem', tone: 'warning' },
  DA_XU_LY: { chu: 'Đã xử lý', tone: 'success' },
  BAC_BO: { chu: 'Bác bỏ', tone: 'danger' },
}

function ngay(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function BaoCaoCuaToi() {
  const { data, isLoading } = useBaoCaoCuaToi()
  const ds = data?.baoCao ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Flag size={20} className="text-brand-600" aria-hidden="true" />
          Báo cáo của tôi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Nhà tuyển dụng không bao giờ biết ai đã báo cáo tin của họ.
        </p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-600" />
          <span className="sr-only">Đang tải</span>
        </div>
      )}

      {!isLoading && ds.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-medium text-slate-700">Bạn chưa báo cáo tin nào</p>
          <p className="mt-1 text-xs text-slate-500">
            Gặp tin đòi tiền cọc hay thông tin sai sự thật thì bấm “Báo cáo tin” ở trang tin đó.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {ds.map((r) => (
          <MotBaoCao key={r.id} r={r} />
        ))}
      </ul>
    </div>
  )
}

function MotBaoCao({ r }: { r: BaoCaoItem }) {
  const nhan = NHAN[r.status]

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{JOB_REPORT_REASON_LABELS[r.reason]}</p>
          <p className="mt-0.5 text-xs text-slate-500">Gửi ngày {ngay(r.createdAt)}</p>
        </div>
        <Badge tone={nhan.tone}>{nhan.chu}</Badge>
      </div>

      <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{r.moTa}</p>

      {r.ketLuan && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-600">Kết luận của quản trị viên</p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap text-slate-800">{r.ketLuan}</p>
        </div>
      )}

      <Link
        to={`/viec-lam/${r.jobId}`}
        className="mt-3 inline-block text-xs text-brand-700 underline-offset-2 hover:underline"
      >
        Xem tin đã báo cáo
      </Link>
    </li>
  )
}
