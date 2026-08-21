import { z } from 'zod'
import { SIGNUP_ROLES } from './api.js'
import { TIME_SLOTS, USER_STATUSES } from './domain.js'

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
  // 21 = 7 ngày × 3 khung giờ. Không thể vượt quá dù không trùng ô nào.
  slots: z.array(availabilitySlotSchema).max(21, 'Tối đa 21 ô (7 ngày × 3 buổi)'),
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
