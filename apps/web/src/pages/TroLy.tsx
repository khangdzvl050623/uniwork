import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, MessagesSquare, SendHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BongChat } from '@/components/tro-ly/BongChat'
import { DangTraCuu } from '@/components/tro-ly/DangTraCuu'
import { TheDeNghiNTD } from '@/components/tro-ly/TheDeNghiNTD'
import { useLuotConLai, useTroLy } from '@/hooks/useTroLy'

const TRAN_KY_TU = 2000

/** Bốn câu mồi cho lần đầu vào — ô chat trống là câu hỏi khó nhất với người dùng. */
const CAU_MOI = [
  'Có việc pha chế nào ở Hà Nội không?',
  'Việc nào hợp với lịch rảnh của em?',
  'Làm sao để khai lịch rảnh?',
  'Đơn ứng tuyển của em đang đến đâu rồi?',
]

export function TroLy() {
  const dieuHuong = useNavigate()
  /*
   * KHÔNG nhận tham số phiên nào.
   *
   * Trang này là LUỒNG TRỢ LÝ — một luồng cho mỗi người, vĩnh viễn. Mở ra là
   * thấy lại đúng cuộc trò chuyện hôm qua, kể cả trên máy khác, vì server suy
   * luồng từ tài khoản chứ không từ một khoá trình duyệt gửi lên.
   *
   * Luồng với nhà tuyển dụng nằm ở `/hoi-thoai/:id` — trang khác, vì đầu kia
   * là người chứ không phải model.
   */
  const {
    tinNhan,
    dangChay,
    toolDangChay,
    deNghi,
    loi,
    coTheGuiLai,
    gui,
    guiLai,
    chuyenNhaTuyenDung,
    boDeNghi,
  } = useTroLy()
  const { data: luot } = useLuotConLai()

  const [noiDung, setNoiDung] = useState('')
  const cuoiDanhSach = useRef<HTMLDivElement>(null)

  /*
   * Tự cuộn xuống khi có chữ mới.
   *
   * `block: 'end'` chứ không `behavior: 'smooth'` cho mỗi mẩu chữ: chữ tới
   * liên tục nên cuộn mượt sẽ xếp hàng hàng chục animation và màn hình trôi
   * giật. Nhảy thẳng thì khó chịu hơn một chút nhưng theo kịp.
   */
  useEffect(() => {
    cuoiDanhSach.current?.scrollIntoView({ block: 'end' })
  }, [tinNhan, toolDangChay])

  const hetLuot = luot !== undefined && luot.conLai <= 0
  const chuaSanSang = luot !== undefined && !luot.sanSang

  /*
   * Ô nhập đổi vai theo trạng thái phiên.
   *
   * `HUMAN_ACTIVE` thì chữ đi thẳng cho nhà tuyển dụng qua socket — KHÔNG tốn
   * lượt AI, nên hạn mức ngày không khoá ô nhập. Trộn hai luật vào một biến là
   * chỗ sẽ khoá nhầm: hết lượt hỏi trợ lý mà cũng không nhắn được người thật.
   */
  /*
   * Ô nhập chỉ còn MỘT vai: hỏi trợ lý.
   *
   * Bản trước nó đổi vai theo `state` — cùng một ô lúc thì gửi cho model, lúc
   * thì gửi cho nhà tuyển dụng. Hết rồi: nói chuyện với người có trang riêng
   * (`/hoi-thoai/:id`), nên chỗ này không còn nhánh nào để đi nhầm.
   */
  const khoa = dangChay || hetLuot || chuaSanSang

  function guiDi(e: FormEvent) {
    e.preventDefault()
    const cau = noiDung.trim()
    if (cau === '' || khoa) return
    setNoiDung('')
    void gui(cau)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Sparkles size={22} className="text-brand-600" aria-hidden="true" />
            Trợ lý UniWork
          </h1>

          {/*
           * Số lượt còn lại là `role="status"` với câu trọn nghĩa, không phải
           * một con số trần: trình đọc màn hình đọc "2" thì không ai hiểu 2 cái
           * gì.
           */}
          <div className="flex items-center gap-2">
            {luot && (
              <p
                role="status"
                aria-atomic="true"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                Còn {luot.conLai}/{luot.tong} lượt hỏi hôm nay
              </p>
            )}
            {/*
              Đường ra danh sách. Bắt buộc phải có ở ĐÂY: một sinh viên đang
              nói với nhà tuyển dụng A mà muốn hỏi nơi B thì phải mở hội thoại
              khác, và trang này là nơi họ đang đứng lúc nhận ra điều đó.
            */}
            <Link
              to="/hoi-thoai"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <MessagesSquare size={13} aria-hidden="true" />
              Hội thoại của tôi
            </Link>
          </div>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Hỏi về việc làm, lịch rảnh, hồ sơ và đơn ứng tuyển của bạn. Trợ lý chỉ trả lời dựa trên dữ
          liệu thật trên UniWork.
        </p>
      </header>

      <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
        {tinNhan.length === 0 && !dangChay && (
          <div className="rounded-xl border border-dashed border-slate-300 p-5">
            <p className="text-sm text-slate-600">Chưa có câu hỏi nào. Thử một trong số này:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CAU_MOI.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={khoa}
                  onClick={() => void gui(c)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {tinNhan.map((t) => (
          <BongChat key={t.id} tin={t} />
        ))}

        {dangChay && <DangTraCuu tool={toolDangChay} />}

        {deNghi && (
          <TheDeNghiNTD
            deNghi={deNghi}
            onBo={boDeNghi}
            onChuyen={() => {
              void chuyenNhaTuyenDung(deNghi.jobId, deNghi.lyDo).then((id) => {
                if (id) dieuHuong(`/hoi-thoai/${id}`)
              })
            }}
          />
        )}

        {loi && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <p className="min-w-0 flex-1 text-sm text-red-800">{loi}</p>
            {coTheGuiLai && (
              <Button variant="outline" size="sm" onClick={() => void guiLai()}>
                Gửi lại
              </Button>
            )}
          </div>
        )}

        <div ref={cuoiDanhSach} />
      </div>

      <form onSubmit={guiDi} className="mt-4">
        {chuaSanSang && (
          <p className="mb-2 text-sm text-slate-500">Trợ lý chưa được cấu hình trên máy chủ này.</p>
        )}
        {hetLuot && !chuaSanSang && (
          <p className="mb-2 text-sm text-slate-500">
            Bạn đã dùng hết {luot?.tong} lượt hỏi hôm nay. Mai quay lại nhé.
          </p>
        )}

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="cau-hoi" className="sr-only">
              Câu hỏi cho trợ lý
            </label>
            <textarea
              id="cau-hoi"
              rows={2}
              value={noiDung}
              maxLength={TRAN_KY_TU}
              disabled={khoa}
              onChange={(e) => setNoiDung(e.target.value)}
              /* Enter gửi, Shift+Enter xuống dòng — nếp quen của mọi ô chat. */
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) guiDi(e)
              }}
              placeholder="Hỏi trợ lý về việc làm, lịch rảnh, hồ sơ…"
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <Button type="submit" size="icon" disabled={khoa || noiDung.trim() === ''}>
            {dangChay ? (
              <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <SendHorizontal size={18} />
            )}
            <span className="sr-only">Gửi câu hỏi</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
