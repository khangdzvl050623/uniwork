import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type Role = 'STUDENT' | 'EMPLOYER'

function Field({
  label,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string
  type?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

function RoleTabs({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  const tabs: { key: Role; label: string; icon: typeof GraduationCap }[] = [
    { key: 'STUDENT', label: 'Sinh viên', icon: GraduationCap },
    { key: 'EMPLOYER', label: 'Nhà tuyển dụng', icon: Building2 },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
            role === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
      <Link to="/" className="mb-6 flex items-center justify-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white">
          <Briefcase size={20} />
        </span>
        <span className="text-xl font-bold text-slate-900">
          Uni<span className="text-brand-600">Work</span>
        </span>
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6">{children}</div>
    </div>
  )
}

export function Login() {
  const [role, setRole] = useState<Role>('STUDENT')

  return (
    <AuthShell>
      <h1 className="mb-1 text-center text-xl font-bold text-slate-900">Đăng nhập</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Chào mừng bạn quay lại UniWork</p>

      <RoleTabs role={role} onChange={setRole} />

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Email" type="email" placeholder="ten@sinhvien.edu.vn" />
        <Field label="Mật khẩu" type="password" placeholder="••••••••" />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" />
            Ghi nhớ đăng nhập
          </label>
          <a href="#" className="text-brand-600 hover:underline">
            Quên mật khẩu?
          </a>
        </div>

        <Button size="lg" className="w-full">
          Đăng nhập
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

export function Register() {
  const [role, setRole] = useState<Role>('STUDENT')

  return (
    <AuthShell>
      <h1 className="mb-1 text-center text-xl font-bold text-slate-900">Tạo tài khoản</h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Miễn phí hoàn toàn, mất khoảng 2 phút
      </p>

      <RoleTabs role={role} onChange={setRole} />

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        {role === 'STUDENT' ? (
          <>
            <Field label="Họ và tên" placeholder="Nguyễn Văn A" />
            <Field label="Email" type="email" placeholder="ten@sinhvien.edu.vn" />
            <Field label="Trường đang học" placeholder="ĐH Kinh tế TP.HCM" />
          </>
        ) : (
          <>
            <Field label="Tên công ty / cửa hàng" placeholder="The Corner Coffee" />
            <Field label="Email liên hệ" type="email" placeholder="tuyendung@congty.vn" />
            <Field
              label="Mã số thuế hoặc giấy phép kinh doanh"
              placeholder="0312345678"
              hint="Dùng để xác minh, tin chỉ hiển thị sau khi được duyệt"
            />
          </>
        )}

        <Field label="Mật khẩu" type="password" hint="Tối thiểu 8 ký tự, có chữ và số" />

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
          Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của UniWork
        </label>

        <Button size="lg" className="w-full">
          Tạo tài khoản
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
