import { useState, type FormEvent, type ReactNode } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { BongChat, type BienChat } from '@/components/tro-ly/BongChat'
import { DangGo } from '@/components/tro-ly/DangGo'
import { danhDauThoiGian } from '@/lib/gop-tin'
import { useCuonDanhSach } from '@/hooks/useCuonDanhSach'
import type { KenhHoiThoai } from '@/hooks/useKenhHoiThoai'
import { cn } from '@/lib/utils'

const TRAN_KY_TU = 2000

/**
 * Khung đọc + gõ của MỘT hội thoại người–người.
 *
 * ===========================================================================
 * MỘT BẢN, BA MÀN HÌNH
 * ===========================================================================
 * Hộp thư nhà tuyển dụng, hàng đợi hỗ trợ của admin, và (về sau) mọi chỗ mở
 * lại một hội thoại cũ đều cần y hệt những thứ này: cuộn xuống khi có tin mới,
 * Enter gửi / Shift+Enter xuống dòng, trần ký tự, ô nhập khoá lại khi chưa
 * được gửi, và một câu giải thích VÌ SAO nó khoá.
 *
 * Cái cuối cùng là phần hay bị bỏ nhất và cũng là phần người dùng cần nhất:
 * một ô nhập xám không lời giải thích thì người ta nghĩ trang bị hỏng.
 *
 * Trang trợ lý của sinh viên KHÔNG dùng component này — nó còn ô câu mồi, thẻ
 * đề nghị chuyển, nút gửi lại và bộ đếm lượt. Ép chung một component cho cả
 * bốn là đẻ ra sáu cờ bật/tắt, và không ai đọc nổi nữa.
 */
export function KhungChat({
  kenh,
  tenHo,
  bien = 'sang',
  placeholder,
  lyDoKhoa,
  trong,
  dauTrang,
}: {
  kenh: KenhHoiThoai
  /** Tên hiển thị của người kia — "Sinh viên N.V.A", "Hỗ trợ UniWork"… */
  tenHo: string
  bien?: BienChat
  placeholder: string
  /** Câu giải thích khi `kenh.duocGui` là false. Bắt buộc phải có câu chữ. */
  lyDoKhoa: string
  /** Hiện khi hội thoại chưa có tin nào. */
  trong?: ReactNode
  /** Thanh hành động phía trên khung tin (tiếp nhận, kết thúc…). */
  dauTrang?: ReactNode
}) {
  const [noiDung, setNoiDung] = useState('')
  const [dangGui, setDangGui] = useState(false)
  /*
   * Cuộn do `useCuonDanhSach` lo — giữ chỗ khi chèn tin cũ, chỉ cuộn xuống khi
   * đang ở gần đáy. Truyền `hoDangGo` để chỉ báo "đang gõ" hiện ra cũng được
   * đưa vào tầm nhìn, nếu không nó nằm khuất dưới đáy.
   */
  const { cuoiRef, ghiNeo, veDay } = useCuonDanhSach(kenh.tinNhan, kenh.hoDangGo)

  function taiTinCu() {
    ghiNeo(kenh.tinNhan[0]?.id)
    void kenh.taiCu()
  }

  const khoa = !kenh.duocGui || dangGui

  async function guiDi(e: FormEvent) {
    e.preventDefault()
    const cau = noiDung.trim()
    if (cau === '' || khoa) return
    /*
     * Xoá ô nhập TRƯỚC khi chờ ACK, và không khôi phục khi lỗi.
     *
     * Lựa chọn có chủ đích: `guiTin` đã đặt `kenh.loi` khi hỏng, nên người
     * dùng biết. Còn giữ chữ lại rồi tự điền về sau vài trăm mili giây là kiểu
     * ô nhập "nhảy chữ" — họ đã gõ câu tiếp theo và bị chèn mất.
     */
    setNoiDung('')
    setDangGui(true)
    veDay()
    try {
      await kenh.guiTin(cau)
    } finally {
      setDangGui(false)
    }
  }

  const mau =
    bien === 'sang'
      ? {
          vien: 'border-slate-300',
          vienNhe: 'border-slate-100',
          chuPhu: 'text-slate-500',
          oNhap: 'border-slate-200/90 bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 shadow-2xs disabled:bg-slate-50',
          nut: 'bg-brand-600 text-white hover:bg-brand-700 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer transition-all',
        }
      : {
          vien: 'border-dash-line',
          vienNhe: 'border-dash-line',
          chuPhu: 'text-dash-muted',
          oNhap: 'border-dash-line bg-dash-surface text-dash-text focus:border-dash-accent',
          nut: 'bg-dash-accent text-dash-accent-ink hover:opacity-90 active:scale-95 cursor-pointer transition-all',
        }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {dauTrang}

      <div className={cn('min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-4')}>
        {kenh.dangTai && (
          <p className={cn('py-6 text-center text-sm', mau.chuPhu)} role="status">
            Đang tải hội thoại…
          </p>
        )}

        {!kenh.dangTai && kenh.tinNhan.length === 0 && trong}

        {/*
          Nút, không tự tải khi cuộn chạm đỉnh. Tự tải cần một IntersectionObserver
          và một cơ chế chống bắn lặp; nút thì bấm được bằng bàn phím, đọc được
          bằng trình đọc màn hình, và người dùng biết chắc mình vừa làm gì.
        */}
        {kenh.conCu && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={taiTinCu}
              disabled={kenh.dangTaiCu}
              className={cn(
                'rounded-full border border-slate-200/80 bg-white px-3.5 py-1 text-xs font-medium shadow-2xs transition-all hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                mau.chuPhu,
              )}
            >
              {kenh.dangTaiCu ? 'Đang tải…' : 'Tải tin cũ hơn'}
            </button>
          </div>
        )}

        {danhDauThoiGian(kenh.tinNhan).map(({ tin, moc, hienGio }) => (
          <div key={tin.id} data-tin-id={tin.id} className="space-y-3">
            {moc && (
              <p className={cn('py-1 text-center text-xs tabular-nums', mau.chuPhu)}>{moc}</p>
            )}
            <BongChat tin={tin} tenHo={tenHo} bien={bien} hienGio={hienGio} />
          </div>
        ))}

        {kenh.hoDangGo && <DangGo ten={tenHo} bien={bien} />}

        <div ref={cuoiRef} />
      </div>

      {kenh.loi && (
        <div
          role="alert"
          className="mb-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
        >
          {kenh.loi}
        </div>
      )}

      <form onSubmit={guiDi} className={cn('border-t pt-3', mau.vienNhe)}>
        {!kenh.duocGui && <p className={cn('mb-2 text-sm', mau.chuPhu)}>{lyDoKhoa}</p>}

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="o-nhan-tin" className="sr-only">
              Tin nhắn cho {tenHo}
            </label>
            <textarea
              id="o-nhan-tin"
              rows={2}
              value={noiDung}
              maxLength={TRAN_KY_TU}
              disabled={khoa}
              placeholder={placeholder}
              onChange={(e) => {
                setNoiDung(e.target.value)
                kenh.baoDangGo()
              }}
              /* Enter gửi, Shift+Enter xuống dòng — nếp quen của mọi ô chat. */
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) void guiDi(e)
              }}
              className={cn(
                'w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-colors disabled:opacity-60',
                mau.oNhap,
              )}
            />
          </div>

          <button
            type="submit"
            disabled={khoa || noiDung.trim() === ''}
            /*
             * 44×44 là sàn của vùng chạm trên thiết bị cảm ứng. Nút gửi nhỏ
             * hơn thế là nút bấm ba lần mới trúng.
             */
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
              mau.nut,
            )}
          >
            {dangGui ? (
              <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <SendHorizontal size={18} />
            )}
            <span className="sr-only">Gửi tin nhắn</span>
          </button>
        </div>
      </form>
    </div>
  )
}
