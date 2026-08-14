/**
 * Dữ liệu mẫu cho môi trường phát triển.
 *
 * Chạy: `pnpm db:seed` (trong apps/api)
 *
 * File này CHẠY LẠI ĐƯỢC NHIỀU LẦN mà không hỏng. Mọi thao tác đều dùng
 * `upsert` thay vì `create`, nên chạy lần thứ hai chỉ cập nhật chứ không ném
 * lỗi trùng khoá. Điều này quan trọng hơn vẻ ngoài của nó: seed mà chạy một
 * lần là chết sẽ khiến cả nhóm ngại chạy, rồi mỗi người ôm một bộ dữ liệu khác
 * nhau và bắt đầu cãi nhau xem lỗi là do code hay do dữ liệu.
 */

import { PrismaClient, Role } from '@prisma/client'
import { hash } from '@node-rs/argon2'

const prisma = new PrismaClient()

/**
 * Mật khẩu chung cho cả ba tài khoản demo.
 *
 * Để lộ thiên ở đây là CỐ Ý — đây là dữ liệu dev, cả nhóm cần đăng nhập thử
 * được. Seed không bao giờ chạy trên production; chốt chặn nằm ở cuối file.
 */
const DEMO_PASSWORD = 'Uniwork@123'

/**
 * Tham số Argon2id, dùng chung với luồng đăng ký thật ở Sprint 1.
 *
 * Ba con số này quyết định băm một mật khẩu tốn bao nhiêu tài nguyên. Đặt cao
 * thì kẻ trộm được database cũng rất khó dò ngược, nhưng server cũng tốn đúng
 * ngần ấy cho mỗi lần đăng nhập. Mức dưới đây là khuyến nghị của OWASP và vừa
 * sức instance 512MB của Render — đẩy memoryCost lên cao hơn sẽ ăn hết RAM khi
 * có vài người đăng nhập cùng lúc.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
}

/**
 * Mười kỹ năng phổ biến trong việc làm thêm của sinh viên Việt Nam.
 *
 * Danh mục cố định do admin quản lý, không cho nhập tự do — nếu không sẽ có
 * "Giao tiếp", "giao tiếp" và "Kỹ năng giao tiếp" thành ba tag riêng, làm bộ
 * lọc mất tác dụng.
 */
const SKILLS = [
  { name: 'Giao tiếp', slug: 'giao-tiep' },
  { name: 'Tiếng Anh giao tiếp', slug: 'tieng-anh-giao-tiep' },
  { name: 'Bán hàng', slug: 'ban-hang' },
  { name: 'Chăm sóc khách hàng', slug: 'cham-soc-khach-hang' },
  { name: 'Pha chế', slug: 'pha-che' },
  { name: 'Phục vụ bàn', slug: 'phuc-vu-ban' },
  { name: 'Thu ngân', slug: 'thu-ngan' },
  { name: 'Tin học văn phòng', slug: 'tin-hoc-van-phong' },
  { name: 'Thiết kế đồ hoạ', slug: 'thiet-ke-do-hoa' },
  { name: 'Gia sư', slug: 'gia-su' },
]

async function seedSkills() {
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: { name: skill.name },
      create: skill,
    })
  }

  return SKILLS.length
}

async function seedUsers(passwordHash: string) {
  // Sinh viên — có hồ sơ đầy đủ để màn hình tìm việc ở Sprint 1 có dữ liệu thật
  // mà render, không phải bịa tạm trong component.
  await prisma.user.upsert({
    where: { email: 'sinhvien@uniwork.dev' },
    update: {},
    create: {
      email: 'sinhvien@uniwork.dev',
      passwordHash,
      role: Role.STUDENT,
      emailVerifiedAt: new Date(),
      studentProfile: {
        create: {
          fullName: 'Nguyễn Văn An',
          university: 'Đại học Bách khoa Hà Nội',
          major: 'Công nghệ thông tin',
          year: 3,
          bio: 'Sinh viên năm 3, tìm việc làm thêm buổi tối và cuối tuần.',
          expectedHourlyRate: 35_000,
          availableFrom: new Date('2026-08-01'),
          availableUntil: new Date('2026-12-31'),
        },
      },
    },
  })

  // Nhà tuyển dụng — đã duyệt giấy tờ, vì tin của nhà tuyển dụng chưa duyệt
  // sẽ không hiện công khai, mà seed cần có tin hiện được để thử.
  await prisma.user.upsert({
    where: { email: 'ntd@uniwork.dev' },
    update: {},
    create: {
      email: 'ntd@uniwork.dev',
      passwordHash,
      role: Role.EMPLOYER,
      emailVerifiedAt: new Date(),
      employerProfile: {
        create: {
          companyName: 'Chuỗi cà phê Sương Mai',
          website: 'https://suongmai.example.com',
          address: '12 Tạ Quang Bửu, Hai Bà Trưng, Hà Nội',
          verifiedAt: new Date(),
        },
      },
    },
  })

  // Admin — không có bảng hồ sơ riêng, quyền nằm ở trường `role`.
  await prisma.user.upsert({
    where: { email: 'admin@uniwork.dev' },
    update: {},
    create: {
      email: 'admin@uniwork.dev',
      passwordHash,
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  })

  return 3
}

async function main() {
  // Chốt chặn. Seed ghi tài khoản có mật khẩu ai cũng biết; chạy nhầm lên
  // database thật là tạo sẵn ba cửa hậu. Biến môi trường rất dễ trỏ nhầm khi
  // đang chuyển qua lại giữa local và Neon, nên chặn bằng code thay vì bằng
  // trí nhớ.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed không được phép chạy khi NODE_ENV=production')
  }

  console.log('Đang băm mật khẩu demo...')
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS)

  const skillCount = await seedSkills()
  const userCount = await seedUsers(passwordHash)

  console.log(`Xong: ${userCount} tài khoản, ${skillCount} kỹ năng.`)
  console.log(`Mật khẩu chung cho cả ba tài khoản: ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('Seed thất bại:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
