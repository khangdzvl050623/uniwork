import type { AuthUser } from '@uniwork/shared'

/**
 * Nơi giữ phiên đăng nhập phía web (T44).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO ACCESS TOKEN NẰM TRONG BỘ NHỚ, KHÔNG PHẢI localStorage
 * ---------------------------------------------------------------------------
 * localStorage đọc được bằng JavaScript. Chỉ cần MỘT đoạn script lạ chạy được
 * trên trang — một thư viện npm bị nhiễm, một đoạn quảng cáo, một lỗ XSS — là
 * nó đọc sạch token và gửi đi nơi khác. Token trong biến module thì đoạn script
 * đó phải chạy đúng lúc trang đang mở và phải với được vào scope của module,
 * khó hơn hẳn.
 *
 * Đánh đổi: tải lại trang là mất token. Nhưng KHÔNG mất phiên đăng nhập — vì
 * refresh token nằm trong cookie httpOnly mà JavaScript không đọc được, nên
 * lúc web khởi động ta gọi /api/auth/refresh một lần để lấy access token mới.
 * Người dùng không thấy gì cả, còn kẻ trộm script thì không lấy được gì.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CÓ TRẠNG THÁI 'dang-kiem-tra'
 * ---------------------------------------------------------------------------
 * Ngay sau khi tải lại trang, ta CHƯA BIẾT người dùng còn đăng nhập hay không
 * — phải đợi lời gọi refresh trả lời. Nếu chỉ có hai trạng thái (có token /
 * không có token) thì trong khoảnh khắc đó mọi route được bảo vệ sẽ thấy
 * "không có token" và đá người dùng về trang đăng nhập, dù họ đang đăng nhập
 * hoàn toàn bình thường. Đây là lỗi kinh điển của các ứng dụng React có xác
 * thực, và trạng thái thứ ba này chính là thứ ngăn nó.
 */

export type AuthStatus = 'dang-kiem-tra' | 'da-dang-nhap' | 'chua-dang-nhap'

export interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: AuthUser | null
}

const TRANG_THAI_BAN_DAU: AuthState = {
  status: 'dang-kiem-tra',
  accessToken: null,
  user: null,
}

/*
 * Giữ nguyên tham chiếu cho tới khi có thay đổi thật.
 *
 * `useSyncExternalStore` so sánh snapshot bằng `Object.is`. Nếu mỗi lần gọi
 * `getState()` lại dựng một object mới thì React thấy "khác" ở mọi lần render
 * và rơi vào vòng lặp render vô tận. Nên state chỉ được THAY THẾ khi thật sự
 * đổi, không bao giờ sửa tại chỗ.
 */
let state: AuthState = TRANG_THAI_BAN_DAU

const listeners = new Set<() => void>()

function setState(next: AuthState) {
  state = next
  for (const listener of listeners) listener()
}

export function getAuthState(): AuthState {
  return state
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Ghi phiên mới sau khi đăng nhập, đăng ký, hoặc refresh thành công. */
export function setSession(accessToken: string, user: AuthUser) {
  setState({ status: 'da-dang-nhap', accessToken, user })
}

/**
 * Cập nhật thông tin người dùng mà KHÔNG đụng tới token.
 *
 * Dùng sau khi xác thực email hoặc sửa hồ sơ: `emailVerifiedAt` và
 * `displayName` đổi, nhưng token hiện tại vẫn còn hạn và vẫn hợp lệ. Cấp token
 * mới ở đây là thừa, và còn làm mất thời điểm hết hạn đang đếm dở.
 */
export function updateUser(user: AuthUser) {
  if (state.status !== 'da-dang-nhap') return
  setState({ ...state, user })
}

/** Xoá phiên: đăng xuất, hoặc refresh thất bại. */
export function clearSession() {
  setState({ status: 'chua-dang-nhap', accessToken: null, user: null })
}

/** Token để `apiFetch` gắn vào header Authorization. */
export function getAccessToken(): string | null {
  return state.accessToken
}

/**
 * Chỉ dùng trong test — trả store về đúng trạng thái lúc mới nạp trang.
 *
 * Store là biến ở phạm vi module nên nó SỐNG XUYÊN QUA các ca test trong cùng
 * một file. Không dọn thì ca sau thừa hưởng phiên đăng nhập của ca trước và
 * đỏ/xanh theo thứ tự chạy — loại lỗi tốn cả buổi để lần ra.
 */
export function resetAuthStore() {
  setState(TRANG_THAI_BAN_DAU)
}
