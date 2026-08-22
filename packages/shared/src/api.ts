import type {
  DayOfWeek,
  DocumentType,
  JobStatus,
  ReviewStatus,
  Role,
  SalaryUnit,
  ScheduleType,
  TimeSlot,
  UserStatus,
} from './domain.js'

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
  /**
   * Máy chủ có cấu hình đăng nhập Google hay không.
   *
   * Đặt ở đây thay vì dựng một endpoint riêng vì web vốn đã gọi /api/health
   * ngay lúc mở trang (để đánh thức Render) — nhờ vậy biết được thông tin này
   * mà không tốn thêm một vòng mạng nào.
   *
   * Web dùng nó để quyết định có hiện nút "Đăng nhập bằng Google" không. Hiện
   * một nút bấm vào là lỗi thì tệ hơn hẳn so với không hiện.
   */
  googleSanSang: boolean
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

/*
 * ===========================================================================
 * Auth — Sprint 1
 * ===========================================================================
 *
 * Đây là hợp đồng DEV2 dựng form theo. Chốt trước khi viết service, vì phía
 * web bị chặn cho tới khi có nó.
 *
 * Nguyên tắc xuyên suốt: KHÔNG bao giờ có `passwordHash`, `tokenHash`, hay
 * refresh token trong bất kỳ kiểu nào dưới đây. Refresh token đi bằng cookie
 * httpOnly, không đi qua body — nên nó không được phép xuất hiện ở đây, và
 * việc nó vắng mặt chính là thứ ngăn ai đó vô tình trả nó ra.
 */

/** Người dùng đang đăng nhập, ở dạng an toàn để gửi ra ngoài. */
export interface AuthUser {
  id: string
  email: string
  role: Role
  /** null nghĩa là chưa xác thực email. Web dùng để hiện nhắc nhở. */
  emailVerifiedAt: string | null
  /** Tên hiển thị: họ tên sinh viên, hoặc tên công ty. */
  displayName: string
}

/**
 * Trả về sau khi đăng ký, đăng nhập, hoặc refresh.
 *
 * `accessToken` nằm trong body để web giữ TRONG BỘ NHỚ. Không đặt nó vào
 * cookie: cookie tự động đi kèm mọi request, kể cả request do trang khác kích
 * hoạt — đó là cửa cho tấn công CSRF. Còn refresh token thì ngược lại, nó nằm
 * trong cookie httpOnly để JavaScript không đọc được.
 */
export interface AuthTokens {
  accessToken: string
  /** Số giây access token còn sống, để web hẹn giờ gọi refresh trước khi hết. */
  expiresIn: number
  user: AuthUser
}

/** Vai trò được phép tự đăng ký. ADMIN chỉ tạo bằng seed hoặc bởi admin khác. */
export const SIGNUP_ROLES = ['STUDENT', 'EMPLOYER'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

/** Khoảng thời gian cho bộ lọc của dashboard. */
export const STATS_RANGES = ['7d', '30d', '90d', '1y'] as const
export type StatsRange = (typeof STATS_RANGES)[number]

/** Một ô KPI: số hiện tại kèm chuỗi giá trị để vẽ biểu đồ thu nhỏ. */
export interface KpiMetric {
  value: number
  /** Thay đổi so với kỳ trước, phần trăm. Âm nghĩa là giảm. */
  changePercent: number
  /**
   * Chuỗi giá trị theo thời gian dùng vẽ sparkline. Độ dài đổi theo khoảng lọc
   * và giao diện không giả định con số nào, nên trả 7 hay 365 điểm đều vẽ được.
   */
  series: number[]
}

/**
 * GET /api/admin/thong-ke?range=30d — số liệu trang tổng quan khu quản trị.
 *
 * Cùng lý do như SiteStatsResponse: khai kiểu ở đây để phía api có sẵn hình
 * dạng phải trả về, và để web đổi nguồn dữ liệu mà không phải sửa giao diện.
 *
 * Endpoint này PHẢI chặn theo quyền — chỉ ROLE ADMIN đọc được. Khác với
 * /api/thong-ke vốn là số công khai, ở đây có số lượng hồ sơ chờ duyệt và
 * thông tin doanh nghiệp chưa xác minh.
 */
export interface AdminStatsResponse {
  computedAt: string
  range: StatsRange

  /** Bốn ô KPI trên cùng trang tổng quan. */
  pendingJobs: KpiMetric
  pendingEmployers: KpiMetric
  students: KpiMetric
  employers: KpiMetric

  /** Biểu đồ đường: tin đăng mới và lượt ứng tuyển theo thời gian. */
  trend: {
    /** Nhãn trục ngang, cùng độ dài với hai chuỗi bên dưới. */
    labels: string[]
    newJobs: number[]
    applications: number[]
  }

  /** Biểu đồ tròn: phân bố tin theo kiểu bố trí thời gian. */
  scheduleMix: { type: ScheduleType; count: number }[]

  /** Chỉ tiêu duyệt trong kỳ: đã làm được bao nhiêu trên mục tiêu bao nhiêu. */
  reviewGoals: { label: string; current: number; target: number }[]
}

/*
 * ===========================================================================
 * Hồ sơ — Sprint 1 tuần 3 (T51–T55)
 * ===========================================================================
 *
 * Mọi endpoint dưới đây đều thao tác trên hồ sơ CỦA CHÍNH người gọi — không có
 * id người khác trong tham số. Nhờ vậy "sửa hồ sơ người khác" không phải là
 * một nhánh cần kiểm tra riêng, nó đơn giản là không tồn tại đường gọi nào để
 * làm việc đó.
 */

/** Hồ sơ sinh viên, dùng cả cho GET /api/toi và GET /api/toi/ho-so-sinh-vien. */
export interface StudentProfileResponse {
  fullName: string
  university: string | null
  major: string | null
  year: number | null
  bio: string | null
  phone: string | null
  /** Đường dẫn Cloudinary tới CV đã tải lên. null nghĩa là chưa có (T56). */
  cvUrl: string | null
  expectedHourlyRate: number | null
  skills: SkillResponse[]
}

/** Sửa trường, ngành, năm học, giới thiệu (T52). Không sửa kỹ năng hay CV ở đây. */
export interface UpdateStudentProfileInput {
  university?: string | null
  major?: string | null
  year?: number | null
  bio?: string | null
}

/**
 * Một giấy tờ NTD đã nộp (T57).
 *
 * KHÔNG có trường URL/đường dẫn file ở đây — giấy tờ lưu ở chế độ Cloudinary
 * `authenticated` (riêng tư, khác CV công khai ở T56), nên không có địa chỉ
 * nào xem được trực tiếp. Muốn xem phải gọi riêng
 * `GET /api/toi/giay-to/:type/xem` để xin một signed URL sống vài phút.
 */
export interface EmployerDocumentResponse {
  type: DocumentType
  status: ReviewStatus
  /** Lý do admin từ chối, có giá trị khi status = REJECTED. */
  reviewNote: string | null
  reviewedAt: string | null
  submittedAt: string
}

/** Trả về khi xin xem một giấy tờ (T57) — URL chỉ sống trong vài phút. */
export interface DocumentViewUrlResponse {
  url: string
  expiresAt: string
}

/** Hồ sơ nhà tuyển dụng, dùng cả cho GET /api/toi và GET /api/toi/ho-so-ntd. */
export interface EmployerProfileResponse {
  companyName: string
  description: string | null
  address: string | null
  website: string | null
  logoUrl: string | null
  contactName: string | null
  phone: string | null
  /** null nghĩa là chưa được admin duyệt giấy tờ — vẫn sửa hồ sơ được, chỉ chưa đăng tin được. */
  verifiedAt: string | null
  /** Giấy tờ đã nộp, tối đa 3 (mỗi DocumentType một bản hiện hành). */
  documents: EmployerDocumentResponse[]
}

/** Sửa tên công ty, mô tả, địa chỉ, website (T53). */
export interface UpdateEmployerProfileInput {
  companyName: string
  description?: string | null
  address?: string | null
  website?: string | null
}

/** GET /api/toi (T51) — hồ sơ đầy đủ của người đang đăng nhập. */
export interface MeResponse {
  id: string
  email: string
  role: Role
  status: UserStatus
  emailVerifiedAt: string | null
  displayName: string
  createdAt: string
  /** Có giá trị khi role = STUDENT, ngược lại null. */
  studentProfile: StudentProfileResponse | null
  /** Có giá trị khi role = EMPLOYER, ngược lại null. */
  employerProfile: EmployerProfileResponse | null
}

/** PUT /api/toi/ky-nang (T54) — thay TOÀN BỘ danh sách, không phải thêm/bớt từng cái. */
export interface UpdateSkillsInput {
  skillIds: string[]
}

/** Một ô trong lưới 7 ngày × 3 khung giờ. */
export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek
  slot: TimeSlot
}

/** GET /api/toi/lich-ranh (T55). */
export interface AvailabilityResponse {
  slots: AvailabilitySlot[]
}

/** PUT /api/toi/lich-ranh (T55) — thay TOÀN BỘ lưới trong một lần gọi. */
export interface UpdateAvailabilityInput {
  slots: AvailabilitySlot[]
}

/*
 * ===========================================================================
 * Quản trị
 * ===========================================================================
 */

/** Một hàng trong bảng "Người dùng" của khu quản trị. */
export interface AdminUserResponse {
  id: string
  displayName: string
  email: string
  role: Role
  status: UserStatus
  /** Tên trường/ĐH — null với nhà tuyển dụng và admin, chỉ sinh viên mới có. */
  school: string | null
  joinedAt: string
  /** Số đơn ứng tuyển đã nộp. Luôn 0 với nhà tuyển dụng và admin. */
  applicationCount: number
}

/** GET /api/admin/nguoi-dung — danh sách toàn bộ người dùng. */
export interface AdminUserListResponse {
  users: AdminUserResponse[]
}

/** PUT /api/admin/nguoi-dung/:id/trang-thai. */
export interface UpdateUserStatusInput {
  status: UserStatus
}

/**
 * Một hồ sơ nhà tuyển dụng trong hàng đợi duyệt giấy tờ của admin.
 *
 * Cố ý KHÔNG có `taxCode` hay `openJobs` như bản dựng giả trước đây: mã số thuế
 * là một GIẤY TỜ (`DocumentType.TAX_CODE`) chứ không phải một cột, và số tin
 * đang mở thì chưa tồn tại vì module tin tuyển dụng thuộc Sprint 2.
 */
export interface AdminEmployerResponse {
  /** id của `EmployerProfile`. Dùng cho mọi endpoint duyệt bên dưới. */
  id: string
  /** id của `User` — cần cho việc khoá tài khoản, khác với `id` ở trên. */
  userId: string
  companyName: string
  email: string
  contactName: string | null
  phone: string | null
  address: string | null
  website: string | null
  /** null nghĩa là chưa được xác minh. Đây là KẾT LUẬN, `documents` là chứng cứ. */
  verifiedAt: string | null
  /** Tài khoản đã bị khoá hay chưa — admin cần thấy ngay trong cùng một bảng. */
  accountStatus: UserStatus
  /** CHỈ những giấy tờ đã nộp. Loại chưa nộp thì vắng mặt, không có hàng giả. */
  documents: EmployerDocumentResponse[]
  createdAt: string
}

/** GET /api/admin/nha-tuyen-dung. */
export interface AdminEmployerListResponse {
  employers: AdminEmployerResponse[]
}

/** PUT /api/admin/nha-tuyen-dung/:id/giay-to/:type — duyệt hoặc từ chối MỘT giấy tờ. */
export interface ReviewDocumentInput {
  status: Extract<ReviewStatus, 'APPROVED' | 'REJECTED'>
  /** Bắt buộc khi từ chối: nhà tuyển dụng cần biết phải nộp lại thứ gì. */
  reviewNote?: string | null
}

/**
 * PUT /api/admin/nha-tuyen-dung/:id/xac-minh — chốt hoặc thu hồi xác minh.
 *
 * Tách khỏi việc duyệt từng giấy tờ vì đây là hai hành động khác hẳn nhau: duyệt
 * giấy tờ là ghi nhận chứng cứ, xác minh là kết luận. Tách ra thì "thu hồi xác
 * minh" (chế tài với NTD có dấu hiệu lừa đảo) không đòi phải bịa ra một lý do
 * từ chối giấy tờ nào cả.
 */
export interface VerifyEmployerInput {
  verified: boolean
}

/**
 * Một dòng trong bảng "Danh mục kỹ năng" của khu quản trị.
 *
 * Có HAI con số đếm chứ không phải một. Cả `JobSkill` lẫn `StudentSkill` đều
 * tham chiếu `Skill` với `onDelete: Restrict`, nên chỉ cần một trong hai còn
 * dùng là không xoá được. Trả mỗi `jobCount` thì admin thấy "0 tin" mà bấm xoá
 * vẫn lỗi, không hiểu vì sao — hoá ra 5 sinh viên đang khai kỹ năng đó.
 */
export interface AdminSkillResponse {
  id: string
  name: string
  /** Khoá tra cứu ổn định, dùng trong URL lọc. Đổi `name` KHÔNG đổi cái này. */
  slug: string
  /** Số tin tuyển dụng đang yêu cầu kỹ năng này. */
  jobCount: number
  /** Số sinh viên đang khai kỹ năng này trong hồ sơ. */
  studentCount: number
}

/** GET /api/admin/ky-nang. */
export interface AdminSkillListResponse {
  skills: AdminSkillResponse[]
}

/** POST /api/admin/ky-nang — slug do server sinh từ `name`, không nhận từ client. */
export interface CreateSkillInput {
  name: string
}

/**
 * PUT /api/admin/ky-nang/:id — CHỈ đổi được tên hiển thị.
 *
 * `slug` cố ý không sửa được: tin tuyển dụng và link lọc (`/viec-lam?skill=pha-che`)
 * tham chiếu kỹ năng bằng slug. Cho đổi slug là làm chết mọi link đã phát ra
 * ngoài, đổi lại chỉ được một chuỗi đẹp hơn trong URL.
 */
export interface UpdateSkillInput {
  name: string
}

/*
 * ===========================================================================
 * Tin tuyển dụng — Sprint 2
 * ===========================================================================
 */

/**
 * Một ca làm: một ô trong lưới 7 ngày × 3 buổi.
 *
 * Cùng hình dạng với `AvailabilitySlot` của sinh viên, và đó là chủ đích — nhờ
 * vậy phép ghép lịch ở Sprint 3 chỉ là một câu JOIN chứ không phải thuật toán
 * so khoảng thời gian.
 */
export interface JobShiftItem {
  /**
   * 0 = Chủ nhật … 6 = Thứ 7, theo `Date.prototype.getDay()`.
   *
   * Dùng `DayOfWeek` (hợp của 7 số) chứ không phải `number`, đúng như
   * `AvailabilitySlot`. Nhờ vậy một component lưới duy nhất phục vụ được cả
   * việc khai lịch rảnh lẫn việc chọn ca làm — nếu một bên là `number` thì
   * TypeScript coi hai kiểu là khác nhau và phải có một lớp ép kiểu ở giữa,
   * đúng chỗ dễ lọt giá trị 7 vào mà không ai chặn.
   */
  dayOfWeek: DayOfWeek
  slot: TimeSlot
}

/** Kỹ năng gắn trên tin — đủ để hiện nhãn và dựng link lọc, không hơn. */
export interface JobSkillItem {
  id: string
  name: string
  slug: string
}

/**
 * Tin tuyển dụng nhìn từ phía NHÀ TUYỂN DỤNG (chủ tin).
 *
 * Khác bản công khai ở chỗ có `status`, `rejectionReason` và các mốc thời gian
 * nội bộ — chủ tin cần biết tin đang nằm ở đâu trong luồng duyệt và vì sao bị
 * từ chối. Bản công khai (Sprint 2, T79–T80) sẽ không có những trường này.
 */
export interface EmployerJobResponse {
  id: string
  title: string
  description: string
  requirements: string[]
  benefits: string[]

  city: string
  district: string
  quantity: number

  /** true = "Thoả thuận", và khi đó `salaryMin`/`salaryMax` LUÔN null. */
  salaryNegotiable: boolean
  salaryMin: number | null
  salaryMax: number | null
  /** Bắt buộc kể cả khi thoả thuận — "thoả thuận theo giờ" khác "theo tháng". */
  salaryUnit: SalaryUnit

  scheduleType: ScheduleType
  /** Chỉ RECURRING mới có. */
  commitmentMonths: number | null
  /** RECURRING và SEASONAL. Vô nghĩa với ONE_TIME nên luôn null ở đó. */
  minShiftsPerWeek: number | null
  /** RECURRING (tuỳ chọn) và SEASONAL (bắt buộc). */
  startDate: string | null
  /** Chỉ SEASONAL. */
  endDate: string | null
  /** Chỉ ONE_TIME. */
  workDate: string | null

  deadline: string

  status: JobStatus
  /** Lý do admin từ chối, để chủ tin biết phải sửa gì trước khi gửi lại. */
  rejectionReason: string | null
  publishedAt: string | null
  closedAt: string | null
  viewCount: number

  shifts: JobShiftItem[]
  skills: JobSkillItem[]

  createdAt: string
  updatedAt: string
}

/** GET /api/ntd/tin-tuyen-dung — mọi tin của chính mình, đủ mọi trạng thái. */
export interface EmployerJobListResponse {
  jobs: EmployerJobResponse[]
}

/**
 * Dữ liệu tạo/sửa một tin.
 *
 * Ba nhóm trường thời gian loại trừ nhau theo `scheduleType`, và luật đó được
 * canh ở BA tầng: form ẩn/hiện ô, `createJobSchema` phía shared, và CHECK
 * `jobs_schedule_fields_check` trong database. Xem bảng luật trong
 * `validation.ts`.
 *
 * `slug`/`status`/`publishedAt` KHÔNG có ở đây — chúng do server quyết định.
 * Tin luôn sinh ra ở `DRAFT`, muốn công khai phải đi qua gửi duyệt và admin
 * duyệt.
 */
export interface CreateJobInput {
  title: string
  description: string
  requirements: string[]
  benefits: string[]

  city: string
  district: string
  quantity: number

  salaryNegotiable: boolean
  salaryMin?: number | null
  salaryMax?: number | null
  salaryUnit: SalaryUnit

  scheduleType: ScheduleType
  commitmentMonths?: number | null
  minShiftsPerWeek?: number | null
  /** Gửi lên dạng chuỗi ISO; server tự đổi sang Date. */
  startDate?: string | null
  endDate?: string | null
  workDate?: string | null

  deadline: string

  /** Bắt buộc có ít nhất một ca — thiếu ca thì tin không lọc theo lịch được. */
  shifts: JobShiftItem[]
  skillIds: string[]
}

/** Sửa tin: cùng hình dạng với lúc tạo, thay TOÀN BỘ nội dung. */
export type UpdateJobInput = CreateJobInput

/**
 * Tin trong hàng đợi duyệt của admin.
 *
 * Là `EmployerJobResponse` cộng thông tin doanh nghiệp. Admin cần ĐỦ nội dung
 * tin để phán đoán — nhất là `description`, nơi tin lừa đảo thật sự nằm — nên
 * không cắt bớt thành một bản tóm tắt rồi bắt gọi thêm một endpoint chi tiết.
 */
export interface AdminJobResponse extends EmployerJobResponse {
  employer: {
    /** id của `EmployerProfile`. */
    id: string
    companyName: string
    /** null nghĩa là chưa xác minh — tin của họ đáng ngờ hơn hẳn. */
    verifiedAt: string | null
  }
}

/** GET /api/admin/tin-tuyen-dung?status=PENDING */
export interface AdminJobListResponse {
  jobs: AdminJobResponse[]
}

/**
 * PUT /api/admin/tin-tuyen-dung/:id/duyet
 *
 * Dùng động từ nghiệp vụ (`APPROVE`/`REJECT`) thay vì trạng thái đích. Duyệt
 * đưa tin sang `OPEN`, còn từ chối đưa về `DRAFT` — không phải một enum đối
 * xứng nào cả, nên gọi tên theo QUYẾT ĐỊNH thì đọc code rõ hơn là bắt người
 * viết nhớ "REJECT nghĩa là DRAFT".
 */
export interface ReviewJobInput {
  decision: 'APPROVE' | 'REJECT'
  /** Bắt buộc khi từ chối: nhà tuyển dụng cần biết phải sửa gì. */
  rejectionReason?: string | null
}

/*
 * ---------------------------------------------------------------------------
 * Tin tuyển dụng — bản CÔNG KHAI (T79–T80)
 * ---------------------------------------------------------------------------
 *
 * Cố ý KHÔNG kế thừa `EmployerJobResponse`. Kiểu đó mang `status`,
 * `rejectionReason`, `closedAt` — chuyện nội bộ giữa nhà tuyển dụng và admin,
 * không việc gì tới người đi tìm việc. Kế thừa rồi `Omit` mấy trường ấy đi thì
 * mỗi lần thêm cột nội bộ mới, nó tự động lọt ra API công khai cho tới khi có
 * người nhớ bổ sung vào danh sách loại trừ.
 *
 * Khai riêng thì chiều mặc định đảo lại: thêm trường mới KHÔNG lộ ra, trừ khi
 * ai đó chủ động viết nó vào đây.
 */

/** Doanh nghiệp, phần người tìm việc được thấy. */
export interface PublicEmployer {
  companyName: string
  /** Đã được admin xác minh giấy tờ hay chưa — hiện thành dấu tick trên thẻ tin. */
  verified: boolean
}

/** Một thẻ tin trong danh sách việc làm. */
export interface PublicJobSummary {
  id: string
  title: string
  employer: PublicEmployer

  city: string
  district: string
  quantity: number

  salaryNegotiable: boolean
  salaryMin: number | null
  salaryMax: number | null
  salaryUnit: SalaryUnit

  scheduleType: ScheduleType
  commitmentMonths: number | null

  deadline: string
  /** Mốc tin lên sàn. Luôn có giá trị vì chỉ tin đã duyệt mới ra tới đây. */
  publishedAt: string

  skills: JobSkillItem[]
  shifts: JobShiftItem[]
}

/** Trang chi tiết tin. */
export interface PublicJobDetail extends PublicJobSummary {
  description: string
  requirements: string[]
  benefits: string[]
  minShiftsPerWeek: number | null
  startDate: string | null
  endDate: string | null
  workDate: string | null
  viewCount: number
  /** Thông tin liên hệ của doanh nghiệp — chỉ ở trang chi tiết. */
  employerAddress: string | null
  employerWebsite: string | null
}

/**
 * GET /api/viec-lam
 *
 * `total` là số tin khớp bộ lọc, có thể LỚN HƠN `jobs.length` vì server chặn
 * cứng số hàng trả về. Phân trang thật thuộc Sprint 3, khi bộ lọc được dựng
 * lại — thêm `total` ngay từ bây giờ để lúc đó chỉ việc thêm `page`/`limit`
 * vào cùng object này, không phải đổi hình dạng response.
 */
export interface PublicJobListResponse {
  jobs: PublicJobSummary[]
  total: number
}

/** Bộ lọc của `GET /api/viec-lam`. Sprint 2 chỉ có ba tiêu chí so sánh bằng. */
export interface PublicJobQuery {
  city?: string
  district?: string
  scheduleType?: ScheduleType
}
