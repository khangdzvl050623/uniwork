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

/** Trạng thái tài khoản. SUSPENDED chặn đăng nhập, không xoá dữ liệu. */
export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/** Cách bố trí thời gian của tin tuyển dụng (README mục 5). */
export const SCHEDULE_TYPES = ['RECURRING', 'SEASONAL', 'ONE_TIME'] as const
export type ScheduleType = (typeof SCHEDULE_TYPES)[number]

/**
 * Nhãn tiếng Việt cho các giá trị cố định.
 *
 * Ở đây chứ không phải trong `apps/web`, cùng chỗ với `TIME_SLOT_LABELS`: ba
 * màn hình khác nhau đang hiện cùng những giá trị này (đăng tin, quản lý tin,
 * duyệt tin, danh sách việc làm). Mỗi nơi tự khai một bảng nhãn thì sớm muộn
 * cùng một `ONE_TIME` hiện thành "Một buổi" ở trang này và "Làm một lần" ở
 * trang kia.
 */
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  RECURRING: 'Định kỳ',
  SEASONAL: 'Thời vụ',
  ONE_TIME: 'Một buổi',
}

/** Mô tả ngắn đi kèm, dùng ở form đăng tin để người chọn hiểu mình đang chọn gì. */
export const SCHEDULE_TYPE_HINTS: Record<ScheduleType, string> = {
  RECURRING: 'Lặp lại hằng tuần, không có ngày kết thúc',
  SEASONAL: 'Chạy trong một khoảng thời gian rồi dừng',
  ONE_TIME: 'Chỉ diễn ra đúng một buổi',
}

export const JOB_STATUSES = ['DRAFT', 'PENDING', 'OPEN', 'CLOSED'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  OPEN: 'Đang hiển thị',
  CLOSED: 'Đã đóng',
}

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
 * Khoảng lương hợp lý của TỪNG đơn vị, dùng cho thanh trượt lọc.
 *
 * Ba đơn vị KHÔNG quy đổi về cùng một thang được: quy đổi đòi giả định "một ca
 * mấy giờ" và "một tháng mấy ca", hai con số thay đổi theo từng tin. Nên mỗi
 * đơn vị có thang riêng, và bộ lọc chỉ so số trong cùng một đơn vị.
 *
 * Các mốc lấy theo dữ liệu thật trong `prisma/seed.ts` rồi nới rộng hai đầu để
 * còn chỗ cho tin mới — không phải số bịa: HOUR 24–32k, SHIFT 120–350k,
 * MONTH 2–3,5 triệu.
 */
export const KHOANG_LUONG: Record<SalaryUnit, { min: number; max: number; buoc: number }> = {
  HOUR: { min: 15_000, max: 60_000, buoc: 5_000 },
  SHIFT: { min: 100_000, max: 500_000, buoc: 50_000 },
  MONTH: { min: 1_000_000, max: 15_000_000, buoc: 500_000 },
}

/**
 * Cách sắp xếp danh sách việc làm công khai.
 *
 * `match` chỉ dùng được khi người xem là sinh viên đã khai lịch rảnh — không có
 * lịch thì mọi tin đều `null` điểm và thứ tự trở thành ngẫu nhiên.
 */
export const PUBLIC_JOB_SORTS = ['newest', 'match'] as const
export type PublicJobSort = (typeof PUBLIC_JOB_SORTS)[number]

export const PUBLIC_JOB_SORT_LABELS: Record<PublicJobSort, string> = {
  newest: 'Mới đăng trước',
  match: 'Phù hợp lịch nhất',
}

/** Dạng ngắn để ghép sau con số: "25.000đ/giờ". */
export const SALARY_UNIT_LABELS: Record<SalaryUnit, string> = {
  HOUR: 'giờ',
  SHIFT: 'ca',
  MONTH: 'tháng',
}

/**
 * Ba KHUNG KHAI BÁO trong ngày — không phải ca làm việc của doanh nghiệp.
 *
 * ---------------------------------------------------------------------------
 * ĐÂY LÀ PHÂN BIỆT QUAN TRỌNG NHẤT CỦA CẢ MÔ HÌNH GHÉP LỊCH (chốt 2026-08-27)
 * ---------------------------------------------------------------------------
 * `TimeSlot` là khung thời gian CHUẨN HOÁ để hai bên khai báo và ghép được với
 * nhau. Nó KHÔNG mô tả giờ làm chính xác:
 *
 *   Sinh viên khai `T2 MORNING`  = "thứ Hai buổi sáng tôi có thể làm"
 *   Tin khai `T2 MORNING`        = "cần người có thể làm thứ Hai buổi sáng"
 *
 * Quán cần người 10:00–16:00 sẽ khai `MORNING` + `AFTERNOON` — nghĩa là "ứng
 * viên phải rảnh được trong cả hai khung này", không phải "ca kéo dài 12 tiếng".
 * Giờ làm cụ thể do hai bên chốt khi phỏng vấn.
 *
 * Vì sao chia khung rời rạc thay vì cho nhập giờ tự do: nhờ đó lịch rảnh và ca
 * làm cùng một tập giá trị, và phép ghép trở thành giao tập hợp — một câu JOIN,
 * không phải bài toán so khoảng thời gian chồng lấn.
 *
 * ---------------------------------------------------------------------------
 * HỆ QUẢ CHO GIAO DIỆN — ĐỪNG QUẢNG BÁ ĐÂY LÀ GIỜ LÀM THẬT
 * ---------------------------------------------------------------------------
 * Đã cân nhắc và BỎ phương án tăng lên 6 khung (06–09, 09–12, …): nó không giải
 * quyết vấn đề gốc, vì ca thật ở tin part-time Việt Nam dài 6–8 tiếng với ranh
 * giới mỗi nơi một khác. Mịn hơn vẫn chỉ là xấp xỉ. Muốn đúng hẳn phải chuyển
 * sang `startTime`/`endTime`, và khi đó phép ghép, lưới khai lịch, validate và
 * ràng buộc đều phải dựng lại — việc của v2.
 *
 * Trong lúc chưa làm việc đó, mô hình này ĐÚNG chứ không phải tạm bợ — miễn là
 * giao diện gọi đúng tên: "khung giờ có thể làm", không phải "ca làm việc".
 */
export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const
export type TimeSlot = (typeof TIME_SLOTS)[number]

/**
 * `range` là RANH GIỚI CỦA KHUNG, không phải giờ vào ca.
 *
 * Hiện dưới nhãn "Sáng" thì người đọc rất dễ hiểu thành "ca sáng bắt đầu 6h,
 * kéo 6 tiếng". Chỗ nào hiện `range` cũng phải kèm câu nói rõ đây là khung để
 * đối chiếu lịch — xem `LuoiKhungGio` và `JobDetail`.
 */
export const TIME_SLOT_LABELS: Record<TimeSlot, { label: string; range: string }> = {
  MORNING: { label: 'Sáng', range: '06:00 – 12:00' },
  AFTERNOON: { label: 'Chiều', range: '12:00 – 18:00' },
  EVENING: { label: 'Tối', range: '18:00 – 22:00' },
}

/**
 * Tổng số ô trong lưới khai lịch: 7 ngày × số khung giờ.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO SUY RA CHỨ KHÔNG GHI CỨNG 21
 * ---------------------------------------------------------------------------
 * Con số 21 từng được viết thẳng ở ba chỗ trong `validation.ts` (trần số ô lịch
 * rảnh, trần `minShiftsPerWeek`, trần `maxShiftsPerWeek`). Thêm một khung giờ
 * thứ tư vào `TIME_SLOTS` thì cả ba chỗ đó lặng lẽ sai: lịch rảnh bị cắt ở ô
 * thứ 21, và nhà tuyển dụng không khai nổi số ca thật của mình.
 *
 * Không có lỗi nào bắn ra — chỉ là một cái trần vô hình mà không ai nhớ đã đặt
 * ở đâu. Suy ra từ `TIME_SLOTS.length` thì thêm hay bớt khung giờ đều tự đúng.
 */
export const SO_O_MOI_TUAN = 7 * TIME_SLOTS.length

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
 * Nhà cung cấp danh tính ngoài.
 *
 * Mới có Google. Facebook thêm sau thì chỉ là một giá trị nữa ở đây — bảng
 * `user_accounts` không cần đổi cấu trúc.
 */
export const AUTH_PROVIDERS = ['GOOGLE'] as const
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]

/**
 * Token dùng một lần gửi qua email.
 *
 * KHÔNG liên quan gì tới access token hay refresh token. Access token là JWT
 * không lưu ở đâu cả; refresh token nằm ở bảng riêng. Hai giá trị dưới đây chỉ
 * là chuỗi nhét trong link email, bấm một lần rồi hết hiệu lực.
 */
export const ONE_TIME_TOKEN_TYPES = ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] as const
export type OneTimeTokenType = (typeof ONE_TIME_TOKEN_TYPES)[number]

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

/**
 * Tên đầy đủ, dùng trong câu văn.
 *
 * `DAY_LABELS` viết tắt để vừa một ô hẹp trên lưới; ở giữa một câu thông báo
 * lỗi thì "T4" đọc lên khó hiểu hơn hẳn "Thứ Tư".
 */
export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  0: 'Chủ nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
}

/* ========================================================== SPRINT 4 ==== */

/**
 * Nhãn TRẠNG THÁI — đơn này ĐANG ở đâu.
 *
 * Chuyển từ `apps/web/src/data/mock.ts` sang đây — bản cũ thiếu `WITHDRAWN` vì
 * dữ liệu giả không có ca sinh viên rút đơn. Nhãn phải phủ hết enum, nếu không
 * thì `Record` tra ra `undefined` và giao diện hiện một ô trống.
 *
 * `SHORTLISTED` đọc là "Đã mời phỏng vấn", KHÔNG phải "Vào vòng trong" (chốt
 * 2026-08-29). Đối chiếu TopCV và các ATS quốc tế: cả ba mô hình đều có bước
 * PHỎNG VẤN giữa "thích hồ sơ" và "nhận người", còn "vào vòng trong" thì không
 * nói được đang chờ chuyện gì xảy ra. Mà chính `SHORTLISTED` là mốc mở khoá số
 * điện thoại, tức là mốc NTD gọi đi hẹn gặp — nên nó vốn ĐÃ là bước phỏng vấn,
 * chỉ thiếu tên đúng. Xem thêm chú thích `enum ApplicationStatus` ở schema.
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: 'Chờ xem',
  VIEWED: 'Đã xem',
  SHORTLISTED: 'Đã mời phỏng vấn',
  ACCEPTED: 'Đã nhận',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
}

/**
 * Nhãn HÀNH ĐỘNG — việc NTD sắp làm, đọc trên nút bấm.
 *
 * Tách khỏi bảng trên vì hai thứ khác nghĩa: nút là mệnh lệnh ("Mời phỏng vấn"),
 * huy hiệu là sự thật hiện tại ("Đã mời phỏng vấn"). Dùng chung một bảng thì
 * hoặc nút đọc như một lời kể, hoặc huy hiệu đọc như một mệnh lệnh.
 */
export const APPLICATION_ACTION_LABELS: Record<ApplicationStatus, string> = {
  PENDING: 'Chờ xem',
  VIEWED: 'Đánh dấu đã xem',
  SHORTLISTED: 'Mời phỏng vấn',
  /* Không nút nào gọi tới — `ACCEPTED` không đi tới được. Giữ nhãn để những
     hàng có sẵn từ trước vẫn tra được tên. */
  ACCEPTED: 'Nhận vào làm',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'Rút đơn',
}

/**
 * Việc NTD phải làm NGOÀI ứng dụng sau khi chuyển sang trạng thái này.
 *
 * Đây là chỗ vá lỗ hổng lớn nhất của luồng cũ: bấm "vào vòng trong" xong thì
 * màn hình im lặng, không ai nói cho nhà tuyển dụng biết bước tiếp theo là gọi
 * điện. Với việc part-time thì buổi gặp diễn ra ngoài app — app không sắp lịch
 * hộ được, nhưng ít nhất phải NÓI RA rằng tới lượt họ.
 */
export const VIEC_TIEP_THEO: Partial<Record<ApplicationStatus, string>> = {
  SHORTLISTED:
    'Đã mở số điện thoại và email — phần còn lại diễn ra giữa bạn và ứng viên. ' +
    'Nếu sau buổi gặp bạn không chọn bạn ấy, hãy quay lại bấm Từ chối để họ biết kết quả.',
}

/**
 * Chuyển trạng thái nào là hợp lệ.
 *
 * Một nguồn sự thật cho CẢ HAI phía: service chặn, và giao diện chỉ vẽ nút cho
 * bước đi được. Hai nơi tự giữ bảng riêng là cách sinh ra nút bấm vào thì báo
 * lỗi — người dùng không hiểu vì sao hệ thống mời họ làm việc nó từ chối.
 *
 * Ba nguyên tắc đằng sau bảng này:
 *
 * 1. KHÔNG LÙI. `REJECTED` về `PENDING` là viết lại lịch sử, mà sinh viên thì
 *    đã nhận thông báo từ chối rồi.
 * 2. Trạng thái kết thúc không đi đâu nữa. Đổi ý sau đó là chuyện phải nói với
 *    nhau, không phải một nút.
 * 3. `VIEWED` bỏ qua được — NTD đọc hồ sơ rồi mời phỏng vấn luôn là chuyện
 *    thường, bắt đi từng bước chỉ tạo thao tác thừa.
 *
 * ---------------------------------------------------------------------------
 * `ACCEPTED` KHÔNG ĐI TỚI ĐƯỢC — CÓ CHỦ ĐÍCH, KHÔNG PHẢI SÓT
 * ---------------------------------------------------------------------------
 * Chốt 2026-08-29. UniWork KHÔNG phải một ATS: nó dừng ở chỗ bàn giao liên hệ,
 * việc tuyển thật diễn ra giữa hai con người bên ngoài.
 *
 *     Nộp → NTD đọc hồ sơ → mời phỏng vấn / từ chối → mở liên hệ → NTD gọi
 *
 * Vì sao không giữ `ACCEPTED` làm "ghi sổ tuỳ tâm": nó chỉ đúng khi nhà tuyển
 * dụng nhớ quay lại bấm sau một sự kiện xảy ra ngoài ứng dụng. Phần lớn sẽ
 * không. Một con số "đã nhận" đúng chừng một phần ba còn TỆ HƠN không có, vì
 * người đọc coi nó là sự thật. Đây đúng nguyên tắc `null ≠ 0` đã dùng xuyên
 * suốt dự án, chỉ ở tầng hệ thống: đừng khẳng định thứ mình không đo được.
 *
 * NHƯNG `SHORTLISTED → REJECTED` thì GIỮ, và bất đối xứng đó là cố ý:
 *
 *   - Phỏng vấn xong mà ĐƯỢC NHẬN thì sinh viên tự biết — họ đi làm buổi đầu.
 *   - Phỏng vấn xong mà BỊ TỪ CHỐI thì rất nhiều nơi im lặng luôn, và sinh viên
 *     chờ mãi một câu trả lời không bao giờ tới. Đó chính là vấn nạn dự án này
 *     sinh ra để giải, nên đường ghi lại lời từ chối phải luôn mở.
 *
 * Giá trị `ACCEPTED` vẫn nằm trong enum: xoá một giá trị enum của Postgres là
 * migration đụng mọi hàng, để đổi lấy đúng một cái tên không ai gọi tới. Những
 * hàng `ACCEPTED` có sẵn từ trước vẫn hiển thị bình thường.
 */
export const CHUYEN_TRANG_THAI_HOP_LE: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ['VIEWED', 'SHORTLISTED', 'REJECTED'],
  VIEWED: ['SHORTLISTED', 'REJECTED'],
  /* Không có `ACCEPTED` — xem chú thích dài ở trên, đây không phải chỗ bị sót. */
  SHORTLISTED: ['REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

/**
 * Trạng thái sinh viên tự đặt được, và là trạng thái DUY NHẤT họ đặt được.
 *
 * Tách khỏi bảng trên vì bảng đó nói "đi từ đâu tới đâu được", còn cái này nói
 * "ai được đi". Hai câu hỏi khác nhau: nhà tuyển dụng KHÔNG đặt được `WITHDRAWN`
 * (rút đơn là quyền của người nộp), sinh viên KHÔNG đặt được gì khác ngoài nó.
 */
export const TRANG_THAI_CUA_SINH_VIEN: ApplicationStatus = 'WITHDRAWN'

/** Đơn đã kết thúc, không rút được nữa. */
export const TRANG_THAI_KET_THUC: ApplicationStatus[] = ['ACCEPTED', 'REJECTED', 'WITHDRAWN']

/**
 * Từ trạng thái nào thì nhà tuyển dụng thấy được số điện thoại và email.
 *
 * > "Không có quy tắc này thì app thành chỗ thu thập số điện thoại sinh viên —
 * > đúng cái vấn nạn mà dự án muốn giải quyết." — README mục 5
 *
 * `WITHDRAWN` KHÔNG nằm trong danh sách kể cả khi đơn từng ở `SHORTLISTED`. NTD
 * đã nhìn thấy số rồi, đóng lại không lấy được ký ức đó về — nhưng hệ thống thì
 * không có lý do gì tiếp tục phát nó ra sau khi sinh viên đã rút.
 */
export const TRANG_THAI_MO_LIEN_HE: ApplicationStatus[] = ['SHORTLISTED', 'ACCEPTED']

/**
 * Trạng thái mà công việc của ỨNG DỤNG đã xong, dù kết quả tốt hay xấu.
 *
 * `SHORTLISTED` nằm ở đây chứ không nằm ở "đang chờ xử lý": liên hệ đã bàn giao,
 * UniWork không còn việc gì để làm với hồ sơ đó. Đường `→ REJECTED` vẫn mở nhưng
 * là để ghi lại kết quả sau buổi gặp, không phải một bước bắt buộc.
 */
export const TRANG_THAI_XONG_VIEC: ApplicationStatus[] = [
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
]

/** Trạng thái NTD còn phải xử lý — dùng cho tab mặc định ở màn hình ứng viên. */
export const TRANG_THAI_DANG_XU_LY: ApplicationStatus[] = ['PENDING', 'VIEWED']
