import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Đếm ngược tính bằng giây, dùng cho nút "Gửi lại mã" (T47).
 *
 * Mốc kết thúc lưu bằng THỜI ĐIỂM tuyệt đối, không phải bằng cách trừ dần một
 * biến đếm. Lý do: trình duyệt bóp `setInterval` xuống còn mỗi phút một lần khi
 * tab chạy nền. Trừ dần thì người dùng chuyển sang tab khác 60 giây rồi quay
 * lại sẽ thấy đồng hồ mới nhích được vài giây — sai hẳn. So với `Date.now()`
 * thì tab nền hay không cũng ra cùng một con số.
 */
export function useCountdown() {
  const ketThucLuc = useRef<number>(0)
  const [conLai, setConLai] = useState(0)

  const batDau = useCallback((giay: number) => {
    ketThucLuc.current = Date.now() + giay * 1000
    setConLai(giay)
  }, [])

  useEffect(() => {
    if (conLai <= 0) return

    const id = setInterval(() => {
      const giay = Math.max(0, Math.ceil((ketThucLuc.current - Date.now()) / 1000))
      setConLai(giay)
      if (giay === 0) clearInterval(id)
    }, 250)

    // Nhịp 250ms chứ không phải 1000ms: với nhịp đúng 1 giây, con số hiển thị
    // lệch với thời gian thật tới gần một giây tuỳ lúc bắt đầu, và người dùng
    // thấy nó "nhảy cóc" bỏ qua một số.
    return () => clearInterval(id)
  }, [conLai])

  return { conLai, dangCho: conLai > 0, batDau }
}
