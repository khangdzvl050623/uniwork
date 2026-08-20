import { useCallback, useEffect, useState } from 'react'

export type DashTheme = 'dark' | 'light'

const STORAGE_KEY = 'uniwork:dash-theme'

/**
 * Chế độ sáng/tối cho riêng khu quản trị.
 *
 * Cố ý KHÔNG dùng chung với trang công khai. Trang công khai chỉ có một chế độ
 * sáng và không có nút đổi; gộp hai thứ vào một biến thì đổi chế độ ở admin sẽ
 * kéo theo trang chủ đổi màu, trong khi trang chủ không hề dựng cho chế độ tối.
 *
 * Đọc lựa chọn đã lưu trước, nếu chưa có thì theo cài đặt hệ điều hành. Thứ tự
 * này quan trọng: người đã tự chọn sáng thì không nên bị hệ điều hành ghi đè,
 * còn người chưa chọn gì thì đoán theo hệ điều hành vẫn hơn là đoán bừa.
 *
 * Trạng thái khởi tạo tính ngay trong hàm khởi tạo của useState chứ không đặt
 * trong useEffect. Đặt trong useEffect thì khung đầu tiên luôn vẽ ra chế độ mặc
 * định rồi khung sau mới nhảy sang chế độ đúng — người dùng chọn nền sáng sẽ
 * thấy một nháy đen mỗi lần mở trang.
 */
function readInitial(): DashTheme {
  if (typeof window === 'undefined') return 'dark'

  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useDashTheme() {
  const [theme, setTheme] = useState<DashTheme>(readInitial)

  useEffect(() => {
    // localStorage ném lỗi khi trình duyệt chặn lưu trữ (chế độ riêng tư khoá
    // chặt, hoặc trang nằm trong iframe khác nguồn). Không lưu được thì cũng
    // không nên làm sập cả trang quản trị chỉ vì một tuỳ chọn giao diện.
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* bỏ qua */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
