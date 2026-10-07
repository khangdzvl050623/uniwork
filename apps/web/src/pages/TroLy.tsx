import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, MessagesSquare, SendHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BongChat } from '@/components/tro-ly/BongChat'
import { DangTraCuu } from '@/components/tro-ly/DangTraCuu'
import { TheDeNghiNTD } from '@/components/tro-ly/TheDeNghiNTD'
import { TheBaoCaoTin } from '@/components/tro-ly/TheBaoCaoTin'
import { DialogBaoCao } from '@/components/bao-cao/DialogBaoCao'
import { useLuotConLai, useTroLy } from '@/hooks/useTroLy'
import { danhDauThoiGian } from '@/lib/gop-tin'
import { useCuonDanhSach } from '@/hooks/useCuonDanhSach'
import { cn } from '@/lib/utils'

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
    bieuMauBaoCao,
    loi,
    coTheGuiLai,
    gui,
    guiLai,
    chuyenNhaTuyenDung,
    boDeNghi,
    boBieuMauBaoCao,
    conCu,
    dangTaiCu,
    taiCu,
  } = useTroLy()
  const { data: luot } = useLuotConLai()

  const [noiDung, setNoiDung] = useState('')
  const [moBaoCao, setMoBaoCao] = useState(false)
  /*
   * Cuộn theo chữ đang chảy — nhưng chỉ khi người dùng đang ở gần đáy.
   *
   * Luồng trợ lý giờ sống vĩnh viễn, nên lịch sử dài ra mãi và người ta sẽ
   * cuộn lên đọc. Kéo họ xuống đáy mỗi mẩu chữ là không đọc được gì. Xem
   * `useCuonDanhSach`.
   */
  const { cuoiRef, ghiNeo, veDay } = useCuonDanhSach(tinNhan, toolDangChay)

  function hoi(cau: string) {
    veDay()
    void gui(cau)
  }

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
    hoi(cau)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6 sm:py-8">
      <header className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-500 via-teal-500 to-emerald-400 text-white shadow-md shadow-brand-500/25 ring-2 ring-white">
              <Sparkles size={21} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                Trợ lý UniWork
              </h1>
              <p className="text-xs font-medium text-slate-500">
                AI hỗ trợ tìm việc, khớp lịch học & tư vấn hồ sơ thông minh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {luot && (
              <p
                role="status"
                aria-atomic="true"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/90 px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    luot.conLai > 3 ? 'bg-emerald-500' : luot.conLai > 0 ? 'bg-amber-500' : 'bg-rose-500',
                  )}
                />
                Còn <strong className="font-bold text-slate-900">{luot.conLai}</strong>/{luot.tong} lượt hôm nay
              </p>
            )}
            <Link
              to="/hoi-thoai"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3.5 py-1 text-xs font-semibold text-slate-600 shadow-2xs transition-all hover:border-brand-400 hover:text-brand-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <MessagesSquare size={13} aria-hidden="true" />
              Hội thoại của tôi
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-[2rem] border border-slate-200/80 bg-gradient-to-b from-white/90 via-slate-50/40 to-white/90 p-5 sm:p-6 shadow-sm backdrop-blur-md">
        {tinNhan.length === 0 && !dangChay && (
          <div className="my-auto rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-7 text-center shadow-sm sm:p-9">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-400 via-teal-500 to-emerald-400 text-white shadow-xl shadow-brand-500/30 ring-4 ring-brand-50">
              <Sparkles size={28} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
              Xin chào! Bạn cần tìm hiểu gì hôm nay?
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
              Hỏi bất kỳ điều gì về việc làm bán thời gian, khung giờ rảnh, hồ sơ hoặc tiến độ ứng tuyển của bạn.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {CAU_MOI.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={khoa}
                  onClick={() => hoi(c)}
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-left text-xs font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:text-brand-900 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50"
                >
                  <span className="mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                    <Sparkles size={12} />
                  </span>
                  <span className="leading-snug">{c}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/*
          Trang này cũng gom nhóm thời gian như mọi hội thoại khác, dù đầu kia
          là model. Người dùng quay lại sau một ngày vẫn cần biết đoạn nào hỏi
          hôm qua, đoạn nào hỏi hôm nay — luồng trợ lý sống vĩnh viễn nên nó
          dài ra mãi.
        */}
        {conCu && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={dangTaiCu}
              onClick={() => {
                ghiNeo(tinNhan[0]?.id)
                void taiCu()
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-2xs transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
            >
              {dangTaiCu ? 'Đang tải…' : 'Tải tin cũ hơn'}
            </button>
          </div>
        )}

        {danhDauThoiGian(tinNhan).map(({ tin, moc, hienGio }) => (
          <div key={tin.id} data-tin-id={tin.id} className="space-y-3">
            {moc && <p className="py-1 text-center text-xs tabular-nums text-slate-400">{moc}</p>}
            <BongChat tin={tin} hienGio={hienGio} />
          </div>
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

        {bieuMauBaoCao && (
          <TheBaoCaoTin
            bieuMau={bieuMauBaoCao}
            onBo={boBieuMauBaoCao}
            onXacNhan={() => setMoBaoCao(true)}
          />
        )}

        {loi && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3"
          >
            <p className="min-w-0 flex-1 text-sm font-medium text-red-800">{loi}</p>
            {coTheGuiLai && (
              <Button variant="outline" size="sm" onClick={() => void guiLai()}>
                Gửi lại
              </Button>
            )}
          </div>
        )}

        <div ref={cuoiRef} />
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

        <div className="relative rounded-[2rem] bg-gradient-to-b from-slate-100 to-slate-200/60 p-1.5 ring-1 ring-slate-200/80 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)]">
          <div className="flex items-end gap-2 rounded-[1.65rem] bg-white p-2 shadow-inner transition-all focus-within:ring-2 focus-within:ring-brand-500/30">
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
                className="max-h-32 min-h-[46px] w-full resize-none bg-transparent px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:text-slate-400"
              />
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={khoa || noiDung.trim() === ''}
              className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-r from-teal-500 via-brand-600 to-emerald-600 text-white shadow-md shadow-brand-600/30 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-brand-600/40 active:scale-95 disabled:opacity-40"
            >
              {dangChay ? (
                <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
              ) : (
                <SendHorizontal size={18} />
              )}
              <span className="sr-only">Gửi câu hỏi</span>
            </Button>
          </div>
        </div>
      </form>

      {bieuMauBaoCao && (
        <DialogBaoCao
          jobId={bieuMauBaoCao.jobId}
          tenTin={bieuMauBaoCao.tenTin}
          initialReason={bieuMauBaoCao.lyDo}
          initialMoTa={bieuMauBaoCao.moTa}
          open={moBaoCao}
          onOpenChange={(v) => {
            setMoBaoCao(v)
            if (!v) boBieuMauBaoCao()
          }}
        />
      )}
    </div>
  )
}
