import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@uniwork/shared'
import { useAuth } from '@/hooks/useAuth'

/**
 * Hai lớp canh cửa phía web, song song với `requireAuth`/`requireRole` phía api
 * (T48).
 *
 * ---------------------------------------------------------------------------
 * ĐÂY KHÔNG PHẢI LỚP BẢO MẬT
 * ---------------------------------------------------------------------------
 * Mọi thứ chạy trong trình duyệt đều sửa được. Ai mở DevTools cũng có thể ép
 * component này cho qua. Nó chỉ để người dùng không bấm vào một trang rồi nhận
 * về màn hình lỗi trống trơn.
 *
 * Lớp bảo mật thật nằm ở api: middleware `requireAuth`/`requireRole` chặn ở
 * server, nơi người dùng không với tới được. Bỏ lớp này thì giao diện xấu; bỏ
 * lớp kia thì dữ liệu bị lộ.
 */

function DangKiemTra() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-brand-600" />
      <span className="sr-only">Đang kiểm tra phiên đăng nhập</span>
    </div>
  )
}

/**
 * Chặn route với người chưa đăng nhập, và nhớ đường quay lại.
 *
 * `state.from` là thứ làm nên trải nghiệm đúng: người dùng bấm vào link
 * /ho-so từ email, bị đá về /dang-nhap, đăng nhập xong quay lại ĐÚNG /ho-so
 * chứ không phải trang chủ. Thiếu nó thì họ phải tự mò lại chỗ mình định tới.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  // Chưa biết còn phiên hay không thì CHỜ, tuyệt đối không chuyển hướng.
  //
  // Đây là khoảnh khắc ngay sau khi tải lại trang, lúc lời gọi khôi phục phiên
  // chưa trả lời. Đá người dùng đi lúc này nghĩa là cứ nhấn F5 là bị đăng xuất
  // — xem giải thích đầy đủ trong lib/auth-store.ts.
  if (status === 'dang-kiem-tra') return <DangKiemTra />

  if (status === 'chua-dang-nhap') {
    // `replace` để trang bị chặn không nằm lại trong lịch sử. Không có nó thì
    // bấm nút Back sau khi đăng nhập sẽ quay về đúng trang vừa bị chặn và bị
    // chặn lần nữa — người dùng kẹt trong vòng lặp.
    return <Navigate to="/dang-nhap" replace state={{ from: location }} />
  }

  return <Outlet />
}

/**
 * Chặn route theo vai trò. Luôn đặt BÊN TRONG `<RequireAuth>`.
 *
 * Tách khỏi RequireAuth chứ không gộp, cùng lý do như phía api: phần lớn route
 * chỉ cần "đã đăng nhập", gộp lại thì route nào cũng phải liệt kê đủ mọi vai.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { status, user } = useAuth()

  if (status === 'dang-kiem-tra') return <DangKiemTra />
  if (status === 'chua-dang-nhap' || !user) return <Navigate to="/dang-nhap" replace />

  /*
   * Sai vai thì đưa về trang chủ, KHÔNG đưa về trang đăng nhập.
   *
   * Họ đã đăng nhập rồi — hiện form đăng nhập nữa chỉ khiến người ta tưởng
   * phiên hỏng và loay hoay đăng nhập lại, trong khi vấn đề thật là tài khoản
   * này không có quyền vào đó. Sinh viên bấm nhầm link khu quản trị thì về
   * trang chủ là hợp lý nhất.
   */
  if (!roles.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
