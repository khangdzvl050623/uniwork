import type { ApiResponse } from '@uniwork/shared'

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

/**
 * Một cửa duy nhất để gọi API.
 *
 * Vì mọi endpoint đều trả về `{ ok: true, data }` hoặc `{ ok: false, error }`
 * (hợp đồng khai ở packages/shared), hàm này bóc sẵn phần vỏ: gọi xong là có
 * ngay `data` đúng kiểu, còn lỗi thì được ném ra dưới dạng ApiClientError.
 *
 * Nhờ vậy TanStack Query bắt lỗi đúng cơ chế `isError`, và không component nào
 * phải tự viết `if (!res.ok)` nữa.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    // Cần thiết để trình duyệt gửi kèm cookie refresh token ở Sprint 1.
    credentials: 'include',
  })

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
