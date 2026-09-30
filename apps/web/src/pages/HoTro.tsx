import { useState, type FormEvent } from 'react'
import { Headset, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useHoTro } from '@/hooks/useHoTro'

/**
 * Liên hệ hỗ trợ — người dùng nói chuyện với quản trị viên UniWork.
 *
 * ===========================================================================
 * MÀN HÌNH NÓI THẲNG AI SẼ ĐỌC ĐƯỢC GÌ
 * ===========================================================================
 * Quản trị viên đọc hội thoại này TỪ ĐẦU. Đó là thiết kế đúng — cả cuộc trò
 * chuyện chính là nội dung cái ticket. Nhưng nó chỉ đúng nếu người dùng BIẾT
 * trước khi gõ.
 *
 * Nên câu đó nằm ngay dưới tiêu đề, không giấu trong trang điều khoản. Người
 * ta sắp kể một vấn đề có thể kèm chuyện riêng; họ có quyền biết ai đọc.
 */

const TRAN_MO_TA = 1000

export function HoTro() {
  const { kenh, dangMo, xinGapNguoiThat, huyYeuCau, ketThuc } = useHoTro()
  const [moTa, setMoTa] = useState('')
  const [dangGui, setDangGui] = useState(false)

  const trangThai = kenh.trangThai

  async function gui(e: FormEvent) {
    e.preventDefault()
    if (moTa.trim() === '' || dangGui) return
    setDangGui(true)
    try {
      await xinGapNguoiThat(moTa.trim())
      setMoTa('')
    } finally {
      setDangGui(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-8">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Headset size={20} className="text-brand-600" aria-hidden="true" />
          Liên hệ hỗ trợ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản trị viên UniWork sẽ đọc <strong>toàn bộ</strong> hội thoại này từ đầu. Họ không đọc
          được các cuộc trò chuyện của bạn với nhà tuyển dụng.
        </p>
      </header>

      {dangMo && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-600" />
          <span className="sr-only">Đang mở kênh hỗ trợ</span>
        </div>
      )}

      {/*
        Luồng ĐÃ ĐÓNG cũng hiện form, không hiện một hội thoại chết.
        `yeuCauHoTro` mở lại chính luồng ấy, nên lịch sử cũ không mất — người
        dùng đọc lại được ở `/hoi-thoai/<id>`.
      */}
      {!dangMo && (trangThai === 'AI_ACTIVE' || trangThai === 'CLOSED') && (
        <form onSubmit={gui} className="rounded-xl border border-slate-200 bg-white p-5">
          <label htmlFor="mo-ta-ho-tro" className="font-medium text-slate-900">
            Bạn cần hỗ trợ việc gì?
          </label>
          <p className="mt-0.5 text-sm text-slate-500">
            Viết cụ thể giúp quản trị viên trả lời được ngay lần đầu — mã tin, thời điểm, bạn đã
            thử gì.
          </p>
          <textarea
            id="mo-ta-ho-tro"
            rows={5}
            value={moTa}
            maxLength={TRAN_MO_TA}
            onChange={(e) => setMoTa(e.target.value)}
            placeholder="Ví dụ: em nộp đơn tin ABC từ thứ hai, trạng thái vẫn là “đã gửi” và không bấm rút được."
            className="mt-3 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {moTa.length}/{TRAN_MO_TA}
            </span>
            <Button type="submit" disabled={moTa.trim() === '' || dangGui}>
              {dangGui && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
              Gửi yêu cầu hỗ trợ
            </Button>
          </div>

          {kenh.loi && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {kenh.loi}
            </p>
          )}
        </form>
      )}

      {!dangMo && (trangThai === 'WAITING_ADMIN' || trangThai === 'HUMAN_ACTIVE') && (
        <div className="flex min-h-[28rem] flex-col rounded-xl border border-slate-200 bg-white p-4">
          <KhungChat
            kenh={kenh}
            bien="sang"
            tenHo="Hỗ trợ UniWork"
            placeholder="Nhắn cho quản trị viên…"
            lyDoKhoa="Yêu cầu đã vào hàng đợi. Bạn nhắn được ngay khi có quản trị viên tiếp nhận."

            dauTrang={
              <div
                role="status"
                aria-atomic="true"
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3"
              >
                <p className="text-sm text-slate-700">
                  {trangThai === 'WAITING_ADMIN' && 'Đang chờ quản trị viên tiếp nhận…'}
                  {trangThai === 'HUMAN_ACTIVE' && 'Bạn đang nhắn với quản trị viên UniWork.'}
                </p>

                {trangThai === 'WAITING_ADMIN' && (
                  <Button variant="ghost" size="sm" onClick={() => void huyYeuCau()}>
                    Huỷ yêu cầu
                  </Button>
                )}
                {trangThai === 'HUMAN_ACTIVE' && (
                  <Button variant="ghost" size="sm" onClick={() => void ketThuc()}>
                    Kết thúc
                  </Button>
                )}
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}
