import { useHealth } from '@/hooks/useHealth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

/**
 * Nút đăng nhập bằng Google.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO LÀ THẺ <a> CHỨ KHÔNG PHẢI <button> GỌI fetch
 * ---------------------------------------------------------------------------
 * Luồng OAuth bắt đầu bằng việc RỜI KHỎI trang này sang google.com. Gọi bằng
 * `fetch` thì trình duyệt đi lấy nội dung của google.com về dưới dạng dữ liệu —
 * và bị chặn ngay vì khác nguồn. Phải là một cú điều hướng thật của trình
 * duyệt, và thẻ `<a>` chính là cách nói điều đó.
 *
 * Kèm theo: người dùng bấm giữ Ctrl hay chuột giữa vẫn mở được tab mới, đúng
 * như mọi liên kết khác trên web — thứ mà `<button>` phải viết thêm code mới có.
 *
 * Nút chỉ hiện khi máy chủ báo đã cấu hình Google. Hiện một nút bấm vào là lỗi
 * thì tệ hơn hẳn so với không hiện.
 */
export function GoogleButton({ label = 'Đăng nhập bằng Google' }: { label?: string }) {
  const { data } = useHealth()

  if (!data?.googleSanSang) return null

  return (
    <>
      <a
        href={`${BASE_URL}/api/auth/google`}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]"
      >
        {/* Logo Google vẽ thẳng bằng SVG thay vì tải ảnh: bốn đường path này
            nhẹ hơn mọi file ảnh, và không nhấp nháy lúc trang mới mở. */}
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        {label}
      </a>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">hoặc</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </>
  )
}
