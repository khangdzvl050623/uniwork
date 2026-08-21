import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { OtpInput } from '@/components/ui/OtpInput'
import { useAuth, useSendOtp, useVerifyEmail } from '@/hooks/useAuth'
import { useCountdown } from '@/hooks/useCountdown'
import { ApiClientError } from '@/lib/api'

/** Chờ bao lâu mới cho bấm "Gửi lại". Api chặn 5 lần/giờ, nên nới tay ở đây là hại người dùng. */
const GIAY_CHO_GUI_LAI = 60

/**
 * Màn nhập mã xác thực email (T47).
 *
 * Người dùng tới đây ngay sau khi đăng ký, nên họ đã đăng nhập rồi — mã gửi cho
 * chính họ, không cần nhập lại email. Đó cũng là lý do api không nhận email
 * trong body của /gui-otp: nhận thì endpoint thành công cụ dò email và máy gửi
 * thư rác.
 */
export function VerifyEmail() {
  const navigate = useNavigate()
  const { status, user } = useAuth()
  const sendOtp = useSendOtp()
  const verify = useVerifyEmail()
  const { conLai, dangCho, batDau } = useCountdown()

  const [code, setCode] = useState('')
  const [loi, setLoi] = useState<string>()
  const [devCode, setDevCode] = useState<string>()

  /*
   * Tự gửi mã ngay khi vào trang, đúng MỘT lần.
   *
   * `StrictMode` cố ý chạy effect hai lần ở môi trường phát triển. Không chặn
   * thì mỗi lần mở trang đốt 2 trong 5 lượt gửi mỗi giờ mà api cho phép — và
   * người dùng thật nhận hai email giống hệt nhau.
   */
  const daGuiLanDau = useRef(false)

  useEffect(() => {
    if (daGuiLanDau.current) return
    if (status !== 'da-dang-nhap' || user?.emailVerifiedAt) return

    daGuiLanDau.current = true
    guiMa()
    // Chỉ chạy khi trạng thái đăng nhập vừa xác định xong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.emailVerifiedAt])

  function guiMa() {
    setLoi(undefined)
    sendOtp.mutate(undefined, {
      onSuccess: (data) => {
        batDau(GIAY_CHO_GUI_LAI)
        setDevCode(data.devCode)
      },
      onError: (err) => {
        setLoi(err instanceof ApiClientError ? err.message : 'Không gửi được mã, thử lại sau.')
        // Bị chặn vì gọi quá nhanh thì vẫn phải đếm ngược, nếu không người dùng
        // bấm liên tục và càng bị chặn lâu hơn.
        if (err instanceof ApiClientError && err.code === 'RATE_LIMITED') {
          batDau(GIAY_CHO_GUI_LAI)
        }
      },
    })
  }

  function xacThuc(ma: string) {
    setLoi(undefined)
    verify.mutate(ma, {
      onSuccess: (u) => {
        // Sinh viên đi tiếp tới điền hồ sơ, nhà tuyển dụng tới nộp giấy tờ —
        // đó là việc kế tiếp của mỗi bên, không phải trang chủ.
        navigate(u.role === 'EMPLOYER' ? '/ntd/ho-so' : '/ho-so', { replace: true })
      },
      onError: (err) => {
        setLoi(
          err instanceof ApiClientError ? err.message : 'Không xác thực được, thử lại sau.',
        )
        // CỐ Ý giữ nguyên mã đã gõ. Xoá sạch bắt người dùng gõ lại cả 6 chữ số
        // chỉ vì sai một chữ — trong khi thứ họ cần là sửa đúng chữ đó.
      },
    })
  }

  if (status === 'dang-kiem-tra') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    )
  }

  if (status === 'chua-dang-nhap') return <Navigate to="/dang-nhap" replace />

  // Đã xác thực rồi thì không có việc gì ở đây nữa.
  if (user?.emailVerifiedAt) return <Navigate to="/" replace />

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Xác thực email</h1>
          <p className="mt-1 text-sm text-slate-500">
            Chúng tôi đã gửi mã 6 chữ số tới
            <br />
            <span className="font-medium text-slate-700">{user?.email}</span>
          </p>
        </div>

        {devCode && (
          // Chỉ có ngoài production — api cố tình trả mã về để lập trình viên và
          // người demo lấy được mà không cần mở hộp thư.
          <p className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            Mã ở môi trường thử: <span className="font-bold tracking-widest">{devCode}</span>
          </p>
        )}

        <OtpInput
          value={code}
          onChange={setCode}
          // Tự gửi khi vừa đủ 6 chữ số — không bắt bấm thêm nút. Người dùng gõ
          // xong chữ số cuối là xong việc của họ.
          onComplete={xacThuc}
          disabled={verify.isPending}
          error={Boolean(loi)}
        />

        {loi && (
          <p
            role="alert"
            className="animate-in fade-in slide-in-from-top-1 mt-3 flex items-center justify-center gap-1.5 text-sm text-red-600 duration-150"
          >
            <AlertCircle size={14} />
            {loi}
          </p>
        )}

        <Button
          size="lg"
          className="mt-5 w-full"
          onClick={() => xacThuc(code)}
          // Kiểm ĐỦ 6 CHỮ SỐ, không chỉ đếm độ dài: ô khuyết ở giữa được giữ
          // chỗ bằng dấu cách nên " 23456" cũng dài 6.
          disabled={!/^\d{6}$/.test(code) || verify.isPending}
        >
          {verify.isPending && <Loader2 size={16} className="animate-spin" />}
          {verify.isPending ? 'Đang kiểm tra…' : 'Xác thực'}
        </Button>

        <div className="mt-4 text-center text-sm text-slate-500">
          {dangCho ? (
            // `tabular-nums` để con số không làm dòng chữ giật qua lại mỗi giây
            // — chữ số trong font tỉ lệ có bề rộng khác nhau.
            <span>
              Gửi lại mã sau <span className="font-medium tabular-nums">{conLai}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={guiMa}
              disabled={sendOtp.isPending}
              className="font-medium text-brand-600 transition-colors hover:underline disabled:opacity-50"
            >
              {sendOtp.isPending ? 'Đang gửi…' : 'Chưa nhận được mã? Gửi lại'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 flex items-start justify-center gap-1.5 px-4 text-center text-xs text-slate-400">
        <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
        Mã có hiệu lực trong 10 phút. Nhớ kiểm tra cả thư mục Spam.
      </p>
    </div>
  )
}
