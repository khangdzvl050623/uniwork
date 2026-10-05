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
  chatModel: chuoi('AI_CHAT_MODEL', 'gemini-3.5-flash-lite'),

  /* ------------------------------------------------- giới hạn mỗi lượt ---- */
  maxOutputTokens: so('AI_MAX_OUTPUT_TOKENS', 1024),

  /*
   * BA TRAN THOI GIAN, KHONG PHAI MOT
   *
   * Mot luot co nhieu buoc, moi buoc mot loi goi model, xen giua la cac lan
   * chay tool. Mot con so duy nhat khong dien ta duoc: dat 30 s cho ca luot thi
   * luot 4 vong tool binh thuong cung bi cat; dat 120 s cho moi buoc thi mot
   * buoc treo giu ket noi SSE hai phut.
   */
  /*
   * Hai con so duoi day DAT THEO SO DO THAT, khong phai uoc chung.
   *
   * Do 2026-09-28: do tre cua Gemini free tier chia hai cum ro ret — hoac
   * ~1 s, hoac ~15-25 s — va KHONG lien quan toi kich thuoc prompt. Mot luot
   * 4 buoc roi vao cum cham la ~100 s ma van la luot hop le.
   *
   * Dat 30 s cho moi buoc thi cat nham chinh nhung luot do. Xem [00 C.1].
   */
  /** Tran cho MOT loi goi model. */
  requestTimeoutMs: so('AI_REQUEST_TIMEOUT_MS', 60_000),
  /** Tran cho CA luot, ke ca thoi gian chay tool va SDK tu thu lai. */
  turnTimeoutMs: so('AI_TURN_TIMEOUT_MS', 180_000),
  /** Tran cho MOT lan chay tool. Tool cua ta chi doc Postgres cuc bo. */
  toolTimeoutMs: so('AI_TOOL_TIMEOUT_MS', 8_000),
  /** Mặc định của AI SDK là 20 — quá rộng cho hạn mức free. */
  maxToolRounds: so('AI_MAX_TOOL_ROUNDS', 4),

  /*
   * Mạch ngắt nhà cung cấp — xem `mach-ngat.ts`.
   *
   * 3 lỗi LIÊN TIẾP: một lỗi lẻ là chuyện thường của mạng, hai lỗi có thể vẫn
   * là xui; tới lần thứ ba thì gọi tiếp là đang góp phần kéo dài sự cố.
   *
   * 60 giây: hạn mức theo phút của Gemini tính trong cửa sổ một phút, nên mở
   * ngắn hơn thế là đóng lại đúng lúc vẫn còn bị chặn.
   */
  circuitFailures: so('AI_CIRCUIT_FAILURES', 3),
  circuitCooldownMs: so('AI_CIRCUIT_COOLDOWN_MS', 60_000),
  historyMessages: so('AI_HISTORY_MESSAGES', 12),

  /* ------------------------------------------------------------- quota ---- */
  chatTurnsPerDay: so('AI_CHAT_TURNS_PER_DAY', 10),
  scanJobsPerDay: so('AI_SCAN_JOBS_PER_DAY', 3),
} as const

export const CO_KHOA_THAT = aiConfig.googleApiKey !== ''

/* ------------------------------------------------------------- múi giờ --- */

/**
 * Ngày của NGƯỜI DÙNG. Quota lượt/ngày reset lúc nửa đêm giờ Việt Nam.
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
