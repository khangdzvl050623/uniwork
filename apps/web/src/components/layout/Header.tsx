import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { UserMenu } from '@/components/layout/UserMenu'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { MENU_THEO_VAI, NAV_KHACH, NAV_THEO_VAI } from '@/lib/menu-nguoi-dung'
import { cn } from '@/lib/utils'

export function Header() {
  const [open, setOpen] = useState(false)
  const { status, user, daDangNhap } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()

  // Chưa biết là ai (đang kiểm tra phiên) thì dùng nav của khách — giống hệt
  // hành vi cũ, nên không sinh thêm nhấp nháy nào.
  const nav = user ? NAV_THEO_VAI[user.role] : NAV_KHACH

  return (
    <header className="sticky top-0 z-40 border-b border-teal-100/80 bg-white/85 backdrop-blur-xl shadow-xs transition-colors">
      <div className="mx-auto flex h-15 max-w-[1180px] items-center gap-6 px-4">
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-400 via-brand-400 to-emerald-300 text-slate-900 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
            <span className="text-sm font-black text-slate-900">U</span>
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900">
            Uni<span className="bg-gradient-to-r from-teal-600 via-brand-600 to-emerald-600 bg-clip-text text-transparent">Work</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1.5 lg:flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80 shadow-2xs font-semibold backdrop-blur-xs'
                    : 'text-slate-600 hover:bg-teal-50/60 hover:text-teal-900',
                )
              }
            >
              {item.label}
              {item.caret && <ChevronDown size={14} className="opacity-70" />}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2.5 lg:flex">
          {daDangNhap ? (
            <>
              <NotificationBell enabled />
              <UserMenu />
              {/* Chỉ nhà tuyển dụng mới thấy nút đăng tuyển — sinh viên bấm vào
                  chỉ để nhận về một trang bị chặn. */}
              {user?.role === 'EMPLOYER' && (
                <>
                  <span className="mx-1 h-5 w-px bg-slate-200" />
                  <Link
                    to="/ntd/dang-tin"
                    className="rounded-full bg-gradient-to-r from-teal-500 to-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    Đăng tuyển
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              {/* Trong lúc còn kiểm tra phiên thì giữ chỗ, KHÔNG hiện nút đăng
                  nhập rồi lại thay bằng tên người dùng — nhấp nháy như vậy làm
                  người dùng tưởng mình vừa bị đăng xuất. */}
              {status === 'dang-kiem-tra' ? (
                <div className="h-9 w-40" aria-hidden />
              ) : (
                <>
                  <Link
                    to="/dang-nhap"
                    className="rounded-full border border-teal-200/80 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-2xs transition-all duration-200 hover:bg-teal-50/60 hover:border-teal-300 hover:text-teal-900 active:scale-95"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/dang-ky"
                    className="rounded-full bg-teal-500/15 border border-teal-200/80 px-4 py-1.5 text-sm font-bold text-teal-900 shadow-2xs transition-all duration-200 hover:bg-teal-500/25 active:scale-95"
                  >
                    Đăng ký
                  </Link>
                  <span className="mx-1 h-5 w-px bg-slate-200" />
                  <Link
                    to="/ntd/dang-tin"
                    className="rounded-full bg-gradient-to-r from-teal-500 to-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    Đăng tuyển
                  </Link>
                </>
              )}
            </>
          )}
        </div>

        <button
          className="ml-auto rounded-xl p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Mở menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-teal-100 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50/80 hover:text-teal-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-slate-200 pt-3">
            {daDangNhap && user ? (
              <>
                <div className="flex items-center justify-between px-3 pb-2">
                  <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
                  <NotificationBell enabled />
                </div>
                <div className="flex flex-col gap-1">
                  {MENU_THEO_VAI[user.role].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50/80 hover:text-teal-900"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      logout.mutate(undefined, {
                        onSettled: () => navigate('/', { replace: true }),
                      })
                    }}
                    disabled={logout.isPending}
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {logout.isPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/dang-nhap"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-teal-200 bg-white py-2 text-center text-sm font-medium text-slate-700 shadow-2xs hover:bg-teal-50"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/dang-ky"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-teal-600 py-2 text-center text-sm font-semibold text-white shadow-2xs hover:bg-teal-700"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
