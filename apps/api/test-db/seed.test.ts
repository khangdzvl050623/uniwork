import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Seed phải chạy lại được nhiều lần mà không sinh bản sao.
 *
 * Đây không phải tính chất "có thì tốt". Lệnh build của Render gọi `prisma db
 * seed` ở MỖI LẦN DEPLOY. Seed mất tính lặp lại thì mỗi lần đẩy code là một lần
 * dữ liệu production nhân đôi, và không ai để ý cho tới lúc trang danh sách hiện
 * cùng một tin bốn lần.
 *
 * Cách kiểm: đếm hàng, chạy seed, đếm lại. Bằng nhau là đạt.
 *
 * Test này CÓ GHI vào database — nó chạy đúng cái seed thật. An toàn, vì đó
 * chính là điều đang được chứng minh. Nhưng cũng vì vậy nó chỉ nên chạy trên
 * database phát triển, không bao giờ trỏ vào Neon.
 */

const prisma = new PrismaClient()
const thuMucApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

afterAll(() => prisma.$disconnect())

async function demHang() {
  const [skills, users, userAccounts, jobs, jobShifts, jobSkills, availabilities, applications] =
    await Promise.all([
      prisma.skill.count(),
      prisma.user.count(),
      prisma.userAccount.count(),
      prisma.job.count(),
      prisma.jobShift.count(),
      prisma.jobSkill.count(),
      prisma.availability.count(),
      prisma.application.count(),
    ])

  return { skills, users, userAccounts, jobs, jobShifts, jobSkills, availabilities, applications }
}

describe('seed', () => {
  it('chạy lần thứ hai không làm số hàng thay đổi', async () => {
    execSync('pnpm exec tsx prisma/seed.ts', { cwd: thuMucApi, stdio: 'pipe' })
    const truoc = await demHang()

    execSync('pnpm exec tsx prisma/seed.ts', { cwd: thuMucApi, stdio: 'pipe' })
    const sau = await demHang()

    expect(sau).toEqual(truoc)
  })

  it('nạp đủ dữ liệu tham chiếu và dữ liệu demo', async () => {
    const dem = await demHang()

    // Kỹ năng là dữ liệu tham chiếu — phải có ở mọi môi trường, kể cả production.
    expect(dem.skills).toBeGreaterThanOrEqual(14)

    // Còn lại là dữ liệu demo, chỉ có khi DATABASE_URL trỏ về máy này.
    expect(dem.jobs).toBeGreaterThanOrEqual(9)
    expect(dem.availabilities).toBeGreaterThan(0)
  })

  it('có đủ ba trạng thái đăng nhập để Sprint 1 thử được', async () => {
    // Thiếu tài khoản không mật khẩu thì cột `passwordHash` nullable chỉ là lý
    // thuyết, và lỗi đầu tiên sẽ xuất hiện lúc đấu Google thật.
    const chiMatKhau = await prisma.user.count({
      where: { passwordHash: { not: null }, linkedAccounts: { none: {} } },
    })
    const caHai = await prisma.user.count({
      where: { passwordHash: { not: null }, linkedAccounts: { some: {} } },
    })
    const chiGoogle = await prisma.user.count({
      where: { passwordHash: null, linkedAccounts: { some: {} } },
    })

    expect(chiMatKhau).toBeGreaterThan(0)
    expect(caHai).toBeGreaterThan(0)
    expect(chiGoogle).toBeGreaterThan(0)
  })

  it('có tin lương thoả thuận và tin lương có số', async () => {
    expect(await prisma.job.count({ where: { salaryNegotiable: true } })).toBeGreaterThan(0)
    expect(await prisma.job.count({ where: { salaryNegotiable: false } })).toBeGreaterThan(0)
  })

  it('hai sinh viên khớp số tin KHÁC NHAU khi lọc theo lịch rảnh', async () => {
    // Tính năng lõi của UniWork. Nếu mọi sinh viên đều khớp cùng số tin thì dữ
    // liệu mẫu vô dụng: bộ lọc chạy hay không chạy đều cho ra kết quả giống hệt,
    // và Sprint 4 sẽ viết truy vấn sai mà không có gì báo.
    const ketQua = await prisma.$queryRaw<{ so: bigint }[]>`
      SELECT count(DISTINCT j.id) AS so
      FROM student_profiles sp
      JOIN availabilities a ON a."studentProfileId" = sp.id
      JOIN job_shifts js    ON js."dayOfWeek" = a."dayOfWeek" AND js.slot = a.slot
      JOIN jobs j           ON j.id = js."jobId" AND j.status = 'OPEN'
      GROUP BY sp.id
    `

    const soTinKhop = ketQua.map((r) => Number(r.so))

    expect(soTinKhop.length).toBeGreaterThanOrEqual(2)
    expect(new Set(soTinKhop).size).toBeGreaterThan(1)
  })
})
