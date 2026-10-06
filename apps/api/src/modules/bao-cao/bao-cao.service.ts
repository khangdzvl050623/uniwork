import type { JobReportReason, JobReportStatus, Prisma, Role } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import { createNotification } from '../notifications/notifications.service.js'
import { phongNguoiDung } from '../chat/chat.access.js'
import { phatToiPhong } from '../chat/phat-su-kien.js'

/**
 * Báo cáo tin tuyển dụng — một quy trình RIÊNG, không đi qua hội thoại.
 *
 * ===========================================================================
 * VÌ SAO KHÔNG DÙNG HANDOFF
 * ===========================================================================
 * Đường handoff duy nhất của trợ lý là chuyển sang CHÍNH nhà tuyển dụng sở hữu
 * tin. Với một tin lừa đảo thì đó đúng là người cần tránh — và tệ hơn, nó để
 * lộ ngay ai vừa tố cáo.
 *
 * Nên báo cáo đi thẳng tới admin, và nhà tuyển dụng KHÔNG BAO GIỜ nhận được
 * danh tính người báo cáo hay nội dung họ viết.
 */

export interface AnhChupTin {
  title: string
  description: string
  city: string
  district: string
  salaryNegotiable: boolean
  salaryMin: number | null
  salaryMax: number | null
  salaryUnit: string
  status: string
  congTy: string
  chupLuc: string
}

export interface BaoCaoItem {
  id: string
  jobId: string
  reason: JobReportReason
  moTa: string
  status: JobReportStatus
  ketLuan: string | null
  createdAt: string
  handledAt: string | null
  anhChupTin?: AnhChupTin
}

function toItem(r: {
  id: string
  jobId: string
  reason: JobReportReason
  moTa: string
  status: JobReportStatus
  ketLuan: string | null
  createdAt: Date
  handledAt: Date | null
  anhChupTin?: unknown
}): BaoCaoItem {
  return {
    id: r.id,
    jobId: r.jobId,
    reason: r.reason,
    moTa: r.moTa,
    status: r.status,
    ketLuan: r.ketLuan,
    createdAt: r.createdAt.toISOString(),
    handledAt: r.handledAt?.toISOString() ?? null,
    anhChupTin: r.anhChupTin as AnhChupTin | undefined,
  }
}

const CHON_ITEM = {
  id: true,
  jobId: true,
  reason: true,
  moTa: true,
  status: true,
  ketLuan: true,
  createdAt: true,
  handledAt: true,
  anhChupTin: true,
} satisfies Prisma.JobReportSelect

/* ============================================================== gửi báo cáo -- */

export interface GuiBaoCaoInput {
  jobId: string
  clientReportId: string
  reason: JobReportReason
  moTa: string
}

export interface GuiBaoCaoKetQua {
  baoCao: BaoCaoItem
  /** Báo cáo này đã gửi rồi, đây là bản cũ. Không tạo thêm, không báo thêm. */
  daCo: boolean
}

/**
 * Ghi một báo cáo.
 *
 * ---------------------------------------------------------------------------
 * ẢNH CHỤP TIN LÀ PHẦN QUAN TRỌNG NHẤT
 * ---------------------------------------------------------------------------
 * Nhà tuyển dụng sửa được tin sau khi bị báo cáo. Xoá câu đòi tiền cọc đi là
 * admin mở ra thấy một tin sạch sẽ và không hiểu vì sao có người báo. Không
 * chụp lại thì MỌI báo cáo về nội dung đều vô hiệu hoá được bằng một lần bấm
 * Sửa — và người báo cáo là bên trông như đang nói dối.
 */
export async function guiBaoCao(userId: string, v: GuiBaoCaoInput): Promise<GuiBaoCaoKetQua> {
  const tin = await prisma.job.findUnique({
    where: { id: v.jobId },
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      district: true,
      salaryNegotiable: true,
      salaryMin: true,
      salaryMax: true,
      salaryUnit: true,
      status: true,
      employerProfile: { select: { userId: true, companyName: true } },
    },
  })
  if (!tin) throw notFound('Không tìm thấy tin tuyển dụng')

  /*
   * Không tự báo cáo tin của chính mình. Không phải để chặn phá hoại — nó vô
   * nghĩa và làm bẩn số đếm: muốn gỡ tin thì bấm Đóng tin, không cần admin.
   */
  if (tin.employerProfile.userId === userId) {
    throw badRequest('Đây là tin của bạn. Dùng nút Đóng tin nếu muốn gỡ.')
  }

  const anhChup: AnhChupTin = {
    title: tin.title,
    description: tin.description,
    city: tin.city,
    district: tin.district,
    salaryNegotiable: tin.salaryNegotiable,
    salaryMin: tin.salaryMin,
    salaryMax: tin.salaryMax,
    salaryUnit: tin.salaryUnit,
    status: tin.status,
    congTy: tin.employerProfile.companyName,
    chupLuc: new Date().toISOString(),
  }

  try {
    const row = await prisma.jobReport.create({
      data: {
        jobId: tin.id,
        reporterUserId: userId,
        clientReportId: v.clientReportId,
        reason: v.reason,
        moTa: v.moTa,
        anhChupTin: anhChup as unknown as Prisma.InputJsonValue,
      },
      select: CHON_ITEM,
    })
    return { baoCao: toItem(row), daCo: false }
  } catch (e) {
    if (!laTrungKhoa(e)) throw e

    /*
     * Hai khoá cùng có thể bắn P2002 ở đây, và chúng nghĩa khác hẳn nhau:
     *
     *   (reporterUserId, clientReportId) — GỬI LẠI. Trả bản cũ, không tạo
     *   thêm, không báo thêm. Đây là yêu cầu \"retry phải trả kết quả cũ\".
     *
     *   chỉ mục một phần (reporterUserId, jobId) WHERE đang mở — BÁO TRÙNG.
     *   Người dùng bấm báo cáo lần hai cho cùng một tin khi lần đầu chưa xử
     *   xong. Đó là lỗi cần nói, không phải gửi lại.
     */
    const cu = await prisma.jobReport.findUnique({
      where: {
        reporterUserId_clientReportId: { reporterUserId: userId, clientReportId: v.clientReportId },
      },
      select: CHON_ITEM,
    })
    if (cu) return { baoCao: toItem(cu), daCo: true }

    throw conflict('Bạn đã báo cáo tin này và admin đang xem. Chờ kết quả nhé.')
  }
}

/* ========================================================= người gửi xem -- */

/** Báo cáo của chính mình, kèm kết luận nếu admin đã xử. */
export async function baoCaoCuaToi(userId: string): Promise<{ baoCao: BaoCaoItem[] }> {
  const ds = await prisma.jobReport.findMany({
    where: { reporterUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: CHON_ITEM,
  })
  return { baoCao: ds.map(toItem) }
}

/* =============================================================== admin -- */

export interface BaoCaoChoAdmin extends BaoCaoItem {
  anhChupTin: AnhChupTin
  /** Số lượt báo cáo ĐANG MỞ của chính tin này. Để xếp ưu tiên, KHÔNG để kết luận. */
  soLuotDangMo: number
  tinConMo: boolean
}

/**
 * Hàng đợi của admin.
 *
 * `soLuotDangMo` là để XẾP ƯU TIÊN, không phải để kết luận. Mười lượt báo cáo
 * có thể là mười người thật, cũng có thể là một nhóm nhắn nhau cùng bấm. Admin
 * vẫn phải đọc ảnh chụp và tự quyết.
 */
export async function hangDoiBaoCao(
  status?: JobReportStatus,
): Promise<{ baoCao: BaoCaoChoAdmin[] }> {
  const ds = await prisma.jobReport.findMany({
    where: status ? { status } : { status: { in: ['CHO_XU_LY', 'DANG_XEM'] } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: {
      ...CHON_ITEM,
      anhChupTin: true,
      job: { select: { status: true } },
    },
  })

  const dem = await prisma.jobReport.groupBy({
    by: ['jobId'],
    where: { jobId: { in: ds.map((r) => r.jobId) }, status: { in: ['CHO_XU_LY', 'DANG_XEM'] } },
    _count: { _all: true },
  })
  const theoTin = new Map(dem.map((d) => [d.jobId, d._count._all]))

  return {
    baoCao: ds.map((r) => ({
      ...toItem(r),
      anhChupTin: r.anhChupTin as unknown as AnhChupTin,
      soLuotDangMo: theoTin.get(r.jobId) ?? 1,
      tinConMo: r.job.status === 'OPEN',
    })),
  }
}

/**
 * Admin ghi kết quả.
 *
 * `updateMany` với trạng thái NGUỒN trong `where`: hai admin cùng mở một báo
 * cáo và cùng bấm thì người thứ hai nhận `count === 0` và một câu rõ ràng, chứ
 * không ghi đè kết luận của người thứ nhất.
 *
 * KHÔNG tự đóng tin ở đây. Đóng tin là một hành động riêng của admin trên
 * chính tin đó — gộp vào là một lần bấm nhầm xoá cả một tin hợp lệ.
 */
export async function xuLyBaoCao(
  adminUserId: string,
  reportId: string,
  status: Extract<JobReportStatus, 'DANG_XEM' | 'DA_XU_LY' | 'BAC_BO'>,
  ketLuan: string,
): Promise<{ baoCao: BaoCaoItem }> {
  const truoc = await prisma.jobReport.findUnique({
    where: { id: reportId },
    select: { reporterUserId: true, jobId: true, status: true },
  })
  if (!truoc) throw notFound('Không tìm thấy báo cáo')

  const ketThuc = status === 'DA_XU_LY' || status === 'BAC_BO'
  if (ketThuc && ketLuan.trim() === '') {
    throw badRequest('Phải ghi kết luận — người báo cáo sẽ đọc câu này')
  }

  const row = await prisma.$transaction(async (tx) => {
    const doi = await tx.jobReport.updateMany({
      where: { id: reportId, status: { in: ['CHO_XU_LY', 'DANG_XEM'] } },
      data: {
        status,
        ketLuan: ketLuan.trim() === '' ? null : ketLuan.trim(),
        handledByUserId: adminUserId,
        handledAt: ketThuc ? new Date() : null,
      },
    })
    if (doi.count === 0) throw conflict('Báo cáo này đã được xử lý rồi')

    /*
     * Chỉ báo cho người gửi khi đã có kết luận. `DANG_XEM` là trạng thái nội
     * bộ của admin — bắn thông báo cho mỗi lần admin mở ra xem là làm phiền.
     */
    if (ketThuc) {
      await createNotification(tx, {
        userId: truoc.reporterUserId,
        type: 'BAO_CAO_DA_XU_LY',
        title: status === 'DA_XU_LY' ? 'Báo cáo của bạn đã được xử lý' : 'Kết quả báo cáo',
        body: ketLuan.trim(),
        link: '/bao-cao-cua-toi',
      })
    }

    return tx.jobReport.findUniqueOrThrow({ where: { id: reportId }, select: CHON_ITEM })
  })

  if (ketThuc) {
    phatToiPhong(phongNguoiDung(truoc.reporterUserId), 'bao-cao:da-xu-ly', {
      reportId,
      status,
    })
  }

  return { baoCao: toItem(row) }
}

/** Chỉ ADMIN mới vào được hai hàm trên — kiểm ở route, nhắc lại ở đây cho rõ. */
export function chanKhongPhaiAdmin(role: Role): void {
  if (role !== 'ADMIN') throw forbidden('Chỉ quản trị viên xem được hàng đợi báo cáo')
}

function laTrungKhoa(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
}
