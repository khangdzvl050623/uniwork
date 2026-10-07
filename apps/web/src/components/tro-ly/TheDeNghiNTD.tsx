import { Building2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DeNghiNTD } from '@/hooks/useTroLy'

/**
 * Thẻ "nhắn nhà tuyển dụng" — AI đề nghị, người dùng quyết.
 *
 * ===========================================================================
 * NÚT NÀY CHƯA GỬI GÌ CẢ, VÀ PHẢI NÓI RÕ ĐIỀU ĐÓ
 * ===========================================================================
 * Yêu cầu đề bài: AI được phép ĐỀ NGHỊ chuyển sang người thật, nhưng không tự
 * gửi tin trước khi người dùng chọn. Phía server đã bảo đảm bằng cách không
 * tồn tại tool nào ghi được tin nhắn — nhưng người dùng không đọc được code.
 *
 * Nên giao diện phải nói ra: dòng cuối thẻ ghi rõ nhà tuyển dụng **chưa** nhận
 * được gì. Thiếu câu đó thì người dùng thấy AI "đề nghị nhắn" và tưởng tin đã
 * bay đi rồi, rồi ngồi đợi trả lời cho một tin chưa hề gửi.
 *
 * Tại sao hiện `lyDo`: model tự tóm tắt vì sao cần hỏi nhà tuyển dụng. Cho
 * người dùng đọc trước khi bấm là cơ hội duy nhất để họ phát hiện AI hiểu sai
 * ý mình — sau khi bấm thì tin đã sang người thật rồi.
 */
export function TheDeNghiNTD({
  deNghi,
  dangGui,
  onChuyen,
  onBo,
}: {
  deNghi: DeNghiNTD
  dangGui?: boolean
  onChuyen: () => void
  onBo: () => void
}) {
  return (
    <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/90 to-orange-50/40 p-4.5 shadow-2xs">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
          <Building2 size={18} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Hỏi trực tiếp nhà tuyển dụng?</p>
          <p className="mt-1 text-sm text-slate-700 leading-relaxed">{deNghi.lyDo}</p>
          <p className="mt-2 truncate text-xs font-semibold text-slate-500">
            {deNghi.tenTin} · {deNghi.congTy}
          </p>
        </div>

        <button
          type="button"
          onClick={onBo}
          /* 44×44 là ngưỡng tối thiểu cho vùng chạm — nút đóng nhỏ hơn thì trên
             điện thoại rất hay bấm trượt sang nút chính ngay cạnh. */
          className="-m-2 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-amber-100/60 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Bỏ qua lời đề nghị này"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button variant="accent" size="sm" onClick={onChuyen} disabled={dangGui} className="rounded-xl shadow-xs">
          {dangGui ? 'Đang chuyển…' : 'Nhắn nhà tuyển dụng'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onBo} disabled={dangGui} className="rounded-xl">
          Để sau
        </Button>
      </div>

      <p className="mt-2.5 text-xs text-slate-600">
        Nhà tuyển dụng <strong className="font-semibold text-slate-800">chưa nhận được gì</strong>. Chỉ khi bạn bấm
        nút trên thì hội thoại mới chuyển sang người thật.
      </p>
    </div>
  )
}
