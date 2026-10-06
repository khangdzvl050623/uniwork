import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Headset,
  HelpCircle,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react'
import { DANH_MUC_HO_TRO, DANH_MUC_HO_TRO_LABELS, type DanhMucHoTro } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { OtpInput } from '@/components/ui/OtpInput'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useAuth } from '@/hooks/useAuth'
import { useHoTro } from '@/hooks/useHoTro'
import { apiFetch, ApiClientError } from '@/lib/api'

const TRAN_MO_TA = 1000

export function HoTro() {
  const { daDangNhap } = useAuth()

  if (!daDangNhap) {
    return <HoTroKhach />
  }

  return <HoTroThanhVien />
}

/* ===========================================================================
 * HỖ TRỢ DÀNH CHO THÀNH VIÊN ĐÃ ĐĂNG NHẬP (SV & NTD)
 * =========================================================================== */

function HoTroThanhVien() {
  const { kenh, dangMo, xinGapNguoiThat, huyYeuCau, ketThuc } = useHoTro({ enabled: true })
  const [danhMuc, setDanhMuc] = useState<DanhMucHoTro>('HE_THONG')
  const [moTa, setMoTa] = useState('')
  const [tomTatAi, setTomTatAi] = useState('')
  const [xacNhanTomTat, setXacNhanTomTat] = useState(false)
  const [dangGui, setDangGui] = useState(false)
  const [moFormLienHe, setMoFormLienHe] = useState(false)
  const [faqMo, setFaqMo] = useState<string | null>(null)

  const trangThai = kenh.trangThai

  async function gui(e: FormEvent) {
    e.preventDefault()
    if (moTa.trim() === '' || dangGui) return
    setDangGui(true)
    try {
      await xinGapNguoiThat({
        danhMuc,
        moTa: moTa.trim(),
        tomTatAi: xacNhanTomTat && tomTatAi.trim() ? tomTatAi.trim() : undefined,
      })
      setMoTa('')
      setTomTatAi('')
      setMoFormLienHe(false)
    } finally {
      setDangGui(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Headset size={24} className="text-brand-600" aria-hidden="true" />
          Hộp thư Hỗ trợ UniWork
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Kênh hỗ trợ chính thức giữa người dùng và ban quản trị. Phiên trò chuyện được xử lý trực
          tiếp bởi Quản trị viên.
        </p>

        {/* Cam kết bảo mật quyền riêng tư */}
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
          <ShieldCheck size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <strong>Cam kết bảo mật & quyền riêng tư:</strong> Quản trị viên chỉ đọc được nội dung
            trong phiên hỗ trợ này. Quản trị viên <strong>tuyệt đối không có quyền</strong> truy cập
            vào các cuộc trò chuyện riêng giữa Sinh viên và Nhà tuyển dụng hoặc lịch sử AI cá nhân.
          </div>
        </div>
      </header>

      {dangMo && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-600" />
          <span className="sr-only">Đang mở kênh hỗ trợ</span>
        </div>
      )}

      {/* Trạng thái chưa mở phiên hỗ trợ hoặc phiên cũ đã đóng */}
      {!dangMo && (trangThai === 'AI_ACTIVE' || trangThai === 'CLOSED') && (
        <div className="space-y-6">
          {/* PHẦN 1: Hướng dẫn tự động / Câu hỏi thường gặp */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <HelpCircle size={18} className="text-brand-600" />
              Hướng dẫn tự phục vụ & Câu hỏi thường gặp
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Các vấn đề thường gặp có thể được xử lý nhanh theo hướng dẫn dưới đây:
            </p>

            <div className="mt-4 space-y-2.5">
              {[
                {
                  id: 'quen-mat-khau',
                  tieuDe: 'Quên mật khẩu hoặc muốn đổi mật khẩu?',
                  noiDung:
                    'Nếu bạn đã đăng nhập, vào trang Cài đặt tài khoản để cập nhật mật khẩu mới. Nếu quên mật khẩu khi đăng nhập, chọn tính năng "Quên mật khẩu" tại màn hình đăng nhập để nhận mã OTP an toàn gửi về email đã đăng ký.',
                },
                {
                  id: 'xac-minh-dn',
                  tieuDe: 'Xác minh hồ sơ doanh nghiệp & giấy phép?',
                  noiDung:
                    'Nhà tuyển dụng cần tải lên ảnh chụp Giấy phép Đăng ký kinh doanh (ĐKKD) rõ nét trong phần Thông tin công ty. Ban quản trị sẽ đối soát và phê duyệt trong vòng 24 giờ làm việc.',
                },
                {
                  id: 'kieu-nai-duyet',
                  tieuDe: 'Khiếu nại kiểm duyệt tin tuyển dụng bị từ chối?',
                  noiDung:
                    'Vui lòng kiểm tra lý do từ chối trong email thông báo. Nếu tin tuyển dụng đáp ứng đầy đủ tiêu chuẩn cộng đồng và thông tin lương/địa điểm rõ ràng, bạn có thể chỉnh sửa lại nội dung hoặc liên hệ Admin qua kênh này để được rà soát lại.',
                },
                {
                  id: 'loi-he-thong',
                  tieuDe: 'Gặp sự cố kết nối hoặc lỗi hiển thị trên hệ thống?',
                  noiDung:
                    'Hãy thử làm mới trang (Ctrl + F5) hoặc xóa cache trình duyệt. Nếu vấn đề vẫn tiếp diễn khi nộp hồ sơ hoặc nhận tin nhắn, bạn hãy bấm nút "Liên hệ hỗ trợ trực tiếp" bên dưới để quản trị viên kiểm tra nhật ký hệ thống.',
                },
              ].map((faq) => (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/60"
                >
                  <button
                    type="button"
                    onClick={() => setFaqMo(faqMo === faq.id ? null : faq.id)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100/70"
                  >
                    <span>{faq.tieuDe}</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${
                        faqMo === faq.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {faqMo === faq.id && (
                    <div className="border-t border-slate-100 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
                      {faq.noiDung}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* PHẦN 2: Nút liên hệ trực tiếp (Bypass AI quota) & Form xác nhận */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {trangThai === 'CLOSED'
                    ? 'Mở yêu cầu hỗ trợ mới'
                    : 'Liên hệ trực tiếp Quản trị viên'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Kết nối trực tiếp với ban quản trị UniWork mà không phụ thuộc vào lượt trợ lý AI.
                </p>
              </div>
              {!moFormLienHe && (
                <Button onClick={() => setMoFormLienHe(true)} className="shrink-0">
                  <Headset size={16} className="mr-1.5" />
                  {trangThai === 'CLOSED' ? 'Gửi yêu cầu mới' : 'Liên hệ hỗ trợ'}
                </Button>
              )}
            </div>

            {moFormLienHe && (
              <form onSubmit={gui} className="mt-5 border-t border-slate-100 pt-5">
                {/* Chọn danh mục vấn đề */}
                <div>
                  <label htmlFor="danh-muc-ho-tro" className="block text-sm font-medium text-slate-900">
                    Danh mục vấn đề cần hỗ trợ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="danh-muc-ho-tro"
                    value={danhMuc}
                    onChange={(e) => setDanhMuc(e.target.value as DanhMucHoTro)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
                  >
                    {DANH_MUC_HO_TRO.map((key) => (
                      <option key={key} value={key}>
                        {DANH_MUC_HO_TRO_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mô tả chi tiết vấn đề */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="mo-ta-ho-tro" className="block text-sm font-medium text-slate-900">
                      Mô tả chi tiết vấn đề <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400">
                      {moTa.length}/{TRAN_MO_TA}
                    </span>
                  </div>
                  <textarea
                    id="mo-ta-ho-tro"
                    rows={4}
                    value={moTa}
                    maxLength={TRAN_MO_TA}
                    onChange={(e) => setMoTa(e.target.value)}
                    placeholder="Mô tả cụ thể sự cố bạn gặp phải, mã tin tuyển dụng, mã đơn ứng tuyển hoặc thời điểm phát sinh lỗi..."
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
                    required
                  />
                </div>

                {/* Chuyển ngữ cảnh từ AI (Người dùng xác nhận tóm tắt) */}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={xacNhanTomTat}
                      onChange={(e) => setXacNhanTomTat(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800">
                        Đính kèm bản tóm tắt chuyển ngữ cảnh từ trợ lý AI
                      </span>
                      <p className="mt-0.5 text-slate-500">
                        Bạn có quyền xem và chỉnh sửa bản tóm tắt này trước khi gửi. Admin sẽ chỉ
                        nhận bản tóm tắt này, không xem lịch sử hội thoại AI riêng tư.
                      </p>
                    </div>
                  </label>

                  {xacNhanTomTat && (
                    <div className="mt-3">
                      <textarea
                        rows={3}
                        value={tomTatAi}
                        onChange={(e) => setTomTatAi(e.target.value)}
                        placeholder="Nội dung tóm tắt vấn đề từ phiên trợ lý AI (bạn có thể chỉnh sửa tự do)..."
                        className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </div>

                {kenh.loi && (
                  <p role="alert" className="mt-3 text-xs text-rose-700">
                    {kenh.loi}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMoFormLienHe(false)}
                    disabled={dangGui}
                  >
                    Hủy bỏ
                  </Button>
                  <Button type="submit" disabled={moTa.trim() === '' || dangGui}>
                    {dangGui && (
                      <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                    )}
                    Gửi yêu cầu hỗ trợ
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* Trạng thái WAITING_ADMIN hoặc HUMAN_ACTIVE */}
      {!dangMo && (trangThai === 'WAITING_ADMIN' || trangThai === 'HUMAN_ACTIVE') && (
        <div className="flex min-h-[30rem] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <KhungChat
            kenh={kenh}
            bien="sang"
            tenHo="Quản trị viên UniWork"
            placeholder="Nhập tin nhắn trao đổi với quản trị viên..."
            lyDoKhoa="Yêu cầu đang chờ quản trị viên tiếp nhận. Bạn sẽ được trò chuyện ngay khi admin phản hồi."
            dauTrang={
              <div
                role="status"
                aria-atomic="true"
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        trangThai === 'HUMAN_ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <p className="text-sm font-semibold text-slate-800">
                      {trangThai === 'WAITING_ADMIN' && 'Đang chờ quản trị viên tiếp nhận...'}
                      {trangThai === 'HUMAN_ACTIVE' && 'Đang trò chuyện với Quản trị viên'}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Hai bên online thì trao đổi realtime; offline tin nhắn vẫn lưu và gửi thông báo
                    khi có phản hồi.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {trangThai === 'WAITING_ADMIN' && (
                    <Button variant="ghost" size="sm" onClick={() => void huyYeuCau()}>
                      Huỷ yêu cầu
                    </Button>
                  )}
                  {trangThai === 'HUMAN_ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void ketThuc()}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      Đã giải quyết / Đóng phiên
                    </Button>
                  )}
                </div>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}

/* ===========================================================================
 * HỖ TRỢ DÀNH CHO KHÁCH KHÔNG ĐĂNG NHẬP ĐƯỢC (XÁC MINH OTP EMAIL)
 * =========================================================================== */

function HoTroKhach() {
  const [buoc, setBuoc] = useState<'FORM' | 'OTP' | 'THANH_CONG'>('FORM')
  const [email, setEmail] = useState('')
  const [hoTen, setHoTen] = useState('')
  const [phone, setPhone] = useState('')
  const [danhMuc, setDanhMuc] = useState<DanhMucHoTro>('TAI_KHOAN')
  const [moTa, setMoTa] = useState('')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [dangXuLy, setDangXuLy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function guiOtp(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !hoTen.trim() || !moTa.trim() || dangXuLy) return

    setDangXuLy(true)
    setLoi(null)
    try {
      const res = await apiFetch<{ devCode?: string }>('/api/ho-tro/khach/gui-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.devCode) {
        setDevCode(res.devCode)
      }
      setBuoc('OTP')
    } catch (err) {
      setLoi(err instanceof ApiClientError ? err.message : 'Không gửi được mã xác thực')
    } finally {
      setDangXuLy(false)
    }
  }

  async function xacNhanVaGui(code: string) {
    if (dangXuLy) return
    setDangXuLy(true)
    setLoi(null)
    try {
      await apiFetch('/api/ho-tro/khach/gui-yeu-cau', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          hoTen: hoTen.trim(),
          phone: phone.trim() || undefined,
          danhMuc,
          moTa: moTa.trim(),
        }),
      })
      setBuoc('THANH_CONG')
    } catch (err) {
      setLoi(err instanceof ApiClientError ? err.message : 'Xác thực thất bại')
    } finally {
      setDangXuLy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Headset size={24} className="text-brand-600" aria-hidden="true" />
          Hỗ trợ Sự cố & Tài khoản
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dành cho người dùng gặp lỗi đăng nhập, quên mật khẩu, hoặc cần xác minh thông tin khi chưa
          truy cập được vào tài khoản UniWork.
        </p>
      </header>

      {buoc === 'FORM' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800">
            <KeyRound size={18} className="shrink-0 text-blue-600" />
            <div>
              <strong>Bạn quên mật khẩu?</strong> Nếu bạn vẫn nhận được email, bạn có thể tự đổi
              mật khẩu nhanh bằng tính năng{' '}
              <a href="/quen-mat-khau" className="font-semibold underline hover:text-blue-900">
                Quên mật khẩu tại đây
              </a>{' '}
              mà không cần đợi ban quản trị xét duyệt.
            </div>
          </div>

          <form onSubmit={guiOtp} className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Gửi yêu cầu hỗ trợ (Xác minh qua Email)
            </h2>

            <div>
              <label htmlFor="khach-email" className="block text-sm font-medium text-slate-800">
                Email liên hệ của bạn <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3 top-3 text-slate-400"
                />
                <input
                  id="khach-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Hệ thống sẽ gửi mã OTP 6 số tới email này để xác thực quyền sở hữu.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="khach-hoten" className="block text-sm font-medium text-slate-800">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1">
                  <User
                    size={16}
                    className="pointer-events-none absolute left-3 top-3 text-slate-400"
                  />
                  <input
                    id="khach-hoten"
                    type="text"
                    required
                    value={hoTen}
                    onChange={(e) => setHoTen(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="khach-phone" className="block text-sm font-medium text-slate-800">
                  Số điện thoại liên hệ
                </label>
                <div className="relative mt-1">
                  <Phone
                    size={16}
                    className="pointer-events-none absolute left-3 top-3 text-slate-400"
                  />
                  <input
                    id="khach-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="khach-danhmuc" className="block text-sm font-medium text-slate-800">
                Danh mục sự cố <span className="text-rose-500">*</span>
              </label>
              <select
                id="khach-danhmuc"
                value={danhMuc}
                onChange={(e) => setDanhMuc(e.target.value as DanhMucHoTro)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
              >
                {DANH_MUC_HO_TRO.map((k) => (
                  <option key={k} value={k}>
                    {DANH_MUC_HO_TRO_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="khach-mota" className="block text-sm font-medium text-slate-800">
                Mô tả chi tiết vấn đề <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="khach-mota"
                rows={4}
                required
                value={moTa}
                maxLength={TRAN_MO_TA}
                onChange={(e) => setMoTa(e.target.value)}
                placeholder="Mô tả sự cố bạn đang gặp: ví dụ không đăng nhập được do mất số điện thoại, tài khoản bị tạm khóa, lỗi xác thực..."
                className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500"
              />
            </div>

            {loi && (
              <p role="alert" className="text-xs text-rose-700">
                {loi}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={dangXuLy || !email.trim() || !hoTen.trim() || !moTa.trim()}
            >
              {dangXuLy && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
              Tiếp tục: Nhận mã xác thực qua Email
            </Button>
          </form>
        </div>
      )}

      {buoc === 'OTP' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setBuoc('FORM')
              setLoi(null)
            }}
            className="mb-4 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} /> Quay lại sửa thông tin
          </button>

          <h2 className="text-base font-semibold text-slate-900">Xác minh thông tin liên hệ</h2>
          <p className="mt-1 text-xs text-slate-600">
            Chúng tôi đã gửi mã xác thực 6 chữ số tới <strong>{email}</strong>. Vui lòng kiểm tra
            hộp thư và nhập mã vào bên dưới.
          </p>

          {devCode && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              Mã thử nghiệm (môi trường dev): <strong>{devCode}</strong>
            </div>
          )}

          <div className="mt-6 flex flex-col items-center">
            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={(code) => void xacNhanVaGui(code)}
              disabled={dangXuLy}
              error={!!loi}
            />
          </div>

          {loi && (
            <p role="alert" className="mt-3 text-center text-xs text-rose-700">
              {loi}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={guiOtp}
              disabled={dangXuLy}
              className="text-xs text-brand-600 hover:underline disabled:opacity-50"
            >
              Gửi lại mã mới
            </button>
            <Button
              type="button"
              onClick={() => void xacNhanVaGui(otp)}
              disabled={dangXuLy || otp.length < 6}
            >
              {dangXuLy && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
              Xác nhận & Gửi yêu cầu
            </Button>
          </div>
        </div>
      )}

      {buoc === 'THANH_CONG' && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            Yêu cầu hỗ trợ đã được tiếp nhận
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Cảm ơn bạn. Thông tin sự cố của bạn đã được chuyển tới hàng đợi Quản trị viên UniWork.
          </p>
          <div className="mx-auto mt-4 max-w-md rounded-lg border border-slate-100 bg-slate-50 p-3.5 text-left text-xs text-slate-600">
            <div>
              <strong>Email nhận phản hồi:</strong> {email}
            </div>
            <div className="mt-1">
              <strong>Danh mục:</strong> {DANH_MUC_HO_TRO_LABELS[danhMuc]}
            </div>
            <div className="mt-1">
              <strong>Thời gian tiếp nhận:</strong> Vừa xong
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Quản trị viên sẽ xem xét và phản hồi trực tiếp tới email của bạn trong thời gian sớm
            nhất.
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => {
              setBuoc('FORM')
              setEmail('')
              setMoTa('')
              setOtp('')
            }}
          >
            Gửi yêu cầu khác
          </Button>
        </div>
      )}
    </div>
  )
}
