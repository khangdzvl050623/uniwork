import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { AuthTokens, AuthUser, SignupRole } from '@uniwork/shared'
import { apiFetch } from '@/lib/api'
import {
  clearSession,
  getAuthState,
  setSession,
  subscribeAuth,
  updateUser,
  type AuthState,
} from '@/lib/auth-store'

/**
 * Đọc phiên đăng nhập trong component.
 *
 * Dùng `useSyncExternalStore` thay vì bọc store bằng Context: store này là một
 * biến module, sống ngoài React và bị `apiFetch` sửa ở giữa một lời gọi mạng
 * (lúc tự refresh). `useSyncExternalStore` sinh ra đúng cho tình huống đó —
 * nó đảm bảo mọi component đọc cùng một giá trị trong cùng một lần render,
 * kể cả khi store đổi giữa chừng.
 */
export function useAuth(): AuthState & { daDangNhap: boolean } {
  const state = useSyncExternalStore(subscribeAuth, getAuthState, getAuthState)
  return { ...state, daDangNhap: state.status === 'da-dang-nhap' }
}

/* ------------------------------------------------------------ đăng nhập -- */

export interface LoginInput {
  email: string
  password: string
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<AuthTokens>(
        '/api/auth/dang-nhap',
        { method: 'POST', body: JSON.stringify(input) },
        // Sai mật khẩu cũng trả 401. Để cơ chế tự refresh chạy ở đây thì mỗi
        // lần gõ nhầm lại kéo theo một lời gọi refresh vô nghĩa.
        { khongTuRefresh: true },
      ),
    onSuccess: (data) => setSession(data.accessToken, data.user),
  })
}

/* -------------------------------------------------------------- đăng ký -- */

export interface RegisterInput {
  email: string
  password: string
  role: SignupRole
  /** Sinh viên: họ tên. Nhà tuyển dụng: tên công ty. */
  name: string
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch<AuthTokens>(
        '/api/auth/dang-ky',
        { method: 'POST', body: JSON.stringify(input) },
        { khongTuRefresh: true },
      ),
    onSuccess: (data) => setSession(data.accessToken, data.user),
  })
}

/* ------------------------------------------------------------ đăng xuất -- */

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(
        '/api/auth/dang-xuat',
        { method: 'POST' },
        { khongTuRefresh: true },
      ),

    /*
     * Dọn phiên kể cả khi lời gọi hỏng.
     *
     * Đăng xuất phải luôn thành công dưới góc nhìn người dùng. Mất mạng giữa
     * chừng mà vẫn để họ ở trạng thái đăng nhập là kiểu hỏng tệ nhất — nhất là
     * khi họ vừa bấm đăng xuất trên máy của người khác. Server có endpoint thu
     * hồi token riêng, còn ở đây ưu tiên xoá sạch phía máy này trước.
     */
    onSettled: () => {
      clearSession()
      // Cache còn giữ hồ sơ, danh sách việc đã lưu... của người vừa đăng xuất.
      // Không xoá thì người đăng nhập tiếp theo trên cùng máy sẽ thấy thoáng
      // qua dữ liệu của người trước.
      queryClient.clear()
    },
  })
}

/* ------------------------------------------------------------------ OTP -- */

/** Server trả `devCode` ngoài production để lập trình viên khỏi mở hộp thư. */
export function useSendOtp() {
  return useMutation({
    mutationFn: () => apiFetch<{ devCode?: string }>('/api/auth/gui-otp', { method: 'POST' }),
  })
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<AuthUser>('/api/auth/xac-thuc-email', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    // Chỉ cập nhật phần user, giữ nguyên token đang còn hạn.
    onSuccess: (user) => updateUser(user),
  })
}
