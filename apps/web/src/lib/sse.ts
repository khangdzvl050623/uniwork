import { getAccessToken, getAuthState } from './auth-store'
import { ApiClientError } from './api'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

/**
 * Đọc Server-Sent Events từ một endpoint POST.
 *
 * ===========================================================================
 * VÌ SAO KHÔNG DÙNG `EventSource` CÓ SẴN CỦA TRÌNH DUYỆT
 * ===========================================================================
 * `EventSource` chỉ gửi được GET, và **không đặt được header**. Mà endpoint
 * này cần cả hai: câu hỏi đi trong body, và `Authorization: Bearer` để xác
 * thực. Cách duy nhất là tự đọc `fetch` + `ReadableStream`.
 *
 * ===========================================================================
 * VÌ SAO KHÔNG DÙNG LẠI `apiFetch`
 * ===========================================================================
 * `apiFetch` kết thúc bằng `response.json()` — nó đợi toàn bộ thân response
 * rồi mới trả về. Với stream thì đó đúng là thứ phải tránh: người dùng chờ
 * 15–25 giây nhìn màn hình trắng thay vì thấy chữ chảy ra.
 *
 * Phần logic gia hạn phiên khi gặp 401 thì chép lại, vì nó cũng cần ở đây.
 */

export interface SuKienSSE {
  ten: string
  du: unknown
}

/**
 * Lỗi trước khi kênh mở — hình dạng giống `apiFetch` để chỗ gọi bắt chung một
 * kiểu. Sau khi kênh mở thì lỗi đi bằng sự kiện `loi`, không ném.
 */
async function bocLoi(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as {
    ok?: false
    error?: { code: string; message: string }
  } | null

  throw new ApiClientError(
    body?.error?.code ?? 'INTERNAL_ERROR',
    body?.error?.message ?? 'Máy chủ không phản hồi được',
    res.status,
  )
}

/**
 * Gửi một câu hỏi và nhận từng sự kiện qua callback.
 *
 * Ném `ApiClientError` cho lỗi TRƯỚC khi kênh mở (429 hết lượt, 409 đang bận,
 * 503 chưa cấu hình) — đó là lý do phía server kiểm hết rồi mới mở kênh.
 */
export async function moKenhSSE(
  path: string,
  than: unknown,
  nhan: (sk: SuKienSSE) => void,
  tinHieu?: AbortSignal,
): Promise<void> {
  const goi = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(than),
      credentials: 'include',
      signal: tinHieu,
    })

  let res = await goi(getAccessToken())

  /* Gặp 401 thì gia hạn một lần rồi gọi lại — cùng luật với `apiFetch`. */
  if (res.status === 401 && getAuthState().status === 'da-dang-nhap') {
    const { khoiPhucPhien } = await import('./api')
    await khoiPhucPhien()
    res = await goi(getAccessToken())
  }

  if (!res.ok) return bocLoi(res)
  if (!res.body) throw new ApiClientError('INTERNAL_ERROR', 'Không mở được kênh', 500)

  const doc = res.body.pipeThrough(new TextDecoderStream()).getReader()

  /*
   * Gói tin SSE ngăn cách nhau bằng hai dấu xuống dòng, nhưng một gói CÓ THỂ bị
   * cắt làm đôi giữa hai lần đọc — TCP không hứa hẹn gì về ranh giới. Nên phải
   * giữ phần dư lại và ghép với lần đọc sau.
   *
   * Bỏ bước này thì lỗi chỉ xuất hiện với câu trả lời dài, trên mạng chậm —
   * tức là đúng lúc không ai đang ngồi debug.
   */
  let du = ''

  for (;;) {
    const { done, value } = await doc.read()
    if (done) break

    du += value
    const goiTin = du.split('\n\n')
    du = goiTin.pop() ?? ''

    for (const g of goiTin) {
      const sk = bocGoiTin(g)
      if (sk) nhan(sk)
    }
  }
}

function bocGoiTin(goi: string): SuKienSSE | null {
  let ten = 'message'
  const dong: string[] = []

  for (const d of goi.split('\n')) {
    /* Dòng bắt đầu bằng dấu hai chấm là nhịp tim giữ kết nối — bỏ qua. */
    if (d.startsWith(':') || d === '') continue
    if (d.startsWith('event:')) ten = d.slice(6).trim()
    else if (d.startsWith('data:')) dong.push(d.slice(5).trim())
  }

  if (dong.length === 0) return null
  try {
    return { ten, du: JSON.parse(dong.join('\n')) }
  } catch {
    return null
  }
}
