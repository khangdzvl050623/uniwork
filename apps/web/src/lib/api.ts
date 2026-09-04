import type { ApiResponse, AuthTokens } from '@uniwork/shared'
import { clearSession, getAccessToken, getAuthState, setSession } from './auth-store'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

/**
 * Lỗi API đã được bóc tách, để chỗ gọi bắt bằng `instanceof` thay vì đoán
 * hình dạng của object lỗi.
 */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export interface ApiFetchOptions {
  /**
   * Tắt cơ chế tự refresh khi gặp 401.
   *
   * Bắt buộc bật cho chính các endpoint xác thực. `/dang-nhap` trả 401 khi sai
   * mật khẩu — đó là câu trả lời đúng, không phải phiên hết hạn. Đem nó đi
   * refresh vừa vô nghĩa vừa nguy hiểm: nếu người dùng đang đăng nhập bằng tài
   * khoản A mà gõ sai mật khẩu tài khoản B, refresh thất bại sẽ xoá luôn phiên
   * A đang dùng tốt.
   */
  khongTuRefresh?: boolean
}

/* -------------------------------------------------------- refresh token -- */

/**
 * Lời gọi refresh đang chạy dở, nếu có.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO PHẢI GOM VỀ MỘT LỜI GỌI ("single-flight")
 * ---------------------------------------------------------------------------
 * Một trang hồ sơ thường bắn 3–4 request cùng lúc. Access token hết hạn thì cả
 * 3–4 cùng nhận 401 trong vòng vài mili giây. Không gom lại thì mỗi cái tự gọi
 * refresh một lần.
 *
 * Điều đó không chỉ tốn request — nó LÀM HỎNG PHIÊN ĐĂNG NHẬP. Server xoay
 * vòng refresh token: lần refresh đầu thu hồi token cũ và cấp token mới. Ba
 * lời gọi sau vẫn đang cầm token cũ đã bị thu hồi, và server coi "token đã thu
 * hồi bị đem ra dùng" là dấu hiệu bị đánh cắp — nó huỷ TOÀN BỘ phiên của tài
 * khoản đó (xem auth.service.ts phía api). Kết quả: người dùng bị đăng xuất
 * khỏi mọi thiết bị chỉ vì mở một trang có nhiều request.
 *
 * Giữ đúng một promise dùng chung là cách chặn chuyện đó: ai tới sau thì chờ
 * kết quả của người đi trước, không tự gọi thêm.
 */
let refreshDangChay: Promise<string | null> | null = null

async function goiRefresh(): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    // Cookie chứa refresh token là httpOnly — JavaScript không đọc được nó,
    // chỉ có thể yêu cầu trình duyệt gửi kèm.
    credentials: 'include',
  })

  if (!response.ok) return null

  const body = (await response.json().catch(() => null)) as ApiResponse<AuthTokens> | null
  if (!body?.ok) return null

  setSession(body.data.accessToken, body.data.user)
  return body.data.accessToken
}

/** Bọc `goiRefresh` để nhiều lời gọi cùng lúc dùng chung một kết quả. */
function refreshMotLan(): Promise<string | null> {
  refreshDangChay ??= goiRefresh().finally(() => {
    // Dọn ngay khi xong, để lần hết hạn SAU còn gọi refresh mới được. Quên
    // dòng này thì phiên chỉ gia hạn được đúng một lần rồi thôi.
    refreshDangChay = null
  })

  return refreshDangChay
}

/**
 * Khôi phục phiên lúc web vừa mở (T44).
 *
 * Access token nằm trong bộ nhớ nên tải lại trang là mất. Cookie refresh thì
 * còn, nên gọi đúng một lần ở đây để đổi lấy access token mới. Đây là lý do
 * người dùng đóng tab rồi mở lại vẫn thấy mình đang đăng nhập.
 *
 * Luôn kết thúc bằng một trạng thái xác định — `da-dang-nhap` hoặc
 * `chua-dang-nhap` — để route guard thôi chờ và biết đường quyết định.
 */
export async function khoiPhucPhien(): Promise<void> {
  const token = await refreshMotLan()
  if (!token) clearSession()
}

/* ---------------------------------------------------------------- fetch -- */

async function goiMotLan(path: string, init: RequestInit | undefined, token: string | null) {
  const headers = new Headers(init?.headers)

  // Chỉ đặt Content-Type khi thân request là JSON. Với FormData (tải CV, nộp
  // giấy tờ) thì PHẢI để trình duyệt tự đặt: nó cần chèn thêm chuỗi `boundary`
  // ngăn cách các phần, mà chuỗi đó chỉ trình duyệt mới biết. Ghi đè bằng tay
  // là server nhận được một multipart không cách nào bóc ra được.
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    // Cần thiết để trình duyệt gửi kèm cookie refresh token.
    credentials: 'include',
  })
}

/**
 * Một cửa duy nhất để gọi API.
 *
 * Vì mọi endpoint đều trả về `{ ok: true, data }` hoặc `{ ok: false, error }`
 * (hợp đồng khai ở packages/shared), hàm này bóc sẵn phần vỏ: gọi xong là có
 * ngay `data` đúng kiểu, còn lỗi thì được ném ra dưới dạng ApiClientError.
 *
 * Nó cũng tự gắn access token và tự gia hạn phiên khi gặp 401 (T45), nên
 * không component nào phải biết token là gì hay hết hạn lúc nào.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options?: ApiFetchOptions,
): Promise<T> {
  let response = await goiMotLan(path, init, getAccessToken())

  /*
   * Gặp 401 thì thử gia hạn phiên đúng MỘT lần rồi gọi lại.
   *
   * Điều kiện `status === 'da-dang-nhap'` quan trọng: nó phân biệt "phiên hết
   * hạn" với "vốn dĩ chưa đăng nhập". Người chưa đăng nhập mà gọi trúng
   * endpoint cần quyền thì cứ để lỗi 401 nổi lên — không có gì để gia hạn, và
   * gọi refresh chỉ tổ tốn thêm một vòng mạng cho mỗi lần.
   */
  if (response.status === 401 && !options?.khongTuRefresh) {
    if (getAuthState().status === 'da-dang-nhap') {
      const tokenMoi = await refreshMotLan()

      if (tokenMoi) {
        response = await goiMotLan(path, init, tokenMoi)
      } else {
        // Refresh hỏng nghĩa là phiên hết thật. Xoá store để giao diện chuyển
        // ngay sang trạng thái chưa đăng nhập, thay vì hiện nút "Đăng xuất"
        // cho một phiên đã chết.
        clearSession()
      }
    }
  }

  // Server có thể trả về HTML khi sập hẳn hoặc khi proxy chen vào giữa —
  // lúc đó response.json() sẽ ném lỗi parse khó hiểu. Bắt sớm ở đây.
  let body: ApiResponse<T>
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'Máy chủ trả về dữ liệu không đọc được',
      response.status,
    )
  }

  if (!body.ok) {
    throw new ApiClientError(
      body.error.code,
      body.error.message,
      response.status,
      body.error.details,
    )
  }

  return body.data
}

/** Chỉ dùng trong test — xoá lời gọi refresh đang treo giữa các ca test. */
export function resetRefreshState() {
  refreshDangChay = null
}
