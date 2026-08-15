/**
 * Các giá trị cố định của nghiệp vụ, khai một lần dùng cho cả hai phía.
 *
 * Vì sao khai bằng mảng `as const` rồi mới suy ra type, thay vì dùng `enum`:
 * mảng này vừa là **type** lúc biên dịch, vừa là **dữ liệu** lúc chạy. Nhờ đó
 * web dựng được ô select từ chính danh sách này, và api dùng nó để validate —
 * hai bên không thể lệch nhau vì chỉ có một nguồn.
 */

export const ROLES = ['STUDENT', 'EMPLOYER', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

/** Cách bố trí thời gian của tin tuyển dụng (README mục 5). */
export const SCHEDULE_TYPES = ['RECURRING', 'SEASONAL', 'ONE_TIME'] as const
export type ScheduleType = (typeof SCHEDULE_TYPES)[number]

export const JOB_STATUSES = ['DRAFT', 'PENDING', 'OPEN', 'CLOSED'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const APPLICATION_STATUSES = [
  'PENDING',
  'VIEWED',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** Cách quy đổi con số lương của tin tuyển dụng. */
export const SALARY_UNITS = ['HOUR', 'SHIFT', 'MONTH'] as const
export type SalaryUnit = (typeof SALARY_UNITS)[number]

/**
 * Ba khung giờ trong ngày.
 *
 * Chia sẵn thành ba khung thay vì cho nhập giờ tự do là quyết định có chủ đích:
 * nhờ đó lịch rảnh của sinh viên và ca làm của tin cùng một tập giá trị rời rạc,
 * và việc ghép hai bên trở thành phép giao tập hợp — một câu JOIN, không phải
 * bài toán so khoảng thời gian chồng lấn.
 */
export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const
export type TimeSlot = (typeof TIME_SLOTS)[number]

export const TIME_SLOT_LABELS: Record<TimeSlot, { label: string; range: string }> = {
  MORNING: { label: 'Sáng', range: '06:00 – 12:00' },
  AFTERNOON: { label: 'Chiều', range: '12:00 – 18:00' },
  EVENING: { label: 'Tối', range: '18:00 – 22:00' },
}

/** Giấy tờ nhà tuyển dụng nộp để được xác minh (BRD Đăng tin). */
export const DOCUMENT_TYPES = ['BUSINESS_LICENSE', 'TAX_CODE', 'ID_CARD'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  TAX_CODE: 'Mã số thuế',
  ID_CARD: 'CCCD người đại diện',
}

/** Kết quả admin xét duyệt một giấy tờ. */
export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/**
 * 0 = Chủ nhật ... 6 = Thứ 7.
 *
 * Theo đúng quy ước của `Date.prototype.getDay()` trong JavaScript, để không
 * phải cộng trừ khi chuyển đổi. Chỗ nào cần hiển thị thứ 2 trước thì tự sắp
 * lại lúc render, còn dữ liệu lưu vẫn theo chuẩn này.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'CN',
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
}
