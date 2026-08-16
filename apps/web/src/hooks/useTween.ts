import { useEffect, useRef, useState } from 'react'

/**
 * Chạy một số — hoặc một mảng số — từ giá trị ĐANG hiển thị tới giá trị mới.
 *
 * Đây là điểm khác quan trọng so với component CountUp dùng ở trang công khai.
 * CountUp luôn đếm từ 0, vì ở đó số chỉ hiện đúng một lần khi cuộn tới. Trong
 * dashboard thì khác: người dùng đổi bộ lọc 7 ngày / 30 ngày liên tục, và mỗi
 * lần đổi mà số tụt về 0 rồi bò lên lại thì vừa chậm vừa nhìn như lỗi. Hook này
 * xuất phát từ giá trị hiện tại nên đổi bộ lọc chỉ là một bước nhích ngắn.
 *
 * Vì sao dùng requestAnimationFrame thay vì transition của CSS: giá trị này là
 * SỐ mà React phải vẽ ra thành chữ và thành toạ độ đường biểu đồ, chứ không phải
 * một thuộc tính CSS trình duyệt tự nội suy được. Thuộc tính `d` của <path> thì
 * Firefox chưa nội suy được, nên nội suy trong JS là cách duy nhất chạy đúng
 * trên mọi trình duyệt. Đổi lại, nó chạy trên luồng chính — chấp nhận được vì
 * mỗi lần chỉ nội suy vài chục con số.
 */

/** easeOutCubic: bốc nhanh rồi hãm dần về đích, không vọt quá. */
function ease(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useTween(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target
      setValue(target)
      return
    }

    const from = current.current
    let start = 0
    let frame = 0

    const step = (now: number) => {
      if (!start) start = now
      const progress = Math.min((now - start) / duration, 1)
      const next = from + (target - from) * ease(progress)
      current.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

/**
 * Lấy mẫu lại một mảng cho đủ `n` phần tử, nội suy tuyến tính giữa các điểm.
 *
 * Cần hàm này vì đổi bộ lọc từ 7 ngày sang 30 ngày là đổi luôn SỐ LƯỢNG điểm.
 * Không có nó thì hai mảng dài ngắn khác nhau không ghép cặp được để nội suy, và
 * biểu đồ buộc phải nhảy cứng sang hình mới. Kéo giãn mảng cũ cho bằng độ dài
 * mảng mới trước rồi mới nội suy thì đường biểu đồ biến hình mượt.
 */
function resample(source: number[], n: number): number[] {
  if (source.length === n) return source
  if (source.length === 0) return new Array(n).fill(0)
  if (source.length === 1) return new Array(n).fill(source[0])

  return Array.from({ length: n }, (_, i) => {
    const t = (i / Math.max(n - 1, 1)) * (source.length - 1)
    const lo = Math.floor(t)
    const hi = Math.min(lo + 1, source.length - 1)
    return source[lo] + (source[hi] - source[lo]) * (t - lo)
  })
}

/**
 * Như useTweenArray nhưng cho NHIỀU chuỗi cùng lúc, mỗi chuỗi một hàng.
 *
 * Cần bản này vì biểu đồ đường có hai chuỗi và cả hai phải biến hình cùng nhịp.
 * Hai cách làm khác đều hỏng:
 *
 * - Gọi useTweenArray trong vòng lặp qua từng chuỗi: React đòi số lần gọi hook
 *   phải cố định giữa các lần render, nên chỉ cần thêm bớt một chuỗi là vỡ.
 * - Nối hết các chuỗi thành một mảng dài rồi tween: lúc đổi bộ lọc, hàm lấy mẫu
 *   lại sẽ nội suy vắt qua chỗ nối giữa hai chuỗi, khiến đuôi chuỗi này kéo theo
 *   đầu chuỗi kia — đường biểu đồ giật một nhịp lạ ngay giữa quá trình biến hình.
 *
 * Lấy mẫu lại từng hàng riêng biệt thì không có chỗ nối nào để mà vắt qua.
 */
export function useTweenMatrix(target: number[][], duration = 800) {
  const [value, setValue] = useState<number[][]>(() => target.map((row) => row.map(() => 0)))
  const current = useRef<number[][]>(target.map((row) => row.map(() => 0)))

  const key = target.map((row) => row.join(',')).join('|')

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target
      setValue(target)
      return
    }

    const from = target.map((row, r) => resample(current.current[r] ?? [], row.length))
    let start = 0
    let frame = 0

    const step = (now: number) => {
      if (!start) start = now
      const progress = Math.min((now - start) / duration, 1)
      const eased = ease(progress)
      const next = target.map((row, r) =>
        row.map((to, i) => from[r][i] + (to - from[r][i]) * eased),
      )
      current.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration])

  return value
}

export function useTweenArray(target: number[], duration = 800) {
  const [value, setValue] = useState<number[]>(() => new Array(target.length).fill(0))
  const current = useRef<number[]>(new Array(target.length).fill(0))

  // Ký tự hoá mảng để so sánh theo GIÁ TRỊ trong danh sách phụ thuộc. Truyền
  // thẳng mảng vào thì mỗi lần render cha là một mảng mới, effect chạy lại vô
  // hạn dù số liệu không đổi.
  const key = target.join(',')

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target
      setValue(target)
      return
    }

    const from = resample(current.current, target.length)
    let start = 0
    let frame = 0

    const step = (now: number) => {
      if (!start) start = now
      const progress = Math.min((now - start) / duration, 1)
      const eased = ease(progress)
      const next = target.map((to, i) => from[i] + (to - from[i]) * eased)
      current.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration])

  return value
}
