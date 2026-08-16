/**
 * Hợp đồng giữa web và api.
 *
 * Mọi endpoint đều trả về một trong hai hình dạng dưới đây, không có ngoại lệ.
 * Nhờ vậy phía web chỉ cần viết một chỗ xử lý lỗi, thay vì mỗi lời gọi API lại
 * đoán xem lần này server trả về gì.
 */

/** Response khi mọi thứ ổn. */
export interface ApiSuccess<T> {
  ok: true
  data: T
}

/** Response khi có lỗi. `code` để máy đọc, `message` để hiện cho người dùng. */
export interface ApiFailure {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    /** Lỗi validate: từng trường sai vì lý do gì. */
    details?: Record<string, string[]>
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

/**
 * Danh sách mã lỗi cố định.
 *
 * Dùng mã thay vì so sánh chuỗi message: message có thể sửa lại cho dễ đọc,
 * hoặc dịch sang tiếng khác, mà không làm hỏng chỗ nào đang bắt lỗi.
 */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/** GET /api/health — endpoint dùng để ping giữ Render không ngủ. */
export interface HealthResponse {
  status: 'ok'
  /** Số giây process đã chạy. Reset về gần 0 nghĩa là instance vừa bị đánh thức. */
  uptime: number
  version: string
}

/**
 * Một kỹ năng trong danh mục do admin quản lý.
 *
 * Cố tình KHÔNG phải là kiểu Skill mà Prisma sinh ra. Kiểu của Prisma phản ánh
 * cột trong database, gồm cả những thứ người dùng không cần biết như createdAt.
 * Tách riêng ở đây để thêm cột mới vào bảng không vô tình lộ ra ngoài API.
 */
export interface SkillResponse {
  id: string
  name: string
  /** Dạng không dấu, dùng cho URL lọc: /viec-lam?skill=pha-che */
  slug: string
}

/**
 * GET /api/thong-ke — số liệu hiện trên trang chủ.
 *
 * Hiện web đang dùng số mô phỏng (xem apps/web/src/hooks/useSiteStats.ts), api
 * chưa có endpoint này. Kiểu được khai sẵn ở đây, tức là ở đúng chỗ mà mọi hợp
 * đồng giữa hai phía được khai, vì hai lý do:
 *
 * - Người viết api sau này có sẵn hình dạng phải trả về, không phải đi đọc JSX
 *   để đoán trang chủ đang cần những con số nào.
 * - Ngày endpoint thật lên, phía web chỉ đổi đúng một dòng trong useSiteStats;
 *   nếu api trả thiếu trường nào thì TypeScript báo ngay lúc biên dịch chứ
 *   không phải đợi nhìn thấy "NaN" trên màn hình.
 *
 * Đây đều là số ĐẾM ĐƯỢC từ database, không phải số marketing bịa ra — mỗi
 * trường dưới đây tương ứng một câu đếm trên bảng có thật.
 */
export interface SiteStatsResponse {
  /**
   * Lúc số liệu được chốt, dạng ISO 8601. Trang chủ hiện dòng "Cập nhật ...".
   *
   * Cần trường này vì các số dưới đây gần như chắc chắn sẽ được tính sẵn theo
   * chu kỳ rồi lưu lại, chứ không đếm trực tiếp mỗi lần có người mở trang chủ —
   * đếm trên vài bảng lớn cho mỗi lượt truy cập là cách nhanh nhất để giết
   * database. Khi đó "bây giờ" và "lúc số liệu được tính" là hai thời điểm khác
   * nhau, và người đọc có quyền biết mình đang nhìn số của lúc nào.
   */
  computedAt: string

  /** Khối "Thị trường việc làm hôm nay" — nhịp độ của tuần đang chạy. */
  market: {
    /** Số đơn ứng tuyển tạo trong 7 ngày gần nhất. */
    applicationsThisWeek: number
    /** Tổng số giờ của các ca đã ghép thành công. */
    matchedHours: number
    /** Lượt xem trang chi tiết tin tuyển dụng. */
    jobViews: number
    /**
     * Thay đổi so với tuần liền trước, tính bằng phần trăm.
     * Số âm nghĩa là giảm — giao diện tự đổi chữ và mũi tên theo dấu.
     */
    changePercent: number
    /**
     * Lượt ứng tuyển 12 tuần gần nhất, tuần cũ nhất đứng đầu mảng.
     * Giao diện vẽ thành biểu đồ nên độ dài mảng bao nhiêu cũng chạy được.
     */
    weeklyApplications: number[]
  }

  /** Khối "Con số ấn tượng" — số cộng dồn từ lúc mở nền tảng tới nay. */
  lifetime: {
    jobSearches: number
    studentProfiles: number
    matchedHours: number
    jobViews: number
  }

  /** Sinh viên có hoạt động trong 7 ngày gần nhất, hiện ở huy hiệu đầu trang. */
  activeStudentsThisWeek: number
}
