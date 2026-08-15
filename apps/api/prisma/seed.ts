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
 * 2. DỮ LIỆU DEMO — tài khoản dùng chung một mật khẩu ai cũng biết, kèm tin
 *    tuyển dụng và đơn ứng tuyển giả. Chỉ dành cho máy lập trình viên. Đẩy lên
 *    production là tạo sẵn mấy cửa hậu và làm bẩn dữ liệu thật.
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

import {
  ApplicationStatus,
  DocumentType,
  JobStatus,
  PrismaClient,
  ReviewStatus,
  Role,
  SalaryUnit,
  ScheduleType,
  TimeSlot,
} from '@prisma/client'
import { hash } from '@node-rs/argon2'

const prisma = new PrismaClient()

/**
 * Mật khẩu chung cho mọi tài khoản demo.
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

// ---------------------------------------------------------------------------
// 1. DỮ LIỆU THAM CHIẾU — chạy ở mọi môi trường
// ---------------------------------------------------------------------------

/**
 * Kỹ năng phổ biến trong việc làm thêm của sinh viên Việt Nam.
 *
 * Danh mục cố định do admin quản lý, không cho nhập tự do — nếu không sẽ có
 * "Giao tiếp", "giao tiếp" và "Kỹ năng giao tiếp" thành ba tag riêng, làm bộ
 * lọc mất tác dụng.
 *
 * `slug` là khoá tra cứu ổn định: tin demo bên dưới tham chiếu kỹ năng bằng
 * slug, nên đổi `name` cho đẹp hơn không làm hỏng gì.
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
  { name: 'Sư phạm', slug: 'su-pham' },
  { name: 'Quản lý lớp', slug: 'quan-ly-lop' },
  { name: 'Làm việc nhóm', slug: 'lam-viec-nhom' },
  { name: 'Kiên nhẫn', slug: 'kien-nhan' },
]

/** Trả về bảng tra `slug → id` để phần demo gắn kỹ năng vào hồ sơ và tin. */
async function seedSkills() {
  const idTheoSlug = new Map<string, string>()

  for (const skill of SKILLS) {
    const row = await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: { name: skill.name },
      create: skill,
    })
    idTheoSlug.set(row.slug, row.id)
  }

  return idTheoSlug
}

// ---------------------------------------------------------------------------
// 2. DỮ LIỆU DEMO — chỉ chạy khi database nằm trên máy lập trình viên
//
// Cách các bản ghi tham chiếu lẫn nhau ở đây có hai kiểu, tuỳ bảng có khoá tự
// nhiên hay không:
//
// - HỒ SƠ có khoá tự nhiên (`users.email`, và `*_profiles.userId` là unique).
//   Chúng để cuid tự sinh như bình thường, và dữ liệu mẫu dưới đây tham chiếu
//   nhau bằng `key` — một nhãn ngắn chỉ tồn tại trong file này. Id thật được tra
//   lúc chạy rồi bỏ vào Map. Không hardcode id hồ sơ, vì hồ sơ có thể đã được
//   tạo từ lần seed trước với id khác hẳn.
//
// - TIN TUYỂN DỤNG và GIẤY TỜ không có khoá tự nhiên nào (hai tin trùng tên là
//   chuyện bình thường). Chúng mang ID CỐ ĐỊNH viết tay, vì đó là cách duy nhất
//   để `upsert` nhận ra "hàng này đã có rồi" và chạy seed lần thứ hai không tạo
//   ra bản sao. Tiền tố `demo-` giúp phân biệt ngay với dữ liệu thật.
// ---------------------------------------------------------------------------

type ShiftSpec = [dayOfWeek: number, slot: TimeSlot]

/** Nhãn ngắn để dữ liệu mẫu trỏ vào nhau, không phải id trong database. */
type Key = string

interface DemoStudent {
  key: Key
  email: string
  fullName: string
  university: string
  major: string
  year: number
  bio: string
  expectedHourlyRate: number
  skills: string[]
  /** Lưới lịch rảnh sinh viên tự khai. 0 = Chủ nhật ... 6 = Thứ 7. */
  availability: ShiftSpec[]
}

/**
 * Hai sinh viên có lịch rảnh LỆCH NHAU rõ rệt.
 *
 * Cố ý như vậy: bộ lọc "chỉ hiện việc khớp lịch rảnh" là tính năng lõi, mà một
 * sinh viên duy nhất thì không thử được — mọi tin đều khớp hoặc đều không khớp,
 * nhìn không ra bộ lọc có chạy hay không. An rảnh tối và cuối tuần, Mai rảnh
 * chiều các ngày trong tuần; đăng nhập lần lượt hai tài khoản sẽ thấy hai danh
 * sách việc khác hẳn nhau.
 */
const DEMO_STUDENTS: DemoStudent[] = [
  {
    key: 'an',
    email: 'sinhvien@uniwork.dev',
    fullName: 'Nguyễn Văn An',
    university: 'Đại học Bách khoa TP.HCM',
    major: 'Công nghệ thông tin',
    year: 3,
    bio: 'Sinh viên năm 3, tìm việc làm thêm buổi tối và cuối tuần.',
    expectedHourlyRate: 35_000,
    skills: ['giao-tiep', 'pha-che', 'cham-soc-khach-hang', 'tieng-anh-giao-tiep'],
    availability: [
      [2, TimeSlot.EVENING],
      [4, TimeSlot.EVENING],
      [6, TimeSlot.MORNING],
      [6, TimeSlot.AFTERNOON],
      [6, TimeSlot.EVENING],
      [0, TimeSlot.MORNING],
    ],
  },
  {
    key: 'mai',
    email: 'sinhvien2@uniwork.dev',
    fullName: 'Trần Ngọc Mai',
    university: 'Đại học Sư phạm TP.HCM',
    major: 'Sư phạm Toán',
    year: 2,
    bio: 'Muốn nhận lớp gia sư hoặc việc online làm được vào buổi chiều.',
    expectedHourlyRate: 45_000,
    skills: ['gia-su', 'su-pham', 'kien-nhan', 'tin-hoc-van-phong'],
    availability: [
      [1, TimeSlot.AFTERNOON],
      [3, TimeSlot.AFTERNOON],
      [5, TimeSlot.AFTERNOON],
      [3, TimeSlot.EVENING],
      [5, TimeSlot.EVENING],
    ],
  },
]

interface DemoEmployer {
  key: Key
  email: string
  companyName: string
  website: string
  address: string
  contactName: string
  description: string
  /** null = chưa được admin duyệt, tin của họ không được hiện công khai. */
  verified: boolean
  documents: { id: string; type: DocumentType; status: ReviewStatus; reviewNote?: string }[]
}

/**
 * Ba nhà tuyển dụng, trong đó MỘT chưa được duyệt.
 *
 * Nhà tuyển dụng chưa duyệt là mẫu quan trọng nhất trong ba: nó là thứ duy nhất
 * chứng minh được luật "tin của đơn vị chưa xác minh không hiện công khai" thật
 * sự có hiệu lực. Toàn bộ dữ liệu demo đều hợp lệ thì luật đó không bao giờ bị
 * chạm tới, và Sprint 1 sẽ viết truy vấn lọc mà không biết mình viết sai.
 *
 * Nó cũng làm hàng đợi duyệt của admin có việc để làm thay vì rỗng trơn.
 */
const DEMO_EMPLOYERS: DemoEmployer[] = [
  {
    key: 'suongmai',
    email: 'ntd@uniwork.dev',
    companyName: 'Chuỗi cà phê Sương Mai',
    website: 'https://suongmai.example.com',
    address: '12 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
    contactName: 'Lê Thị Sương',
    description: 'Chuỗi 4 quán cà phê khu trung tâm, tuyển ca linh hoạt cho sinh viên.',
    verified: true,
    documents: [
      {
        id: 'demo-giayto-suongmai-gpkd',
        type: DocumentType.BUSINESS_LICENSE,
        status: ReviewStatus.APPROVED,
      },
      { id: 'demo-giayto-suongmai-mst', type: DocumentType.TAX_CODE, status: ReviewStatus.APPROVED },
    ],
  },
  {
    key: 'triviet',
    email: 'trungtam@uniwork.dev',
    companyName: 'Trung tâm Trí Việt',
    website: 'https://triviet.example.com',
    address: '88 Võ Văn Ngân, TP Thủ Đức, TP.HCM',
    contactName: 'Phạm Quang Trí',
    description: 'Trung tâm luyện thi và tiếng Anh thiếu nhi, 6 cơ sở tại TP.HCM.',
    verified: true,
    documents: [
      {
        id: 'demo-giayto-triviet-gpkd',
        type: DocumentType.BUSINESS_LICENSE,
        status: ReviewStatus.APPROVED,
      },
    ],
  },
  {
    key: 'saoviet',
    email: 'sukien@uniwork.dev',
    companyName: 'Sao Việt Event',
    website: 'https://saoviet.example.com',
    address: '215 Nguyễn Lương Bằng, Quận 7, TP.HCM',
    contactName: 'Đỗ Minh Sao',
    description: 'Đơn vị tổ chức sự kiện, tuyển nhân sự thời vụ theo từng chương trình.',
    verified: false,
    documents: [
      {
        id: 'demo-giayto-saoviet-gpkd',
        type: DocumentType.BUSINESS_LICENSE,
        status: ReviewStatus.PENDING,
      },
      {
        id: 'demo-giayto-saoviet-cccd',
        type: DocumentType.ID_CARD,
        status: ReviewStatus.REJECTED,
        reviewNote: 'Ảnh mờ, không đọc được số. Vui lòng chụp lại rõ nét.',
      },
    ],
  },
]

interface DemoJob {
  id: string
  employer: Key
  title: string
  description: string
  requirements: string[]
  benefits: string[]
  city: string
  district: string
  quantity: number
  salaryMin: number
  salaryMax: number
  salaryUnit: SalaryUnit
  scheduleType: ScheduleType
  commitmentMonths?: number
  minShiftsPerWeek?: number
  startDate?: Date
  endDate?: Date
  workDate?: Date
  deadline: Date
  status: JobStatus
  publishedAt?: Date
  closedAt?: Date
  rejectionReason?: string
  viewCount: number
  shifts: ShiftSpec[]
  skills: string[]
}

const d = (iso: string) => new Date(iso)

/**
 * Tám tin trải đủ bốn trạng thái, ba loại thời gian và ba cách tính lương.
 *
 * Không phải để nhìn cho nhiều. Mỗi biến thể ở đây là một nhánh code Sprint 1
 * phải viết: tin CLOSED không được nhận đơn, tin DRAFT chỉ chủ tin thấy, tin
 * PENDING nằm trong hàng đợi admin, lương theo tháng phải hiện khác lương theo
 * giờ. Thiếu mẫu thì nhánh đó chỉ được thử lần đầu lúc demo trước lớp.
 */
const DEMO_JOBS: DemoJob[] = [
  {
    id: 'demo-job-cafe-toi',
    employer: 'suongmai',
    title: 'Phục vụ quán cà phê ca tối',
    description:
      'Quán cà phê nhỏ khu trung tâm cần tuyển bạn phục vụ ca tối. Công việc gồm order, pha chế đồ uống cơ bản, giữ khu vực quầy gọn gàng và hỗ trợ khách. Có đào tạo trong tuần đầu, không cần kinh nghiệm.',
    requirements: [
      'Sinh viên năm 1 đến năm 4, ưu tiên bạn ở gần Quận 1',
      'Làm được tối thiểu 3 ca mỗi tuần, cam kết ít nhất 3 tháng',
      'Thái độ hoà nhã, chịu khó',
    ],
    benefits: ['Hỗ trợ bữa ăn ca', 'Thưởng thêm ngày lễ', 'Môi trường trẻ, linh hoạt đổi ca'],
    city: 'TP.HCM',
    district: 'Quận 1',
    quantity: 2,
    salaryMin: 25_000,
    salaryMax: 30_000,
    salaryUnit: SalaryUnit.HOUR,
    scheduleType: ScheduleType.RECURRING,
    commitmentMonths: 3,
    minShiftsPerWeek: 3,
    deadline: d('2026-09-30'),
    status: JobStatus.OPEN,
    publishedAt: d('2026-08-10'),
    viewCount: 214,
    shifts: [
      [2, TimeSlot.EVENING],
      [4, TimeSlot.EVENING],
      [6, TimeSlot.EVENING],
    ],
    skills: ['giao-tiep', 'pha-che', 'cham-soc-khach-hang'],
  },
  {
    id: 'demo-job-thu-ngan-cuoi-tuan',
    employer: 'suongmai',
    title: 'Thu ngân ca sáng cuối tuần',
    description:
      'Cần bạn thu ngân cho ca sáng thứ 7 và chủ nhật. Sử dụng phần mềm bán hàng có sẵn, được hướng dẫn trong buổi đầu. Phù hợp bạn học các ngày trong tuần.',
    requirements: ['Cẩn thận với tiền mặt', 'Đi làm đúng giờ, ca bắt đầu 6h30'],
    benefits: ['Ca cố định, không đổi lịch đột xuất', 'Được uống đồ trong ca'],
    city: 'TP.HCM',
    district: 'Quận 3',
    quantity: 1,
    salaryMin: 24_000,
    salaryMax: 28_000,
    salaryUnit: SalaryUnit.HOUR,
    scheduleType: ScheduleType.RECURRING,
    commitmentMonths: 2,
    minShiftsPerWeek: 2,
    deadline: d('2026-09-15'),
    status: JobStatus.OPEN,
    publishedAt: d('2026-08-12'),
    viewCount: 97,
    shifts: [
      [6, TimeSlot.MORNING],
      [0, TimeSlot.MORNING],
    ],
    skills: ['thu-ngan', 'giao-tiep'],
  },
  {
    id: 'demo-job-gia-su-toan',
    employer: 'triviet',
    title: 'Gia sư Toán lớp 9',
    description:
      'Trung tâm cần gia sư kèm Toán cho học sinh lớp 9 chuẩn bị thi vào 10. Mỗi buổi 90 phút, dạy tại trung tâm, giáo trình có sẵn.',
    requirements: [
      'Sinh viên ngành Sư phạm Toán, Kỹ thuật hoặc Kinh tế',
      'Điểm Toán THPT từ 8.0 trở lên',
      'Cam kết theo hết một khoá 6 tháng',
    ],
    benefits: [
      'Giáo trình có sẵn',
      'Thưởng theo kết quả học sinh',
      'Được hỗ trợ nghiệp vụ sư phạm',
    ],
    city: 'TP.HCM',
    district: 'TP Thủ Đức',
    quantity: 3,
    salaryMin: 150_000,
    salaryMax: 200_000,
    salaryUnit: SalaryUnit.SHIFT,
    scheduleType: ScheduleType.RECURRING,
    commitmentMonths: 6,
    minShiftsPerWeek: 2,
    deadline: d('2026-09-20'),
    status: JobStatus.OPEN,
    publishedAt: d('2026-08-11'),
    viewCount: 158,
    shifts: [
      [3, TimeSlot.EVENING],
      [5, TimeSlot.EVENING],
    ],
    skills: ['gia-su', 'su-pham', 'kien-nhan'],
  },
  {
    id: 'demo-job-tro-giang-tieng-anh',
    employer: 'triviet',
    title: 'Trợ giảng lớp tiếng Anh thiếu nhi',
    description:
      'Hỗ trợ giáo viên nước ngoài trong lớp tiếng Anh cho trẻ 6–10 tuổi: điểm danh, hỗ trợ hoạt động, quản lý lớp và liên lạc phụ huynh.',
    requirements: ['Tiếng Anh giao tiếp khá trở lên', 'Ưu tiên có chứng chỉ IELTS 6.0+'],
    benefits: ['Được dự giờ giáo viên bản ngữ', 'Cấp chứng nhận trợ giảng sau khoá'],
    city: 'TP.HCM',
    district: 'Quận Bình Thạnh',
    quantity: 4,
    salaryMin: 120_000,
    salaryMax: 160_000,
    salaryUnit: SalaryUnit.SHIFT,
    scheduleType: ScheduleType.RECURRING,
    commitmentMonths: 4,
    minShiftsPerWeek: 2,
    deadline: d('2026-08-25'),
    status: JobStatus.OPEN,
    publishedAt: d('2026-08-08'),
    viewCount: 133,
    shifts: [
      [0, TimeSlot.MORNING],
      [6, TimeSlot.AFTERNOON],
    ],
    skills: ['tieng-anh-giao-tiep', 'quan-ly-lop', 'kien-nhan'],
  },
  {
    id: 'demo-job-ban-hang-tet',
    employer: 'suongmai',
    title: 'Nhân viên bán hàng thời vụ Tết',
    description:
      'Tuyển nhân viên bán hàng thời vụ dịp Tết. Sắp xếp hàng hoá, tư vấn khách, hỗ trợ thu ngân giờ cao điểm.',
    requirements: ['Làm được cuối tuần', 'Sức khoẻ tốt, đứng liên tục được'],
    benefits: ['Thưởng Tết theo doanh số', 'Được giảm giá mua hàng'],
    city: 'TP.HCM',
    district: 'Quận Gò Vấp',
    quantity: 10,
    salaryMin: 28_000,
    salaryMax: 32_000,
    salaryUnit: SalaryUnit.HOUR,
    scheduleType: ScheduleType.SEASONAL,
    startDate: d('2026-12-15'),
    endDate: d('2027-01-20'),
    deadline: d('2026-12-10'),
    status: JobStatus.OPEN,
    publishedAt: d('2026-08-13'),
    viewCount: 61,
    shifts: [
      [0, TimeSlot.MORNING],
      [6, TimeSlot.MORNING],
      [6, TimeSlot.AFTERNOON],
    ],
    skills: ['ban-hang', 'giao-tiep'],
  },
  {
    id: 'demo-job-su-kien-am-nhac',
    employer: 'saoviet',
    title: 'Nhân viên hỗ trợ sự kiện âm nhạc',
    description:
      'Cần 20 bạn hỗ trợ sự kiện âm nhạc ngoài trời: soát vé, hướng dẫn khách, hỗ trợ hậu cần. Thanh toán ngay sau khi kết thúc sự kiện.',
    requirements: ['Có mặt đúng giờ, làm việc liên tục 6 tiếng', 'Ưu tiên bạn có kinh nghiệm sự kiện'],
    benefits: ['Thanh toán ngay trong ngày', 'Có áo đồng phục và nước uống'],
    city: 'TP.HCM',
    district: 'Quận 7',
    quantity: 20,
    salaryMin: 350_000,
    salaryMax: 350_000,
    salaryUnit: SalaryUnit.SHIFT,
    scheduleType: ScheduleType.ONE_TIME,
    workDate: d('2026-09-05'),
    deadline: d('2026-08-30'),
    // Nằm ở PENDING vì Sao Việt chưa được duyệt giấy tờ. Đây là tin dùng để thử
    // hàng đợi duyệt của admin, và để kiểm tra tin PENDING không lọt ra danh
    // sách công khai.
    status: JobStatus.PENDING,
    viewCount: 0,
    shifts: [[6, TimeSlot.AFTERNOON]],
    skills: ['lam-viec-nhom', 'giao-tiep'],
  },
  {
    id: 'demo-job-nhap-lieu-online',
    employer: 'triviet',
    title: 'Cộng tác viên nhập liệu online',
    description:
      'Nhập liệu hồ sơ học viên vào hệ thống nội bộ. Làm online hoàn toàn, giao việc theo tuần, tự sắp xếp giờ miễn hoàn thành đúng hạn.',
    requirements: ['Có laptop và mạng ổn định', 'Thành thạo Excel cơ bản', 'Cam kết tối thiểu 2 tháng'],
    benefits: ['Làm từ xa 100%', 'Thanh toán theo tháng'],
    city: 'Toàn quốc',
    district: 'Làm từ xa',
    quantity: 5,
    salaryMin: 2_000_000,
    salaryMax: 3_500_000,
    salaryUnit: SalaryUnit.MONTH,
    scheduleType: ScheduleType.RECURRING,
    commitmentMonths: 2,
    minShiftsPerWeek: 3,
    deadline: d('2026-09-05'),
    // Nháp: chưa gửi duyệt. Chỉ chủ tin thấy được.
    status: JobStatus.DRAFT,
    viewCount: 0,
    shifts: [
      [1, TimeSlot.AFTERNOON],
      [3, TimeSlot.AFTERNOON],
      [5, TimeSlot.AFTERNOON],
    ],
    skills: ['tin-hoc-van-phong'],
  },
  {
    id: 'demo-job-phu-bep-da-dong',
    employer: 'suongmai',
    title: 'Phụ bếp ca chiều',
    description:
      'Sơ chế nguyên liệu, hỗ trợ bếp chính giờ cao điểm, dọn dẹp khu bếp cuối ca. Đã tuyển đủ người.',
    requirements: ['Sạch sẽ, không dị ứng thực phẩm'],
    benefits: ['Bao ăn ca'],
    city: 'TP.HCM',
    district: 'Quận 1',
    quantity: 1,
    salaryMin: 26_000,
    salaryMax: 26_000,
    salaryUnit: SalaryUnit.HOUR,
    scheduleType: ScheduleType.RECURRING,
    commitmentMonths: 3,
    minShiftsPerWeek: 4,
    deadline: d('2026-07-20'),
    status: JobStatus.CLOSED,
    publishedAt: d('2026-06-28'),
    closedAt: d('2026-07-21'),
    viewCount: 402,
    shifts: [
      [1, TimeSlot.AFTERNOON],
      [2, TimeSlot.AFTERNOON],
      [3, TimeSlot.AFTERNOON],
      [4, TimeSlot.AFTERNOON],
    ],
    skills: ['phuc-vu-ban'],
  },
]

/**
 * Đơn ứng tuyển trải đủ các trạng thái nhà tuyển dụng sẽ gặp.
 *
 * `matchScore` ở đây là số viết tay, không phải kết quả tính toán — công thức
 * thật (kỹ năng khớp + ca khớp + mức đáp ứng cam kết) là việc của Sprint 4. Cột
 * này vốn để đóng băng điểm tại thời điểm nộp đơn, nên có số sẵn là đủ dựng
 * được màn hình danh sách ứng viên.
 */
const DEMO_APPLICATIONS: {
  jobId: string
  student: Key
  status: ApplicationStatus
  matchScore: number
  coverLetter: string
}[] = [
  {
    jobId: 'demo-job-cafe-toi',
    student: 'an',
    status: ApplicationStatus.SHORTLISTED,
    matchScore: 94,
    coverLetter: 'Em rảnh cả ba ca tối trong tin và ở gần Quận 1, đi làm được ngay tuần này ạ.',
  },
  {
    jobId: 'demo-job-ban-hang-tet',
    student: 'an',
    status: ApplicationStatus.PENDING,
    matchScore: 76,
    coverLetter: 'Em làm được cả thứ 7 và chủ nhật, dịp Tết em ở lại thành phố.',
  },
  {
    jobId: 'demo-job-gia-su-toan',
    student: 'mai',
    status: ApplicationStatus.VIEWED,
    matchScore: 88,
    coverLetter: 'Em học Sư phạm Toán năm 2, đã kèm 3 bạn lớp 9 thi vào 10 năm ngoái.',
  },
  {
    jobId: 'demo-job-tro-giang-tieng-anh',
    student: 'mai',
    status: ApplicationStatus.REJECTED,
    matchScore: 48,
    coverLetter: 'Em muốn thử sức ở mảng tiếng Anh thiếu nhi.',
  },
]

/** Tin đã lưu — dữ liệu cho nút dấu trang trên thẻ việc làm. */
const DEMO_SAVED_JOBS = [
  { student: 'an', jobId: 'demo-job-gia-su-toan' },
  { student: 'mai', jobId: 'demo-job-nhap-lieu-online' },
]

// ---------------------------------------------------------------------------
// Các hàm nạp
// ---------------------------------------------------------------------------

/**
 * Tạo tài khoản đăng nhập rồi trả về id của nó.
 *
 * `update: {}` là cố ý để trống: chạy lại seed không được ghi đè mật khẩu hay
 * trạng thái xác thực của tài khoản đã có. Riêng phần hồ sơ bên dưới thì có cập
 * nhật, vì đó mới là chỗ sửa dữ liệu mẫu cho đẹp hơn.
 */
async function upsertUser(email: string, role: Role, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role, emailVerifiedAt: new Date() },
  })

  return user.id
}

async function seedStudents(passwordHash: string, skillIds: Map<string, string>) {
  const idTheoKey = new Map<Key, string>()

  for (const sv of DEMO_STUDENTS) {
    const userId = await upsertUser(sv.email, Role.STUDENT, passwordHash)

    const thongTin = {
      fullName: sv.fullName,
      university: sv.university,
      major: sv.major,
      year: sv.year,
      bio: sv.bio,
      expectedHourlyRate: sv.expectedHourlyRate,
      availableFrom: d('2026-08-01'),
      availableUntil: d('2026-12-31'),
    }

    // Khoá tra là `userId` chứ không phải `id`: cột đó unique, và nó đúng kể cả
    // khi hồ sơ đã được tạo từ lần seed trước với một cuid mình không biết.
    const profile = await prisma.studentProfile.upsert({
      where: { userId },
      update: thongTin,
      create: { userId, ...thongTin },
    })

    idTheoKey.set(sv.key, profile.id)

    // Lịch rảnh và kỹ năng dựng lại từ đầu mỗi lần chạy.
    //
    // Xoá rồi tạo lại, không upsert từng ô: hai bảng này là DANH SÁCH, nên sửa
    // dữ liệu mẫu ở trên bằng cách bỏ bớt một ô mà chỉ upsert thì ô cũ vẫn nằm
    // lại trong database vĩnh viễn. Chúng không mang dữ liệu gì ngoài chính
    // khoá của mình nên dựng lại không mất mát gì.
    await prisma.availability.deleteMany({ where: { studentProfileId: profile.id } })
    await prisma.availability.createMany({
      data: sv.availability.map(([dayOfWeek, slot]) => ({
        studentProfileId: profile.id,
        dayOfWeek,
        slot,
      })),
    })

    await prisma.studentSkill.deleteMany({ where: { studentProfileId: profile.id } })
    await prisma.studentSkill.createMany({
      data: sv.skills.map((slug) => ({
        studentProfileId: profile.id,
        skillId: layIdKyNang(skillIds, slug),
      })),
    })
  }

  return idTheoKey
}

async function seedEmployers(passwordHash: string) {
  const idTheoKey = new Map<Key, string>()

  for (const ntd of DEMO_EMPLOYERS) {
    const userId = await upsertUser(ntd.email, Role.EMPLOYER, passwordHash)

    const thongTin = {
      companyName: ntd.companyName,
      website: ntd.website,
      address: ntd.address,
      contactName: ntd.contactName,
      description: ntd.description,
      verifiedAt: ntd.verified ? d('2026-08-05') : null,
    }

    const profile = await prisma.employerProfile.upsert({
      where: { userId },
      update: thongTin,
      create: { userId, ...thongTin },
    })

    idTheoKey.set(ntd.key, profile.id)

    for (const giayTo of ntd.documents) {
      const noiDung = {
        employerProfileId: profile.id,
        type: giayTo.type,
        fileUrl: `https://res.cloudinary.com/demo/uniwork/${giayTo.id}.jpg`,
        status: giayTo.status,
        reviewNote: giayTo.reviewNote ?? null,
        reviewedAt: giayTo.status === ReviewStatus.PENDING ? null : d('2026-08-05'),
      }

      await prisma.employerDocument.upsert({
        where: { id: giayTo.id },
        update: noiDung,
        create: { id: giayTo.id, ...noiDung },
      })
    }
  }

  return idTheoKey
}

async function seedJobs(employerIds: Map<Key, string>, skillIds: Map<string, string>) {
  for (const job of DEMO_JOBS) {
    const { id, employer, shifts, skills, ...truong } = job

    const noiDung = {
      ...truong,
      employerProfileId: employerIds.get(employer)!,
      commitmentMonths: truong.commitmentMonths ?? null,
      minShiftsPerWeek: truong.minShiftsPerWeek ?? null,
      startDate: truong.startDate ?? null,
      endDate: truong.endDate ?? null,
      workDate: truong.workDate ?? null,
      publishedAt: truong.publishedAt ?? null,
      closedAt: truong.closedAt ?? null,
      rejectionReason: truong.rejectionReason ?? null,
    }

    await prisma.job.upsert({
      where: { id },
      update: noiDung,
      create: { id, ...noiDung },
    })

    // Cùng lý do như lịch rảnh: ca làm và kỹ năng là danh sách, dựng lại từ đầu
    // để bỏ bớt một ca trong dữ liệu mẫu thì database phản ánh đúng.
    await prisma.jobShift.deleteMany({ where: { jobId: id } })
    await prisma.jobShift.createMany({
      data: shifts.map(([dayOfWeek, slot]) => ({ jobId: id, dayOfWeek, slot })),
    })

    await prisma.jobSkill.deleteMany({ where: { jobId: id } })
    await prisma.jobSkill.createMany({
      data: skills.map((slug) => ({ jobId: id, skillId: layIdKyNang(skillIds, slug) })),
    })
  }

  return DEMO_JOBS.length
}

async function seedApplications(studentIds: Map<Key, string>) {
  for (const don of DEMO_APPLICATIONS) {
    const studentProfileId = studentIds.get(don.student)!

    const noiDung = {
      status: don.status,
      matchScore: don.matchScore,
      coverLetter: don.coverLetter,
      cvUrl: `https://res.cloudinary.com/demo/uniwork/cv-${don.student}.pdf`,
      statusChangedAt: don.status === ApplicationStatus.PENDING ? null : d('2026-08-13'),
    }

    await prisma.application.upsert({
      where: { jobId_studentProfileId: { jobId: don.jobId, studentProfileId } },
      update: noiDung,
      create: { jobId: don.jobId, studentProfileId, ...noiDung },
    })
  }

  for (const luu of DEMO_SAVED_JOBS) {
    const studentProfileId = studentIds.get(luu.student)!

    await prisma.savedJob.upsert({
      where: { studentProfileId_jobId: { studentProfileId, jobId: luu.jobId } },
      update: {},
      create: { studentProfileId, jobId: luu.jobId },
    })
  }

  return DEMO_APPLICATIONS.length
}

/**
 * Tra id kỹ năng theo slug, ném lỗi nếu không có.
 *
 * Ném thay vì bỏ qua là cố ý: gõ sai một slug trong dữ liệu mẫu thì tin sẽ lặng
 * lẽ mất một kỹ năng, và người phát hiện ra sẽ là ai đó ở Sprint 4 đang tự hỏi
 * vì sao bộ lọc kỹ năng trả về thiếu.
 */
function layIdKyNang(skillIds: Map<string, string>, slug: string) {
  const id = skillIds.get(slug)
  if (!id) throw new Error(`Slug kỹ năng không có trong danh mục: ${slug}`)
  return id
}

// ---------------------------------------------------------------------------
// Chốt chặn môi trường
// ---------------------------------------------------------------------------

/** Máy chủ database được coi là chạy trên máy lập trình viên. */
const HOST_NOI_BO = ['localhost', '127.0.0.1', '::1', 'host.docker.internal']

/**
 * Dữ liệu demo chỉ được tạo khi database nằm ngay trên máy này.
 *
 * Canh theo `DATABASE_URL` chứ KHÔNG canh theo `NODE_ENV`, vì mối nguy thật
 * nằm ở chỗ khác với chỗ ta hay nhìn.
 *
 * Kịch bản hỏng điển hình: lập trình viên sửa DATABASE_URL trong .env trỏ sang
 * Neon để xem dữ liệu thật, quên đổi lại, rồi chạy `pnpm db:seed`. Lúc đó
 * NODE_ENV vẫn là 'development' — chốt chặn theo NODE_ENV sẽ cho qua, và mấy
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
  // Dữ liệu tham chiếu: luôn nạp, mọi môi trường.
  const skillIds = await seedSkills()
  console.log(`Đã nạp ${skillIds.size} kỹ năng.`)

  // Dữ liệu demo: chỉ ở máy lập trình viên.
  //
  // Chặn bằng code chứ không bằng trí nhớ. Biến DATABASE_URL rất dễ trỏ nhầm
  // khi đang chuyển qua lại giữa Docker local và Neon — chỉ cần một lần chạy
  // nhầm là dữ liệu giả nằm lẫn trong database thật, và tách ra rất khổ.
  //
  // Khi Sprint 1 có màn hình đăng ký, tài khoản để demo trên bản deploy nên
  // được tạo qua chính form đăng ký đó, không phải bằng seed.
  if (!laDatabaseNoiBo()) {
    console.log('DATABASE_URL không trỏ tới máy này — bỏ qua toàn bộ dữ liệu demo.')
    return
  }

  console.log('Đang băm mật khẩu demo...')
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS)

  const studentIds = await seedStudents(passwordHash, skillIds)
  const employerIds = await seedEmployers(passwordHash)

  // Admin không có bảng hồ sơ riêng, quyền nằm ở trường `role`.
  await upsertUser('admin@uniwork.dev', Role.ADMIN, passwordHash)

  const soTin = await seedJobs(employerIds, skillIds)
  const soDon = await seedApplications(studentIds)

  console.log(
    `Đã nạp ${studentIds.size} sinh viên, ${employerIds.size} nhà tuyển dụng, 1 admin, ` +
      `${soTin} tin tuyển dụng, ${soDon} đơn ứng tuyển.`,
  )
  console.log(`Mật khẩu chung cho mọi tài khoản demo: ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('Seed thất bại:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
