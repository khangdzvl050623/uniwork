import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { signAccessToken } from '../../lib/token.js'
import {
  chuyenNhaTuyenDung,
  huyCho,
  ketThuc,
  ntdChuDongTraoDoi,
  tiepNhan,
  tuChoiYeuCau,
} from './handoff.service.js'

vi.mock('./handoff.service.js', () => ({
  chuyenNhaTuyenDung: vi.fn(),
  huyCho: vi.fn(),
  tiepNhan: vi.fn(),
  tuChoiYeuCau: vi.fn(),
  ketThuc: vi.fn(),
  hopThuNTD: vi.fn(),
  ntdChuDongTraoDoi: vi.fn(),
}))

vi.mock('./chat.service.js', () => ({
  guiTinNhan: vi.fn(),
  layTinNhan: vi.fn(),
  hoiThoaiCuaToi: vi.fn(),
  moLuong: vi.fn(),
}))

vi.mock('./chan-ntd.service.js', () => ({
  chanNhaTuyenDung: vi.fn(async () => ({ sessionId: 'sess-1', daChan: true, state: 'CLOSED' })),
  boChanNhaTuyenDung: vi.fn(async () => ({ sessionId: 'sess-1', daChan: false, state: 'CLOSED' })),
  daChan: vi.fn(async () => false),
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }))

const mockChuyenNhaTuyenDung = chuyenNhaTuyenDung as unknown as Mock
const mockHuyCho = huyCho as unknown as Mock
const mockTiepNhan = tiepNhan as unknown as Mock
const mockTuChoiYeuCau = tuChoiYeuCau as unknown as Mock
const mockKetThuc = ketThuc as unknown as Mock
const mockNtdChuDongTraoDoi = ntdChuDongTraoDoi as unknown as Mock

const app = createApp()
const svToken = signAccessToken({ sub: 'sv-1', role: 'STUDENT' })
const ntdToken = signAccessToken({ sub: 'ntd-1', role: 'EMPLOYER' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Quy trình SV gửi yêu cầu trao đổi (WAITING_EMPLOYER)', () => {
  it('chưa đăng nhập thì trả về 401', async () => {
    await request(app)
      .post('/api/hoi-thoai/hoi-ntd')
      .send({ jobId: 'job-1', loiNhan: 'Em muốn hỏi về ca sáng' })
      .expect(401)
  })

  it('không phải sinh viên thì trả về 403', async () => {
    await request(app)
      .post('/api/hoi-thoai/hoi-ntd')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ jobId: 'job-1', loiNhan: 'Em muốn hỏi' })
      .expect(403)
  })

  it('jobId rỗng thì trả về 400', async () => {
    await request(app)
      .post('/api/hoi-thoai/hoi-ntd')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: '   ', loiNhan: 'Em muốn hỏi' })
      .expect(400)
  })

  it('SV gửi yêu cầu thành công chuyển sang WAITING_EMPLOYER', async () => {
    mockChuyenNhaTuyenDung.mockResolvedValue({
      sessionId: 'sess-123',
      state: 'WAITING_EMPLOYER',
      tin: { id: 'm-1', body: 'Em muốn hỏi về ca sáng ạ' },
    })

    const res = await request(app)
      .post('/api/hoi-thoai/hoi-ntd')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ jobId: 'job-123', loiNhan: 'Em muốn hỏi về ca sáng ạ' })
      .expect(200)

    expect(mockChuyenNhaTuyenDung).toHaveBeenCalledWith('sv-1', 'job-123', 'Em muốn hỏi về ca sáng ạ')
    expect(res.body.data.sessionId).toBe('sess-123')
    expect(res.body.data.state).toBe('WAITING_EMPLOYER')
  })
})

describe('NTD chủ động trao đổi từ đơn ứng tuyển', () => {
  it('chưa đăng nhập thì trả về 401', async () => {
    await request(app)
      .post('/api/hoi-thoai/ntd-trao-doi')
      .send({ applicationId: 'app-1' })
      .expect(401)
  })

  it('sinh viên gọi endpoint này thì trả về 403', async () => {
    await request(app)
      .post('/api/hoi-thoai/ntd-trao-doi')
      .set('Authorization', `Bearer ${svToken}`)
      .send({ applicationId: 'app-1' })
      .expect(403)
  })

  it('applicationId không hợp lệ trả về 400', async () => {
    await request(app)
      .post('/api/hoi-thoai/ntd-trao-doi')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ applicationId: '' })
      .expect(400)
  })

  it('NTD chủ động mở trao đổi thành công -> HUMAN_ACTIVE', async () => {
    mockNtdChuDongTraoDoi.mockResolvedValue({
      sessionId: 'sess-active',
      state: 'HUMAN_ACTIVE',
      tin: { id: 'm-ntd', body: 'Chào bạn, bên mình muốn trao đổi thêm về hồ sơ' },
    })

    const res = await request(app)
      .post('/api/hoi-thoai/ntd-trao-doi')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ applicationId: 'app-123', loiNhan: 'Chào bạn, bên mình muốn trao đổi' })
      .expect(200)

    expect(mockNtdChuDongTraoDoi).toHaveBeenCalledWith(
      { id: 'ntd-1', role: 'EMPLOYER' },
      'app-123',
      'Chào bạn, bên mình muốn trao đổi',
    )
    expect(res.body.data.sessionId).toBe('sess-active')
    expect(res.body.data.state).toBe('HUMAN_ACTIVE')
  })
})

describe('Các trạng thái luồng (Hủy, Tiếp nhận, Từ chối, Kết thúc)', () => {
  it('SV huỷ yêu cầu đang chờ (WAITING_EMPLOYER -> CLOSED)', async () => {
    mockHuyCho.mockResolvedValue({ sessionId: 'sess-1', state: 'CLOSED' })

    const res = await request(app)
      .post('/api/hoi-thoai/sess-1/huy-cho')
      .set('Authorization', `Bearer ${svToken}`)
      .expect(200)

    expect(mockHuyCho).toHaveBeenCalledWith('sv-1', 'sess-1')
    expect(res.body.data.state).toBe('CLOSED')
  })

  it('NTD tiếp nhận yêu cầu (WAITING_EMPLOYER -> HUMAN_ACTIVE)', async () => {
    mockTiepNhan.mockResolvedValue({ sessionId: 'sess-1', state: 'HUMAN_ACTIVE' })

    const res = await request(app)
      .post('/api/hoi-thoai/sess-1/tiep-nhan')
      .set('Authorization', `Bearer ${ntdToken}`)
      .expect(200)

    expect(mockTiepNhan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ntd-1', role: 'EMPLOYER' }),
      'sess-1',
    )
    expect(res.body.data.state).toBe('HUMAN_ACTIVE')
  })

  it('NTD từ chối yêu cầu (WAITING_EMPLOYER -> CLOSED)', async () => {
    mockTuChoiYeuCau.mockResolvedValue({ sessionId: 'sess-1', state: 'CLOSED' })

    const res = await request(app)
      .post('/api/hoi-thoai/sess-1/tu-choi')
      .set('Authorization', `Bearer ${ntdToken}`)
      .send({ lyDo: 'Hiện tại quán đã đủ ca làm việc' })
      .expect(200)

    expect(mockTuChoiYeuCau).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ntd-1', role: 'EMPLOYER' }),
      'sess-1',
      'Hiện tại quán đã đủ ca làm việc',
    )
    expect(res.body.data.state).toBe('CLOSED')
  })

  it('Kết thúc cuộc trò chuyện (HUMAN_ACTIVE -> CLOSED)', async () => {
    mockKetThuc.mockResolvedValue({ sessionId: 'sess-1', state: 'CLOSED' })

    const res = await request(app)
      .post('/api/hoi-thoai/sess-1/ket-thuc')
      .set('Authorization', `Bearer ${svToken}`)
      .expect(200)

    expect(mockKetThuc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sv-1' }),
      'sess-1',
    )
    expect(res.body.data.state).toBe('CLOSED')
  })
})

/*
 * Chặn là quyền của SINH VIÊN với luồng của chính mình. Nhà tuyển dụng gọi được
 * đường này thì họ tự "chặn" để đóng ngang một luồng sinh viên đang chờ.
 */
describe('Chặn nhà tuyển dụng — chỉ sinh viên', () => {
  it('chưa đăng nhập → 401', async () => {
    await request(app).post('/api/hoi-thoai/sess-1/chan').expect(401)
  })

  it('nhà tuyển dụng gọi → 403, cả chặn lẫn bỏ chặn', async () => {
    await request(app)
      .post('/api/hoi-thoai/sess-1/chan')
      .set('Authorization', `Bearer ${ntdToken}`)
      .expect(403)
    await request(app)
      .delete('/api/hoi-thoai/sess-1/chan')
      .set('Authorization', `Bearer ${ntdToken}`)
      .expect(403)
  })

  it('sinh viên chặn → 200, daChan = true', async () => {
    const res = await request(app)
      .post('/api/hoi-thoai/sess-1/chan')
      .set('Authorization', `Bearer ${svToken}`)
      .expect(200)
    expect(res.body.data.daChan).toBe(true)
  })
})
