import type { ScheduleType } from '@uniwork/shared'

/**
 * Dữ liệu mô phỏng cho khu quản trị.
 *
 * Gom về một file để sau này thay bằng API chỉ phải sửa chỗ gọi, không phải đi
 * lùng từng mảng nằm rải trong JSX. Mọi trường ở đây đều bám theo luồng nghiệp
 * vụ đã chốt trong README — trạng thái tin, trạng thái xác minh doanh nghiệp,
 * loại giấy tờ, trạng thái đơn ứng tuyển — chứ không phải bịa cho đầy bảng.
 *
 * Khi có API thật, mỗi mảng dưới đây tương ứng một endpoint:
 *   PENDING_JOBS       -> GET /api/admin/tin-tuyen-dung?status=PENDING  (Sprint 2)
 *   EMPLOYER_JOBS      -> GET /api/ntd/tin-tuyen-dung                   (Sprint 2)
 *   EMPLOYER_APPLICANTS-> GET /api/ntd/don-ung-tuyen                    (Sprint 4)
 *
 * Đã thay bằng dữ liệu thật và xoá khỏi file này:
 *   ADMIN_USERS        -> GET /api/admin/nguoi-dung
 *   PENDING_EMPLOYERS  -> GET /api/admin/nha-tuyen-dung
 *   ADMIN_SKILLS       -> GET /api/admin/ky-nang
 */

export type JobReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ApplicationStatus = 'SUBMITTED' | 'REVIEWING' | 'ACCEPTED' | 'REJECTED'

export interface PendingJob {
  id: string
  title: string
  company: string
  district: string
  scheduleType: ScheduleType
  salaryText: string
  quantity: number
  submittedAt: string
  status: JobReviewStatus
  /** Cờ do hệ thống tự gắn khi tin có dấu hiệu đáng ngờ (README mục 7). */
  flags: string[]
}

export const PENDING_JOBS: PendingJob[] = [
  {
    id: 'j-101',
    title: 'Phục vụ quán cà phê ca tối',
    company: 'The Corner Coffee',
    district: 'Quận 1',
    scheduleType: 'RECURRING',
    salaryText: '25.000 - 30.000đ/giờ',
    quantity: 2,
    submittedAt: '12 phút trước',
    status: 'PENDING',
    flags: [],
  },
  {
    id: 'j-102',
    title: 'Nhân viên hỗ trợ sự kiện âm nhạc',
    company: 'Sao Việt Event',
    district: 'Quận 7',
    scheduleType: 'ONE_TIME',
    salaryText: '350.000đ/ca',
    quantity: 20,
    submittedAt: '38 phút trước',
    status: 'PENDING',
    flags: ['Doanh nghiệp chưa xác minh'],
  },
  {
    id: 'j-103',
    title: 'Tuyển gấp CTV nhập liệu, lương cao',
    company: 'Công ty TNHH An Phát Lộc',
    district: 'Làm từ xa',
    scheduleType: 'RECURRING',
    salaryText: '8.000.000 - 15.000.000đ/tháng',
    quantity: 50,
    submittedAt: '1 giờ trước',
    status: 'PENDING',
    flags: ['Lương lệch xa mặt bằng', 'Số lượng tuyển bất thường'],
  },
  {
    id: 'j-104',
    title: 'Trợ giảng lớp tiếng Anh thiếu nhi',
    company: 'Anh ngữ Sunrise',
    district: 'Quận Bình Thạnh',
    scheduleType: 'RECURRING',
    salaryText: '120.000 - 160.000đ/ca',
    quantity: 4,
    submittedAt: '3 giờ trước',
    status: 'APPROVED',
    flags: [],
  },
  {
    id: 'j-105',
    title: 'Nhân viên bán hàng thời vụ Tết',
    company: 'Siêu thị Minh Phát',
    district: 'Quận Gò Vấp',
    scheduleType: 'SEASONAL',
    salaryText: '28.000 - 32.000đ/giờ',
    quantity: 10,
    submittedAt: '5 giờ trước',
    status: 'PENDING',
    flags: [],
  },
  {
    id: 'j-106',
    title: 'Việc nhẹ lương cao tại nhà, không cần kinh nghiệm',
    company: 'Thương mại Đại Lợi',
    district: 'Làm từ xa',
    scheduleType: 'ONE_TIME',
    salaryText: '900.000đ/ca',
    quantity: 100,
    submittedAt: '6 giờ trước',
    status: 'REJECTED',
    flags: ['Dấu hiệu lừa đảo', 'Yêu cầu đặt cọc'],
  },
  {
    id: 'j-107',
    title: 'Gia sư Toán lớp 9',
    company: 'Trung tâm Trí Việt',
    district: 'Quận Thủ Đức',
    scheduleType: 'RECURRING',
    salaryText: '150.000 - 200.000đ/ca',
    quantity: 3,
    submittedAt: '8 giờ trước',
    status: 'APPROVED',
    flags: [],
  },
  {
    id: 'j-108',
    title: 'Cộng tác viên nhập liệu online',
    company: 'DataLine Việt Nam',
    district: 'Làm từ xa',
    scheduleType: 'RECURRING',
    salaryText: '2.000.000 - 3.500.000đ/tháng',
    quantity: 5,
    submittedAt: '1 ngày trước',
    status: 'PENDING',
    flags: [],
  },
]

export interface EmployerJob {
  id: string
  title: string
  scheduleType: ScheduleType
  status: 'DRAFT' | 'PENDING' | 'OPEN' | 'CLOSED'
  views: number
  applications: number
  quantity: number
  deadline: string
}

export const EMPLOYER_JOBS: EmployerJob[] = [
  {
    id: 'ej1',
    title: 'Phục vụ quán cà phê ca tối',
    scheduleType: 'RECURRING',
    status: 'OPEN',
    views: 1_284,
    applications: 34,
    quantity: 2,
    deadline: '30/08/2026',
  },
  {
    id: 'ej2',
    title: 'Pha chế ca sáng cuối tuần',
    scheduleType: 'RECURRING',
    status: 'OPEN',
    views: 862,
    applications: 19,
    quantity: 3,
    deadline: '12/09/2026',
  },
  {
    id: 'ej3',
    title: 'Hỗ trợ khai trương chi nhánh Quận 3',
    scheduleType: 'ONE_TIME',
    status: 'PENDING',
    views: 0,
    applications: 0,
    quantity: 12,
    deadline: '25/08/2026',
  },
  {
    id: 'ej4',
    title: 'Thu ngân ca chiều',
    scheduleType: 'RECURRING',
    status: 'DRAFT',
    views: 0,
    applications: 0,
    quantity: 1,
    deadline: '—',
  },
  {
    id: 'ej5',
    title: 'Nhân viên phục vụ dịp lễ 2/9',
    scheduleType: 'SEASONAL',
    status: 'CLOSED',
    views: 2_140,
    applications: 68,
    quantity: 15,
    deadline: '20/08/2026',
  },
]

export interface EmployerApplicant {
  id: string
  name: string
  school: string
  year: string
  matchScore: number
  jobTitle: string
  appliedAt: string
  status: ApplicationStatus
}

export const EMPLOYER_APPLICANTS: EmployerApplicant[] = [
  {
    id: 'a1',
    name: 'Trần Thị Bảo Ngọc',
    school: 'ĐH Công nghệ Thông tin',
    year: 'Năm 3',
    matchScore: 94,
    jobTitle: 'Phục vụ quán cà phê ca tối',
    appliedAt: '20 phút trước',
    status: 'SUBMITTED',
  },
  {
    id: 'a2',
    name: 'Nguyễn Minh Khang',
    school: 'ĐH Sư phạm Kỹ thuật TP.HCM',
    year: 'Năm 2',
    matchScore: 88,
    jobTitle: 'Phục vụ quán cà phê ca tối',
    appliedAt: '1 giờ trước',
    status: 'REVIEWING',
  },
  {
    id: 'a3',
    name: 'Phạm Gia Huy',
    school: 'ĐH Kinh tế TP.HCM',
    year: 'Năm 1',
    matchScore: 81,
    jobTitle: 'Pha chế ca sáng cuối tuần',
    appliedAt: '3 giờ trước',
    status: 'REVIEWING',
  },
  {
    id: 'a4',
    name: 'Lê Hoàng Phúc',
    school: 'ĐH Khoa học Tự nhiên',
    year: 'Năm 4',
    matchScore: 76,
    jobTitle: 'Pha chế ca sáng cuối tuần',
    appliedAt: '1 ngày trước',
    status: 'ACCEPTED',
  },
  {
    id: 'a5',
    name: 'Đặng Thuỳ Linh',
    school: 'ĐH Ngoại thương CS2',
    year: 'Năm 2',
    matchScore: 62,
    jobTitle: 'Phục vụ quán cà phê ca tối',
    appliedAt: '2 ngày trước',
    status: 'REJECTED',
  },
]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Mới nộp',
  REVIEWING: 'Đang xem',
  ACCEPTED: 'Đã nhận',
  REJECTED: 'Từ chối',
}

export const JOB_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng',
} as const
