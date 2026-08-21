import { CalendarDays, LayoutDashboard, ShieldCheck, UserRound } from 'lucide-react'
import type { Role } from '@uniwork/shared'

/**
 * Đường dẫn trong menu tài khoản, theo từng vai trò.
 *
 * Để ở file riêng chứ không nằm cạnh `UserMenu`: một file vừa xuất component
 * vừa xuất hằng số thì Vite không hot-reload được component đó nữa (quy tắc
 * `react-refresh/only-export-components`). Menu này dùng ở cả bản máy tính
 * (`UserMenu`) lẫn bản di động (`Header`), nên nó phải nằm ngoài cả hai.
 */
export const MENU_THEO_VAI: Record<
  Role,
  { to: string; label: string; icon: typeof UserRound }[]
> = {
  STUDENT: [
    { to: '/ho-so', label: 'Hồ sơ của tôi', icon: UserRound },
    { to: '/lich-ranh', label: 'Lịch rảnh', icon: CalendarDays },
  ],
  EMPLOYER: [
    { to: '/ntd/ho-so', label: 'Hồ sơ doanh nghiệp', icon: UserRound },
    { to: '/ntd/quan-ly', label: 'Tin đăng của tôi', icon: LayoutDashboard },
  ],
  ADMIN: [{ to: '/admin', label: 'Khu quản trị', icon: ShieldCheck }],
}
