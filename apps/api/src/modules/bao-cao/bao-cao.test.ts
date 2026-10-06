import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'
import { createNotification } from '../notifications/notifications.service.js'
import { phatToiPhong } from '../chat/phat-su-kien.js'
import {
  baoCaoCuaToi,
  chanKhongPhaiAdmin,
  guiBaoCao,
  hangDoiBaoCao,
  xuLyBaoCao,
} from './bao-cao.service.js'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    jobReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: vi.fn(),
}))

vi.mock('../chat/phat-su-kien.js', () => ({
  phatToiPhong: vi.fn(),
}))

const mockJobFindUnique = prisma.job.findUnique as unknown as Mock
const mockReportCreate = prisma.jobReport.create as unknown as Mock
const mockReportFindUnique = prisma.jobReport.findUnique as unknown as Mock
const mockReportFindMany = prisma.jobReport.findMany as unknown as Mock
const mockReportGroupBy = prisma.jobReport.groupBy as unknown as Mock
const mockTransaction = prisma.$transaction as unknown as Mock
const mockCreateNotification = createNotification as unknown as Mock
const mockPhatToiPhong = phatToiPhong as unknown as Mock

const app = createApp()
const studentToken = signAccessToken({ sub: 'user-sv-1', role: 'STUDENT' })
const employerToken = signAccessToken({ sub: 'user-ntd-1', role: 'EMPLOYER' })
const adminToken = signAccessToken({ sub: 'user-admin-1', role: 'ADMIN' })

describe('bao-cao.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('guiBaoCao', () => {
    const jobMau = {
      id: 'job-1',
      title: 'Nhân viên phục vụ cafe',
      description: 'Làm việc theo ca 4 tiếng',
      city: 'Hà Nội',
      district: 'Cầu Giấy',
      salaryNegotiable: false,
      salaryMin: 25000,
      salaryMax: 30000,
      salaryUnit: 'VND_PER_HOUR',
      status: 'OPEN',
      employerProfile: {
        userId: 'user-ntd-99',
        companyName: 'Cafe ABC',
      },
    }

    it('tạo báo cáo thành công và lưu ảnh chụp tin', async () => {
      mockJobFindUnique.mockResolvedValue(jobMau)
      const now = new Date()
      mockReportCreate.mockResolvedValue({
        id: 'rep-1',
        jobId: 'job-1',
        reason: 'LUA_DAO',
        moTa: 'Yêu cầu chuyển tiền cọc 300k',
        status: 'CHO_XU_LY',
        ketLuan: null,
        createdAt: now,
        handledAt: null,
        anhChupTin: {
          title: jobMau.title,
          description: jobMau.description,
          city: jobMau.city,
          district: jobMau.district,
          salaryNegotiable: false,
          salaryMin: 25000,
          salaryMax: 30000,
          salaryUnit: 'VND_PER_HOUR',
          status: 'OPEN',
          congTy: 'Cafe ABC',
          chupLuc: now.toISOString(),
        },
      })

      const res = await guiBaoCao('user-sv-1', {
        jobId: 'job-1',
        clientReportId: 'client-rep-1',
        reason: 'LUA_DAO',
        moTa: 'Yêu cầu chuyển tiền cọc 300k',
      })

      expect(res.daCo).toBe(false)
      expect(res.baoCao.id).toBe('rep-1')
      expect(res.baoCao.anhChupTin?.title).toBe('Nhân viên phục vụ cafe')
      expect(mockReportCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 'job-1',
            reporterUserId: 'user-sv-1',
            clientReportId: 'client-rep-1',
            reason: 'LUA_DAO',
            moTa: 'Yêu cầu chuyển tiền cọc 300k',
            anhChupTin: expect.objectContaining({
              title: 'Nhân viên phục vụ cafe',
              congTy: 'Cafe ABC',
            }),
          }),
        }),
      )
    })

    it('ném lỗi notFound khi tin không tồn tại', async () => {
      mockJobFindUnique.mockResolvedValue(null)

      await expect(
        guiBaoCao('user-sv-1', {
          jobId: 'job-khong-ton-tai',
          clientReportId: 'client-rep-1',
          reason: 'LUA_DAO',
          moTa: 'Lừa đảo',
        }),
      ).rejects.toThrow('Không tìm thấy tin tuyển dụng')
    })

    it('ném lỗi badRequest khi NTD tự báo cáo tin của chính mình', async () => {
      mockJobFindUnique.mockResolvedValue({
        ...jobMau,
        employerProfile: { userId: 'user-ntd-1', companyName: 'Cafe ABC' },
      })

      await expect(
        guiBaoCao('user-ntd-1', {
          jobId: 'job-1',
          clientReportId: 'client-rep-1',
          reason: 'SAI_SU_THAT',
          moTa: 'Sai thông tin',
        }),
      ).rejects.toThrow('Đây là tin của bạn. Dùng nút Đóng tin nếu muốn gỡ.')
    })

    it('trả lại bản cũ daCo=true khi retry cùng clientReportId', async () => {
      mockJobFindUnique.mockResolvedValue(jobMau)
      const errP2002 = new Error('Unique constraint failed')
      Object.assign(errP2002, { code: 'P2002' })
      mockReportCreate.mockRejectedValue(errP2002)

      const now = new Date()
      mockReportFindUnique.mockResolvedValue({
        id: 'rep-cu',
        jobId: 'job-1',
        reason: 'LUA_DAO',
        moTa: 'Yêu cầu chuyển tiền cọc',
        status: 'CHO_XU_LY',
        ketLuan: null,
        createdAt: now,
        handledAt: null,
      })

      const res = await guiBaoCao('user-sv-1', {
        jobId: 'job-1',
        clientReportId: 'client-rep-1',
        reason: 'LUA_DAO',
        moTa: 'Yêu cầu chuyển tiền cọc',
      })

      expect(res.daCo).toBe(true)
      expect(res.baoCao.id).toBe('rep-cu')
    })

    it('ném conflict khi đã có báo cáo đang mở cho cùng một tin', async () => {
      mockJobFindUnique.mockResolvedValue(jobMau)
      const errP2002 = new Error('Unique constraint failed')
      Object.assign(errP2002, { code: 'P2002' })
      mockReportCreate.mockRejectedValue(errP2002)

      // findUnique with reporterUserId_clientReportId returns null => this was the partial index
      mockReportFindUnique.mockResolvedValue(null)

      await expect(
        guiBaoCao('user-sv-1', {
          jobId: 'job-1',
          clientReportId: 'client-rep-moi',
          reason: 'LUA_DAO',
          moTa: 'Báo cáo tiếp lần nữa',
        }),
      ).rejects.toThrow('Bạn đã báo cáo tin này và admin đang xem. Chờ kết quả nhé.')
    })
  })

  describe('baoCaoCuaToi', () => {
    it('trả về danh sách báo cáo của người gửi kèm ảnh chụp tin', async () => {
      const now = new Date()
      mockReportFindMany.mockResolvedValue([
        {
          id: 'rep-1',
          jobId: 'job-1',
          reason: 'LUA_DAO',
          moTa: 'Đòi tiền cọc',
          status: 'DA_XU_LY',
          ketLuan: 'Đã tạm dừng tin tuyển dụng do có dấu hiệu lừa đảo.',
          createdAt: now,
          handledAt: now,
          anhChupTin: { title: 'Pha chế', congTy: 'Quán ABC' },
        },
      ])

      const res = await baoCaoCuaToi('user-sv-1')
      expect(res.baoCao).toHaveLength(1)
      expect(res.baoCao[0].id).toBe('rep-1')
      expect(res.baoCao[0].ketLuan).toBe('Đã tạm dừng tin tuyển dụng do có dấu hiệu lừa đảo.')
      expect(res.baoCao[0].anhChupTin?.title).toBe('Pha chế')
    })
  })

  describe('hangDoiBaoCao', () => {
    it('trả về danh sách chờ xử lý cho admin kèm số lượt đang mở', async () => {
      const now = new Date()
      mockReportFindMany.mockResolvedValue([
        {
          id: 'rep-1',
          jobId: 'job-1',
          reason: 'LUA_DAO',
          moTa: 'Bắt cọc',
          status: 'CHO_XU_LY',
          ketLuan: null,
          createdAt: now,
          handledAt: null,
          anhChupTin: { title: 'Tin 1' },
          job: { status: 'OPEN' },
        },
      ])
      mockReportGroupBy.mockResolvedValue([{ jobId: 'job-1', _count: { _all: 3 } }])

      const res = await hangDoiBaoCao()
      expect(res.baoCao).toHaveLength(1)
      expect(res.baoCao[0].soLuotDangMo).toBe(3)
      expect(res.baoCao[0].tinConMo).toBe(true)
    })
  })

  describe('xuLyBaoCao', () => {
    it('ném lỗi notFound khi không tìm thấy báo cáo', async () => {
      mockReportFindUnique.mockResolvedValue(null)

      await expect(
        xuLyBaoCao('user-admin-1', 'rep-0', 'DA_XU_LY', 'Đã xử lý'),
      ).rejects.toThrow('Không tìm thấy báo cáo')
    })

    it('ném lỗi badRequest khi xử lý xong mà để trống kết luận', async () => {
      mockReportFindUnique.mockResolvedValue({
        reporterUserId: 'user-sv-1',
        jobId: 'job-1',
        status: 'CHO_XU_LY',
      })

      await expect(
        xuLyBaoCao('user-admin-1', 'rep-1', 'DA_XU_LY', '   '),
      ).rejects.toThrow('Phải ghi kết luận — người báo cáo sẽ đọc câu này')
    })

    it('cập nhật thành công, gửi thông báo và phát realtime cho người gửi', async () => {
      mockReportFindUnique.mockResolvedValue({
        reporterUserId: 'user-sv-1',
        jobId: 'job-1',
        status: 'CHO_XU_LY',
      })

      const now = new Date()
      const mockTx = {
        jobReport: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'rep-1',
            jobId: 'job-1',
            reason: 'LUA_DAO',
            moTa: 'Đòi cọc',
            status: 'DA_XU_LY',
            ketLuan: 'Đã khóa tin',
            createdAt: now,
            handledAt: now,
          }),
        },
      }
      mockTransaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx)
      })

      const res = await xuLyBaoCao('user-admin-1', 'rep-1', 'DA_XU_LY', 'Đã khóa tin')

      expect(res.baoCao.status).toBe('DA_XU_LY')
      expect(res.baoCao.ketLuan).toBe('Đã khóa tin')
      expect(mockCreateNotification).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          userId: 'user-sv-1',
          type: 'BAO_CAO_DA_XU_LY',
          body: 'Đã khóa tin',
          link: '/bao-cao-cua-toi',
        }),
      )
      expect(mockPhatToiPhong).toHaveBeenCalledWith(
        'user:user-sv-1',
        'bao-cao:da-xu-ly',
        expect.objectContaining({ reportId: 'rep-1', status: 'DA_XU_LY' }),
      )
    })

    it('ném lỗi conflict khi báo cáo đã được admin khác xử lý trước đó', async () => {
      mockReportFindUnique.mockResolvedValue({
        reporterUserId: 'user-sv-1',
        jobId: 'job-1',
        status: 'CHO_XU_LY',
      })

      const mockTx = {
        jobReport: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: vi.fn(),
        },
      }
      mockTransaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx)
      })

      await expect(
        xuLyBaoCao('user-admin-1', 'rep-1', 'DA_XU_LY', 'Đã xử lý'),
      ).rejects.toThrow('Báo cáo này đã được xử lý rồi')
    })
  })

  describe('chanKhongPhaiAdmin', () => {
    it('cho phép ADMIN và từ chối các quyền khác', () => {
      expect(() => chanKhongPhaiAdmin('ADMIN')).not.toThrow()
      expect(() => chanKhongPhaiAdmin('STUDENT')).toThrow(
        'Chỉ quản trị viên xem được hàng đợi báo cáo',
      )
      expect(() => chanKhongPhaiAdmin('EMPLOYER')).toThrow(
        'Chỉ quản trị viên xem được hàng đợi báo cáo',
      )
    })
  })
})

describe('Bao cao HTTP routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /api/toi/bao-cao tạo báo cáo thành công với quyền STUDENT', async () => {
    mockJobFindUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Nhân viên quán',
      description: 'Mô tả',
      city: 'HCM',
      district: 'Q1',
      salaryNegotiable: true,
      salaryMin: null,
      salaryMax: null,
      salaryUnit: 'VND_PER_MONTH',
      status: 'OPEN',
      employerProfile: { userId: 'user-ntd-other', companyName: 'Cong ty ABC' },
    })
    mockReportCreate.mockResolvedValue({
      id: 'rep-http-1',
      jobId: 'job-1',
      reason: 'LUA_DAO',
      moTa: 'Bắt đóng tiền đồng phục 500k trước khi nhận việc',
      status: 'CHO_XU_LY',
      ketLuan: null,
      createdAt: new Date(),
      handledAt: null,
    })

    const res = await request(app)
      .post('/api/toi/bao-cao')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        jobId: 'job-1',
        clientReportId: 'client-uuid-1234',
        reason: 'LUA_DAO',
        moTa: 'Bắt đóng tiền đồng phục 500k trước khi nhận việc',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.baoCao.id).toBe('rep-http-1')
  })

  it('GET /api/toi/bao-cao yêu cầu đăng nhập (401)', async () => {
    const res = await request(app).get('/api/toi/bao-cao')
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/bao-cao chặn sinh viên hoặc NTD (403)', async () => {
    const resStudent = await request(app)
      .get('/api/admin/bao-cao')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(resStudent.status).toBe(403)

    const resEmployer = await request(app)
      .get('/api/admin/bao-cao')
      .set('Authorization', `Bearer ${employerToken}`)
    expect(resEmployer.status).toBe(403)
  })

  it('GET /api/admin/bao-cao cho phép ADMIN truy cập (200)', async () => {
    mockReportFindMany.mockResolvedValue([])
    mockReportGroupBy.mockResolvedValue([])

    const res = await request(app)
      .get('/api/admin/bao-cao')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.baoCao).toEqual([])
  })
})
