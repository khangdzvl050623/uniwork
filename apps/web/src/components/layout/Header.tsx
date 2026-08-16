import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { UniWorkMark } from '@/components/UniWorkMark'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/viec-lam', label: 'Việc làm', caret: true },
  { to: '/lich-ranh', label: 'Lịch rảnh', caret: false },
  { to: '/dang-ky', label: 'Hồ sơ & CV', caret: true },
  { to: '/ntd/ung-vien', label: 'Nhà tuyển dụng', caret: true },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-brand-900">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-500 text-white">
            <UniWorkMark size={17} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-white">
            Uni<span className="text-brand-300">Work</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-brand-50/90 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {item.label}
              {item.caret && <ChevronDown size={14} className="opacity-70" />}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link
            to="/dang-nhap"
            className="rounded-md border border-white/40 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Đăng nhập
          </Link>
          <Link
            to="/dang-ky"
            className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            Đăng ký
          </Link>
          <span className="mx-1 h-6 w-px bg-white/20" />
          <Link
            to="/ntd/dang-tin"
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
          >
            Đăng tuyển
          </Link>
        </div>

        <button
          className="ml-auto rounded-md p-2 text-white hover:bg-white/10 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Mở menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-brand-900 px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-brand-50/90 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Link
              to="/dang-nhap"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/40 py-2 text-center text-sm font-medium text-white"
            >
              Đăng nhập
            </Link>
            <Link
              to="/dang-ky"
              onClick={() => setOpen(false)}
              className="rounded-md bg-white py-2 text-center text-sm font-semibold text-brand-700"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
