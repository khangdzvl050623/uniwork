import { z } from 'zod'
import { SIGNUP_ROLES } from './api.js'
import {
  DAY_FULL_LABELS,
  JOB_STATUSES,
  PUBLIC_JOB_SORTS,
  SALARY_UNITS,
  SO_O_MOI_TUAN,
  SCHEDULE_TYPES,
  TIME_SLOTS,
  USER_STATUSES,
  type DayOfWeek,
} from './domain.js'

/**
 * Luật kiểm dữ liệu dùng chung cho cả web và api.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO PHẢI DÙNG CHUNG, KHÔNG PHẢI CHÉP HAI BẢN
 * ---------------------------------------------------------------------------
 * Trước file này, luật mật khẩu nằm trong `auth.controller.ts` phía api, còn
 * phía web thì chưa có gì. Nếu mỗi bên tự viết một bản, chúng sẽ lệch nhau —
 * không phải "có thể", mà là chắc chắn, ngay lần đầu ai đó sửa một bên.
 *
 * Lệch theo hướng web lỏng hơn api thì người dùng điền xong form, bấm gửi, và
 * nhận về lỗi từ server cho một trường mà form vừa bảo là hợp lệ. Lệch theo
 * hướng ngược lại thì web chặn những giá trị mà server sẵn sàng nhận.
 *
 * Khai một lần ở đây thì hai phía không thể lệch: chúng nhập cùng một object.
 *
 * Lưu ý về vai trò của từng phía. Kiểm ở web là để người dùng biết mình gõ sai
 * NGAY, không phải chờ một vòng mạng. Kiểm ở api mới là thứ thực sự bảo vệ dữ
 * liệu — ai cũng gọi thẳng api được, bỏ qua hoàn toàn giao diện. Web KHÔNG bao
 * giờ thay thế được api ở vai trò đó.
 */

/*
 * Quy tắc mật khẩu: tối thiểu 8 ký tự, có chữ và có số.
 *
 * Cố ý KHÔNG bắt ký tự đặc biệt. Nghiên cứu của NIST cho thấy luật càng rườm
 * rà thì người dùng càng đối phó bằng những mẫu dễ đoán (`Password1!`), trong
 * khi độ dài mới là thứ thật sự làm tăng độ khó dò.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .regex(/[a-zA-Z]/, 'Mật khẩu cần có ít nhất một chữ cái')
  .regex(/[0-9]/, 'Mật khẩu cần có ít nhất một chữ số')

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .email('Email không đúng định dạng')

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(SIGNUP_ROLES),
  name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(120, 'Tên quá dài'),
})

export const loginSchema = z.object({
  email: emailSchema,
  /*
   * Cố ý KHÔNG áp `passwordSchema` ở đây.
   *
   * Người đăng ký từ trước có thể đang dùng mật khẩu theo luật cũ — bắt đúng
   * luật mới sẽ khoá họ ra ngoài chính tài khoản của mình. Thêm nữa, thông báo
   * "mật khẩu cần có chữ số" ở màn ĐĂNG NHẬP là tiết lộ luật mật khẩu cho
   * người đang dò, đổi lại chẳng giúp gì cho người dùng thật.
   */
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

/** Mã OTP: đúng 6 chữ số. Chuỗi 'abcdef' cũng dài 6 nhưng không bao giờ khớp. */
export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Mã xác thực gồm đúng 6 chữ số'),
})

/* ------------------------------------------------------- quên mật khẩu --- */

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Mã gồm đúng 6 chữ số'),
  // Áp `passwordSchema` ở đây (khác màn đăng nhập): người dùng đang ĐẶT mật
  // khẩu mới, nên luật mới phải áp dụng đầy đủ.
  password: passwordSchema,
})

/* ------------------------------------------------------------- hồ sơ ----- */

/**
 * Ô nhập để trống nghĩa là "chưa khai", phải thành `null` chứ không phải `''`.
 *
 * Form HTML luôn trả chuỗi rỗng cho ô chưa điền. Lưu thẳng `''` xuống database
 * thì cột đó vừa "có giá trị" vừa rỗng — mọi chỗ kiểm `if (university)` sau này
 * đều phải nhớ kiểm thêm chuỗi rỗng, và sớm muộn sẽ có chỗ quên.
 */
const chuoiTuyChon = (max: number, thongDiep?: string) =>
  z
    .string()
    .trim()
    .max(max, thongDiep ?? `Tối đa ${max} ký tự`)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))

export const studentProfileSchema = z.object({
  university: chuoiTuyChon(200),
  major: chuoiTuyChon(200),
  /**
   * Năm học 1..10. Trên 6 gần như không có, nhưng vẫn nới tới 10 cho các
   * chương trình dài và trường hợp học lại — chặn chặt quá thì người thật bị
   * kẹt, mà con số này không dùng để tính toán gì quan trọng.
   */
  year: z
    .number()
    .int('Năm học phải là số nguyên')
    .min(1, 'Năm học từ 1 trở lên')
    .max(10, 'Năm học tối đa là 10')
    .nullable()
    .optional(),
  bio: chuoiTuyChon(2000, 'Giới thiệu tối đa 2000 ký tự'),
})

export const employerProfileSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Tên công ty cần ít nhất 2 ký tự')
    .max(200, 'Tên công ty quá dài'),
  description: chuoiTuyChon(2000, 'Mô tả tối đa 2000 ký tự'),
  address: chuoiTuyChon(300),
  website: z
    .string()
    .trim()
    .url('Website phải bắt đầu bằng http:// hoặc https://')
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
})

/* --------------------------------------------------------- lịch rảnh ----- */

export const availabilitySlotSchema = z.object({
  /** 0 = Chủ nhật ... 6 = Thứ 7, theo quy ước `Date.prototype.getDay()`. */
  dayOfWeek: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  slot: z.enum(TIME_SLOTS),
})

export const updateAvailabilitySchema = z.object({
  // Trần suy ra từ `TIME_SLOTS`, không ghi cứng 21 — thêm một khung giờ thứ tư
  // thì trần này tự đúng theo. Xem `SO_O_MOI_TUAN`.
  slots: z
    .array(availabilitySlotSchema)
    .max(SO_O_MOI_TUAN, `Tối đa ${SO_O_MOI_TUAN} ô (7 ngày × ${TIME_SLOTS.length} khung giờ)`),
})

export const updateSkillsSchema = z.object({
  skillIds: z.array(z.string()).max(50, 'Tối đa 50 kỹ năng'),
})

/* ------------------------------------------------------------- file ------ */

/** Giới hạn dung lượng file tải lên, dùng chung cho CV và giấy tờ NTD. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const MAX_FILE_SIZE_LABEL = '5MB'

/* ------------------------------------------------------------ quản trị --- */

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
})

/**
 * Duyệt hoặc từ chối một giấy tờ của nhà tuyển dụng.
 *
 * `PENDING` KHÔNG nằm trong tập giá trị nhận vào, dù nó là một `ReviewStatus`
 * hợp lệ: đó là trạng thái ban đầu do hệ thống đặt lúc NTD nộp file, không phải
 * một quyết định admin có thể ra. Cho phép đặt lại về PENDING chỉ tạo ra một
 * đường xoá dấu vết đã xem xét mà không ai đọc được lý do.
 *
 * Từ chối thì BẮT BUỘC có lý do — `superRefine` bên dưới. Từ chối im lặng đẩy
 * nhà tuyển dụng vào chỗ nộp lại đúng cái file cũ vì không biết mình sai ở đâu.
 */
export const reviewDocumentSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewNote: z.string().trim().max(500, 'Lý do tối đa 500 ký tự').nullish(),
  })
  .superRefine((val, ctx) => {
    if (val.status === 'REJECTED' && !val.reviewNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewNote'],
        message: 'Cần ghi lý do từ chối để nhà tuyển dụng biết phải nộp lại gì',
      })
    }
  })

/** Chốt hoặc thu hồi xác minh của một nhà tuyển dụng. */
export const verifyEmployerSchema = z.object({
  verified: z.boolean(),
})

/**
 * Tên kỹ năng trong danh mục.
 *
 * `.trim()` chạy TRƯỚC `.min()`, nên một chuỗi toàn khoảng trắng bị chặn thay
 * vì lọt vào database thành một dòng trắng không ai xoá được (nhìn bảng không
 * thấy gì, mà `jobCount` vẫn có thể > 0).
 *
 * Không cấm dấu tiếng Việt — tên là thứ hiện cho người đọc. Phần không dấu
 * dùng cho URL là `slug`, do server tự sinh (xem `lib/slug.ts` phía api).
 */
const tenKyNang = z
  .string()
  .trim()
  .min(2, 'Tên kỹ năng cần ít nhất 2 ký tự')
  .max(60, 'Tên kỹ năng tối đa 60 ký tự')

export const createSkillSchema = z.object({ name: tenKyNang })
export const updateSkillSchema = z.object({ name: tenKyNang })

/* -------------------------------------------------- tin tuyển dụng (T68) -- */

/**
 * Luật kiểm tin tuyển dụng.
 *
 * ---------------------------------------------------------------------------
 * PHẢI KHỚP CHÍNH XÁC VỚI CHECK TRONG DATABASE
 * ---------------------------------------------------------------------------
 * Hai ràng buộc `jobs_schedule_fields_check` và `jobs_salary_check` đã tồn tại
 * từ migration `20260815070939_oauth_ready_va_luong_thoa_thuan`. Chúng mới là
 * luật thật — script sửa dữ liệu hay câu SQL vá tay đều đi vòng qua Zod được,
 * CHECK thì không.
 *
 * Vai trò của Zod ở đây KHÔNG phải là lớp bảo vệ, mà là lớp DỊCH: biến một lỗi
 * ràng buộc Postgres khó đọc thành 422 kèm tên trường và câu tiếng Việt. Vì
 * vậy nó phải nói đúng y hệt luật kia — nới hơn thì người dùng nhận lỗi 500 bí
 * ẩn, siết hơn thì chặn oan dữ liệu database vẫn chấp nhận.
 *
 * Bảng luật (chép từ BRD, khớp với CHECK):
 *
 * |            | commitmentMonths | startDate  | endDate  | workDate | minShiftsPerWeek |
 * |------------|------------------|------------|----------|----------|------------------|
 * | RECURRING  | tuỳ chọn         | tuỳ chọn   | CẤM      | CẤM      | tuỳ chọn         |
 * | SEASONAL   | CẤM              | BẮT BUỘC   | BẮT BUỘC | CẤM      | tuỳ chọn         |
 * | ONE_TIME   | CẤM              | CẤM        | CẤM      | BẮT BUỘC | CẤM              |
 *
 * Nguyên tắc đặt luật, lấy nguyên từ comment trong migration: **chỉ cấm cái
 * MÂU THUẪN, không cấm cái chưa khai.** Nên RECURRING được bỏ trống cả
 * `startDate` lẫn `commitmentMonths` (tuyển là đi làm ngay, không đòi cam kết),
 * nhưng tuyệt đối không mang `endDate` — việc định kỳ theo định nghĩa là không
 * có điểm kết thúc.
 */

/**
 * Một ô trong lưới ca làm. `dayOfWeek` khớp CHECK `job_shifts_day_of_week_check`.
 *
 * Dùng lại nguyên `availabilitySlotSchema` thay vì khai một `z.number().min(0).max(6)`
 * riêng: hai bảng `job_shifts` và `availabilities` cố ý có cùng bộ cột, và toàn
 * bộ tính năng lõi của UniWork dựa vào việc ghép chúng bằng một câu JOIN. Khai
 * hai luật riêng cho cùng một khái niệm là mở đường cho chúng lệch nhau — mà
 * lệch ở đây thì bộ lọc theo lịch rảnh im lặng bỏ sót tin, không báo lỗi gì.
 *
 * Kiểu suy ra cũng khớp luôn: cả hai cho ra `DayOfWeek` chứ không phải `number`,
 * nên một component lưới duy nhất phục vụ được cả hai màn hình.
 */
export const jobShiftSchema = availabilitySlotSchema

/**
 * Ngày nhận vào dạng chuỗi ISO rồi đổi sang `Date`.
 *
 * `z.coerce.date()` chạy `new Date(giá trị)` rồi mới kiểm — chuỗi rác cho ra
 * Invalid Date và bị chặn ngay, không lọt xuống Prisma thành một lỗi khó đoán.
 */
const ngay = z.coerce.date()

/**
 * Ngày KHÔNG bắt buộc — và chuỗi rỗng phải hiểu là "để trống", không phải rác.
 *
 * `<input type="date">` để trống trả về `''`. Nếu đưa thẳng vào `z.coerce.date()`
 * thì `new Date('')` ra Invalid Date và form báo "ngày không hợp lệ" cho một ô
 * người dùng CỐ Ý không điền — đúng ba ô `startDate`, `endDate`, `workDate` mà
 * mỗi loại lịch chỉ dùng một.
 *
 * Cùng một lớp lỗi với `chuoiTuyChon` ở phần hồ sơ: form HTML không có khái
 * niệm "null", nó chỉ có chuỗi rỗng.
 */
const ngayTuyChon = z.preprocess((v) => (v === '' ? null : v), ngay.nullish())

const baseJobSchema = z.object({
  title: z.string().trim().min(10, 'Tiêu đề cần ít nhất 10 ký tự').max(150, 'Tiêu đề tối đa 150 ký tự'),
  description: z
    .string()
    .trim()
    .min(50, 'Mô tả cần ít nhất 50 ký tự để sinh viên hiểu công việc')
    .max(5000, 'Mô tả tối đa 5000 ký tự'),

  // Mảng rỗng được phép: đây là phần bổ sung, không phải thông tin bắt buộc.
  requirements: z.array(z.string().trim().min(1)).max(20, 'Tối đa 20 mục yêu cầu'),
  benefits: z.array(z.string().trim().min(1)).max(20, 'Tối đa 20 mục quyền lợi'),

  city: z.string().trim().min(1, 'Chưa chọn tỉnh/thành'),
  district: z.string().trim().min(1, 'Chưa chọn quận/huyện'),
  quantity: z.number().int().min(1, 'Số lượng tuyển tối thiểu là 1').max(999, 'Số lượng quá lớn'),

  salaryNegotiable: z.boolean(),
  salaryMin: z.number().int().min(0, 'Lương không được âm').nullish(),
  salaryMax: z.number().int().min(0, 'Lương không được âm').nullish(),
  salaryUnit: z.enum(SALARY_UNITS),

  scheduleType: z.enum(SCHEDULE_TYPES),
  commitmentMonths: z.number().int().min(1).max(60, 'Cam kết tối đa 60 tháng').nullish(),
  minShiftsPerWeek: z
    .number()
    .int()
    .min(1)
    .max(SO_O_MOI_TUAN, `Một tuần chỉ có ${SO_O_MOI_TUAN} khung giờ`)
    .nullish(),
  startDate: ngayTuyChon,
  endDate: ngayTuyChon,
  workDate: ngayTuyChon,

  deadline: ngay,

  /*
   * Ít nhất một ca — điều kiện nghiệm thu của T68, và là luật nghiệp vụ thật:
   * tin không có ca làm nào thì không lọt vào bộ lọc theo lịch rảnh, tức là mất
   * đúng tính năng lõi của UniWork.
   */
  shifts: z.array(jobShiftSchema).min(1, 'Chọn ít nhất một ca làm'),
  skillIds: z.array(z.string().min(1)).max(15, 'Tối đa 15 kỹ năng'),
})

/** Gộp hai luật chéo (lịch và lương) để `create` và `update` dùng chung. */
function kiemLuatCheo(val: z.infer<typeof baseJobSchema>, ctx: z.RefinementCtx) {
  const cam = (
    truong: 'commitmentMonths' | 'minShiftsPerWeek' | 'startDate' | 'endDate' | 'workDate',
    thongBao: string,
  ) => {
    if (val[truong] != null) {
      ctx.addIssue({ code: 'custom', path: [truong], message: thongBao })
    }
  }

  const batBuoc = (truong: 'startDate' | 'endDate' | 'workDate', thongBao: string) => {
    if (val[truong] == null) {
      ctx.addIssue({ code: 'custom', path: [truong], message: thongBao })
    }
  }

  /* ---- lịch: khớp jobs_schedule_fields_check ---- */
  if (val.scheduleType === 'RECURRING') {
    cam('endDate', 'Việc định kỳ không có ngày kết thúc')
    cam('workDate', 'Ngày làm việc chỉ dùng cho việc một lần')
  }

  if (val.scheduleType === 'SEASONAL') {
    batBuoc('startDate', 'Việc thời vụ phải có ngày bắt đầu')
    batBuoc('endDate', 'Việc thời vụ phải có ngày kết thúc')
    cam('commitmentMonths', 'Việc thời vụ đã có ngày bắt đầu và kết thúc, không dùng cam kết tháng')
    cam('workDate', 'Ngày làm việc chỉ dùng cho việc một lần')

    if (val.startDate && val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Ngày kết thúc phải sau ngày bắt đầu',
      })
    }
  }

  if (val.scheduleType === 'ONE_TIME') {
    batBuoc('workDate', 'Việc một lần phải có ngày làm việc')
    cam('startDate', 'Việc một lần chỉ cần ngày làm việc')
    cam('endDate', 'Việc một lần chỉ cần ngày làm việc')
    cam('commitmentMonths', 'Việc một lần không có cam kết tháng')
    cam('minShiftsPerWeek', 'Việc chỉ diễn ra một buổi thì "số ca mỗi tuần" vô nghĩa')

    /*
     * Ca làm PHẢI rơi đúng vào thứ của `workDate`.
     *
     * -----------------------------------------------------------------------
     * VÌ SAO LUẬT NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ
     * -----------------------------------------------------------------------
     * Thiếu nó thì tạo được một tin "một buổi" diễn ra Thứ Tư 02/09 nhưng mang
     * ca làm Thứ Hai sáng và Thứ Sáu tối — dữ liệu tự mâu thuẫn, và không tầng
     * nào chặn: CHECK trong database không kiểm được vì `workDate` nằm ở bảng
     * `jobs` còn `dayOfWeek` ở bảng `job_shifts`, mà CHECK của Postgres không
     * bắc qua hai bảng được (muốn vậy phải viết trigger).
     *
     * Hậu quả không dừng ở chỗ trông kỳ. Tính năng lõi của UniWork ở Sprint 3
     * ghép `job_shifts` với `availabilities` theo `(dayOfWeek, slot)`. Một tin
     * diễn ra Thứ Tư mà mang ca Thứ Hai sẽ được gợi ý cho đúng những sinh viên
     * KHÔNG rảnh hôm đó — bộ lọc trả kết quả sai mà không báo lỗi gì.
     *
     * Cho phép NHIỀU buổi trong cùng một ngày (sáng + chiều của một sự kiện
     * chạy cả ngày), chỉ cấm rải sang thứ khác. Ràng buộc thật ở đây là "đúng
     * một NGÀY", không phải "đúng một ô".
     */
    if (val.workDate) {
      const thuCuaNgayLam = val.workDate.getDay()
      const caLech = val.shifts.filter((s) => s.dayOfWeek !== thuCuaNgayLam)

      if (caLech.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['shifts'],
          message: `Việc một buổi chỉ được chọn ca trong ${DAY_FULL_LABELS[thuCuaNgayLam as DayOfWeek]} — đúng ngày làm việc đã chọn`,
        })
      }
    }
  }

  /*
   * Không được đòi nhiều ca hơn số ca đã mở.
   *
   * -------------------------------------------------------------------------
   * VÌ SAO ĐÂY LÀ LUẬT THẬT, KHÔNG PHẢI PHÒNG XA
   * -------------------------------------------------------------------------
   * `job_shifts` là các ca nhà tuyển dụng MỞ, `minShiftsPerWeek` là số ca người
   * làm phải nhận trong đó (chốt 2026-08-27). Mở 3 ca mà đòi nhận 5 là tin
   * KHÔNG AI thoả được — không phải một yêu cầu khắt khe, mà là lỗi nhập liệu.
   *
   * Hậu quả nếu để lọt: tin đó không bao giờ `eligible` với bất kỳ ai, nên nó
   * biến mất khỏi mọi kết quả lọc theo lịch rảnh — trong khi nhà tuyển dụng
   * thấy tin mình đã `OPEN` bình thường và không hiểu vì sao không ai ứng tuyển.
   *
   * Cũng như mọi luật khác ở đây, đây chỉ là tầng cho ra thông báo dễ đọc.
   * `ghepLich` vẫn chặn trần ngưỡng ở phía tính toán, để dữ liệu cũ tạo trước
   * khi có luật này không làm hỏng bộ lọc.
   */
  if (val.minShiftsPerWeek != null && val.minShiftsPerWeek > val.shifts.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['minShiftsPerWeek'],
      message: `Đang mở ${val.shifts.length} ca nên không thể yêu cầu tối thiểu ${val.minShiftsPerWeek} ca — mở thêm ca hoặc hạ con số này xuống`,
    })
  }

  /* ---- lương: khớp jobs_salary_check ---- */
  if (val.salaryNegotiable) {
    // Cấm trạng thái nửa vời "thoả thuận nhưng vẫn ghi 25000" — đúng thứ làm bộ
    // lọc lương trả về kết quả không ai giải thích được.
    if (val.salaryMin != null || val.salaryMax != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMin'],
        message: 'Đã chọn "Thoả thuận" thì không điền mức lương',
      })
    }
  } else {
    if (val.salaryMin == null) {
      ctx.addIssue({ code: 'custom', path: ['salaryMin'], message: 'Nhập mức lương tối thiểu' })
    }
    if (val.salaryMax == null) {
      ctx.addIssue({ code: 'custom', path: ['salaryMax'], message: 'Nhập mức lương tối đa' })
    }
    if (val.salaryMin != null && val.salaryMax != null && val.salaryMax < val.salaryMin) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMax'],
        message: 'Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu',
      })
    }
  }

  /*
   * Hạn nhận hồ sơ không được ở quá khứ.
   *
   * KHÔNG có CHECK tương ứng ở database, và cố ý: "quá khứ" phụ thuộc thời điểm
   * đọc, nên một CHECK như vậy sẽ làm mọi tin cũ thành không sửa được. Đây là
   * luật của lúc NHẬP, không phải bất biến của dữ liệu.
   */
  if (val.deadline.getTime() < Date.now()) {
    ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Hạn nhận hồ sơ đã qua' })
  }

  /*
   * Trùng ca: schema có `@@unique([jobId, dayOfWeek, slot])`, gửi trùng sẽ vỡ ở
   * tầng database. Bắt ở đây để báo lỗi rõ thay vì một lỗi ràng buộc thô.
   */
  const khoaCa = val.shifts.map((s) => `${s.dayOfWeek}-${s.slot}`)
  if (new Set(khoaCa).size !== khoaCa.length) {
    ctx.addIssue({ code: 'custom', path: ['shifts'], message: 'Có ca làm bị chọn trùng' })
  }

  /* Cùng lý do: `@@id([jobId, skillId])` không cho trùng kỹ năng. */
  if (new Set(val.skillIds).size !== val.skillIds.length) {
    ctx.addIssue({ code: 'custom', path: ['skillIds'], message: 'Có kỹ năng bị chọn trùng' })
  }
}

export const createJobSchema = baseJobSchema.superRefine(kiemLuatCheo)
export const updateJobSchema = baseJobSchema.superRefine(kiemLuatCheo)

/**
 * Dữ liệu tin SAU KHI đã qua Zod.
 *
 * Khác `CreateJobInput` ở chỗ các trường ngày đã là `Date` chứ không còn là
 * chuỗi ISO — `z.coerce.date()` đổi sẵn. `CreateJobInput` mô tả thứ đi trên
 * dây (JSON), kiểu này mô tả thứ tầng service cầm trong tay. Lẫn hai cái là
 * nguồn của những lỗi kiểu rất khó đọc ở chỗ gọi Prisma.
 */
export type CreateJobData = z.infer<typeof createJobSchema>
export type UpdateJobData = z.infer<typeof updateJobSchema>

/**
 * Quyết định của admin với một tin đang chờ duyệt.
 *
 * Từ chối BẮT BUỘC có lý do, cùng luật với duyệt giấy tờ nhà tuyển dụng: từ
 * chối im lặng đẩy người ta vào chỗ gửi lại đúng cái tin cũ vì không biết mình
 * sai ở đâu — và làm nghẽn chính hàng đợi của admin.
 */
export const reviewJobSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    rejectionReason: z.string().trim().max(500, 'Lý do tối đa 500 ký tự').nullish(),
  })
  .superRefine((val, ctx) => {
    if (val.decision === 'REJECT' && !val.rejectionReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Cần ghi lý do từ chối để nhà tuyển dụng biết phải sửa gì',
      })
    }
  })

export type ReviewJobData = z.infer<typeof reviewJobSchema>

/** Lọc hàng đợi duyệt theo trạng thái. Không truyền thì mặc định `PENDING`. */
export const adminJobQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
})

/**
 * Bộ lọc của trang việc làm công khai.
 *
 * Sprint 2 CHỈ có ba tiêu chí so sánh bằng. Tìm kiếm toàn văn, lọc theo lịch
 * rảnh, lọc theo lương và kỹ năng đều thuộc Sprint 3 — xem ghi chú T79 trong
 * `docs/sprint-2.md` để biết vì sao ranh giới này đáng giữ.
 *
 * Chuỗi rỗng thành `undefined`: ô lọc bỏ trống trên form gửi lên `?city=`, mà
 * `city: ''` sẽ thành điều kiện "tỉnh/thành đúng bằng chuỗi rỗng" và trả về
 * danh sách trống không ai giải thích được.
 */
const locTuyChon = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

/**
 * Cờ bật/tắt đến từ query string.
 *
 * KHÔNG dùng `z.coerce.boolean()`: nó chạy `Boolean(v)`, mà `Boolean('false')`
 * là `true`. Tức là `?matchAvailability=false` sẽ BẬT bộ lọc — đúng ngược ý
 * người gọi, và không có lỗi nào bắn ra để ai đó nhận ra.
 */
const coTuyChon = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'))

/**
 * Số nguyên dương đến từ query string.
 *
 * Cũng không dùng `z.coerce.number()` được, vì `Number('')` là `0`: ô lọc để
 * trống sẽ thành điều kiện "đúng bằng 0" và trả về danh sách rỗng không ai giải
 * thích được — cùng loại bẫy với `locTuyChon` ở trên.
 *
 * `Number('abc')` cho `NaN`, và `z.number()` từ chối `NaN`, nên chuỗi rác vẫn
 * bị chặn thành 422 rõ ràng.
 */
const soDuongTuyChon = (toiDa: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().positive().max(toiDa).optional(),
  )

/**
 * Danh sách id ngăn nhau bằng dấu phẩy: `?skillIds=a,b,c`.
 *
 * Chọn dạng này thay vì lặp tham số (`?skillIds=a&skillIds=b`) để chỉ có MỘT
 * hình dạng phải xử lý. Lặp tham số thì Express trả về chuỗi khi có một giá trị
 * và mảng khi có nhiều — mỗi chỗ dùng lại phải tự chuẩn hoá, và chỗ nào quên
 * thì lỗi chỉ lộ ra đúng lúc người dùng chọn một kỹ năng.
 */
const danhSachIdTuyChon = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return undefined
    const ids = v.split(',').map((s) => s.trim()).filter(Boolean)
    return ids.length > 0 ? ids : undefined
  })

export const publicJobQuerySchema = z
  .object({
    city: locTuyChon,
    district: locTuyChon,
    scheduleType: z.enum(SCHEDULE_TYPES).optional(),

    matchAvailability: coTuyChon,

    salaryUnit: z.enum(SALARY_UNITS).optional(),
    // Trần 100 triệu: đủ rộng cho mọi đơn vị (kể cả lương tháng) mà vẫn chặn
    // được giá trị vô lý gõ tay vào URL.
    salaryFrom: soDuongTuyChon(100_000_000),
    includeNegotiable: coTuyChon,

    skillIds: danhSachIdTuyChon,

    // Trần là số ô tối đa một tuần chứa được, suy ra từ `TIME_SLOTS`.
    maxShiftsPerWeek: soDuongTuyChon(SO_O_MOI_TUAN),
    maxCommitmentMonths: soDuongTuyChon(60),

    sort: z.enum(PUBLIC_JOB_SORTS).optional(),
  })
  .superRefine((val, ctx) => {
    /*
     * `salaryFrom` không có nghĩa nếu thiếu `salaryUnit`.
     *
     * "Từ 25.000đ" là 25 nghìn một GIỜ, một CA hay một THÁNG? Ba câu trả lời
     * khác nhau hoàn toàn. Không chặn ở đây thì phải chọn bừa một đơn vị mặc
     * định, và người lọc nhận về kết quả của một câu hỏi họ không hề đặt.
     */
    if (val.salaryFrom !== undefined && !val.salaryUnit) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryUnit'],
        message: 'Chọn đơn vị lương (giờ, ca hay tháng) trước khi lọc theo mức lương',
      })
    }
  })
