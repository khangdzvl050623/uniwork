import { ShieldAlert, X } from 'lucide-react'
import { JOB_REPORT_REASON_LABELS } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import type { BieuMauBaoCao } from '@/hooks/useTroLy'

/**
 * Thẻ biểu mẫu báo cáo tin — chatbot chuẩn bị sẵn, người dùng xác nhận mới gửi.
 *
 * ===========================================================================
 * NÚT NÀY CHƯA GỬI GÌ CẢ — NGƯỜI DÙNG PHẢI XÁC NHẬN
 * ===========================================================================
 * Quy tắc an toàn: AI được phép giúp người dùng chuẩn bị biểu mẫu báo cáo khi
 * họ kể về một tin lừa đảo/sai sự thật, nhưng KHÔNG được tự ý gửi cáo buộc
 * nhân danh người dùng. Báo cáo đi thẳng tới admin, không gửi cho nhà tuyển dụng.
 */
export function TheBaoCaoTin({
  bieuMau,
  onXacNhan,
  onBo,
}: {
  bieuMau: BieuMauBaoCao
  onXacNhan: () => void
  onBo: () => void
}) {
  return (
    <div className="rounded-2xl border border-rose-300/80 bg-gradient-to-br from-rose-50/90 to-red-50/40 p-4.5 shadow-2xs">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700">
          <ShieldAlert size={18} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">
            Biểu mẫu báo cáo tin xấu (Trợ lý AI đã soạn sẵn)
          </p>

          <div className="mt-2.5 rounded-xl border border-rose-200/60 bg-white/90 p-3 text-xs text-slate-700 shadow-2xs space-y-1">
            <p>
              <strong className="text-slate-900">Tin:</strong> {bieuMau.tenTin} · {bieuMau.congTy}
            </p>
            <p>
              <strong className="text-slate-900">Lý do:</strong> {JOB_REPORT_REASON_LABELS[bieuMau.lyDo] ?? bieuMau.lyDo}
            </p>
            <p>
              <strong className="text-slate-900">Nội dung:</strong> {bieuMau.moTa}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBo}
          className="-m-2 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-100/60 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          aria-label="Bỏ qua biểu mẫu này"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onXacNhan}
          className="rounded-xl bg-rose-600 text-white shadow-xs hover:bg-rose-700"
        >
          Xem lại & Xác nhận gửi
        </Button>
        <Button variant="ghost" size="sm" onClick={onBo} className="rounded-xl">
          Bỏ qua
        </Button>
      </div>

      <p className="mt-2.5 text-xs text-slate-600">
        AI chỉ hỗ trợ chuẩn bị thông tin. Báo cáo <strong className="font-semibold text-slate-800">chưa được gửi đi</strong> cho
        đến khi bạn xem lại và bấm xác nhận gửi tới Quản trị viên. Nhà tuyển dụng không biết ai báo cáo.
      </p>
    </div>
  )
}
