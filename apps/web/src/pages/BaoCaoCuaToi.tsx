import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ExternalLink, Flag, Loader2, ShieldCheck } from 'lucide-react'
import { JOB_REPORT_REASON_LABELS } from '@uniwork/shared'
import { Badge } from '@/components/ui/Badge'
import { useBaoCaoCuaToi, type BaoCaoItem, type TrangThaiBaoCao } from '@/hooks/useBaoCao'

/**
 * Báo cáo mình đã gửi, và kết luận của admin.
 *
 * ===========================================================================
 * NGUYÊN TẮC BẢO MẬT & MINH BẠCH
 * ===========================================================================
 * 1. Nhà tuyển dụng không bao giờ biết ai đã báo cáo tin của họ.
 * 2. Admin xử lý độc lập và ghi nhận kết luận phản hồi cho người báo cáo.
 * 3. Bản chụp tin tại thời điểm báo cáo được lưu trữ để làm bằng chứng ngay cả
 *    khi nhà tuyển dụng đã sửa hoặc gỡ tin.
 */

const NHAN: Record<TrangThaiBaoCao, { chu: string; tone: 'warning' | 'success' | 'danger' }> = {
  CHO_XU_LY: { chu: 'Chờ xử lý', tone: 'warning' },
  DANG_XEM: { chu: 'Admin đang xem', tone: 'warning' },
  DA_XU_LY: { chu: 'Đã xử lý vi phạm', tone: 'success' },
  BAC_BO: { chu: 'Bác bỏ (không đủ căn cứ)', tone: 'danger' },
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
        <p className="mt-1 text-sm text-slate-600">
          Theo dõi tiến độ và kết quả xử lý các tin tuyển dụng bạn đã báo cáo vi phạm.
        </p>

        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
          <ShieldCheck size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <strong>Bảo vệ danh tính người báo cáo:</strong> Báo cáo được gửi trực tiếp tới Quản trị viên
            UniWork. Hệ thống <strong>tuyệt đối không chia sẻ danh tính</strong> của bạn hoặc bất kỳ lịch sử
            trò chuyện nào cho Nhà tuyển dụng bị báo cáo.
          </div>
        </div>
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
            Gặp tin đòi tiền cọc, lừa đảo hay thông tin sai sự thật thì bấm “Báo cáo tin” ở trang tin đó
            hoặc nhờ trợ lý AI chuẩn bị biểu mẫu báo cáo.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {ds.map((r) => (
          <MotBaoCao key={r.id} r={r} />
        ))}
      </ul>
    </div>
  )
}

function MotBaoCao({ r }: { r: BaoCaoItem }) {
  const [xemAnhChup, setXemAnhChup] = useState(false)
  const nhan = NHAN[r.status]
  const anh = r.anhChupTin

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {anh && (
            <p className="text-base font-semibold text-slate-900">
              {anh.title} · <span className="font-normal text-slate-600">{anh.congTy}</span>
            </p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {JOB_REPORT_REASON_LABELS[r.reason]}
            </span>
            <span className="text-xs text-slate-400">Gửi ngày {ngay(r.createdAt)}</span>
          </div>
        </div>
        <Badge tone={nhan.tone}>{nhan.chu}</Badge>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
        <span className="block font-semibold text-slate-800">Nội dung bạn đã phản ánh:</span>
        <p className="mt-0.5 whitespace-pre-wrap">{r.moTa}</p>
      </div>

      {/* Kết luận của Quản trị viên */}
      {r.ketLuan ? (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3.5">
          <p className="text-xs font-bold text-brand-900">Kết luận xử lý từ Quản trị viên:</p>
          <p className="mt-1 text-xs whitespace-pre-wrap text-brand-800">{r.ketLuan}</p>
          {r.handledAt && (
            <p className="mt-1.5 text-[11px] text-brand-600">Đã xử lý lúc {ngay(r.handledAt)}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400 italic">
          Báo cáo đang trong hàng đợi xử lý của Quản trị viên UniWork.
        </p>
      )}

      {/* Bản chụp tin lúc báo cáo */}
      {anh && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setXemAnhChup(!xemAnhChup)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            <ChevronDown size={14} className={`transition-transform ${xemAnhChup ? 'rotate-180' : ''}`} />
            {xemAnhChup ? 'Ẩn bản chụp tin lúc báo cáo' : 'Xem lại bản chụp tin lúc báo cáo'}
          </button>

          {xemAnhChup && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600 space-y-1.5">
              <p>
                <strong>Địa điểm:</strong> {anh.district}, {anh.city}
              </p>
              <p>
                <strong>Mức lương lúc chụp:</strong>{' '}
                {anh.salaryNegotiable
                  ? 'Thỏa thuận'
                  : `${anh.salaryMin?.toLocaleString('vi-VN')} - ${anh.salaryMax?.toLocaleString('vi-VN')}đ/${anh.salaryUnit}`}
              </p>
              <p>
                <strong>Mô tả việc làm lúc chụp:</strong>
              </p>
              <p className="rounded bg-white p-2.5 text-slate-700 whitespace-pre-wrap border border-slate-100">
                {anh.description}
              </p>
              <p className="text-[11px] text-slate-400">
                Chụp tự động lúc: {new Date(anh.chupLuc).toLocaleString('vi-VN')}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <Link
          to={`/viec-lam/${r.jobId}`}
          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
        >
          <span>Xem trang tin tuyển dụng hiện tại</span>
          <ExternalLink size={12} />
        </Link>
      </div>
    </li>
  )
}
