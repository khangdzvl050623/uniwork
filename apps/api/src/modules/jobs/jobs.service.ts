import type { Prisma } from '@prisma/client'
import type {
  CreateJobData,
  EmployerJobResponse,
  JobShiftItem,
  UpdateJobData,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'

/**
 * Nghiệp vụ tin tuyển dụng.
 *
 * Module này phục vụ BA nhóm người gọi trên cùng một bảng `Job`: nhà tuyển dụng
 * quản lý tin của mình, admin duyệt tin, và trang công khai. Gộp chung một
 * module thay vì tách ba, vì tách ra sẽ phải export qua lại `CHON_JOB` và các
 * kiểu response cho cùng một bảng.
 *
 * Phân biệt quyền nằm ở tầng route (`jobs.routes.ts`), không phải ở đây.
 */

/**
 * Hồ sơ NTD của người đang đăng nhập.
 *
 * Lấy kèm `verifiedAt` chứ không chỉ `id` — khác với `requireEmployerProfileId`
 * bên `profile.service.ts`. Không phải trùng lặp: bước gửi duyệt (T72) cần biết
 * NTD đã được xác minh chưa, và lấy sẵn trong cùng một câu truy vấn rẻ hơn gọi
 * thêm một câu nữa ở đúng chỗ đó.
 */
async function layHoSoNtd(userId: string): Promise<{ id: string; verifiedAt: Date | null }> {
  const profile = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { id: true, verifiedAt: true },
  })
  if (!profile) throw notFound('Không tìm thấy hồ sơ nhà tuyển dụng')
  return profile
}

/** Cột cần cho `EmployerJobResponse`. Dùng chung cho tạo, đọc và sửa. */
const CHON_JOB = {
  id: true,
  title: true,
  description: true,
  requirements: true,
  benefits: true,
  city: true,
  district: true,
  quantity: true,
  salaryNegotiable: true,
  salaryMin: true,
  salaryMax: true,
  salaryUnit: true,
  scheduleType: true,
  commitmentMonths: true,
  minShiftsPerWeek: true,
  startDate: true,
  endDate: true,
  workDate: true,
  deadline: true,
  status: true,
  rejectionReason: true,
  publishedAt: true,
  closedAt: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  shifts: { select: { dayOfWeek: true, slot: true } },
  skills: { select: { skill: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.JobSelect

type HangJob = Prisma.JobGetPayload<{ select: typeof CHON_JOB }>

function toEmployerJobResponse(job: HangJob): EmployerJobResponse {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    benefits: job.benefits,
    city: job.city,
    district: job.district,
    quantity: job.quantity,
    salaryNegotiable: job.salaryNegotiable,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryUnit: job.salaryUnit,
    scheduleType: job.scheduleType,
    commitmentMonths: job.commitmentMonths,
    minShiftsPerWeek: job.minShiftsPerWeek,
    startDate: job.startDate?.toISOString() ?? null,
    endDate: job.endDate?.toISOString() ?? null,
    workDate: job.workDate?.toISOString() ?? null,
    deadline: job.deadline.toISOString(),
    status: job.status,
    rejectionReason: job.rejectionReason,
    publishedAt: job.publishedAt?.toISOString() ?? null,
    closedAt: job.closedAt?.toISOString() ?? null,
    viewCount: job.viewCount,
    // `shifts` và `skills` là bảng nối — phẳng chúng ra ở đây để phía web không
    // phải biết `job.skills[].skill.name` là gì.
    shifts: job.shifts.map((s) => ({ dayOfWeek: s.dayOfWeek, slot: s.slot })),
    skills: job.skills.map((s) => s.skill),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }
}

/**
 * Lấy một tin VÀ kiểm chủ sở hữu. Trả kèm hồ sơ NTD của người gọi.
 *
 * ---------------------------------------------------------------------------
 * MỌI ENDPOINT ĐỤNG TỚI MỘT TIN CỤ THỂ ĐỀU PHẢI ĐI QUA ĐÂY
 * ---------------------------------------------------------------------------
 * `requireRole('EMPLOYER')` ở tầng route chỉ trả lời "người này có phải nhà
 * tuyển dụng không" — KHÔNG trả lời "tin này có phải của họ không". Thiếu bước
 * thứ hai thì NTD A sửa và xoá được tin của NTD B chỉ bằng cách đổi id trên
 * URL. Đây là lỗ hổng nghiêm trọng nhất có thể có ở module này.
 *
 * Gom vào một hàm thay vì lặp lại bốn lần ở T69–T72: lặp lại là chuyện sớm
 * muộn quên một chỗ, mà chỗ quên đó không có biểu hiện gì cho tới khi bị lợi
 * dụng.
 *
 * Lấy luôn cả tin đầy đủ (`CHON_JOB`) chứ không chỉ `employerProfileId`: cả
 * bốn endpoint đều cần nội dung tin ngay sau đó — sửa cần biết giá trị cũ để so,
 * xoá và gửi duyệt cần biết trạng thái hiện tại. Tách làm hai câu truy vấn chỉ
 * để "kiểm trước, lấy sau" là thêm một vòng tới database mà không được gì.
 *
 * Trả `FORBIDDEN` chứ không phải `NOT_FOUND` theo đúng điều kiện nghiệm thu
 * T69. Đánh đổi có biết: 403 xác nhận id đó tồn tại. Chấp nhận được vì id là
 * `cuid()` — không đoán tuần tự được, nên biết "tồn tại" gần như vô giá trị với
 * người dò.
 */
async function layTinCuaToi(
  userId: string,
  jobId: string,
): Promise<{ job: HangJob; ntd: { id: string; verifiedAt: Date | null } }> {
  const ntd = await layHoSoNtd(userId)

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { ...CHON_JOB, employerProfileId: true },
  })
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng')
  if (job.employerProfileId !== ntd.id) throw forbidden('Tin này không thuộc về bạn')

  return { job, ntd }
}

/**
 * Toàn bộ tin của chính mình, ĐỦ MỌI TRẠNG THÁI.
 *
 * Khác hẳn endpoint công khai (T79) vốn chỉ trả `OPEN`: chủ tin cần thấy cả tin
 * nháp lẫn tin đang chờ duyệt lẫn tin bị từ chối — nếu không thì tin bị từ chối
 * biến mất khỏi màn hình và không ai sửa lại được.
 *
 * Không phân trang, cùng lý do như `listUsers`: một nhà tuyển dụng thực tế có
 * dưới vài chục tin, và `rateLimit` ở bước tạo giữ cho con số đó không phình.
 */
export async function listMyJobs(userId: string): Promise<EmployerJobResponse[]> {
  const ntd = await layHoSoNtd(userId)

  const jobs = await prisma.job.findMany({
    where: { employerProfileId: ntd.id },
    select: CHON_JOB,
    orderBy: { createdAt: 'desc' },
  })

  return jobs.map(toEmployerJobResponse)
}

/** Chi tiết một tin của chính mình. */
export async function getMyJob(userId: string, jobId: string): Promise<EmployerJobResponse> {
  const { job } = await layTinCuaToi(userId, jobId)
  return toEmployerJobResponse(job)
}

/**
 * Sửa các trường này thì tin phải được duyệt lại.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO `description` NẰM TRONG DANH SÁCH
 * ---------------------------------------------------------------------------
 * BA đề xuất ban đầu chỉ bắt duyệt lại khi sửa lương, địa điểm, ca làm — bỏ mô
 * tả ra cho nhẹ tải admin. Mục tiêu đúng, nhưng danh sách đó thiếu đúng chỗ
 * nguy hiểm nhất: tin lừa đảo KHÔNG đổi lương, nó đổi MÔ TẢ. Đăng "Nhân viên
 * văn phòng 30k/giờ" cho qua duyệt, rồi sửa mô tả thành "đóng 500k phí đồng
 * phục trước khi nhận việc". Bỏ `description` ra là mở đúng cánh cửa mà khâu
 * duyệt sinh ra để đóng.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CÓ THÊM `salaryUnit` — điểm bổ sung so với danh sách trong BRD
 * ---------------------------------------------------------------------------
 * BRD liệt kê `salaryMin`/`salaryMax`/`salaryNegotiable` nhưng quên `salaryUnit`.
 * Đây là thiếu sót chứ không phải quyết định: giữ nguyên hai con số mà đổi đơn
 * vị từ `HOUR` sang `MONTH` là biến "25.000–30.000 mỗi giờ" thành "mỗi tháng"
 * — cùng một kiểu đánh tráo mà ba trường kia đang được canh để chặn.
 *
 * `benefits`, `requirements`, `skills` cố ý KHÔNG nằm đây: phần bổ sung chi
 * tiết, rủi ro thấp, bắt duyệt lại chỉ làm nghẽn hàng đợi của admin.
 */
const TRUONG_BAT_DUYET_LAI = [
  'title',
  'description',
  'city',
  'district',
  'quantity',
  'salaryNegotiable',
  'salaryMin',
  'salaryMax',
  'salaryUnit',
] as const

/** So hai tập ca làm bất kể thứ tự — `[T2 tối, T4 tối]` và `[T4 tối, T2 tối]` là một. */
function caLamGiongNhau(cu: { dayOfWeek: number; slot: string }[], moi: JobShiftItem[]): boolean {
  if (cu.length !== moi.length) return false

  const khoa = (s: { dayOfWeek: number; slot: string }) => `${s.dayOfWeek}-${s.slot}`
  const tapCu = new Set(cu.map(khoa))
  return moi.every((s) => tapCu.has(khoa(s)))
}

/** Có trường nhạy cảm nào đổi giá trị không. */
function coDoiTruongNhayCam(cu: HangJob, moi: UpdateJobData): boolean {
  const doiTruongThuong = TRUONG_BAT_DUYET_LAI.some((truong) => {
    // Chuẩn hoá undefined về null: client bỏ trống một ô có thể gửi undefined,
    // trong khi database lưu null. Không chuẩn hoá thì hai giá trị "cùng nghĩa
    // là không có" lại bị coi là khác nhau và bắt duyệt lại oan.
    const giaTriCu = cu[truong] ?? null
    const giaTriMoi = moi[truong] ?? null
    return giaTriCu !== giaTriMoi
  })

  return doiTruongThuong || !caLamGiongNhau(cu.shifts, moi.shifts)
}

/**
 * Sửa một tin. Thay TOÀN BỘ nội dung, kể cả ca làm và kỹ năng.
 *
 * ---------------------------------------------------------------------------
 * TIN ĐÃ `CLOSED` THÌ KHÔNG SỬA ĐƯỢC
 * ---------------------------------------------------------------------------
 * `CLOSED` nghĩa là tin đã kết thúc — tuyển đủ người hoặc hết hạn. Cho sửa rồi
 * đẩy về `PENDING` là hồi sinh một tin đã đóng, trong khi các đơn ứng tuyển cũ
 * vẫn trỏ vào đúng tin đó: ứng viên bị từ chối ở đợt trước bỗng thấy mình đang
 * có đơn ở một tin "đang mở" với nội dung và mức lương khác hẳn thứ họ từng
 * nộp. Muốn tuyển tiếp thì đăng tin mới — hai đợt tách bạch, lịch sử mỗi đợt
 * vẫn đọc được.
 *
 * Không áp dụng cho `DRAFT` và `PENDING`: hai trạng thái đó chưa có ứng viên
 * nào và vốn dĩ đang trong quá trình soạn thảo.
 *
 * ---------------------------------------------------------------------------
 * KHI NÀO QUAY VỀ `PENDING`
 * ---------------------------------------------------------------------------
 * Chỉ khi tin ĐANG `OPEN` và có trường nhạy cảm đổi. Tin `DRAFT` hay `PENDING`
 * thì không có gì để "duyệt lại" — nó vốn chưa công khai.
 *
 * Giữ nguyên `rejectionReason` ở bước này, cố ý: nhà tuyển dụng đang sửa dở
 * theo lý do bị từ chối, xoá nó ngay lúc lưu là lấy mất tờ ghi chú khỏi tay họ
 * giữa chừng. Xoá ở bước gửi duyệt lại (T72) mới đúng lúc.
 */
export async function updateJob(
  userId: string,
  jobId: string,
  input: UpdateJobData,
): Promise<EmployerJobResponse> {
  const { job: cu } = await layTinCuaToi(userId, jobId)

  if (cu.status === 'CLOSED') {
    throw conflict(
      'Tin đã đóng thì không sửa được nữa. Hãy đăng một tin mới nếu muốn tuyển tiếp.',
    )
  }

  await kiemSkillIds(input.skillIds)

  const quayVePending = cu.status === 'OPEN' && coDoiTruongNhayCam(cu, input)

  const job = await prisma.job.update({
    where: { id: jobId },
    data: {
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      benefits: input.benefits,

      city: input.city,
      district: input.district,
      quantity: input.quantity,

      salaryNegotiable: input.salaryNegotiable,
      salaryMin: input.salaryNegotiable ? null : (input.salaryMin ?? null),
      salaryMax: input.salaryNegotiable ? null : (input.salaryMax ?? null),
      salaryUnit: input.salaryUnit,

      scheduleType: input.scheduleType,
      commitmentMonths: input.commitmentMonths ?? null,
      minShiftsPerWeek: input.minShiftsPerWeek ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      workDate: input.workDate ?? null,

      deadline: input.deadline,

      // `status` chỉ xuất hiện trong `data` khi thật sự cần đổi. Ghi
      // `status: cu.status` cũng chạy, nhưng khi đó không đọc được từ code là
      // "trường hợp nào thì đổi".
      ...(quayVePending ? { status: 'PENDING' as const } : {}),

      /*
       * Xoá sạch rồi ghi lại, không cố tính phần thêm/bớt.
       *
       * `deleteMany` + `create` lồng trong cùng một `update` được Prisma bọc
       * chung một transaction, nên không có khoảnh khắc nào tin tồn tại mà
       * không có ca làm. Tính diff thủ công vừa dài vừa dễ sai, mà số hàng ở
       * đây tối đa là 21 ca và 15 kỹ năng.
       */
      shifts: {
        deleteMany: {},
        create: input.shifts.map((s) => ({ dayOfWeek: s.dayOfWeek, slot: s.slot })),
      },
      skills: {
        deleteMany: {},
        create: input.skillIds.map((skillId) => ({ skillId })),
      },
    },
    select: CHON_JOB,
  })

  return toEmployerJobResponse(job)
}

/**
 * Xoá hẳn một tin. CHỈ khi tin chưa từng công khai.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO `OPEN` VÀ `CLOSED` KHÔNG XOÁ ĐƯỢC
 * ---------------------------------------------------------------------------
 * `Application.job` khai `onDelete: Cascade` — xoá một tin là xoá theo MỌI đơn
 * ứng tuyển của tin đó. Sinh viên đã nộp CV, đang chờ kết quả, bỗng mất sạch
 * đơn khỏi danh sách "đơn đã nộp": không phải "bị từ chối", mà là biến mất
 * không dấu vết.
 *
 * BRD Module 3 đã đặt luật cho đúng tình huống này: "Tin bị gỡ sau khi đã ứng
 * tuyển → đơn giữ nguyên, sinh viên vẫn xem được trạng thái". Xoá cứng vi phạm
 * thẳng dòng đó.
 *
 * Muốn gỡ một tin đã duyệt thì dùng `closeJob` bên dưới: tin thành `CLOSED`,
 * rời khỏi trang công khai, nhưng bản ghi và mọi đơn vẫn còn.
 *
 * Luồng ứng tuyển thuộc Sprint 4 nên hiện chưa có đơn nào để mất. Luật vẫn phải
 * đúng ngay từ bây giờ: tới lúc đó endpoint này đã tồn tại và đang dễ dãi, sẽ
 * không ai nhớ quay lại siết.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO `PENDING` LẠI XOÁ ĐƯỢC
 * ---------------------------------------------------------------------------
 * Tin `PENDING` chưa từng hiện công khai nên chưa thể có đơn nào. Bắt nhà tuyển
 * dụng rút về `DRAFT` rồi mới cho xoá là thêm một bước mà không bảo vệ được gì
 * — đúng nguyên tắc dùng xuyên suốt schema này: chỉ cấm cái mâu thuẫn, không
 * cấm cái chưa gây hại.
 *
 * Đổi lại admin có thể mất một mục đang xem dở trong hàng đợi. Endpoint duyệt
 * của admin (T78) phải trả 404 rõ ràng cho trường hợp đó, và nó được lưới an
 * toàn ở `error-handler.ts` bảo vệ sẵn.
 */
export async function deleteJob(userId: string, jobId: string): Promise<{ id: string }> {
  const { job } = await layTinCuaToi(userId, jobId)

  if (job.status === 'OPEN' || job.status === 'CLOSED') {
    throw conflict(
      job.status === 'OPEN'
        ? 'Tin đang hiển thị công khai thì không xoá được. Hãy đóng tin nếu muốn gỡ xuống.'
        : 'Tin đã đóng thì không xoá được — xoá sẽ mất luôn lịch sử đơn ứng tuyển của đợt tuyển đó.',
    )
  }

  await prisma.job.delete({ where: { id: jobId } })
  return { id: jobId }
}

/**
 * Đóng một tin đang mở: `OPEN` → `CLOSED`.
 *
 * Đây là đường ĐÚNG để gỡ một tin đã duyệt xuống — thay cho việc xoá. Tin rời
 * khỏi trang công khai ngay (endpoint công khai ở T79 chỉ lọc `OPEN`), nhưng
 * bản ghi và mọi đơn ứng tuyển vẫn nguyên vẹn.
 *
 * Không có đường ngược lại. Mở lại một tin đã đóng đưa hệ thống về đúng chỗ khó
 * xử đã bàn ở T70: đơn của đợt cũ nằm lẫn với đợt mới. Muốn tuyển tiếp thì đăng
 * tin mới.
 *
 * Chỉ nhận `OPEN`. `DRAFT`/`PENDING` chưa từng công khai nên không có gì để
 * đóng — muốn bỏ thì xoá hẳn.
 */
export async function closeJob(userId: string, jobId: string): Promise<EmployerJobResponse> {
  const { job } = await layTinCuaToi(userId, jobId)

  if (job.status !== 'OPEN') {
    throw conflict(
      job.status === 'CLOSED'
        ? 'Tin này đã đóng rồi'
        : 'Chỉ đóng được tin đang hiển thị công khai. Tin chưa duyệt thì xoá hẳn.',
    )
  }

  const daDong = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'CLOSED', closedAt: new Date() },
    select: CHON_JOB,
  })

  return toEmployerJobResponse(daDong)
}

/**
 * Gửi tin đi duyệt: `DRAFT` → `PENDING`.
 *
 * ---------------------------------------------------------------------------
 * NHÀ TUYỂN DỤNG PHẢI ĐƯỢC XÁC MINH
 * ---------------------------------------------------------------------------
 * Đây là chỗ `verifiedAt` thực sự có hiệu lực. BRD chốt: "lưu nháp được, gửi
 * duyệt thì 403". Soạn thảo thì mở, nhưng đưa tin vào hàng đợi để lên trang
 * công khai thì phải chứng minh được mình là đơn vị tuyển dụng có thật.
 *
 * Chặn ở bước này chứ không ở bước tạo, vì như vậy NTD có việc để làm trong lúc
 * chờ admin duyệt giấy tờ — soạn sẵn tin, gửi ngay khi được xác minh.
 *
 * ---------------------------------------------------------------------------
 * KIỂM LẠI HẠN NHẬN HỒ SƠ Ở ĐÂY, DÙ ZOD ĐÃ KIỂM LÚC TẠO
 * ---------------------------------------------------------------------------
 * Không thừa. Zod kiểm `deadline` tại thời điểm TẠO/SỬA, còn gửi duyệt là một
 * hành động riêng không mang theo thân request nào để mà kiểm. Một tin nháp
 * soạn hai tháng trước với hạn "30 ngày nữa" thì hôm nay hạn đã qua — gửi đi,
 * admin duyệt, và tin lên trang công khai với hạn nộp nằm ở quá khứ.
 *
 * Đây đúng là loại lỗi chỉ lộ ra sau vài tuần, tức là gần như chắc chắn lọt qua
 * lúc thử nghiệm.
 */
export async function submitJob(userId: string, jobId: string): Promise<EmployerJobResponse> {
  const { job, ntd } = await layTinCuaToi(userId, jobId)

  if (!ntd.verifiedAt) {
    throw forbidden(
      'Hồ sơ doanh nghiệp chưa được xác minh nên chưa gửi tin đi duyệt được. ' +
        'Hãy nộp đủ giấy tờ và chờ quản trị viên duyệt.',
    )
  }

  if (job.status !== 'DRAFT') {
    // `job.status` đã được thu hẹp bỏ 'DRAFT' nhờ guard ngay trên, nên bảng này
    // chỉ còn ba nhánh — thêm 'DRAFT' vào là TypeScript báo lỗi.
    const lyDo: Record<typeof job.status, string> = {
      PENDING: 'Tin này đang chờ duyệt rồi',
      OPEN: 'Tin này đã được duyệt và đang hiển thị công khai',
      CLOSED: 'Tin đã đóng thì không gửi duyệt lại được. Hãy đăng một tin mới.',
    }
    throw conflict(lyDo[job.status])
  }

  if (job.deadline.getTime() < Date.now()) {
    throw conflict('Hạn nhận hồ sơ của tin này đã qua. Hãy sửa lại hạn trước khi gửi duyệt.')
  }

  const daGui = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      /*
       * Xoá lý do từ chối ở ĐÂY, không phải lúc sửa tin.
       *
       * Trong lúc sửa, nhà tuyển dụng vẫn cần đọc lý do để biết phải sửa gì —
       * xoá lúc lưu là lấy mất tờ ghi chú khỏi tay họ giữa chừng. Tới khi họ
       * chủ động gửi lại thì lý do cũ mới hết vai trò, và giữ nó lại chỉ khiến
       * màn hình hiện "đã bị từ chối" cho một tin đang chờ duyệt.
       */
      rejectionReason: null,
    },
    select: CHON_JOB,
  })

  return toEmployerJobResponse(daGui)
}

/**
 * Kiểm mọi `skillId` gửi lên đều có thật.
 *
 * Không có bước này thì một id sai sẽ vỡ ở tầng khoá ngoại của Postgres, và
 * người dùng nhận về lỗi 500 với câu chữ về tên constraint. Đếm một câu rồi so
 * số lượng là đủ — không cần lấy về cả danh sách.
 */
async function kiemSkillIds(skillIds: string[]): Promise<void> {
  if (skillIds.length === 0) return

  const coThat = await prisma.skill.count({ where: { id: { in: skillIds } } })
  if (coThat !== skillIds.length) {
    throw badRequest('Có kỹ năng không tồn tại trong danh mục', {
      skillIds: ['Danh sách kỹ năng chứa mục không hợp lệ'],
    })
  }
}

/**
 * Tạo tin mới — LUÔN ở trạng thái `DRAFT`.
 *
 * `status` không nhận từ client và cũng không có trong `CreateJobInput`: cho
 * phép client tự đặt `OPEN` là bỏ qua toàn bộ khâu duyệt, tức là mở đúng cánh
 * cửa mà khâu duyệt sinh ra để đóng. Muốn công khai thì đi qua gửi duyệt (T72)
 * rồi admin duyệt (T78).
 *
 * Tin, ca làm và kỹ năng ghi trong MỘT transaction. Prisma tạo bản ghi con lồng
 * trong `create` đã tự bọc transaction, nên không cần `$transaction` tường minh
 * — nửa chừng lỗi thì không còn lại tin nào không có ca làm.
 *
 * Nhà tuyển dụng CHƯA xác minh vẫn tạo được tin nháp. Đúng theo BRD: "lưu nháp
 * được, gửi duyệt thì 403". Chặn ngay từ bước soạn thảo chỉ khiến họ không có
 * gì để làm trong lúc chờ admin duyệt giấy tờ.
 */
export async function createJob(userId: string, input: CreateJobData): Promise<EmployerJobResponse> {
  const ntd = await layHoSoNtd(userId)
  await kiemSkillIds(input.skillIds)

  const job = await prisma.job.create({
    data: {
      employerProfileId: ntd.id,

      title: input.title,
      description: input.description,
      requirements: input.requirements,
      benefits: input.benefits,

      city: input.city,
      district: input.district,
      quantity: input.quantity,

      salaryNegotiable: input.salaryNegotiable,
      // Ép null khi thoả thuận thay vì tin vào client.
      //
      // Zod đã chặn "thoả thuận mà vẫn gửi số", nhưng nó chỉ chặn `!= null`.
      // Ghi tường minh ở đây để dù input có lọt giá trị nào đi nữa thì cột vẫn
      // đúng với CHECK `jobs_salary_check`.
      salaryMin: input.salaryNegotiable ? null : (input.salaryMin ?? null),
      salaryMax: input.salaryNegotiable ? null : (input.salaryMax ?? null),
      salaryUnit: input.salaryUnit,

      scheduleType: input.scheduleType,
      commitmentMonths: input.commitmentMonths ?? null,
      minShiftsPerWeek: input.minShiftsPerWeek ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      workDate: input.workDate ?? null,

      deadline: input.deadline,

      shifts: { create: input.shifts.map((s) => ({ dayOfWeek: s.dayOfWeek, slot: s.slot })) },
      skills: { create: input.skillIds.map((skillId) => ({ skillId })) },
    },
    select: CHON_JOB,
  })

  return toEmployerJobResponse(job)
}
