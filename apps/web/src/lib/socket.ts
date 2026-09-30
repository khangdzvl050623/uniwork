import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from './auth-store'
import { khoiPhucPhien } from './api'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

/**
 * Một kết nối Socket.IO dùng chung cho cả ứng dụng.
 *
 * ===========================================================================
 * VÌ SAO MỘT, KHÔNG PHẢI MỖI MÀN HÌNH MỘT
 * ===========================================================================
 * Server đưa mỗi socket vào phòng `user:<id>` ngay lúc kết nối, và thông báo,
 * tiến trình quét CV, tin nhắn mới đều đi qua đó. Mỗi màn hình mở một kết nối
 * thì cùng một sự kiện tới nhiều lần, và trên gói CloudAMQP Little Lemur sau
 * này thì số connection là tài nguyên có hạn thật (20).
 *
 * ===========================================================================
 * TOKEN GỬI LÚC BẮT TAY, KHÔNG PHẢI TRONG HEADER
 * ===========================================================================
 * WebSocket không đặt được header. Socket.IO có `auth` cho đúng việc này, và
 * server đọc nó trong middleware — xem `socket.gateway.ts`.
 *
 * `auth` là HÀM chứ không phải object: object thì token bị chốt ở lần kết nối
 * đầu, và mọi lần nối lại sau đó vẫn gửi token cũ đã hết hạn.
 */
let socket: Socket | null = null

export function laySocket(): Socket {
  if (socket) return socket

  socket = io(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: (cb) => cb({ token: getAccessToken() }),
    autoConnect: false,
  })

  /*
   * Access token sống 15 phút, kết nối này sống hàng giờ. Server hẹn giờ ngắt
   * đúng lúc token hết hạn và bắn `phien:het-han` trước khi ngắt.
   *
   * Việc của client: gia hạn rồi nối lại. Người dùng không thấy gì — mất kết
   * nối dưới một giây, và tin nhắn trong khoảng đó được tải bù bằng cursor.
   */
  socket.on('phien:het-han', () => {
    void khoiPhucPhien().then(() => socket?.connect())
  })

  return socket
}

/** Nối nếu chưa nối. Gọi bao nhiêu lần cũng được. */
export function moSocket(): Socket {
  const s = laySocket()
  if (!s.connected) s.connect()
  return s
}

/** Dùng lúc đăng xuất — kết nối cũ mang danh tính cũ, không được giữ lại. */
export function dongSocket(): void {
  socket?.disconnect()
  socket = null
}

/* ------------------------------------------------------------------ ACK -- */

export interface AckLoi {
  ok: false
  code: string
  message?: string
}

export type Ack<T> = ({ ok: true } & T) | AckLoi

/**
 * Bọc `emit` có ACK thành Promise, kèm hạn chờ.
 *
 * `socket.emit` không hứa hẹn gì cả. Không có hạn chờ thì một ACK không bao
 * giờ tới sẽ để lại một Promise treo vĩnh viễn, và giao diện kẹt ở trạng thái
 * "đang gửi" mà không có nút nào thoát ra.
 */
export function goiSocket<T>(s: Socket, ten: string, du: unknown, hanMs = 10_000): Promise<Ack<T>> {
  return new Promise((giai) => {
    s.timeout(hanMs).emit(ten, du, (loi: unknown, kq: Ack<T>) => {
      if (loi) return giai({ ok: false, code: 'TIMEOUT', message: 'Máy chủ không phản hồi' })
      giai(kq)
    })
  })
}
