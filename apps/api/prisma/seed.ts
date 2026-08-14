/**
 * Nạp dữ liệu ban đầu cho database.
 *
 * Chạy: `pnpm db:seed` (trong apps/api)
 *
 * File này xử lý HAI LOẠI DỮ LIỆU KHÁC HẲN NHAU, và phân biệt được chúng là
 * điều quan trọng nhất ở đây:
 *
 * 1. DỮ LIỆU THAM CHIẾU — danh mục kỹ năng. Đây là dữ liệu vận hành thật, mọi
 *    môi trường đều cần. Thiếu nó thì bộ lọc tìm việc trống trơn.
 *
 * 2. DỮ LIỆU DEMO — ba tài khoản dùng chung một mật khẩu ai cũng biết. Chỉ
 *    dành cho máy lập trình viên. Đẩy lên production là tạo sẵn ba cửa hậu.
 *
 * Trước đây cả hai nằm chung dưới một chốt chặn `NODE_ENV=production`, nên
 * production không có kỹ năng nào — chặn đúng thứ cần chặn nhưng chặn nhầm cả
 * thứ cần giữ. Giờ tách ra: dữ liệu tham chiếu chạy ở mọi nơi, dữ liệu demo bị
 * bỏ qua khi chạy production.
 *
 * File CHẠY LẠI ĐƯỢC NHIỀU LẦN. Mọi thao tác dùng `upsert` thay vì `create`,
 * nên chạy lần thứ hai chỉ cập nhật chứ không ném lỗi trùng khoá. Nhờ vậy nó
 * nằm được trong lệnh build của Render, chạy lại mỗi lần deploy mà không hỏng.
 */

import { PrismaClient, Role } from '@prisma/client'
import { hash } from '@node-rs/argon2'

const prisma = new PrismaClient()

/**
 * Mật khẩu chung cho cả ba tài khoản demo.
 *
 * Để lộ thiên ở đây là CỐ Ý — đây là dữ liệu dev, cả nhóm cần đăng nhập thử
 * được. Chốt chặn nằm ở `main()`: phần tạo tài khoản bị bỏ qua khi chạy
 * production, nên chuỗi này không bao giờ thành mật khẩu thật của ai.
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

async function seedDemoUsers(passwordHash: string) {
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

/** Máy chủ database được coi là chạy trên máy lập trình viên. */
const HOST_NOI_BO = ['localhost', '127.0.0.1', '::1', 'host.docker.internal']

/**
 * Tài khoản demo chỉ được tạo khi database nằm ngay trên máy này.
 *
 * Canh theo `DATABASE_URL` chứ KHÔNG canh theo `NODE_ENV`, vì mối nguy thật
 * nằm ở chỗ khác với chỗ ta hay nhìn.
 *
 * Kịch bản hỏng điển hình: lập trình viên sửa DATABASE_URL trong .env trỏ sang
 * Neon để xem dữ liệu thật, quên đổi lại, rồi chạy `pnpm db:seed`. Lúc đó
 * NODE_ENV vẫn là 'development' — chốt chặn theo NODE_ENV sẽ cho qua, và ba
 * tài khoản mật khẩu công khai đi thẳng vào database production.
 *
 * Tên máy chủ trong chuỗi kết nối thì không nói dối được: `localhost` là máy
 * mình, `...neon.tech` thì không. Gặp chuỗi không đọc được cũng từ chối luôn —
 * sai thì sai về phía an toàn.
 */
function laDatabaseNoiBo(): boolean {
  const url = process.env.DATABASE_URL
  if (!url) return false

  try {
    return HOST_NOI_BO.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

async function main() {
  const choPhepDemo = laDatabaseNoiBo()

  // Dữ liệu tham chiếu: luôn nạp, mọi môi trường.
  const skillCount = await seedSkills()
  console.log(`Đã nạp ${skillCount} kỹ năng.`)

  // Dữ liệu demo: chỉ ở máy lập trình viên.
  //
  // Chặn bằng code chứ không bằng trí nhớ. Biến DATABASE_URL rất dễ trỏ nhầm
  // khi đang chuyển qua lại giữa Docker local và Neon — chỉ cần một lần chạy
  // nhầm là ba tài khoản mật khẩu công khai nằm sẵn trong database thật.
  //
  // Khi Sprint 1 có màn hình đăng ký, tài khoản để demo trên bản deploy nên
  // được tạo qua chính form đăng ký đó, không phải bằng seed.
  if (!choPhepDemo) {
    console.log('DATABASE_URL không trỏ tới máy này — bỏ qua tài khoản demo.')
    return
  }

  console.log('Đang băm mật khẩu demo...')
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS)
  const userCount = await seedDemoUsers(passwordHash)

  console.log(`Đã nạp ${userCount} tài khoản demo.`)
  console.log(`Mật khẩu chung cho cả ba: ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('Seed thất bại:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
