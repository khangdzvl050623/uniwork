import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { AppError } from '../../lib/errors.js'
import { signAccessToken } from '../../lib/token.js'
import { batDauLuot, taoPhien } from './chat.service.js'
import { chayLuot } from './tro-ly.service.js'

/*
 * `CO_KHOA_THAT` là hằng chốt lúc nạp module, còn ở làn test này khoá CỐ Ý để
 * trống (xem `vitest.config.ts`). Bọc bằng getter để lật được cả hai nhánh —
 * nhánh "chưa cấu hình" là nhánh phần lớn thành viên trong nhóm gặp hằng ngày.
 */
let coKhoa = true
vi.mock('@uniwork/ai-runtime', async (goc) => {
  const that = await goc<typeof import('@uniwork/ai-runtime')>()
  return {
    ...that,
    get CO_KHOA_THAT() {
      return coKhoa
    },
    demLuotConLai: vi.fn(async () => ({ conLai: 3, tong: 5 })),
  }
})

vi.mock('./chat.service.js', () => ({
  taoPhien: vi.fn(),
  layTinNhan: vi.fn(async () => ({ tinNhan: [] })),
  batDauLuot: vi.fn(),
}))
vi.mock('./tro-ly.service.js', () => ({
  chayLuot: vi.fn(),
  RUNNER_ID: 'api-test',
}))
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }))

const mockBatDauLuot = batDauLuot as unknown as Mock
const mockChayLuot = chayLuot as unknown as Mock
const mockTaoPhien = taoPhien as unknown as Mock

const app = createApp()
const token = signAccessToken({ sub: 'u-1', role: 'STUDENT' })

const than = {
  sessionId: 'phien-1',
  clientMessageId: 'cm-0123456789',
  noiDung: 'có việc pha chế ở Cầu Giấy không',
}

const hoi = (body: object = than) =>
  request(app).post('/api/tro-ly/hoi').set('Authorization', `Bearer ${token}`).send(body)

beforeEach(() => {
  vi.clearAllMocks()
  coKhoa = true
  mockBatDauLuot.mockResolvedValue({ loai: 'moi', turnId: 't-1', seqCauHoi: 1, conLai: 4 })
  mockChayLuot.mockResolvedValue(undefined)
  mockTaoPhien.mockResolvedValue({ sessionId: 'phien-1', kind: 'AI_STUDENT', state: 'AI_ACTIVE', jobId: null })
})

describe('canh cửa', () => {
  it('chưa đăng nhập thì 401', async () => {
    await request(app).post('/api/tro-ly/hoi').send(than).expect(401)
  })

  it('ADMIN không có trợ lý', async () => {
    const t = signAccessToken({ sub: 'a-1', role: 'ADMIN' })
    await request(app).post('/api/tro-ly/hoi').set('Authorization', `Bearer ${t}`).send(than).expect(403)
  })
})

/*
 * ===========================================================================
 * NHÓM CA QUAN TRỌNG NHẤT FILE NÀY
 * ===========================================================================
 * Sau khi header SSE đã gửi, HTTP status đóng băng ở 200 vĩnh viễn. Một lỗi
 * phát sinh trước đó mà bị đẩy xuống sau lúc mở kênh sẽ đi ra dưới dạng
 * `200 OK` kèm một sự kiện `loi` — và một client viết bình thường (fetch rồi
 * kiểm `res.ok`) coi đó là thành công.
 *
 * Nên "kiểm xong hết rồi mới mở kênh" không phải chuyện gọn gàng, nó là hợp
 * đồng. Bốn ca dưới đây canh đúng hợp đồng đó.
 */
describe('lỗi trước khi mở kênh phải là HTTP status thật', () => {
  it('chưa cấu hình khoá → 503, và KHÔNG chạm database', async () => {
    coKhoa = false
    const res = await hoi().expect(503)
    expect(res.body.error.code).toBe('AI_UNAVAILABLE')
    expect(mockBatDauLuot).not.toHaveBeenCalled()
  })

  it('hết lượt trong ngày → 429 AI_QUOTA_EXCEEDED', async () => {
    mockBatDauLuot.mockRejectedValue(new AppError('AI_QUOTA_EXCEEDED', 'Hết lượt', 429))
    const res = await hoi().expect(429)
    expect(res.body.error.code).toBe('AI_QUOTA_EXCEEDED')
    expect(mockChayLuot).not.toHaveBeenCalled()
  })

  it('đang có lượt chạy dở → 409 AI_BUSY', async () => {
    mockBatDauLuot.mockRejectedValue(new AppError('AI_BUSY', 'Đang bận', 409))
    const res = await hoi().expect(409)
    expect(res.body.error.code).toBe('AI_BUSY')
  })

  it('nội dung rỗng → 400, không giữ lượt', async () => {
    const res = await hoi({ ...than, noiDung: '   ' }).expect(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(mockBatDauLuot).not.toHaveBeenCalled()
  })

  it('quá 2000 ký tự → 400', async () => {
    await hoi({ ...than, noiDung: 'a'.repeat(2001) }).expect(400)
  })
})

describe('kênh SSE', () => {
  it('trả đúng content-type và mở sự kiện bằng `phien`', async () => {
    const res = await hoi().expect(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.text).toContain('event: phien')
    expect(res.text).toContain('"turnId":"t-1"')
    expect(res.text).toContain('"conLai":4')
  })

  it('giao lượt cho chayLuot kèm đúng người gọi và phiên', async () => {
    await hoi({ ...than, jobIdDangXem: 'job-9' }).expect(200)
    expect(mockChayLuot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        role: 'STUDENT',
        sessionId: 'phien-1',
        turnId: 't-1',
        jobIdDangXem: 'job-9',
      }),
    )
  })

  /*
   * Gửi lại: tin đã nằm trong database rồi. Phát nguyên câu trả lời cũ và đóng
   * kênh. Gọi model lần hai ở đây là tính tiền hai lần cho một câu hỏi, và tệ
   * hơn — trả ra một câu trả lời KHÁC cho cùng một tin nhắn.
   */
  it('gửi lại thì phát lại câu trả lời cũ và KHÔNG gọi model', async () => {
    mockBatDauLuot.mockResolvedValue({ loai: 'gui-lai', traLoiCu: 'Mình tìm được 3 tin.' })
    const res = await hoi().expect(200)
    expect(res.text).toContain('"guiLai":true')
    expect(res.text).toContain('Mình tìm được 3 tin.')
    expect(mockChayLuot).not.toHaveBeenCalled()
  })

  it('gửi lại khi câu trả lời cũ chưa kịp ghi thì vẫn đóng kênh gọn gàng', async () => {
    mockBatDauLuot.mockResolvedValue({ loai: 'gui-lai', traLoiCu: null })
    const res = await hoi().expect(200)
    expect(res.text).toContain('event: xong')
  })
})

describe('các endpoint rẻ', () => {
  it('tạo phiên trả 201', async () => {
    const res = await request(app)
      .post('/api/hoi-thoai')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'AI_STUDENT', clientSessionId: 'cs-0123456789' })
      .expect(201)
    expect(res.body.data.sessionId).toBe('phien-1')
  })

  it('clientSessionId quá ngắn → 400', async () => {
    await request(app)
      .post('/api/hoi-thoai')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'AI_STUDENT', clientSessionId: 'abc' })
      .expect(400)
  })

  it('luot-con-lai nói rõ trợ lý đã sẵn sàng chưa', async () => {
    coKhoa = false
    const res = await request(app)
      .get('/api/tro-ly/luot-con-lai')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.data).toMatchObject({ conLai: 3, tong: 5, sanSang: false })
  })
})
