import { PrismaClient, SalaryUnit, ScheduleType, TimeSlot } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Kiểm bốn CHECK constraint và các ràng buộc toàn vẹn của database.
 *
 * VÌ SAO PHẢI CÓ TEST NÀY, chứ không đợi Sprint 1:
 *
 * Bốn CHECK constraint được viết TAY trong file migration. Prisma không hề biết
 * chúng tồn tại — chúng không nằm trong `schema.prisma`, nên `prisma migrate
 * diff` không thấy, `prisma validate` không kiểm, và `prisma db push` bỏ qua
 * migration hoàn toàn nên dựng ra một database KHÔNG có ràng buộc nào.
 *
 * Nghĩa là chúng có thể biến mất mà không một công cụ nào kêu lên. Tin sẽ lặng
 * lẽ lưu được với `scheduleType = SEASONAL` mà không có ngày kết thúc, và người
 * phát hiện ra sẽ là ai đó ở Sprint 4 đang tự hỏi vì sao giao diện hiện ô trống.
 *
 * File này là thứ duy nhất kêu lên khi điều đó xảy ra.
 *
 * Hầu hết test dưới đây KHÔNG ghi gì vào database — chúng thử một thao tác và
 * mong nó bị từ chối. Vài test cần dữ liệu thật thì tự dọn ở `afterAll`.
 */

const prisma = new PrismaClient()

/** Mọi bản ghi test tạo ra đều mang tiền tố này để dọn cho sạch. */
const TIEN_TO = 'test-rangbuoc-'

let employerProfileId: string

beforeAll(async () => {
  const employer = await prisma.employerProfile.findFirst()

  if (!employer) {
    throw new Error(
      'Database chưa có dữ liệu mẫu. Chạy `pnpm db:up && pnpm db:seed` trước khi chạy test:db.',
    )
  }

  employerProfileId = employer.id
})

afterAll(async () => {
  await prisma.job.deleteMany({ where: { id: { startsWith: TIEN_TO } } })
  await prisma.user.deleteMany({ where: { email: { startsWith: TIEN_TO } } })
  await prisma.$disconnect()
})

/** Tin hợp lệ tối thiểu — mỗi test chỉ đổi đúng thứ nó muốn làm sai. */
function tinHopLe(sua: Record<string, unknown> = {}) {
  return {
    id: `${TIEN_TO}${Math.random().toString(36).slice(2)}`,
    employerProfileId,
    title: 'Tin thử ràng buộc',
    description: 'Không hiển thị ở đâu cả, chỉ dùng để thử database.',
    city: 'TP.HCM',
    district: 'Quận 1',
    salaryNegotiable: false,
    salaryMin: 25_000,
    salaryMax: 30_000,
    salaryUnit: SalaryUnit.HOUR,
    scheduleType: ScheduleType.RECURRING,
    deadline: new Date('2027-01-01'),
    ...sua,
  }
}

describe('jobs_schedule_fields_check — ba loại thời gian không được lẫn cột', () => {
  it('RECURRING mang endDate thì bị từ chối', async () => {
    // Việc định kỳ theo định nghĩa là không có điểm kết thúc xác định. Có
    // endDate nghĩa là nó thực ra là việc thời vụ bị chọn nhầm loại.
    await expect(
      prisma.job.create({ data: tinHopLe({ endDate: new Date('2027-02-01') }) }),
    ).rejects.toThrow(/jobs_schedule_fields_check/)
  })

  it('SEASONAL thiếu endDate thì bị từ chối', async () => {
    await expect(
      prisma.job.create({
        data: tinHopLe({
          scheduleType: ScheduleType.SEASONAL,
          startDate: new Date('2026-12-15'),
        }),
      }),
    ).rejects.toThrow(/jobs_schedule_fields_check/)
  })

  it('SEASONAL có endDate trước startDate thì bị từ chối', async () => {
    await expect(
      prisma.job.create({
        data: tinHopLe({
          scheduleType: ScheduleType.SEASONAL,
          startDate: new Date('2027-01-20'),
          endDate: new Date('2026-12-15'),
        }),
      }),
    ).rejects.toThrow(/jobs_schedule_fields_check/)
  })

  it('SEASONAL mang commitmentMonths thì bị từ chối', async () => {
    // Đây chính là tình huống BA nêu: startDate/endDate gói gọn 10 ngày Tết mà
    // lại kèm "cam kết 1 tháng" — hai trường nói hai chuyện khác nhau.
    await expect(
      prisma.job.create({
        data: tinHopLe({
          scheduleType: ScheduleType.SEASONAL,
          startDate: new Date('2026-12-15'),
          endDate: new Date('2027-01-20'),
          commitmentMonths: 1,
        }),
      }),
    ).rejects.toThrow(/jobs_schedule_fields_check/)
  })

  it('ONE_TIME mang minShiftsPerWeek thì bị từ chối', async () => {
    // Việc diễn ra đúng một buổi thì "số ca tối thiểu mỗi tuần" vô nghĩa.
    await expect(
      prisma.job.create({
        data: tinHopLe({
          scheduleType: ScheduleType.ONE_TIME,
          workDate: new Date('2026-09-05'),
          minShiftsPerWeek: 2,
        }),
      }),
    ).rejects.toThrow(/jobs_schedule_fields_check/)
  })

  it('ONE_TIME thiếu workDate thì bị từ chối', async () => {
    await expect(
      prisma.job.create({ data: tinHopLe({ scheduleType: ScheduleType.ONE_TIME }) }),
    ).rejects.toThrow(/jobs_schedule_fields_check/)
  })

  it('RECURRING không khai commitmentMonths vẫn LƯU ĐƯỢC', async () => {
    // Test này canh chiều ngược lại: ràng buộc không được siết quá tay.
    //
    // Có việc định kỳ không đòi cam kết gì cả — "rảnh buổi nào làm buổi đó".
    // Ép bắt buộc thì nhà tuyển dụng lại điền số bừa, đúng thứ ta đang tránh ở
    // mục lương. Nguyên tắc: chỉ cấm cái mâu thuẫn, không cấm cái chưa khai.
    const job = await prisma.job.create({ data: tinHopLe({ commitmentMonths: null }) })

    expect(job.commitmentMonths).toBeNull()
    expect(job.scheduleType).toBe(ScheduleType.RECURRING)
  })
})

describe('jobs_salary_check — lương thoả thuận và lương có số loại trừ nhau', () => {
  it('thoả thuận nhưng vẫn ghi số thì bị từ chối', async () => {
    // Trạng thái nửa vời này chính là thứ làm bộ lọc lương trả về kết quả không
    // ai giải thích được.
    await expect(
      prisma.job.create({ data: tinHopLe({ salaryNegotiable: true }) }),
    ).rejects.toThrow(/jobs_salary_check/)
  })

  it('không thoả thuận nhưng thiếu số thì bị từ chối', async () => {
    await expect(
      prisma.job.create({ data: tinHopLe({ salaryMin: null, salaryMax: null }) }),
    ).rejects.toThrow(/jobs_salary_check/)
  })

  it('lương tối đa nhỏ hơn lương tối thiểu thì bị từ chối', async () => {
    await expect(
      prisma.job.create({ data: tinHopLe({ salaryMin: 40_000, salaryMax: 20_000 }) }),
    ).rejects.toThrow(/jobs_salary_check/)
  })

  it('thoả thuận và bỏ trống cả hai số thì LƯU ĐƯỢC', async () => {
    const job = await prisma.job.create({
      data: tinHopLe({ salaryNegotiable: true, salaryMin: null, salaryMax: null }),
    })

    expect(job.salaryNegotiable).toBe(true)
    // salaryUnit vẫn bắt buộc: "thoả thuận theo giờ" khác "thoả thuận theo tháng".
    expect(job.salaryUnit).toBe(SalaryUnit.HOUR)
  })
})

describe('dayOfWeek phải nằm trong 0..6', () => {
  it('ca làm với dayOfWeek = 7 bị từ chối', async () => {
    // Giá trị 7 không làm gãy gì ngay — nó chỉ lặng lẽ không khớp ô nào trong
    // lưới, và tin biến mất khỏi bộ lọc mà không ai hiểu vì sao.
    await expect(
      prisma.jobShift.create({
        data: { jobId: 'demo-job-cafe-toi', dayOfWeek: 7, slot: TimeSlot.MORNING },
      }),
    ).rejects.toThrow(/job_shifts_day_of_week_check/)
  })

  it('lịch rảnh với dayOfWeek âm bị từ chối', async () => {
    const student = await prisma.studentProfile.findFirstOrThrow()

    await expect(
      prisma.availability.create({
        data: { studentProfileId: student.id, dayOfWeek: -1, slot: TimeSlot.MORNING },
      }),
    ).rejects.toThrow(/availabilities_day_of_week_check/)
  })
})

describe('toàn vẹn tham chiếu', () => {
  it('không xoá được kỹ năng đang có tin yêu cầu', async () => {
    // onDelete: Restrict. Xoá một kỹ năng đang được tin dùng sẽ lặng lẽ đổi điều
    // kiện tuyển sau lưng nhà tuyển dụng. Danh mục này là danh mục được chăm
    // sóc — admin nên gộp hoặc đổi tên, không nên xoá.
    await expect(prisma.skill.delete({ where: { slug: 'giao-tiep' } })).rejects.toThrow()
  })

  it('xoá tài khoản thì hồ sơ và lịch rảnh biến mất theo', async () => {
    // onDelete: Cascade. Kiểm bằng tài khoản dùng một lần chứ không đụng dữ liệu
    // mẫu — test không được để lại hố cho lần chạy sau.
    const user = await prisma.user.create({
      data: {
        email: `${TIEN_TO}cascade@uniwork.dev`,
        passwordHash: 'khong-dung-de-dang-nhap',
        role: 'STUDENT',
        studentProfile: {
          create: {
            fullName: 'Tài khoản thử cascade',
            availabilities: { create: { dayOfWeek: 1, slot: TimeSlot.MORNING } },
          },
        },
      },
      include: { studentProfile: true },
    })

    const profileId = user.studentProfile!.id
    expect(await prisma.availability.count({ where: { studentProfileId: profileId } })).toBe(1)

    await prisma.user.delete({ where: { id: user.id } })

    expect(await prisma.studentProfile.findUnique({ where: { id: profileId } })).toBeNull()
    expect(await prisma.availability.count({ where: { studentProfileId: profileId } })).toBe(0)
  })
})

describe('ràng buộc unique', () => {
  it('không ứng tuyển hai lần cùng một tin', async () => {
    // Kiểm ở tầng service cũng cần, nhưng hai request bấm cùng lúc thì chỉ ràng
    // buộc này chặn được.
    const don = await prisma.application.findFirstOrThrow()

    await expect(
      prisma.application.create({
        data: { jobId: don.jobId, studentProfileId: don.studentProfileId },
      }),
    ).rejects.toThrow()
  })

  it('một danh tính Google không gắn được cho hai tài khoản', async () => {
    // Đây là ràng buộc chặn hai người cùng nhận một tài khoản Google.
    const daCo = await prisma.userAccount.findFirstOrThrow()

    const nguoiKhac = await prisma.user.create({
      data: {
        email: `${TIEN_TO}trung-google@uniwork.dev`,
        role: 'STUDENT',
        // passwordHash để null: tài khoản chỉ đăng nhập bằng Google.
      },
    })

    await expect(
      prisma.userAccount.create({
        data: {
          userId: nguoiKhac.id,
          provider: daCo.provider,
          providerAccountId: daCo.providerAccountId,
        },
      }),
    ).rejects.toThrow()
  })
})
