import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Briefcase, CalendarDays, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/viec-lam', label: 'Việc làm' },
  { to: '/lich-ranh', label: 'Lịch rảnh của tôi' },
  { to: '/ntd/dang-tin', label: 'Dành cho nhà tuyển dụng' },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <Briefcase size={18} />
          </span>
          <span className="text-lg font-bold text-slate-900">
            Uni<span className="text-brand-600">Work</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link to="/dang-nhap">
            <Button variant="ghost" size="sm">
              Đăng nhập
            </Button>
          </Link>
          <Link to="/dang-ky">
            <Button size="sm">Đăng ký</Button>
          </Link>
        </div>

        <button
          className="ml-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Mở menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <Link to="/dang-nhap" className="flex-1" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/dang-ky" className="flex-1" onClick={() => setOpen(false)}>
              <Button className="w-full">Đăng ký</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

/** Dải nhắc cập nhật lịch rảnh — thứ mà job board thông thường không có. */
export function AvailabilityBanner() {
  return (
    <div className="bg-brand-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <CalendarDays size={16} className="shrink-0" />
        <p className="flex-1">
          Học kỳ mới đã bắt đầu — cập nhật lịch rảnh để hệ thống lọc đúng việc cho bạn.
        </p>
        <Link to="/lich-ranh" className="shrink-0 font-medium underline underline-offset-2">
          Cập nhật ngay
        </Link>
      </div>
    </div>
  )
}
