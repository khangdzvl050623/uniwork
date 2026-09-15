import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { khoiPhucPhien } from '@/lib/api'

/**
 * Trang tiếp nhận sau khi Google chuyển hướng về.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CẦN MỘT TRANG RIÊNG, VÀ VÌ SAO NÓ TRỐNG
 * ---------------------------------------------------------------------------
 * Api cố ý KHÔNG nhét access token vào URL — URL lọt vào lịch sử duyệt web, log
 * proxy, và header `Referer` gửi sang mọi trang bấm tiếp theo. Thứ nó đặt là
 * cookie refresh httpOnly, thứ JavaScript không đọc được.
 *
 * Nên việc của trang này chỉ là: gọi /refresh một lần để đổi cookie đó lấy
 * access token, rồi đưa người dùng đi tiếp. Người dùng chỉ thấy thoáng qua một
 * vòng xoay chờ.
 *
 * Đây cũng chính xác là việc `khoiPhucPhien` làm mỗi lần tải lại trang — dùng
 * lại nguyên hàm đó thay vì viết một bản riêng.
 */
export function GoogleCallback() {
  const navigate = useNavigate()
  const { status, user } = useAuth()
  const daGoi = useRef(false)

  useEffect(() => {
    if (daGoi.current) return
    daGoi.current = true
    void khoiPhucPhien()
  }, [])

  useEffect(() => {
    if (status === 'dang-kiem-tra') return

    /*
     * Tới được trang này nghĩa là Google đã xác thực xong, api đã tạo phiên và
     * đặt cookie refresh — nếu hỏng trước đó thì api tự chuyển hướng kèm câu
     * báo lỗi của riêng nó, không đi qua đây.
     *
     * Nên `chua-dang-nhap` ở đúng chỗ này chỉ có MỘT nghĩa: cookie vừa đặt
     * không quay về được với lời gọi /refresh. Gần như luôn là do trình duyệt
     * chặn cookie bên thứ ba — web ở vercel.app còn api ở onrender.com, hai
     * site khác nhau, nên `SameSite=None` chỉ là xin phép chứ không phải được
     * phép. Đo thật 2026-09-15: InPrivate của Edge tái hiện 100%; Safari và
     * Brave chặn mặc định.
     *
     * Vì vậy câu báo lỗi phải nói ra lối thoát. "Vui lòng thử lại" là ngõ cụt:
     * nguyên nhân nằm ở thiết lập trình duyệt, nên bấm lại bao nhiêu lần cũng
     * hỏng y hệt.
     */
    if (status === 'chua-dang-nhap') {
      const loi =
        'Trình duyệt đang chặn cookie đăng nhập, thường gặp ở chế độ ẩn danh. ' +
        'Hãy dùng cửa sổ thường, hoặc đăng nhập bằng email và mật khẩu.'

      navigate('/dang-nhap?loi=' + encodeURIComponent(loi), { replace: true })
      return
    }

    /*
     * Tài khoản Google tạo mới luôn là sinh viên và chưa có hồ sơ gì.
     *
     * Đưa thẳng tới trang hồ sơ thay vì trang chủ: họ vừa tạo tài khoản xong,
     * và việc kế tiếp có ích nhất là điền hồ sơ. Người đã dùng lâu (hồ sơ có
     * trường/ngành rồi) thì về trang chủ.
     */
    const chuaDienHoSo = user?.role === 'STUDENT' && user.displayName === user.email
    navigate(chuaDienHoSo ? '/ho-so' : '/', { replace: true })
  }, [status, user, navigate])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-brand-600" />
      <p className="text-sm text-slate-500">Đang hoàn tất đăng nhập…</p>
    </div>
  )
}
