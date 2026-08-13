/**
 * Dữ liệu giả cho bản web tĩnh. Sẽ thay bằng dữ liệu thật từ API ở Sprint 2.
 * Cấu trúc bám theo mô hình dữ liệu ở README mục 5 để sau đổi sang API ít phải sửa.
 */

export type ScheduleType = 'RECURRING' | 'SEASONAL' | 'ONE_TIME'
export type SalaryUnit = 'HOUR' | 'SHIFT' | 'MONTH'

/** 0 = Chủ nhật, 1 = Thứ 2, ... 6 = Thứ 7 */
export const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

export const TIME_SLOTS = [
  { id: 'morning', label: 'Sáng', range: '06:00 – 12:00' },
  { id: 'afternoon', label: 'Chiều', range: '12:00 – 18:00' },
  { id: 'evening', label: 'Tối', range: '18:00 – 22:00' },
] as const

export type SlotId = (typeof TIME_SLOTS)[number]['id']

export interface Shift {
  dayOfWeek: number
  slot: SlotId
}

export interface Job {
  id: string
  title: string
  company: string
  companyInitial: string
  companyColor: string
  verified: boolean
  district: string
  city: string
  salaryMin: number
  salaryMax: number
  salaryUnit: SalaryUnit
  scheduleType: ScheduleType
  commitmentMonths: number | null
  quantity: number
  deadline: string
  postedAt: string
  skills: string[]
  shifts: Shift[]
  matchScore: number
  description: string
  requirements: string[]
  benefits: string[]
}

export const JOBS: Job[] = [
  {
    id: 'j1',
    title: 'Phục vụ quán cà phê ca tối',
    company: 'The Corner Coffee',
    companyInitial: 'C',
    companyColor: 'bg-amber-500',
    verified: true,
    district: 'Quận 1',
    city: 'TP.HCM',
    salaryMin: 25000,
    salaryMax: 30000,
    salaryUnit: 'HOUR',
    scheduleType: 'RECURRING',
    commitmentMonths: 3,
    quantity: 2,
    deadline: '30/08/2026',
    postedAt: '2 giờ trước',
    skills: ['Giao tiếp', 'Pha chế cơ bản', 'Chăm sóc khách hàng'],
    shifts: [
      { dayOfWeek: 2, slot: 'evening' },
      { dayOfWeek: 4, slot: 'evening' },
      { dayOfWeek: 6, slot: 'evening' },
    ],
    matchScore: 94,
    description:
      'Quán cà phê nhỏ khu trung tâm cần tuyển bạn phục vụ ca tối. Công việc gồm order, pha chế đồ uống cơ bản, giữ khu vực quầy gọn gàng và hỗ trợ khách. Có đào tạo trong tuần đầu, không cần kinh nghiệm.',
    requirements: [
      'Sinh viên năm 1 đến năm 4, ưu tiên bạn ở gần Quận 1',
      'Làm được tối thiểu 3 ca mỗi tuần, cam kết ít nhất 3 tháng',
      'Thái độ hoà nhã, chịu khó',
    ],
    benefits: ['Được hỗ trợ bữa ăn ca', 'Thưởng thêm ngày lễ', 'Môi trường trẻ, linh hoạt đổi ca'],
  },
  {
    id: 'j2',
    title: 'Gia sư Toán lớp 9',
    company: 'Trung tâm Trí Việt',
    companyInitial: 'T',
    companyColor: 'bg-brand-600',
    verified: true,
    district: 'Quận Thủ Đức',
    city: 'TP.HCM',
    salaryMin: 150000,
    salaryMax: 200000,
    salaryUnit: 'SHIFT',
    scheduleType: 'RECURRING',
    commitmentMonths: 6,
    quantity: 3,
    deadline: '15/09/2026',
    postedAt: '5 giờ trước',
    skills: ['Sư phạm', 'Toán học', 'Kiên nhẫn'],
    shifts: [
      { dayOfWeek: 3, slot: 'evening' },
      { dayOfWeek: 5, slot: 'evening' },
    ],
    matchScore: 88,
    description:
      'Trung tâm cần gia sư kèm Toán cho học sinh lớp 9 chuẩn bị thi vào 10. Mỗi buổi 90 phút, dạy tại trung tâm, giáo trình có sẵn.',
    requirements: [
      'Sinh viên các ngành Sư phạm Toán, Kỹ thuật, Kinh tế',
      'Điểm Toán THPT từ 8.0 trở lên',
      'Cam kết theo hết một khoá 6 tháng',
    ],
    benefits: ['Giáo trình có sẵn', 'Thưởng theo kết quả học sinh', 'Được hỗ trợ nghiệp vụ sư phạm'],
  },
  {
    id: 'j3',
    title: 'Nhân viên hỗ trợ sự kiện âm nhạc',
    company: 'Sao Việt Event',
    companyInitial: 'S',
    companyColor: 'bg-rose-500',
    verified: false,
    district: 'Quận 7',
    city: 'TP.HCM',
    salaryMin: 350000,
    salaryMax: 350000,
    salaryUnit: 'SHIFT',
    scheduleType: 'ONE_TIME',
    commitmentMonths: null,
    quantity: 20,
    deadline: '20/08/2026',
    postedAt: '1 ngày trước',
    skills: ['Sức khoẻ tốt', 'Làm việc nhóm'],
    shifts: [{ dayOfWeek: 6, slot: 'afternoon' }],
    matchScore: 72,
    description:
      'Cần 20 bạn hỗ trợ sự kiện âm nhạc ngoài trời ngày 23/08. Công việc gồm soát vé, hướng dẫn khách, hỗ trợ hậu cần. Thanh toán ngay sau khi kết thúc sự kiện.',
    requirements: ['Có mặt đúng giờ, làm việc liên tục 6 tiếng', 'Ưu tiên bạn có kinh nghiệm sự kiện'],
    benefits: ['Thanh toán ngay trong ngày', 'Có áo đồng phục và nước uống'],
  },
  {
    id: 'j4',
    title: 'Cộng tác viên nhập liệu online',
    company: 'DataLine Việt Nam',
    companyInitial: 'D',
    companyColor: 'bg-teal-600',
    verified: true,
    district: 'Làm từ xa',
    city: 'Toàn quốc',
    salaryMin: 2000000,
    salaryMax: 3500000,
    salaryUnit: 'MONTH',
    scheduleType: 'RECURRING',
    commitmentMonths: 2,
    quantity: 5,
    deadline: '05/09/2026',
    postedAt: '1 ngày trước',
    skills: ['Tin học văn phòng', 'Cẩn thận', 'Gõ phím nhanh'],
    shifts: [
      { dayOfWeek: 1, slot: 'afternoon' },
      { dayOfWeek: 3, slot: 'afternoon' },
      { dayOfWeek: 5, slot: 'afternoon' },
    ],
    matchScore: 81,
    description:
      'Nhập liệu hồ sơ khách hàng vào hệ thống nội bộ. Làm online hoàn toàn, giao việc theo tuần, tự sắp xếp giờ miễn hoàn thành đúng hạn.',
    requirements: ['Có laptop và mạng ổn định', 'Thành thạo Excel cơ bản', 'Cam kết tối thiểu 2 tháng'],
    benefits: ['Làm từ xa 100%', 'Thanh toán theo tháng', 'Có thể tăng khối lượng nếu làm tốt'],
  },
  {
    id: 'j5',
    title: 'Nhân viên bán hàng thời vụ Tết',
    company: 'Siêu thị Minh Phát',
    companyInitial: 'M',
    companyColor: 'bg-emerald-600',
    verified: true,
    district: 'Quận Gò Vấp',
    city: 'TP.HCM',
    salaryMin: 28000,
    salaryMax: 32000,
    salaryUnit: 'HOUR',
    scheduleType: 'SEASONAL',
    commitmentMonths: null,
    quantity: 10,
    deadline: '10/12/2026',
    postedAt: '2 ngày trước',
    skills: ['Giao tiếp', 'Bán hàng'],
    shifts: [
      { dayOfWeek: 0, slot: 'morning' },
      { dayOfWeek: 6, slot: 'morning' },
      { dayOfWeek: 6, slot: 'afternoon' },
    ],
    matchScore: 76,
    description:
      'Tuyển nhân viên bán hàng thời vụ dịp Tết, làm từ 15/12/2026 đến 20/01/2027. Sắp xếp hàng hoá, tư vấn khách, hỗ trợ thu ngân giờ cao điểm.',
    requirements: ['Làm được cuối tuần', 'Sức khoẻ tốt, đứng liên tục được'],
    benefits: ['Thưởng Tết theo doanh số', 'Được giảm giá mua hàng'],
  },
  {
    id: 'j6',
    title: 'Trợ giảng lớp tiếng Anh thiếu nhi',
    company: 'Anh ngữ Sunrise',
    companyInitial: 'A',
    companyColor: 'bg-indigo-500',
    verified: true,
    district: 'Quận Bình Thạnh',
    city: 'TP.HCM',
    salaryMin: 120000,
    salaryMax: 160000,
    salaryUnit: 'SHIFT',
    scheduleType: 'RECURRING',
    commitmentMonths: 4,
    quantity: 4,
    deadline: '25/08/2026',
    postedAt: '3 ngày trước',
    skills: ['Tiếng Anh', 'Yêu trẻ', 'Quản lý lớp'],
    shifts: [
      { dayOfWeek: 0, slot: 'morning' },
      { dayOfWeek: 6, slot: 'afternoon' },
    ],
    matchScore: 69,
    description:
      'Hỗ trợ giáo viên nước ngoài trong lớp tiếng Anh cho trẻ 6-10 tuổi: điểm danh, hỗ trợ hoạt động, quản lý lớp và liên lạc phụ huynh.',
    requirements: ['Tiếng Anh giao tiếp khá trở lên', 'Ưu tiên có chứng chỉ IELTS 6.0+'],
    benefits: ['Được dự giờ giáo viên bản ngữ', 'Cấp chứng nhận trợ giảng sau khoá'],
  },
]

export const SKILLS = [
  'Giao tiếp',
  'Bán hàng',
  'Pha chế cơ bản',
  'Tin học văn phòng',
  'Tiếng Anh',
  'Sư phạm',
  'Thiết kế',
  'Chăm sóc khách hàng',
  'Làm việc nhóm',
  'Quản lý lớp',
]

export const DISTRICTS = [
  'Quận 1',
  'Quận 3',
  'Quận 7',
  'Quận Bình Thạnh',
  'Quận Gò Vấp',
  'Quận Thủ Đức',
  'Làm từ xa',
]

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  RECURRING: 'Định kỳ',
  SEASONAL: 'Thời vụ',
  ONE_TIME: 'Một buổi',
}

/** Ứng viên giả cho màn hình nhà tuyển dụng xem danh sách ứng tuyển. */
export interface Applicant {
  id: string
  name: string
  university: string
  year: number
  skills: string[]
  matchScore: number
  appliedAt: string
  status: 'PENDING' | 'VIEWED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED'
}

export const APPLICANTS: Applicant[] = [
  {
    id: 'a1',
    name: 'Nguyễn Minh Anh',
    university: 'ĐH Kinh tế TP.HCM',
    year: 2,
    skills: ['Giao tiếp', 'Pha chế cơ bản', 'Chăm sóc khách hàng'],
    matchScore: 96,
    appliedAt: '03/08/2026',
    status: 'SHORTLISTED',
  },
  {
    id: 'a2',
    name: 'Trần Quốc Bảo',
    university: 'ĐH Bách khoa TP.HCM',
    year: 3,
    skills: ['Giao tiếp', 'Làm việc nhóm'],
    matchScore: 84,
    appliedAt: '03/08/2026',
    status: 'VIEWED',
  },
  {
    id: 'a3',
    name: 'Lê Thu Hà',
    university: 'ĐH Sư phạm TP.HCM',
    year: 1,
    skills: ['Giao tiếp', 'Chăm sóc khách hàng'],
    matchScore: 78,
    appliedAt: '02/08/2026',
    status: 'PENDING',
  },
  {
    id: 'a4',
    name: 'Phạm Gia Huy',
    university: 'ĐH Công nghiệp TP.HCM',
    year: 4,
    skills: ['Bán hàng'],
    matchScore: 61,
    appliedAt: '01/08/2026',
    status: 'REJECTED',
  },
]

export const STATUS_LABELS: Record<Applicant['status'], string> = {
  PENDING: 'Chờ xem',
  VIEWED: 'Đã xem',
  SHORTLISTED: 'Vào vòng trong',
  ACCEPTED: 'Đã nhận',
  REJECTED: 'Đã từ chối',
}
