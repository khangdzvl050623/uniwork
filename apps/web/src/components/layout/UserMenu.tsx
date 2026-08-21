import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { MENU_THEO_VAI } from '@/lib/menu-nguoi-dung'
import { cn } from '@/lib/utils'

/** Chữ cái đầu của tên, dùng làm ảnh đại diện tạm khi chưa có ảnh thật. */
function chuDau(ten: string) {
  return ten.trim().charAt(0).toUpperCase() || '?'
}

export function UserMenu() {
  const { user } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()

  const [mo, setMo] = useState(false)
  const boc = useRef<HTMLDivElement>(null)

  /*
   * Bấm ra ngoài hoặc bấm Escape thì đóng.
   *
   * Thiếu hai thứ này là menu dính lại trên màn hình cho tới khi bấm đúng vào
   * nút — người dùng bấm ra chỗ khác rồi thấy nó vẫn nằm đó sẽ tưởng trang lỗi.
   */
  useEffect(() => {
    if (!mo) return

    const bamNgoai = (e: MouseEvent) => {
      if (!boc.current?.contains(e.target as Node)) setMo(false)
    }
    const bamPhim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false)
    }

    document.addEventListener('mousedown', bamNgoai)
    document.addEventListener('keydown', bamPhim)
    return () => {
      document.removeEventListener('mousedown', bamNgoai)
      document.removeEventListener('keydown', bamPhim)
    }
  }, [mo])

  if (!user) return null

  const dangXuat = () => {
    setMo(false)
    logout.mutate(undefined, {
      // `onSettled` trong useLogout đã dọn phiên dù thành công hay không, nên
      // chỉ cần đưa người dùng về trang chủ.
      onSettled: () => navigate('/', { replace: true }),
    })
  }

  return (
    <div className="relative" ref={boc}>
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        aria-expanded={mo}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">
          {chuDau(user.displayName)}
        </span>
        <span className="max-w-[10rem] truncate">{user.displayName}</span>
        <ChevronDown size={14} className={cn('opacity-70 transition-transform', mo && 'rotate-180')} />
      </button>

      {mo && (
        <div
          role="menu"
          // `origin-top-right`: menu bung ra TỪ nút vừa bấm chứ không phải từ
          // giữa chính nó — mắt bám được mối liên hệ giữa hai thứ.
          className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg duration-150"
        >
          <div className="border-b border-slate-100 px-2.5 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium text-slate-900">{user.displayName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            {!user.emailVerifiedAt && (
              <Link
                to="/xac-thuc-email"
                onClick={() => setMo(false)}
                className="mt-1 inline-block text-xs font-medium text-amber-600 hover:underline"
              >
                Email chưa xác thực →
              </Link>
            )}
          </div>

          <div className="py-1">
            {MENU_THEO_VAI[user.role].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setMo(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <item.icon size={15} className="text-slate-400" />
                {item.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={dangXuat}
              disabled={logout.isPending}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              <LogOut size={15} className="text-slate-400" />
              {logout.isPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
