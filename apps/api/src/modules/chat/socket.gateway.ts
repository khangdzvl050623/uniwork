import type { Server as HttpServer } from 'node:http'
import type { Role } from '@prisma/client'
import { Server, type DefaultEventsMap, type Socket as SocketGoc } from 'socket.io'
import { corsOrigins } from '../../config/env.js'
import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { verifyAccessToken } from '../../lib/token.js'
import { phongNguoiDung } from './chat.access.js'
import { guiTinNhan, layTinNhan, quyenPhien } from './chat.service.js'
import { dangKyBoPhat } from './phat-su-kien.js'

/**
 * Cổng Socket.IO — LỚP VỎ MỎNG.
 *
 * Không một dòng nghiệp vụ nào ở đây. Mọi handler chỉ: đọc payload, gọi đúng
 * hàm trong `chat.service`, trả ACK. Lý do ở `chat.service.guiTinNhan`.
 */

interface NguoiDung {
  id: string
  role: Role
}

type Ack = (kq: unknown) => void

/**
 * Gắn kiểu qua THAM SỐ KIỂU của Socket.IO, không qua `declare module`.
 *
 * `declare module` sẽ ghi đè `data` cho mọi `Socket` trong cả process, kể cả
 * những chỗ Socket.IO tự dùng bên trong — và nó va ngay với `SocketData` mặc
 * định của thư viện. Tham số kiểu thì chỉ áp cho server này.
 */
interface DuLieuSocket {
  user?: NguoiDung
  expiresAt?: number
}

type Socket = SocketGoc<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, DuLieuSocket>
type MayChu = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, DuLieuSocket>

export function ganSocketIO(http: HttpServer): MayChu {
  const io: MayChu = new Server(http, {
    path: '/socket.io',
    cors: { origin: corsOrigins, credentials: true },
  })

  /*
   * =========================================================================
   * XÁC THỰC MỘT LẦN LÚC BẮT TAY, VÀ MỘT HẸN GIỜ NGẮT
   * =========================================================================
   * `requireAuth` cố ý không truy vấn database và chấp nhận đánh đổi: tài khoản
   * vừa bị khoá vẫn gọi được API tối đa 15 phút (`ACCESS_TTL`).
   *
   * Với WebSocket, đánh đổi đó KHÔNG còn là 15 phút. Một kết nối sống hàng giờ,
   * nên tài khoản bị khoá lúc 10:00 vẫn chat được tới 14:00. Cùng một luật, hậu
   * quả khác hẳn — vì vòng đời khác hẳn.
   *
   * Sửa bằng chính `exp` của token: hết hạn thì báo rồi ngắt, client refresh và
   * nối lại. Người dùng không thấy gì — mất kết nối dưới một giây, và tin nhắn
   * trong lúc đó được tải bù bằng cursor.
   */
  io.use((socket, next) => {
    const raw = socket.handshake.auth as { token?: unknown }
    const token = typeof raw.token === 'string' ? raw.token : null
    const payload = token === null ? null : verifyAccessToken(token)
    if (!payload) return next(new Error('UNAUTHORIZED'))

    socket.data.user = { id: payload.sub, role: payload.role }
    socket.data.expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : undefined
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    if (!user) return socket.disconnect(true)

    void socket.join(phongNguoiDung(user.id))
    henNgatKhiHetHan(socket)

    socket.on('hoi-thoai:vao', xuLy(socket, vaoPhien))
    socket.on('hoi-thoai:ra', xuLy(socket, raPhien))
    socket.on('hoi-thoai:gui', xuLy(socket, gui))
    socket.on('hoi-thoai:tai-bu', xuLy(socket, taiBu))

    /*
     * `dang-go` KHÔNG có ACK và KHÔNG chạm database.
     *
     * Mất một sự kiện "đang gõ" là không ai biết và không ai quan tâm. Cho nó
     * đi qua cùng đường xác nhận với tin nhắn thật là trả giá cho một thứ vứt
     * đi được — và trên gói free thì mỗi truy vấn đều đáng kể.
     */
    socket.on('hoi-thoai:dang-go', (v: unknown) => {
      void bao(socket, v)
    })
  })

  /* Bộ phát cho `chat.service`. Nhiều instance thì đổi chỗ này sang RabbitMQ. */
  dangKyBoPhat({
    toiPhong: (phong, ten, du) => {
      io.to(phong).emit(ten, du)
    },
  })

  return io
}

/** Gỡ bộ phát khi tắt server, để `chat.service` không bắn vào một io đã đóng. */
export function goSocketIO(): void {
  dangKyBoPhat(null)
}

/* ============================================================== handler -- */

type Handler = (user: NguoiDung, socket: Socket, v: Record<string, unknown>) => Promise<unknown>

/**
 * Bọc chung: mọi handler đều ACK, và KHÔNG handler nào được ném ra ngoài.
 *
 * Ném từ trong một listener của Socket.IO là ném vào `uncaughtException` —
 * process chết. Một `sessionId` sai chính tả không được phép hạ cả server.
 */
function xuLy(socket: Socket, fn: Handler) {
  return (v: unknown, ack?: Ack) => {
    const user = socket.data.user
    if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' })

    const payload = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>

    void fn(user, socket, payload)
      .then((kq) => ack?.({ ok: true, ...(kq as object) }))
      .catch((e: unknown) => {
        if (e instanceof AppError) return ack?.({ ok: false, code: e.code, message: e.message })
        logger.error('Socket handler lỗi ngoài ý muốn', {
          message: e instanceof Error ? e.message : String(e),
        })
        ack?.({ ok: false, code: 'INTERNAL_ERROR' })
      })
  }
}

const layId = (v: Record<string, unknown>, ten: string): string =>
  typeof v[ten] === 'string' ? v[ten] : ''

/**
 * Tên phòng đến TỪ `quyenTruyCapPhien`, không do handler tự ghép chuỗi.
 *
 * Bản thiết kế đầu để handler `join('hoi-thoai:' + id)` trong khi chỗ phát bắn
 * vào `:chu` / `:ntd`. `join` báo thành công, client không nhận được gì, và
 * triệu chứng duy nhất là "realtime không chạy".
 */
const vaoPhien: Handler = async (user, socket, v) => {
  const quyen = await quyenPhien(user, layId(v, 'sessionId'))
  await socket.join(quyen.phong)

  /*
   * ACK trả CURSOR, không trả `seq` lớn nhất của phiên. Với NTD thì dãy seq có
   * khoảng trống hợp lệ — xem `cursor.ts`.
   */
  const bu = await layTinNhan(user, quyen.sessionId, undefined)
  return { cursor: bu.cursor, duocGui: quyen.duocGui, vai: quyen.vai }
}

const raPhien: Handler = async (user, socket, v) => {
  const quyen = await quyenPhien(user, layId(v, 'sessionId'))
  await socket.leave(quyen.phong)
  return {}
}

/**
 * ACK **SAU KHI COMMIT**, không trước.
 *
 * ACK trước commit là nói dối: người dùng thấy dấu tick, rồi tải lại trang và
 * tin nhắn biến mất. `guiTinNhan` chỉ trả về sau khi transaction xong, nên chỗ
 * này chỉ cần không thêm gì vào trước nó.
 */
const gui: Handler = async (user, _socket, v) => {
  const kq = await guiTinNhan(
    user,
    layId(v, 'sessionId'),
    layId(v, 'clientMessageId'),
    typeof v.noiDung === 'string' ? v.noiDung : '',
  )
  return { messageId: kq.message.id, seq: kq.message.seq, cursor: kq.cursor, daCo: kq.daCo }
}

const taiBu: Handler = async (user, _socket, v) => {
  const bu = await layTinNhan(
    user,
    layId(v, 'sessionId'),
    typeof v.cursor === 'string' ? v.cursor : undefined,
  )
  return { tinNhan: bu.tinNhan, cursor: bu.cursor, conNua: bu.conNua }
}

async function bao(socket: Socket, v: unknown): Promise<void> {
  const user = socket.data.user
  if (!user) return
  const payload = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const sessionId = layId(payload, 'sessionId')
  try {
    const quyen = await quyenPhien(user, sessionId)
    /*
     * Phát vào phòng CỦA PHÍA BÊN KIA, và chỉ khi phiên đang cho nhắn trực tiếp.
     * Không thì "đang gõ" của sinh viên nói chuyện với AI cũng hiện trên màn
     * hình NTD.
     */
    if (!quyen.duocGui) return
    socket
      .to(quyen.vai === 'CHU' ? `hoi-thoai:${sessionId}:ntd` : `hoi-thoai:${sessionId}:chu`)
      .emit('hoi-thoai:dang-go', { sessionId, userId: user.id })
  } catch {
    /* Không quyền hoặc phiên không tồn tại — bỏ qua, đây là sự kiện vứt đi được. */
  }
}

function henNgatKhiHetHan(socket: Socket): void {
  const het = socket.data.expiresAt
  if (het === undefined) return

  const hen = setTimeout(
    () => {
      socket.emit('phien:het-han', {})
      socket.disconnect(true)
    },
    Math.max(0, het - Date.now()),
  )
  /*
   * `unref` để một hẹn giờ 15 phút không giữ process sống khi tắt server.
   * `clearTimeout` lúc disconnect để không rò timer theo mỗi lần nối lại.
   */
  hen.unref()
  socket.on('disconnect', () => clearTimeout(hen))
}
