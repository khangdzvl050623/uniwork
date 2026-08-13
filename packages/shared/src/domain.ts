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
