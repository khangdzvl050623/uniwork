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

/** Một mục trên thanh điều hướng chính của header. */
export interface MucNav {
  to: string
  label: string
  /** Mũi tên xuống ngụ ý có menu con. Chỉ nav của khách mới dùng, xem dưới. */
  caret?: boolean
}

/**
 * Thanh điều hướng chính, theo từng vai trò.
 *
 * Trước đây là MỘT mảng cứng dùng chung cho tất cả mọi người. Hệ quả là nhà
 * tuyển dụng đăng nhập vào vẫn thấy "Lịch rảnh" và "Hồ sơ & CV" — hai mục chỉ
 * sinh viên mới vào được, bấm vào thì `RequireRole` đá về trang chủ. Người dùng
 * không hiểu vì sao mình bị đuổi khỏi một mục nằm ngay trên thanh menu của
 * chính mình.
 *
 * Tách theo vai nên mỗi người chỉ thấy đường mình thật sự đi được.
 */
export const NAV_THEO_VAI: Record<Role, MucNav[]> = {
  STUDENT: [
    { to: '/viec-lam', label: 'Việc làm' },
    { to: '/lich-ranh', label: 'Lịch rảnh' },
    // Đã đăng nhập thì "Hồ sơ & CV" phải dẫn tới hồ sơ thật. Nav của khách trỏ
    // mục này về /dang-ky là có chủ đích (mời đăng ký), nhưng giữ nguyên cho
    // người đã có tài khoản thì thành gửi họ về lại trang đăng ký.
    { to: '/ho-so', label: 'Hồ sơ & CV' },
  ],
  EMPLOYER: [
    { to: '/viec-lam', label: 'Việc làm' },
    { to: '/ntd/quan-ly', label: 'Tin đăng của tôi' },
    { to: '/ntd/ung-vien', label: 'Ứng viên' },
  ],
  ADMIN: [
    { to: '/viec-lam', label: 'Việc làm' },
    { to: '/admin', label: 'Khu quản trị' },
  ],
}

/**
 * Nav cho người CHƯA đăng nhập.
 *
 * Cố ý giữ nguyên như cũ: đây là nav tiếp thị, các mục dẫn tới trang cần đăng
 * nhập là để người xem thấy hệ thống có gì rồi mời họ đăng ký, không phải lỗi.
 *
 * Cũng dùng luôn trong lúc còn đang kiểm tra phiên (chưa biết là ai) — đúng
 * bằng hành vi trước đây, nên không thêm nhấp nháy nào so với hiện tại.
 */
export const NAV_KHACH: MucNav[] = [
  { to: '/viec-lam', label: 'Việc làm', caret: true },
  { to: '/lich-ranh', label: 'Lịch rảnh' },
  { to: '/dang-ky', label: 'Hồ sơ & CV', caret: true },
  { to: '/ntd/ung-vien', label: 'Nhà tuyển dụng', caret: true },
]
