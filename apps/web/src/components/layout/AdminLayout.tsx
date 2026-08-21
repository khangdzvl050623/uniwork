import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  Moon,
  Plus,
  Search,
  Shapes,
  Sun,
  Users,
  X,
} from 'lucide-react'
import type { Role } from '@uniwork/shared'
import { useAuth } from '@/hooks/useAuth'
import { useDashTheme } from '@/hooks/useDashTheme'
import { cn } from '@/lib/utils'

/**
 * Khung của khu quản trị (admin + NTD quản lý).
 *
 * Tách hẳn khỏi `Layout` của trang công khai chứ không thêm biến thể vào đó. Hai
 * khu vực này không dùng chung gì cả: một bên header ngang có menu marketing,
 * một bên sidebar dọc có ô tìm kiếm và nút hành động. Nhồi cả hai vào một
 * component thì mỗi lần sửa một bên lại phải nghĩ xem có vỡ bên kia không.
 *
 * Nền tối chỉ nằm trong khối này, không đụng tới `body`. Nhờ vậy chuyển từ
 * /admin về trang chủ là màu nền tự trở lại đúng, không cần thêm/bớt class trên
 * thẻ <html> lúc điều hướng.
 */

interface MucSidebar {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface NhomSidebar {
  title: string
  items: MucSidebar[]
}

/**
 * Sidebar chia theo vai, KHÔNG dùng chung một danh sách.
 *
 * Khung tối này phục vụ hai vai khác hẳn nhau: admin và nhà tuyển dụng (route
 * /ntd/quan-ly cũng nằm trong `AdminLayout`). Trước đây danh sách là một hằng
 * số tĩnh dựng cho mọi người, nên nhà tuyển dụng mở trang quản lý tin của mình
 * là nhìn thấy nguyên menu quản trị: "Duyệt tin tuyển dụng", "Duyệt nhà tuyển
 * dụng", "Người dùng". Bấm vào thì `RequireRole` chặn — nhưng họ đã kịp biết hệ
 * thống có những khu nào. Chiều ngược lại admin thấy "Tin đăng của tôi" trỏ tới
 * một route chỉ EMPLOYER vào được.
 *
 * Đây không phải lớp bảo mật (lớp thật nằm ở middleware phía api). Nó là chuyện
 * đừng bày ra trước mắt người dùng những cánh cửa họ không mở được.
 */
const NAV_ADMIN: NhomSidebar[] = [
  {
    title: 'Tổng quan',
    // `end` là bắt buộc riêng cho mục này: mọi route admin khác đều bắt đầu
    // bằng '/admin', thiếu nó thì "Bảng điều khiển" sáng lên ở cả 4 trang.
    items: [{ to: '/admin', label: 'Bảng điều khiển', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Chờ xử lý',
    items: [
      { to: '/admin/duyet-tin', label: 'Duyệt tin tuyển dụng', icon: ClipboardCheck },
      { to: '/admin/duyet-ntd', label: 'Duyệt nhà tuyển dụng', icon: Building2 },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { to: '/admin/ky-nang', label: 'Danh mục kỹ năng', icon: Shapes },
      { to: '/admin/nguoi-dung', label: 'Người dùng', icon: Users },
    ],
  },
]

const NAV_EMPLOYER: NhomSidebar[] = [
  {
    title: 'Tuyển dụng',
    items: [
      { to: '/ntd/quan-ly', label: 'Tin đăng của tôi', icon: BriefcaseBusiness },
      { to: '/ntd/dang-tin', label: 'Đăng tin mới', icon: Plus },
      { to: '/ntd/ung-vien', label: 'Ứng viên', icon: Users },
    ],
  },
  {
    title: 'Doanh nghiệp',
    items: [{ to: '/ntd/ho-so', label: 'Hồ sơ & giấy tờ', icon: Building2 }],
  },
]

const NAV_THEO_VAI: Partial<Record<Role, NhomSidebar[]>> = {
  ADMIN: NAV_ADMIN,
  EMPLOYER: NAV_EMPLOYER,
}

/** Chữ nhỏ cạnh logo — người đang đứng ở khu nào. */
const TEN_KHU: Partial<Record<Role, string>> = {
  ADMIN: 'Quản trị',
  EMPLOYER: 'Nhà tuyển dụng',
}

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggle } = useDashTheme()
  const { user } = useAuth()

  /*
   * `AdminLayout` nằm NGOÀI `RequireAuth` trong cây route, nên nó dựng xong
   * trước khi biết người dùng là ai. Lúc đó `user` còn null và sidebar rỗng —
   * chấp nhận được, vì phần nội dung bên phải đang hiện vòng quay chờ của
   * `RequireAuth`. Đoán bừa một vai để lấp chỗ trống thì lại quay về đúng lỗi
   * vừa sửa: bày menu sai cho người xem.
   */
  const sections = (user && NAV_THEO_VAI[user.role]) || []

  return (
    // data-dash-theme là chỗ duy nhất quyết định chế độ sáng/tối. Mọi biến màu
    // --dash-* khai theo thuộc tính này (xem index.css), nên đổi một thuộc tính
    // ở đây là cả khu quản trị đổi theo — không component nào cần biết.
    //
    // Đặt trên div này chứ không trên <html>: trang công khai chỉ dựng cho chế
    // độ sáng, để lên <html> thì admin đổi màu sẽ kéo cả trang chủ đổi theo.
    <div data-dash-theme={theme} className="bg-dash-bg text-dash-text min-h-screen">
      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar
          open={menuOpen}
          onNavigate={() => setMenuOpen(false)}
          sections={sections}
          tenKhu={(user && TEN_KHU[user.role]) || ''}
        />

        {/* min-w-0 là bắt buộc, không phải cho đẹp: mặc định một item của flex
            không co nhỏ hơn nội dung bên trong nó, nên chỉ cần một bảng rộng là
            cả cột này phình ra và đẩy sidebar khỏi màn hình. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onToggleMenu={() => setMenuOpen((v) => !v)}
            menuOpen={menuOpen}
            theme={theme}
            onToggleTheme={toggle}
            tenNguoiDung={user?.displayName ?? ''}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  open,
  onNavigate,
  sections,
  tenKhu,
}: {
  open: boolean
  onNavigate: () => void
  sections: NhomSidebar[]
  tenKhu: string
}) {
  return (
    <>
      {/* Lớp phủ chỉ có trên màn hình nhỏ, nơi sidebar trượt đè lên nội dung. */}
      {open && (
        <button
          aria-label="Đóng menu"
          onClick={onNavigate}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'border-dash-line bg-dash-bg fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col border-r',
          'transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-dash-line flex h-16 items-center gap-2.5 border-b px-5">
          <span className="bg-dash-accent grid h-8 w-8 place-items-center rounded-lg">
            <BriefcaseBusiness size={17} className="text-dash-bg" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            UniWork
            <span className="text-dash-muted ml-1.5 font-medium">{tenKhu}</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-6 last:mb-0">
              <p className="text-dash-muted px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
                {section.title}
              </p>

              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'dash-nav-mark group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                          'transition-[background-color,color] duration-150',
                          isActive
                            ? 'bg-dash-accent/12 text-dash-accent font-medium'
                            : 'text-dash-muted hover:bg-dash-surface hover:text-dash-text',
                        )
                      }
                    >
                      {/* Biểu tượng nhích sang phải một chút khi rê chuột. Chỉ
                          2px — đủ để tay biết hàng này bấm được, chưa đủ để mắt
                          bị kéo đi khi lướt qua cả danh sách. */}
                      <item.icon
                        size={17}
                        className="shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                      />
                      {/* Hai mục "Chờ xử lý" từng có huy hiệu 34 và 12 ghi cứng
                          trong mã. Bỏ đi: hệ thống chưa có tin tuyển dụng nào,
                          nên con số đó nói dối ngay trên thanh điều hướng. Gắn
                          lại khi có API đếm thật. */}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-dash-line border-t p-3">
          <NavLink
            to="/"
            className="text-dash-muted hover:bg-dash-surface hover:text-dash-text flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150"
          >
            <span className="bg-dash-raised grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold">
              ←
            </span>
            Về trang công khai
          </NavLink>
        </div>
      </aside>
    </>
  )
}

function TopBar({
  onToggleMenu,
  menuOpen,
  theme,
  onToggleTheme,
  tenNguoiDung,
}: {
  onToggleMenu: () => void
  menuOpen: boolean
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  tenNguoiDung: string
}) {
  return (
    <header className="border-dash-line bg-dash-bg/85 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onToggleMenu}
        aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
        className="text-dash-muted hover:bg-dash-surface hover:text-dash-text -ml-1 rounded-lg p-2 transition-colors lg:hidden"
      >
        {menuOpen ? <Menu size={19} /> : <Menu size={19} />}
      </button>

      <SearchBox />

      <div className="ml-auto flex items-center gap-1.5">
        <button className="bg-dash-accent text-dash-accent-ink hidden items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97] sm:inline-flex">
          <Plus size={16} />
          Tạo mới
        </button>

        <IconButton
          label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          onClick={onToggleTheme}
        >
          {/* Hai biểu tượng cùng chồng lên nhau, cái đang tắt thì thu nhỏ và xoay
              đi. Đổi hẳn thẻ này sang thẻ kia thì không có gì để làm mượt — trình
              duyệt chỉ thấy một phần tử biến mất và một phần tử khác xuất hiện. */}
          <span className="relative grid h-[17px] w-[17px] place-items-center">
            <Sun
              size={17}
              className={cn(
                'absolute transition-[transform,opacity] duration-300 ease-out',
                theme === 'light'
                  ? 'scale-100 rotate-0 opacity-100'
                  : 'scale-50 -rotate-90 opacity-0',
              )}
            />
            <Moon
              size={17}
              className={cn(
                'absolute transition-[transform,opacity] duration-300 ease-out',
                theme === 'dark'
                  ? 'scale-100 rotate-0 opacity-100'
                  : 'scale-50 rotate-90 opacity-0',
              )}
            />
          </span>
        </IconButton>

        {/* Chuông từng đeo một chấm đỏ "5" ghi cứng. Bảng `notifications` còn
            chưa tồn tại (cố ý, xem đầu schema.prisma) nên con số đó thuần tuý
            là bịa — và một chấm đỏ thì người dùng buộc phải bấm vào để kiểm. */}
        <IconButton label="Thông báo">
          <Bell size={17} />
        </IconButton>

        <span className="bg-dash-line mx-1 h-6 w-px" />

        <span
          title={tenNguoiDung}
          className="bg-dash-violet/25 text-dash-violet ring-dash-line grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-1"
        >
          {tenNguoiDung.slice(0, 2).toUpperCase() || '—'}
        </span>
      </div>
    </header>
  )
}

/**
 * Ô tìm kiếm kèm gợi ý phím tắt.
 *
 * Phím tắt hiện đúng theo hệ điều hành: ⌘K trên macOS, Ctrl K ở chỗ còn lại.
 * Hiện sai thì người dùng bấm theo rồi không thấy gì xảy ra, tức là gợi ý còn
 * tệ hơn không có gợi ý.
 */
function SearchBox() {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  }, [])

  return (
    <label className="border-dash-line bg-dash-surface focus-within:border-dash-accent/60 flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border px-3 transition-colors duration-150">
      <Search size={15} className="text-dash-muted shrink-0" />
      <input
        placeholder="Tìm tin đăng, doanh nghiệp, người dùng…"
        className="placeholder:text-dash-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <kbd className="border-dash-line text-dash-muted hidden shrink-0 rounded border px-1.5 py-0.5 font-sans text-[10px] font-medium sm:block">
        {isMac ? '⌘' : 'Ctrl'} K
      </kbd>
    </label>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="text-dash-muted hover:bg-dash-surface hover:text-dash-text relative grid h-9 w-9 place-items-center rounded-lg transition-[transform,background-color,color] duration-150 ease-out active:scale-95"
    >
      {children}
    </button>
  )
}

/** Dùng tạm cho các trang trong khu quản trị chưa dựng. */
export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="dash-card grid min-h-[320px] place-items-center p-8 text-center">
      <div>
        <X size={26} className="text-dash-muted mx-auto" />
        <h1 className="mt-3 text-lg font-semibold">{title}</h1>
        <p className="text-dash-muted mt-1.5 text-sm">Trang này sẽ được dựng ở bước tiếp theo.</p>
      </div>
    </div>
  )
}
