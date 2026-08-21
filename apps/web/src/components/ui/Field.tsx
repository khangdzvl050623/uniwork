import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: ReactNode
}

/**
 * Ô nhập kèm nhãn, gợi ý và thông báo lỗi.
 *
 * Vài chi tiết ở đây không ai để ý nhưng thiếu thì thấy ngay:
 *
 * - `useId` nối nhãn với ô nhập. Nhờ vậy bấm vào chữ "Mật khẩu" là con trỏ nhảy
 *   vào ô — hành vi mặc định của web mà form dựng ẩu hay làm mất.
 * - `aria-invalid` và `aria-describedby` để trình đọc màn hình đọc luôn lý do
 *   sai, thay vì chỉ đọc tên ô rồi im lặng.
 * - `autoComplete` truyền từ ngoài vào, và chỗ gọi PHẢI khai đúng. Sai giá trị
 *   này thì trình quản lý mật khẩu không điền được, hoặc tệ hơn là lưu nhầm mật
 *   khẩu mới đè lên mật khẩu cũ.
 */
export function Field({ label, error, hint, className, type = 'text', ...props }: FieldProps) {
  const id = useId()
  const errorId = `${id}-loi`
  const hintId = `${id}-goi-y`

  // Ô mật khẩu có nút hiện/ẩn. Gõ mật khẩu dài trên điện thoại mà không xem lại
  // được là nguồn gốc của phần lớn lần "sai mật khẩu" ở màn đăng ký.
  const laMatKhau = type === 'password'
  const [hienMatKhau, setHienMatKhau] = useState(false)
  const inputType = laMatKhau && hienMatKhau ? 'text' : type

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input
          {...props}
          id={id}
          type={inputType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none',
            'placeholder:text-slate-400',
            // Chỉ làm mượt màu viền, không dùng transition-all — nếu không thì
            // chiều cao ô cũng bị làm mượt mỗi khi dòng lỗi bên dưới xuất hiện.
            'transition-[border-color,box-shadow] duration-150 ease-out',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            laMatKhau && 'pr-11',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-200',
          )}
        />

        {laMatKhau && (
          <button
            type="button"
            onClick={() => setHienMatKhau((v) => !v)}
            // tabIndex -1: bấm Tab từ ô mật khẩu phải nhảy thẳng tới nút Gửi,
            // không dừng ở đây. Người dùng bàn phím không cần ghé qua nút này.
            tabIndex={-1}
            aria-label={hienMatKhau ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-slate-400 transition-colors hover:text-slate-600"
          >
            {hienMatKhau ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error ? (
        <p
          id={errorId}
          // role="alert" để trình đọc màn hình thông báo ngay khi lỗi hiện ra,
          // không đợi người dùng tự di chuyển tới đó.
          role="alert"
          className="animate-in fade-in slide-in-from-top-1 mt-1.5 text-xs text-red-600 duration-150"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
