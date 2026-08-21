import { useCallback, useState } from 'react'
import type { z } from 'zod'
import { ApiClientError } from '@/lib/api'

/**
 * Trạng thái form + kiểm dữ liệu bằng chính schema Zod mà api dùng.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TỰ VIẾT THAY VÌ CÀI react-hook-form
 * ---------------------------------------------------------------------------
 * Toàn bộ form của dự án này đều là form phẳng dưới mười ô nhập, không có mảng
 * lồng nhau hay trường động. Phần react-hook-form giỏi nhất — tránh render lại
 * ở form hàng trăm ô — không có chỗ dùng, nên nó chỉ còn là một phụ thuộc nữa
 * phải học và phải nâng cấp.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CHỈ BÁO LỖI SAU LẦN GỬI ĐẦU TIÊN
 * ---------------------------------------------------------------------------
 * Kiểm ngay từ ký tự đầu tiên nghĩa là vừa gõ chữ "n" của "nguyen@..." đã bị
 * mắng "Email không đúng định dạng". Người dùng chưa làm gì sai — họ mới gõ
 * được một chữ.
 *
 * Nên: im lặng cho tới lần bấm Gửi đầu tiên. Từ đó trở đi mới kiểm theo từng
 * phím gõ, vì lúc này lỗi đang hiện trên màn hình và người dùng cần thấy nó
 * biến mất ngay khi họ sửa đúng — chứ không phải đợi bấm Gửi lần nữa mới biết.
 */

/**
 * Lỗi theo từng trường, cộng thêm khoá `_` cho lỗi của cả form.
 *
 * Viết dạng mapped type giao với `{ _?: string }` chứ không phải
 * `Partial<Record<keyof T | '_', string>>`: với `T` còn là tham số kiểu chung
 * chung, TypeScript không chứng minh được `{ _: '...' }` hợp lệ và sẽ từ chối
 * ngay ở chỗ gán.
 */
export type FieldErrors<T> = { [K in keyof T]?: string } & { _?: string }

/**
 * Bảng lỗi lúc đang dựng, trước khi gán kiểu hẹp.
 *
 * TypeScript không cho ghi vào `obj[key]` khi `key` có kiểu `keyof T` với `T`
 * còn là tham số chung — nó không chứng minh được giá trị hợp với ô đó. Dựng ở
 * dạng lỏng rồi ép kiểu đúng một lần lúc trả về là cách gọn nhất; phép ép đó
 * an toàn vì mọi giá trị trong bảng đều là `string`.
 */
type BangLoi = Record<string, string | undefined>

/** Zod trả mọi lỗi của một trường; giao diện chỉ hiện lỗi đầu tiên. */
function bocLoi<T>(error: z.ZodError): FieldErrors<T> {
  const result: BangLoi = {}

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    // Ba dòng lỗi chồng nhau dưới một ô nhập là nhiễu, không phải thông tin.
    // Người dùng sửa lỗi đầu rồi lỗi sau sẽ tự hiện ra nếu còn.
    result[key] ??= issue.message
  }

  return result as FieldErrors<T>
}

export interface UseZodFormResult<TValues> {
  values: TValues
  errors: FieldErrors<TValues>
  setValue: <K extends keyof TValues>(key: K, value: TValues[K]) => void
  /** Kiểm toàn bộ; trả dữ liệu đã chuẩn hoá nếu hợp lệ, `null` nếu không. */
  validate: () => unknown | null
  /** Gắn lỗi từ server (`details`) vào đúng ô nhập. */
  applyServerError: (error: unknown) => void
  reset: () => void
}

export function useZodForm<TValues extends Record<string, unknown>>(
  schema: z.ZodType,
  initialValues: TValues,
): UseZodFormResult<TValues> {
  const [values, setValues] = useState<TValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors<TValues>>({})
  const [daGuiMotLan, setDaGuiMotLan] = useState(false)

  const setValue = useCallback(
    <K extends keyof TValues>(key: K, value: TValues[K]) => {
      setValues((truoc) => {
        const sau = { ...truoc, [key]: value }

        if (daGuiMotLan) {
          const ketQua = schema.safeParse(sau)
          setErrors(ketQua.success ? {} : bocLoi<TValues>(ketQua.error))
        } else {
          // Chưa gửi lần nào thì chưa hiện lỗi, nhưng vẫn phải xoá lỗi server
          // còn sót của chính ô đang gõ — nếu không, người dùng sửa email bị
          // trùng mà dòng "Email này đã được đăng ký" vẫn nằm y nguyên.
          setErrors((cu) => (cu[key] || cu._ ? { ...cu, [key]: undefined, _: undefined } : cu))
        }

        return sau
      })
    },
    [schema, daGuiMotLan],
  )

  const validate = useCallback(() => {
    setDaGuiMotLan(true)

    const ketQua = schema.safeParse(values)
    if (ketQua.success) {
      setErrors({})
      return ketQua.data
    }

    setErrors(bocLoi<TValues>(ketQua.error))
    return null
  }, [schema, values])

  /**
   * Đưa lỗi của server về đúng ô nhập.
   *
   * Api trả `details: { email: ['...'] }` chính là để dùng ở đây. Lỗi không gắn
   * được vào ô nào (email trùng, sai mật khẩu) rơi vào khoá `_` và hiện ở đầu
   * form — vẫn tốt hơn nhiều so với một hộp thoại alert.
   */
  const applyServerError = useCallback((error: unknown) => {
    if (!(error instanceof ApiClientError)) {
      setErrors({ _: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' })
      return
    }

    if (error.details) {
      const tuServer: BangLoi = {}
      for (const [key, messages] of Object.entries(error.details)) {
        if (messages[0]) tuServer[key] = messages[0]
      }
      setErrors(tuServer as FieldErrors<TValues>)
      return
    }

    setErrors({ _: error.message })
  }, [])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setDaGuiMotLan(false)
    // initialValues là object dựng tại chỗ ở hầu hết chỗ gọi, nên đưa vào deps
    // sẽ tạo hàm mới ở mỗi lần render. Giá trị ban đầu không đổi trong vòng đời
    // form nên bỏ qua là an toàn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { values, errors, setValue, validate, applyServerError, reset }
}
