import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react'
import { loginSchema, registerSchema, type SignupRole } from '@uniwork/shared'
import { GoogleButton } from '@/components/GoogleButton'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { useAuth, useLogin, useRegister } from '@/hooks/useAuth'
import { useZodForm } from '@/hooks/useZodForm'
import { cn } from '@/lib/utils'

/**
 * Màn đăng nhập và đăng ký (T46).
 *
 * Luật kiểm dữ liệu lấy nguyên từ `@uniwork/shared` — cùng object mà api dùng,
 * không phải bản chép lại. Nhờ vậy không có chuyện form báo hợp lệ rồi server
 * từ chối.
 */

function LoiChung({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="animate-in fade-in slide-in-from-top-1 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 duration-150"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function RoleTabs({
  role,
  onChange,
  disabled,
}: {
  role: SignupRole
  onChange: (r: SignupRole) => void
  disabled?: boolean
}) {
  const tabs: { key: SignupRole; label: string; icon: typeof GraduationCap }[] = [
    { key: 'STUDENT', label: 'Sinh viên', icon: GraduationCap },
    { key: 'EMPLOYER', label: 'Nhà tuyển dụng', icon: Building2 },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(tab.key)}
          // Vai trò đang chọn quyết định cả nhãn ô nhập lẫn endpoint gọi đi,
          // nên nó là một lựa chọn thật sự — dùng aria-pressed để trình đọc màn
          // hình nói rõ đang bật cái nào.
          aria-pressed={role === tab.key}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium',
            'transition-[background-color,color,transform] duration-150 ease-out',
            'active:scale-[0.98] disabled:opacity-60',
            role === tab.key
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
      <Link to="/" className="mb-6 flex items-center justify-center gap-2">
        <span className="text-xl font-bold text-slate-900">
          Uni<span className="text-brand-600">Work</span>
        </span>
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-center text-xl font-bold text-slate-900">{title}</h1>
        <p className="mb-6 text-center text-sm text-slate-500">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

/**
 * Người đã đăng nhập mà mở /dang-nhap thì đưa thẳng về trang chủ.
 *
 * Không chặn thì họ đăng nhập đè lên phiên đang có — server cấp phiên mới và
 * thu hồi phiên cũ, tức là các tab khác đang mở bị đăng xuất mà không rõ lý do.
 */
function useChuyenHuongNeuDaDangNhap() {
  const { status } = useAuth()
  const location = useLocation()
  const quayLai = (location.state as { from?: { pathname: string } } | null)?.from?.pathname

  return status === 'da-dang-nhap' ? <Navigate to={quayLai ?? '/'} replace /> : null
}

/* ------------------------------------------------------------ đăng nhập -- */

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const daVao = useChuyenHuongNeuDaDangNhap()

  const form = useZodForm(loginSchema, { email: '', password: '' })

  if (daVao) return daVao

  const guiForm = (e: React.FormEvent) => {
    e.preventDefault()
    const duLieu = form.validate()
    if (!duLieu) return

    login.mutate(duLieu as { email: string; password: string }, {
      onSuccess: () => {
        // Quay lại đúng trang họ định vào trước khi bị chặn (T48).
        const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
        navigate(from ?? '/', { replace: true })
      },
      onError: (err) => form.applyServerError(err),
    })
  }

  // Thông báo do trang khác chuyển sang, ví dụ vừa đặt lại mật khẩu xong.
  const thongBao = (location.state as { thongBao?: string } | null)?.thongBao

  // Lỗi từ luồng Google. Api chuyển hướng về đây kèm ?loi=... vì lúc đó người
  // dùng đang ở giữa chuỗi chuyển hướng, không có chỗ nào khác để báo.
  const loiGoogle = new URLSearchParams(location.search).get('loi') ?? undefined

  return (
    <AuthShell title="Đăng nhập" subtitle="Chào mừng bạn quay lại UniWork">
      {thongBao && (
        <div
          role="status"
          className="animate-in fade-in mb-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-800 duration-150"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{thongBao}</span>
        </div>
      )}

      <LoiChung message={form.errors._ ?? loiGoogle} />

      <GoogleButton />

      <form className="space-y-4" onSubmit={guiForm} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ten@sinhvien.edu.vn"
          value={form.values.email}
          onChange={(e) => form.setValue('email', e.target.value)}
          error={form.errors.email}
          disabled={login.isPending}
        />

        <Field
          label="Mật khẩu"
          type="password"
          // current-password: báo cho trình quản lý mật khẩu đây là ô ĐIỀN mật
          // khẩu đã lưu, không phải ô tạo mật khẩu mới.
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.values.password}
          onChange={(e) => form.setValue('password', e.target.value)}
          error={form.errors.password}
          disabled={login.isPending}
        />

        <div className="flex items-center justify-end text-sm">
          <Link to="/quen-mat-khau" className="text-brand-600 hover:underline">
            Quên mật khẩu?
          </Link>
        </div>

        <Button size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 size={16} className="animate-spin" />}
          {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Chưa có tài khoản?{' '}
        <Link to="/dang-ky" className="font-medium text-brand-600 hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  )
}

/* -------------------------------------------------------------- đăng ký -- */

export function Register() {
  const navigate = useNavigate()
  const register = useRegister()
  const daVao = useChuyenHuongNeuDaDangNhap()

  const [role, setRole] = useState<SignupRole>('STUDENT')
  const [dongY, setDongY] = useState(false)
  const [loiDongY, setLoiDongY] = useState<string>()

  const form = useZodForm(registerSchema, {
    email: '',
    password: '',
    name: '',
    role: 'STUDENT' as SignupRole,
  })

  if (daVao) return daVao

  const doiVaiTro = (r: SignupRole) => {
    setRole(r)
    form.setValue('role', r)
  }

  const guiForm = (e: React.FormEvent) => {
    e.preventDefault()

    // Kiểm ô đồng ý riêng: nó không phải dữ liệu gửi lên server nên không nằm
    // trong schema dùng chung.
    if (!dongY) {
      setLoiDongY('Bạn cần đồng ý với điều khoản để tiếp tục')
      return
    }
    setLoiDongY(undefined)

    const duLieu = form.validate()
    if (!duLieu) return

    register.mutate(duLieu as Parameters<typeof register.mutate>[0], {
      // Đăng ký xong đi thẳng tới màn nhập mã, không về trang chủ. Đây là lúc
      // duy nhất người dùng còn nhớ mình vừa đăng ký bằng email nào.
      onSuccess: () => navigate('/xac-thuc-email', { replace: true }),
      onError: (err) => form.applyServerError(err),
    })
  }

  const laSinhVien = role === 'STUDENT'

  return (
    <AuthShell title="Tạo tài khoản" subtitle="Miễn phí hoàn toàn, mất khoảng 2 phút">
      <RoleTabs role={role} onChange={doiVaiTro} disabled={register.isPending} />

      <LoiChung message={form.errors._} />

      {/* Chỉ hiện ở luồng sinh viên. Tài khoản tạo qua Google mặc định là sinh
          viên (api không có chỗ hỏi vai trò giữa chuỗi chuyển hướng), nên đặt
          nút này ở tab nhà tuyển dụng sẽ tạo ra tài khoản sai vai. */}
      {laSinhVien && <GoogleButton label="Đăng ký bằng Google" />}

      <form className="space-y-4" onSubmit={guiForm} noValidate>
        <Field
          label={laSinhVien ? 'Họ tên' : 'Tên công ty / cửa hàng'}
          autoComplete={laSinhVien ? 'name' : 'organization'}
          placeholder={laSinhVien ? 'Nguyễn Văn A' : 'The Corner Coffee'}
          value={form.values.name}
          onChange={(e) => form.setValue('name', e.target.value)}
          error={form.errors.name}
          disabled={register.isPending}
        />

        <Field
          label={laSinhVien ? 'Email' : 'Email liên hệ'}
          type="email"
          autoComplete="email"
          placeholder={laSinhVien ? 'ten@sinhvien.edu.vn' : 'tuyendung@congty.vn'}
          value={form.values.email}
          onChange={(e) => form.setValue('email', e.target.value)}
          error={form.errors.email}
          disabled={register.isPending}
        />

        <Field
          label="Mật khẩu"
          type="password"
          // new-password: trình duyệt hiểu đây là ô tạo mật khẩu mới nên sẽ gợi
          // ý mật khẩu mạnh, và KHÔNG tự điền mật khẩu cũ vào đây.
          autoComplete="new-password"
          hint="Tối thiểu 8 ký tự, có chữ và số"
          value={form.values.password}
          onChange={(e) => form.setValue('password', e.target.value)}
          error={form.errors.password}
          disabled={register.isPending}
        />

        <div>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={dongY}
              onChange={(e) => {
                setDongY(e.target.checked)
                if (e.target.checked) setLoiDongY(undefined)
              }}
              disabled={register.isPending}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            />
            Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của UniWork
          </label>
          {loiDongY && (
            <p role="alert" className="mt-1.5 text-xs text-red-600">
              {loiDongY}
            </p>
          )}
        </div>

        <Button size="lg" className="w-full" disabled={register.isPending}>
          {register.isPending && <Loader2 size={16} className="animate-spin" />}
          {register.isPending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link to="/dang-nhap" className="font-medium text-brand-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  )
}
