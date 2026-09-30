import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  baoCaoCuaToi,
  guiBaoCao,
  hangDoiBaoCao,
  xuLyBaoCao,
  type AnhChupTin,
} from '../src/modules/bao-cao/bao-cao.service.js'

/**
 * Báo cáo tin tuyển dụng — PostgreSQL thật.
 *
 * Ba thứ chỉ database mới kiểm được:
 *   1. `@@unique(reporterUserId, clientReportId)` — gửi lại trả bản cũ
 *   2. chỉ mục MỘT PHẦN `job_reports_mot_bao_cao_mo` — báo trùng khi đang mở
 *   3. `updateMany` có điều kiện — hai admin cùng xử một báo cáo
 *
 * Chạy: pnpm --filter @uniwork/api test:db
 */

const prisma = new PrismaClient()

let sv: string
let ntdUserId: string
let adminA: string
let adminB: string
let jobId: string
let jobKhacId: string

async function taoUser(email: string, role: 'STUDENT' | 'EMPLOYER' | 'ADMIN') {
  const u = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role, passwordHash: null },
    select: { id: true },
  })
  return u.id
}

async function taoTin(employerProfileId: string, title: string, moTa: string) {
  const cu = await prisma.job.findFirst({
    where: { employerProfileId, title },
    select: { id: true },
  })
  if (cu) {
    await prisma.job.update({ where: { id: cu.id }, data: { description: moTa, status: 'OPEN' } })
    return cu.id
  }
  const j = await prisma.job.create({
    data: {
      employerProfileId,
      title,
      description: moTa,
      city: 'Hà Nội',
      district: 'Cầu Giấy',
      salaryUnit: 'HOUR',
      salaryNegotiable: true,
      scheduleType: 'RECURRING',
      deadline: new Date(Date.now() + 30 * 86_400_000),
      status: 'OPEN',
      publishedAt: new Date(),
    },
    select: { id: true },
  })
  return j.id
}

async function dungDuLieu() {
  sv = await taoUser('bao-cao-sv@test.local', 'STUDENT')
  ntdUserId = await taoUser('bao-cao-ntd@test.local', 'EMPLOYER')
  adminA = await taoUser('bao-cao-admin-a@test.local', 'ADMIN')
  adminB = await taoUser('bao-cao-admin-b@test.local', 'ADMIN')

  const hs = await prisma.employerProfile.upsert({
    where: { userId: ntdUserId },
    update: {},
    create: { userId: ntdUserId, companyName: 'Quán Bị Báo' },
    select: { id: true },
  })

  jobId = await taoTin(hs.id, 'Tin bị báo cáo', 'Nộp trước 500k tiền cọc rồi đi làm')
  jobKhacId = await taoTin(hs.id, 'Tin khác', 'bình thường')

  await prisma.jobReport.deleteMany({ where: { reporterUserId: { in: [sv, ntdUserId] } } })
  await prisma.notification.deleteMany({ where: { userId: sv } })
}

const gui = (clientReportId: string, job = jobId) =>
  guiBaoCao(sv, {
    jobId: job,
    clientReportId,
    reason: 'LUA_DAO',
    moTa: 'Quán nhắn Zalo bảo chuyển khoản 500k tiền cọc trước khi đi làm',
  })

beforeEach(dungDuLieu)

afterAll(async () => {
  await prisma.jobReport.deleteMany({ where: { reporterUserId: sv } })
  await prisma.$disconnect()
})

/* ===================================================================== */

describe('gửi báo cáo', () => {
  it('ghi báo cáo ở trạng thái chờ xử lý', async () => {
    const kq = await gui('br-1')
    expect(kq.daCo).toBe(false)
    expect(kq.baoCao).toMatchObject({ jobId, reason: 'LUA_DAO', status: 'CHO_XU_LY' })
  })

  /*
   * ---------------------------------------------------------------------
   * ẢNH CHỤP — CA QUAN TRỌNG NHẤT FILE NÀY
   * ---------------------------------------------------------------------
   * Nhà tuyển dụng sửa được tin sau khi bị báo. Xoá câu đòi tiền cọc đi là
   * admin mở ra thấy một tin sạch sẽ, và người báo cáo là bên trông như đang
   * nói dối. Không chụp lại thì mọi báo cáo về NỘI DUNG đều vô hiệu hoá được
   * bằng một lần bấm Sửa.
   */
  it('giữ nguyên nội dung tin tại thời điểm báo, dù tin bị sửa sau đó', async () => {
    await gui('br-1')
    await prisma.job.update({
      where: { id: jobId },
      data: { description: 'Quán sạch sẽ, không thu phí gì', title: 'Tin đã sửa' },
    })

    const { baoCao } = await hangDoiBaoCao()
    const cua = baoCao.find((b) => b.jobId === jobId)
    const chup = cua?.anhChupTin as AnhChupTin

    expect(chup.description).toContain('500k tiền cọc')
    expect(chup.title).toBe('Tin bị báo cáo')
  })

  /* "Retry phải trả kết quả cũ, không tạo thêm báo cáo hoặc thông báo." */
  it('gửi lại cùng clientReportId trả bản cũ, KHÔNG tạo bản thứ hai', async () => {
    const dau = await gui('br-1')
    const lai = await gui('br-1')

    expect(lai.daCo).toBe(true)
    expect(lai.baoCao.id).toBe(dau.baoCao.id)
    expect(await prisma.jobReport.count({ where: { reporterUserId: sv } })).toBe(1)
  })

  /*
   * Khác hẳn ca trên: id MỚI nhưng cùng tin, khi báo cũ chưa xử xong. Đây là
   * lỗi cần nói, không phải gửi lại.
   */
  it('báo lần hai cho cùng tin khi chưa xử xong thì bị từ chối', async () => {
    await gui('br-1')
    await expect(gui('br-2')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  /* Chỉ mục MỘT PHẦN: xử xong rồi thì báo lại được. */
  it('xử xong rồi thì báo lại tin đó được', async () => {
    const dau = await gui('br-1')
    await xuLyBaoCao(adminA, dau.baoCao.id, 'BAC_BO', 'Chưa đủ căn cứ')

    await expect(gui('br-2')).resolves.toMatchObject({ daCo: false })
  })

  it('tin khác thì không bị chặn', async () => {
    await gui('br-1')
    await expect(gui('br-2', jobKhacId)).resolves.toMatchObject({ daCo: false })
  })

  it('không tự báo cáo tin của chính mình', async () => {
    await expect(
      guiBaoCao(ntdUserId, {
        jobId,
        clientReportId: 'br-tu',
        reason: 'KHAC',
        moTa: 'tôi muốn gỡ tin này đi cho nhanh',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('admin xử lý', () => {
  it('đếm số lượt đang mở của cùng một tin', async () => {
    await gui('br-1')
    await guiBaoCao(ntdUserId === sv ? adminA : adminB, {
      jobId,
      clientReportId: 'br-admin',
      reason: 'SAI_SU_THAT',
      moTa: 'Lương thực tế thấp hơn tin đăng rất nhiều',
    })

    const { baoCao } = await hangDoiBaoCao()
    const cua = baoCao.filter((b) => b.jobId === jobId)
    expect(cua[0]?.soLuotDangMo).toBe(2)

    await prisma.jobReport.deleteMany({ where: { clientReportId: 'br-admin' } })
  })

  it('kết luận rỗng bị từ chối khi đóng báo cáo', async () => {
    const dau = await gui('br-1')
    await expect(xuLyBaoCao(adminA, dau.baoCao.id, 'DA_XU_LY', '   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('người gửi đọc được kết luận', async () => {
    const dau = await gui('br-1')
    await xuLyBaoCao(adminA, dau.baoCao.id, 'DA_XU_LY', 'Đã gỡ tin và cảnh cáo doanh nghiệp')

    const { baoCao } = await baoCaoCuaToi(sv)
    expect(baoCao[0]).toMatchObject({
      status: 'DA_XU_LY',
      ketLuan: 'Đã gỡ tin và cảnh cáo doanh nghiệp',
    })
  })

  it('người gửi nhận thông báo khi có kết luận', async () => {
    const dau = await gui('br-1')
    await xuLyBaoCao(adminA, dau.baoCao.id, 'BAC_BO', 'Không đủ căn cứ')

    const tb = await prisma.notification.findFirst({
      where: { userId: sv, type: 'BAO_CAO_DA_XU_LY' },
    })
    expect(tb).not.toBeNull()
  })

  /* DANG_XEM là trạng thái nội bộ — bắn thông báo mỗi lần admin mở ra là làm phiền. */
  it('chuyển sang DANG_XEM thì KHÔNG báo cho người gửi', async () => {
    const dau = await gui('br-1')
    await xuLyBaoCao(adminA, dau.baoCao.id, 'DANG_XEM', '')

    expect(await prisma.notification.count({ where: { userId: sv } })).toBe(0)
  })

  /*
   * Hai admin cùng mở một báo cáo rồi cùng bấm. Không có `updateMany` có điều
   * kiện thì người thứ hai ghi đè kết luận của người thứ nhất, và người báo
   * cáo nhận hai thông báo trái ngược nhau.
   */
  it('hai admin cùng xử: đúng MỘT người thành công', async () => {
    const dau = await gui('br-1')
    const kq = await Promise.allSettled([
      xuLyBaoCao(adminA, dau.baoCao.id, 'DA_XU_LY', 'Đã gỡ tin'),
      xuLyBaoCao(adminB, dau.baoCao.id, 'BAC_BO', 'Không đủ căn cứ'),
    ])

    expect(kq.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const hong = kq.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(hong.reason).toMatchObject({ code: 'CONFLICT' })

    /* Và chỉ MỘT thông báo tới người gửi, không phải hai câu trái ngược. */
    expect(await prisma.notification.count({ where: { userId: sv } })).toBe(1)
  })
})
