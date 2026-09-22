import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { io as taoClient, type Socket as ClientSocket } from 'socket.io-client'
import type { Server } from 'socket.io'
import { notFound } from '../../lib/errors.js'
import { signAccessToken } from '../../lib/token.js'
import { guiTinNhan, layTinNhan, quyenPhien } from './chat.service.js'
import { phatToiPhong } from './phat-su-kien.js'
import { ganSocketIO, goSocketIO } from './socket.gateway.js'

vi.mock('./chat.service.js', () => ({
  quyenPhien: vi.fn(),
  layTinNhan: vi.fn(),
  guiTinNhan: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }))

const mockQuyenPhien = quyenPhien as unknown as Mock
const mockLayTinNhan = layTinNhan as unknown as Mock
const mockGuiTinNhan = guiTinNhan as unknown as Mock

/*
 * Server thật, client thật, `chat.service` giả.
 *
 * Cổng Socket.IO là LỚP VỎ: nghiệp vụ đã có test riêng (làn database). Thứ chỉ
 * kiểm được ở đây là những thứ thuộc về chính giao thức — bắt tay có token,
 * vào đúng phòng, hình dạng ACK, và hẹn giờ ngắt khi token hết hạn.
 */
let http: HttpServer
let io: Server
let cong: number
const dangMo: ClientSocket[] = []

function noi(token: string | null): Promise<ClientSocket> {
  const s = taoClient(`http://127.0.0.1:${cong}`, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: token === null ? {} : { token },
    reconnection: false,
  })
  dangMo.push(s)
  return new Promise((giai, tuChoi) => {
    s.on('connect', () => giai(s))
    s.on('connect_error', (e) => tuChoi(e))
  })
}

const goi = (s: ClientSocket, ten: string, du: unknown): Promise<Record<string, unknown>> =>
  new Promise((giai) => s.emit(ten, du, giai))

const QUYEN_CHU = {
  sessionId: 'p-1',
  vai: 'CHU' as const,
  phong: 'hoi-thoai:p-1:chu',
  seqHienTai: 5,
  docTuSeq: 1,
  chiTinChiaSe: false,
  duocGui: true,
}
const QUYEN_NTD = {
  sessionId: 'p-1',
  vai: 'NTD_NHAN_HANDOFF' as const,
  phong: 'hoi-thoai:p-1:ntd',
  seqHienTai: 5,
  docTuSeq: 3,
  chiTinChiaSe: true,
  duocGui: true,
}

beforeEach(async () => {
  vi.clearAllMocks()
  mockQuyenPhien.mockResolvedValue(QUYEN_CHU)
  mockLayTinNhan.mockResolvedValue({ tinNhan: [], cursor: 'CUR-1', conNua: false, duocGui: true })
  mockGuiTinNhan.mockResolvedValue({
    message: { id: 'm-1', seq: 6, senderType: 'STUDENT', body: 'chào', createdAt: 'x' },
    cursor: 'CUR-2',
    daCo: false,
  })

  http = createServer()
  io = ganSocketIO(http)
  await new Promise<void>((giai) => http.listen(0, '127.0.0.1', giai))
  cong = (http.address() as AddressInfo).port
})

afterEach(async () => {
  for (const s of dangMo.splice(0)) s.disconnect()
  goSocketIO()
  await io.close()
  await new Promise<void>((giai) => http.close(() => giai()))
})

const token = () => signAccessToken({ sub: 'u-1', role: 'STUDENT' })

/* ===================================================================== */

describe('bắt tay', () => {
  it('không có token thì từ chối', async () => {
    await expect(noi(null)).rejects.toThrow('UNAUTHORIZED')
  })

  it('token bịa thì từ chối', async () => {
    await expect(noi('khong.phai.token')).rejects.toThrow('UNAUTHORIZED')
  })

  it('token hợp lệ thì vào được', async () => {
    const s = await noi(token())
    expect(s.connected).toBe(true)
  })

  /*
   * ---------------------------------------------------------------------
   * VÌ SAO PHẢI HẸN GIỜ NGẮT
   * ---------------------------------------------------------------------
   * `requireAuth` cố ý không truy vấn database và chấp nhận đánh đổi: tài khoản
   * vừa bị khoá vẫn gọi được API tối đa 15 phút.
   *
   * Với WebSocket, đánh đổi đó không còn là 15 phút — kết nối sống hàng giờ.
   * Cùng một luật, hậu quả khác hẳn, vì vòng đời khác hẳn.
   */
  it('token sắp hết hạn thì server báo rồi ngắt', async () => {
    const jwt = await import('jsonwebtoken')
    const { env } = await import('../../config/env.js')
    const sapHet = jwt.default.sign({ sub: 'u-1', role: 'STUDENT' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '1s',
    })

    const s = await noi(sapHet)
    const bao = await new Promise<boolean>((giai) => {
      s.on('phien:het-han', () => giai(true))
      setTimeout(() => giai(false), 3000)
    })
    expect(bao).toBe(true)
    await new Promise<void>((giai) => {
      if (!s.connected) return giai()
      s.on('disconnect', () => giai())
    })
    expect(s.connected).toBe(false)
  }, 10_000)
})

describe('hoi-thoai:vao', () => {
  /*
   * Tên phòng đến TỪ `quyenTruyCapPhien`, không do handler tự ghép chuỗi. Bản
   * thiết kế đầu để handler join `hoi-thoai:<id>` trong khi chỗ phát bắn vào
   * `:chu` / `:ntd` — join báo thành công, client không nhận được gì, và triệu
   * chứng duy nhất là "realtime không chạy".
   */
  it('chủ phiên vào phòng :chu', async () => {
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:vao', { sessionId: 'p-1' })

    expect(ack.ok).toBe(true)
    expect(io.sockets.adapter.rooms.get('hoi-thoai:p-1:chu')?.size).toBe(1)
    expect(io.sockets.adapter.rooms.has('hoi-thoai:p-1:ntd')).toBe(false)
  })

  it('NTD nhận handoff vào phòng :ntd, KHÔNG vào :chu', async () => {
    mockQuyenPhien.mockResolvedValue(QUYEN_NTD)
    const s = await noi(signAccessToken({ sub: 'ntd-1', role: 'EMPLOYER' }))
    await goi(s, 'hoi-thoai:vao', { sessionId: 'p-1' })

    expect(io.sockets.adapter.rooms.get('hoi-thoai:p-1:ntd')?.size).toBe(1)
    expect(io.sockets.adapter.rooms.has('hoi-thoai:p-1:chu')).toBe(false)
  })

  /* ACK trả CURSOR, không trả seq lớn nhất — với NTD thì dãy seq có lỗ hợp lệ. */
  it('ACK trả cursor và quyền gửi, không trả seq', async () => {
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:vao', { sessionId: 'p-1' })

    expect(ack).toMatchObject({ ok: true, cursor: 'CUR-1', duocGui: true, vai: 'CHU' })
    expect(ack).not.toHaveProperty('seqHienTai')
  })

  it('không có quyền thì ACK báo lỗi, không vào phòng nào', async () => {
    mockQuyenPhien.mockRejectedValue(notFound('Không tìm thấy hội thoại'))
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:vao', { sessionId: 'phien-nguoi-khac' })

    expect(ack).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(io.sockets.adapter.rooms.has('hoi-thoai:phien-nguoi-khac:chu')).toBe(false)
  })

  it('tự động vào phòng riêng của mình lúc kết nối', async () => {
    await noi(token())
    await new Promise((giai) => setTimeout(giai, 50))
    expect(io.sockets.adapter.rooms.get('user:u-1')?.size).toBe(1)
  })

  it('ra phòng thì rời thật', async () => {
    const s = await noi(token())
    await goi(s, 'hoi-thoai:vao', { sessionId: 'p-1' })
    await goi(s, 'hoi-thoai:ra', { sessionId: 'p-1' })
    expect(io.sockets.adapter.rooms.has('hoi-thoai:p-1:chu')).toBe(false)
  })
})

describe('hoi-thoai:gui', () => {
  it('ACK mang messageId và seq của tin đã ghi', async () => {
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:gui', {
      sessionId: 'p-1',
      clientMessageId: 'cm-0123456789',
      noiDung: 'chào anh',
    })

    expect(ack).toMatchObject({ ok: true, messageId: 'm-1', seq: 6, cursor: 'CUR-2', daCo: false })
  })

  it('gửi lại thì ACK nói rõ daCo, để client không vẽ tin thứ hai', async () => {
    mockGuiTinNhan.mockResolvedValue({
      message: { id: 'm-1', seq: 6, senderType: 'STUDENT', body: 'chào', createdAt: 'x' },
      cursor: 'CUR-2',
      daCo: true,
    })
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:gui', {
      sessionId: 'p-1',
      clientMessageId: 'cm-0123456789',
      noiDung: 'chào anh',
    })
    expect(ack).toMatchObject({ ok: true, daCo: true, messageId: 'm-1' })
  })

  it('phiên chưa cho nhắn trực tiếp thì ACK báo lỗi', async () => {
    const { AppError } = await import('../../lib/errors.js')
    mockGuiTinNhan.mockRejectedValue(
      new AppError('CONFLICT', 'Hội thoại chưa ở trạng thái nhắn trực tiếp', 409),
    )
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:gui', {
      sessionId: 'p-1',
      clientMessageId: 'cm-0123456789',
      noiDung: 'x',
    })
    expect(ack).toMatchObject({ ok: false, code: 'CONFLICT' })
  })

  /*
   * ---------------------------------------------------------------------
   * MỘT SESSIONID SAI CHÍNH TẢ KHÔNG ĐƯỢC HẠ CẢ SERVER
   * ---------------------------------------------------------------------
   * Ném từ trong listener của Socket.IO là ném vào `uncaughtException` —
   * process chết. Đây là khác biệt lớn so với Express 5, nơi promise bị reject
   * tự động đi tới middleware xử lý lỗi.
   */
  it('lỗi ngoài ý muốn thành ACK INTERNAL_ERROR, server vẫn sống', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGuiTinNhan.mockRejectedValue(new Error('database sập'))
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:gui', { sessionId: 'p-1' })

    expect(ack).toMatchObject({ ok: false, code: 'INTERNAL_ERROR' })
    expect(ack.message).toBeUndefined()
    expect(s.connected).toBe(true)
  })

  it('payload không phải object cũng không làm sập', async () => {
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:vao', 'tôi là chuỗi')
    expect(ack.ok).toBeDefined()
    expect(s.connected).toBe(true)
  })
})

describe('hoi-thoai:tai-bu', () => {
  it('trả tin, cursor mới và cờ còn nữa', async () => {
    mockLayTinNhan.mockResolvedValue({
      tinNhan: [{ id: 'm-9', seq: 9, senderType: 'EMPLOYER', body: 'ok em', createdAt: 'x' }],
      cursor: 'CUR-9',
      conNua: true,
      duocGui: true,
    })
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:tai-bu', { sessionId: 'p-1', cursor: 'CUR-5' })

    expect(ack).toMatchObject({ ok: true, cursor: 'CUR-9', conNua: true })
    expect(mockLayTinNhan).toHaveBeenCalledWith({ id: 'u-1', role: 'STUDENT' }, 'p-1', 'CUR-5')
  })

  /*
   * MẢNG RỖNG + CURSOR TIẾN là kết quả ĐÚNG, không phải lỗi. Sinh viên nói riêng
   * 5 câu thì cursor của NTD vẫn tiến dù họ không nhận tin nào. Client cập nhật
   * cursor rồi DỪNG — không thử lại.
   */
  it('mảng rỗng kèm cursor mới vẫn là ok: true', async () => {
    mockLayTinNhan.mockResolvedValue({
      tinNhan: [],
      cursor: 'CUR-15',
      conNua: false,
      duocGui: true,
    })
    const s = await noi(token())
    const ack = await goi(s, 'hoi-thoai:tai-bu', { sessionId: 'p-1', cursor: 'CUR-10' })

    expect(ack).toMatchObject({ ok: true, tinNhan: [], cursor: 'CUR-15' })
  })
})

describe('bộ phát', () => {
  /*
   * Đi qua `phatToiPhong` chứ không gọi thẳng `io.to(...)`.
   *
   * Khẳng định ở đây không phải "Socket.IO phát được tin" — thư viện lo việc
   * đó. Là "`ganSocketIO` đã ĐĂNG KÝ bộ phát cho `chat.service`". Quên dòng
   * `dangKyBoPhat` thì mọi test khác vẫn xanh và realtime im lặng hoàn toàn.
   */
  it('cổng đã đăng ký bộ phát cho service', async () => {
    const s = await noi(token())
    await goi(s, 'hoi-thoai:vao', { sessionId: 'p-1' })

    const nhan = new Promise<unknown>((giai) => s.on('hoi-thoai:tin-moi', giai))
    phatToiPhong('hoi-thoai:p-1:chu', 'hoi-thoai:tin-moi', { sessionId: 'p-1', message: { seq: 6 } })

    expect(await nhan).toMatchObject({ sessionId: 'p-1' })
  })

  it('người không ở trong phòng thì không nhận được gì', async () => {
    const s = await noi(token())
    let nhanDuoc = false
    s.on('hoi-thoai:tin-moi', () => (nhanDuoc = true))

    phatToiPhong('hoi-thoai:p-1:chu', 'hoi-thoai:tin-moi', { sessionId: 'p-1' })
    await new Promise((giai) => setTimeout(giai, 100))
    expect(nhanDuoc).toBe(false)
  })
})
