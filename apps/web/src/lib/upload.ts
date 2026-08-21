import type { ApiResponse } from '@uniwork/shared'
import { ApiClientError } from './api'
import { getAccessToken } from './auth-store'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

/**
 * Tải file lên kèm báo tiến độ (T59).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO DÙNG XMLHttpRequest CHỨ KHÔNG PHẢI fetch
 * ---------------------------------------------------------------------------
 * `fetch` không có cách nào theo dõi tiến độ TẢI LÊN. Nó có `response.body` để
 * đọc dần dữ liệu tải xuống, nhưng chiều ngược lại thì không — đề xuất
 * `ReadableStream` cho request body vẫn chưa chạy được trên trình duyệt phổ
 * thông tại thời điểm viết.
 *
 * `XMLHttpRequest` cũ hơn nhưng có `upload.onprogress`, và đó là thứ duy nhất
 * dựng được thanh tiến độ thật. Không có nó thì chỉ còn cách hiện vòng xoay
 * chờ vô định — với file 5MB trên mạng 3G là mười mấy giây không biết còn bao
 * lâu, và người dùng sẽ tưởng trang bị treo rồi bấm lại.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG TỰ REFRESH TOKEN Ở ĐÂY
 * ---------------------------------------------------------------------------
 * `apiFetch` gặp 401 thì gia hạn phiên rồi gọi lại. Làm vậy ở đây nghĩa là tải
 * lại toàn bộ file lần thứ hai — người dùng nhìn thanh tiến độ chạy tới 100%
 * rồi tụt về 0 mà không hiểu vì sao. Thay vào đó, phía gọi nên bảo đảm phiên
 * còn hạn trước khi bắt đầu (gọi một request nhẹ), còn 401 ở đây thì báo thẳng.
 */
export function uploadFile<T>(
  path: string,
  formData: FormData,
  onProgress?: (phanTram: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', `${BASE_URL}${path}`)
    // Gửi kèm cookie refresh token, tương đương `credentials: 'include'`.
    xhr.withCredentials = true

    const token = getAccessToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    // KHÔNG đặt Content-Type: trình duyệt phải tự đặt để chèn chuỗi `boundary`
    // ngăn cách các phần của multipart. Đặt tay là server không bóc ra được.

    xhr.upload.onprogress = (e) => {
      // `lengthComputable` false khi không biết tổng dung lượng — hiếm, nhưng
      // chia cho `e.total` lúc đó sẽ ra Infinity và thanh tiến độ nhảy loạn.
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      let body: ApiResponse<T>
      try {
        body = JSON.parse(xhr.responseText) as ApiResponse<T>
      } catch {
        reject(
          new ApiClientError('INTERNAL_ERROR', 'Máy chủ trả về dữ liệu không đọc được', xhr.status),
        )
        return
      }

      if (!body.ok) {
        reject(new ApiClientError(body.error.code, body.error.message, xhr.status, body.error.details))
        return
      }

      resolve(body.data)
    }

    xhr.onerror = () =>
      reject(new ApiClientError('INTERNAL_ERROR', 'Mất kết nối khi đang tải file lên', 0))

    xhr.onabort = () => reject(new ApiClientError('INTERNAL_ERROR', 'Đã huỷ tải lên', 0))

    xhr.send(formData)
  })
}
