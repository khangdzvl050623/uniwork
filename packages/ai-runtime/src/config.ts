/**
 * Cấu hình của tầng AI.
 *
 * Package này CỐ Ý không import `apps/api/src/config/env.ts`: về sau
 * `apps/worker` cũng dùng nó, mà worker không được import code của api. Nên nó
 * tự đọc `process.env`, và nơi gọi chịu trách nhiệm nạp dotenv trước.
 */

function chuoi(ten: string, macDinh: string): string {
  const v = process.env[ten]
  return v === undefined || v === '' ? macDinh : v
}

function so(ten: string, macDinh: number): number {
  const v = Number(process.env[ten])
  return Number.isFinite(v) && v >= 0 ? v : macDinh
}

export const aiConfig = {
  /* -------------------------------------------------------------- Google -- */
  /**
   * Tên biến theo đúng mặc định của `@ai-sdk/google` để provider tự nhận, không
   * phải truyền tay.
   *
   * CÓ mặc định rỗng — cùng nhóm với GOOGLE_CLIENT_ID chứ không cùng nhóm với
   * JWT_ACCESS_SECRET. Trợ lý AI là tính năng THÊM: thiếu khoá thì nút đó biến
   * mất, còn đăng nhập / tìm việc / ứng tuyển vẫn chạy nguyên vẹn.
   */
  googleApiKey: chuoi('GOOGLE_GENERATIVE_AI_API_KEY', ''),
  chatModel: chuoi('AI_CHAT_MODEL', 'gemini-2.5-flash-lite'),

  /* ------------------------------------------------- giới hạn mỗi lượt ---- */
  maxOutputTokens: so('AI_MAX_OUTPUT_TOKENS', 1024),
  requestTimeoutMs: so('AI_REQUEST_TIMEOUT_MS', 30_000),
  /** Mặc định của AI SDK là 20 — quá rộng cho hạn mức free. */
  maxToolRounds: so('AI_MAX_TOOL_ROUNDS', 4),
  historyMessages: so('AI_HISTORY_MESSAGES', 12),

  /* ------------------------------------------------------------- quota ---- */
  chatTurnsPerDay: so('AI_CHAT_TURNS_PER_DAY', 5),
  scanJobsPerDay: so('AI_SCAN_JOBS_PER_DAY', 3),
} as const

/**
 * Có khoá thật hay không.
 *
 * Cùng mẫu `HAS_REAL_KEY` của `lib/cloudinary.ts` và `lib/mailer.ts`: không có
 * nhánh này thì cả nhóm phải có API key mới chạy được dự án trên máy, và mọi
 * test chạm tới AI sẽ gọi mạng thật.
 */
export const CO_KHOA_THAT = aiConfig.googleApiKey !== ''

/* ------------------------------------------------------------- múi giờ --- */

/**
 * Ngày của NGƯỜI DÙNG. Quota "5 lượt/ngày" reset lúc nửa đêm giờ Việt Nam.
 *
 * `sv-SE` cho ra đúng dạng YYYY-MM-DD.
 */
export const ngayVN = (t: Date = new Date()): string =>
  t.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })

/**
 * Ngày của NHÀ CUNG CẤP. RPD của Gemini reset lúc nửa đêm giờ Pacific, không
 * phải giờ Việt Nam — lệch 14–15 tiếng.
 *
 * Dùng nhầm hàm là loại lỗi chỉ lộ ra sau vài tuần: sáng sớm bộ đếm của ta hiện
 * "0/400" trong khi Google vẫn đang đếm ngày hôm trước, rồi 429 ập tới.
 * `America/Los_Angeles` tự xử lý DST — đừng bù giờ bằng tay.
 */
export const ngayPacific = (t: Date = new Date()): string =>
  t.toLocaleDateString('sv-SE', { timeZone: 'America/Los_Angeles' })

/** Ngày UTC — hạn mức Neuron của Cloudflare reset theo mốc này. */
export const ngayUTC = (t: Date = new Date()): string => t.toISOString().slice(0, 10)
