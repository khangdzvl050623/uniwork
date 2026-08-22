import type { Prisma } from '@prisma/client'
import type { CreateJobData, EmployerJobResponse } from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'

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
