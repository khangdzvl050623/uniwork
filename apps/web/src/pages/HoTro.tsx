import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Headset, HelpCircle, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useHoTro } from '@/hooks/useHoTro'
import { cn } from '@/lib/utils'

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
 *
 * ---------------------------------------------------------------------------
 * HƯỚNG DẪN TRƯỚC, NGƯỜI THẬT LUÔN CÓ LỐI VÀO
 * ---------------------------------------------------------------------------
 * Kế hoạch hỗ trợ: việc tự làm được (quên mật khẩu…) thì hướng dẫn trước, và
 * luôn có lối vào hỗ trợ trực tiếp, không phụ thuộc hạn mức AI.
 *
 * Mỗi câu trong `CAU_HOI_THUONG_GAP` phải là sự thật kiểm được trong code —
 * cùng luật với `noi-dung/huong-dan.ts` của trợ lý. Bản 2026-10-06 hướng dẫn
 * vào "trang Cài đặt tài khoản" để đổi mật khẩu, tải "Giấy phép ĐKKD", xem lý
 * do từ chối "trong email": cả ba đều không tồn tại. Hướng dẫn sai tệ hơn
 * không có — người dùng đi tìm, không thấy, rồi kết luận sản phẩm hỏng.
 */

const TRAN_MO_TA = 1000

const CAU_HOI_THUONG_GAP: { id: string; hoi: string; dap: ReactNode }[] = [
  {
    id: 'mat-khau',
    hoi: 'Quên mật khẩu, hoặc muốn đổi mật khẩu?',
    dap: (
      <>
        Dùng trang{' '}
        <Link to="/quen-mat-khau" className="font-medium text-brand-700 underline">
          Quên mật khẩu
        </Link>
        , kể cả khi bạn đang đăng nhập: UniWork gửi mã 6 số về email, mã dùng được trong 10 phút.
        Tài khoản đăng nhập bằng Google muốn đặt thêm mật khẩu cũng đi đường này.
      </>
    ),
  },
  {
    id: 'ma-otp',
    hoi: 'Không nhận được mã xác thực qua email?',
    dap: 'Kiểm tra thư mục thư rác trước. Mã có hạn — hết hạn thì bấm gửi lại để nhận mã mới.',
  },
  {
    id: 'xac-minh',
    hoi: 'Nhà tuyển dụng: vì sao tin của tôi chưa hiện công khai?',
    dap: (
      <>
        Doanh nghiệp phải được xác minh trước. Vào{' '}
        <Link to="/ntd/ho-so" className="font-medium text-brand-700 underline">
          Hồ sơ nhà tuyển dụng
        </Link>{' '}
        để nộp đủ ba loại giấy tờ — trang đó hiện rõ loại nào còn thiếu. Quản trị viên duyệt từng
        giấy tờ, đủ cả ba thì hồ sơ được xác minh.
      </>
    ),
  },
  {
    id: 'tu-choi-tin',
    hoi: 'Nhà tuyển dụng: tin bị từ chối thì làm gì?',
    dap: 'Tin bị từ chối quay về nháp kèm lý do. Sửa theo lý do đó rồi gửi duyệt lại. Nếu thấy lý do chưa đúng, gửi yêu cầu hỗ trợ bên dưới.',
  },
]

export function HoTro() {
  const { kenh, dangMo, xinGapNguoiThat, huyYeuCau, ketThuc } = useHoTro()
  const [moTa, setMoTa] = useState('')
  const [dangGui, setDangGui] = useState(false)
  const [cauDangMo, setCauDangMo] = useState<string | null>(null)

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
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Headset size={22} className="text-brand-600" aria-hidden="true" />
          Liên hệ hỗ trợ
        </h1>

        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p>
            Quản trị viên UniWork sẽ đọc <strong>toàn bộ</strong> hội thoại hỗ trợ này từ đầu. Họ
            không đọc được các cuộc trò chuyện của bạn với nhà tuyển dụng, cũng không đọc được lịch
            sử trợ lý AI.
          </p>
        </div>
      </header>

      {dangMo && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
          <span className="sr-only">Đang mở hội thoại hỗ trợ</span>
        </div>
      )}

      {/*
        Luồng ĐÃ ĐÓNG cũng hiện form, không hiện một hội thoại chết.
        `yeuCauHoTro` mở lại chính luồng ấy, nên lịch sử cũ không mất — người
        dùng đọc lại được ở `/hoi-thoai/<id>`.
      */}
      {!dangMo && (trangThai === 'AI_ACTIVE' || trangThai === 'CLOSED') && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <HelpCircle size={18} className="text-brand-600" aria-hidden="true" />
              Câu hỏi thường gặp
            </h2>
            <ul className="mt-3 space-y-2">
              {CAU_HOI_THUONG_GAP.map((c) => {
                const mo = cauDangMo === c.id
                return (
                  <li key={c.id} className="overflow-hidden rounded-lg border border-slate-100">
                    <button
                      type="button"
                      aria-expanded={mo}
                      onClick={() => setCauDangMo(mo ? null : c.id)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      <span>{c.hoi}</span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={cn(
                          'shrink-0 text-slate-400 transition-transform motion-reduce:transition-none',
                          mo && 'rotate-180',
                        )}
                      />
                    </button>
                    {mo && (
                      <div className="border-t border-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-600">
                        {c.dap}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <form onSubmit={gui} className="rounded-xl border border-slate-200 bg-white p-5">
            <label htmlFor="mo-ta-ho-tro" className="font-medium text-slate-900">
              {trangThai === 'CLOSED' ? 'Cần hỗ trợ thêm việc gì?' : 'Bạn cần hỗ trợ việc gì?'}
            </label>
            <p className="mt-0.5 text-sm text-slate-500">
              Viết cụ thể giúp quản trị viên trả lời được ngay lần đầu — mã tin, thời điểm, bạn đã
              thử gì. Gửi yêu cầu không tốn lượt hỏi trợ lý AI.
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
        </div>
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
                <p className="flex items-center gap-2 text-sm text-slate-700">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-full',
                      trangThai === 'HUMAN_ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500',
                    )}
                  />
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
                    Đã giải quyết · Kết thúc
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
