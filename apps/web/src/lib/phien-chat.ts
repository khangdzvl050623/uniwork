/**
 * `clientSessionId` — khoá chống trùng khi mở hội thoại.
 *
 * ===========================================================================
 * SINH MỘT LẦN, CẤT VÀO localStorage
 * ===========================================================================
 * Server dùng nó làm khoá chống trùng (`@@unique([ownerUserId,
 * clientSessionId])`): bấm hai lần hay tải lại trang đều ra đúng một phiên.
 *
 * Sinh mới mỗi lần mở trang thì mỗi lần F5 là một hội thoại trắng, và khoá
 * chống trùng trên TIN NHẮN cũng mất tác dụng — nó gắn với `sessionId`, mà
 * `sessionId` đã khác nhau thì hai tin không còn đụng nhau nữa.
 *
 * Mỗi kênh một khoá riêng: trợ lý và hỗ trợ là hai `kind` khác nhau ở server,
 * dùng chung một `clientSessionId` thì lần tạo thứ hai nhận về phiên của kênh
 * kia — cùng `ownerUserId`, cùng `clientSessionId`, nên nó trả hàng đã có mà
 * không hề kiểm `kind`.
 */

const TIEN_TO = 'uniwork:chat:'

export type KenhChat = 'tro-ly' | 'ho-tro'

function sinh(): string {
  return `cs-${crypto.randomUUID()}`
}

export function layClientSessionId(kenh: KenhChat): string {
  const khoa = TIEN_TO + kenh
  try {
    const cu = localStorage.getItem(khoa)
    if (cu) return cu
    const moi = sinh()
    localStorage.setItem(khoa, moi)
    return moi
  } catch {
    /* Trình duyệt chặn localStorage (chế độ riêng tư). Phiên sống trong tab này thôi. */
    return sinh()
  }
}

/**
 * Bỏ phiên cũ, lần gọi sau mở phiên mới.
 *
 * Dùng khi phiên đã `CLOSED`: khoá cũ vẫn trỏ tới đúng hàng đó, nên không đổi
 * khoá thì người dùng vĩnh viễn mở lại một hội thoại đã đóng và không hiểu vì
 * sao không gõ được gì.
 */
export function doiClientSessionId(kenh: KenhChat): string {
  const moi = sinh()
  try {
    localStorage.setItem(TIEN_TO + kenh, moi)
  } catch {
    /* Không cất được thì vẫn dùng được trong tab này. */
  }
  return moi
}
