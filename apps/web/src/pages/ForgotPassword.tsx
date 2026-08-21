import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2, MailCheck } from 'lucide-react'
import { emailSchema, passwordSchema } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { OtpInput } from '@/components/ui/OtpInput'
import { useCountdown } from '@/hooks/useCountdown'
import { useForgotPassword, useResetPassword } from '@/hooks/useAuth'
import { ApiClientError } from '@/lib/api'

/** Api chặn 3 lần/giờ, nên đếm ngược ở đây phải đủ dài để người dùng không đâm vào tường. */
const GIAY_CHO_GUI_LAI = 60

/**
 * Quên mật khẩu — gộp cả hai bước vào một trang.
 *
 * Không tách thành hai route riêng vì người dùng vừa nhập email xong thì màn
 * kế tiếp cần biết email đó là gì. Tách ra thì phải truyền qua URL (lộ email
 * trong lịch sử trình duyệt và log máy chủ) hoặc qua state của router (mất
 * sạch nếu họ tải lại trang giữa chừng, và lúc đó màn nhập mã không biết mình
 * đang đặt lại cho ai).
 *
 * Trang này cũng là nơi tài khoản chỉ đăng nhập bằng Google đặt mật khẩu lần
 * đầu — xem giải thích trong `password-reset.service.ts` phía api.
 */
export function ForgotPassword() {
  const navigate = useNavigate()
  const guiMa = useForgotPassword()
  const datLai = useResetPassword()
  const { conLai, dangCho, batDau } = useCountdown()

  const [buoc, setBuoc] = useState<'nhap-email' | 'nhap-ma'>('nhap-email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [loi, setLoi] = useState<Record<string, string | undefined>>({})
  const [devCode, setDevCode] = useState<string>()

  function guiEmail(e: React.FormEvent) {
    e.preventDefault()

    const kiem = emailSchema.safeParse(email)
    if (!kiem.success) {
      setLoi({ email: kiem.error.issues[0]?.message })
      return
    }
    setLoi({})

    guiMa.mutate(kiem.data, {
      onSuccess: (data) => {
        setBuoc('nhap-ma')
        batDau(GIAY_CHO_GUI_LAI)
        setDevCode(data.devCode)
      },
      onError: (err) =>
        setLoi({ _: err instanceof ApiClientError ? err.message : 'Không gửi được mã' }),
    })
  }

  function guiLaiMa() {
    setLoi({})
    guiMa.mutate(email, {
      onSuccess: (data) => {
        batDau(GIAY_CHO_GUI_LAI)
        setDevCode(data.devCode)
        // Mã cũ vừa bị server huỷ, nên xoá luôn ô nhập — giữ lại chỉ khiến
        // người dùng bấm Xác nhận với một mã chắc chắn sai.
        setCode('')
      },
      onError: (err) => {
        setLoi({ _: err instanceof ApiClientError ? err.message : 'Không gửi được mã' })
        if (err instanceof ApiClientError && err.code === 'RATE_LIMITED') {
          batDau(GIAY_CHO_GUI_LAI)
        }
      },
    })
  }

  function datLaiMatKhau(e: React.FormEvent) {
    e.preventDefault()

    const kiem = passwordSchema.safeParse(matKhau)
    if (!kiem.success) {
      setLoi({ password: kiem.error.issues[0]?.message })
      return
    }
    setLoi({})

    datLai.mutate(
      { email, code, password: matKhau },
      {
        onSuccess: () => {
          // Server đã thu hồi mọi phiên nên KHÔNG tự đăng nhập — đưa họ về màn
          // đăng nhập để tự xác nhận nhớ đúng mật khẩu vừa đặt.
          navigate('/dang-nhap', {
            replace: true,
            state: { thongBao: 'Đặt lại mật khẩu thành công. Mời bạn đăng nhập.' },
          })
        },
        onError: (err) => {
          setLoi({ _: err instanceof ApiClientError ? err.message : 'Không đặt lại được' })
          // Giữ nguyên mã đã gõ: có thể họ chỉ sai một chữ số.
        },
      },
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
      <Link to="/" className="mb-6 flex items-center justify-center gap-2">
        <span className="text-xl font-bold text-slate-900">
          Uni<span className="text-brand-600">Work</span>
        </span>
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
            {buoc === 'nhap-email' ? <KeyRound size={22} /> : <MailCheck size={22} />}
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {buoc === 'nhap-email' ? 'Quên mật khẩu' : 'Nhập mã xác nhận'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {buoc === 'nhap-email' ? (
              'Nhập email của bạn, chúng tôi sẽ gửi mã để đặt mật khẩu mới.'
            ) : (
              <>
                Mã 6 chữ số đã được gửi tới
                <br />
                <span className="font-medium text-slate-700">{email}</span>
              </>
            )}
          </p>
        </div>

        {loi._ && (
          <div
            role="alert"
            className="animate-in fade-in slide-in-from-top-1 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 duration-150"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{loi._}</span>
          </div>
        )}

        {buoc === 'nhap-email' ? (
          <form onSubmit={guiEmail} noValidate className="space-y-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="ten@sinhvien.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={loi.email}
              disabled={guiMa.isPending}
            />

            <Button size="lg" className="w-full" disabled={guiMa.isPending}>
              {guiMa.isPending && <Loader2 size={16} className="animate-spin" />}
              {guiMa.isPending ? 'Đang gửi…' : 'Gửi mã đặt lại'}
            </Button>
          </form>
        ) : (
          <form onSubmit={datLaiMatKhau} noValidate className="space-y-4">
            {devCode && (
              <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
                Mã ở môi trường thử: <span className="font-bold tracking-widest">{devCode}</span>
              </p>
            )}

            <OtpInput value={code} onChange={setCode} disabled={datLai.isPending} error={Boolean(loi._)} />

            <Field
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              hint="Tối thiểu 8 ký tự, có chữ và số"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              error={loi.password}
              disabled={datLai.isPending}
            />

            <Button
              size="lg"
              className="w-full"
              disabled={!/^\d{6}$/.test(code) || datLai.isPending}
            >
              {datLai.isPending && <Loader2 size={16} className="animate-spin" />}
              {datLai.isPending ? 'Đang đặt lại…' : 'Đặt mật khẩu mới'}
            </Button>

            <div className="text-center text-sm text-slate-500">
              {dangCho ? (
                <span>
                  Gửi lại mã sau <span className="font-medium tabular-nums">{conLai}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={guiLaiMa}
                  disabled={guiMa.isPending}
                  className="font-medium text-brand-600 transition-colors hover:underline disabled:opacity-50"
                >
                  {guiMa.isPending ? 'Đang gửi…' : 'Chưa nhận được mã? Gửi lại'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <Link
        to="/dang-nhap"
        className="mt-5 flex items-center justify-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft size={14} />
        Quay lại đăng nhập
      </Link>

      {buoc === 'nhap-ma' && (
        <p className="mt-3 flex items-start justify-center gap-1.5 px-4 text-center text-xs text-slate-400">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          Mã sống 10 phút. Nhập sai 5 lần thì mã bị huỷ, phải xin mã mới.
        </p>
      )}
    </div>
  )
}
