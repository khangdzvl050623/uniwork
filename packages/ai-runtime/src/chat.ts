import { isStepCount, streamText, type ModelMessage, type ToolSet } from 'ai'
import { aiConfig } from './config.js'
import { modelChat } from './provider.js'

/**
 * Chỗ DUY NHẤT trong dự án gọi `streamText`.
 *
 * `apps/api` đưa vào prompt, lịch sử và bộ tool; nhận lại chữ theo từng mẩu và
 * một bản tổng kết để ghi vào `ai_turns`. Nhờ vậy khi AI SDK đổi tên API — mà
 * từ v5 lên v7 nó đã đổi `parameters` → `inputSchema`, `maxSteps` →
 * `stopWhen` — thì chỉ file này phải sửa.
 */

export interface ThamSoLuotChat {
  system: string
  /** Lịch sử ĐÃ LƯỢC PII cộng câu hỏi mới. Xem `modules/chat/luoc-pii.ts`. */
  messages: ModelMessage[]
  tools: ToolSet
  /** Cắt ngang khi hội thoại chuyển sang người thật giữa chừng, hoặc khi tắt server. */
  abortSignal: AbortSignal
  /** Gọi mỗi khi có mẩu chữ mới. Nơi gọi đẩy thẳng ra SSE. */
  onChu: (chu: string) => void
  /** Gọi khi model bắt đầu dùng một tool. Để giao diện hiện "đang tra cứu…". */
  onTool?: (ten: string) => void
}

export interface KetQuaLuotChat {
  traLoi: string
  inputTokens: number
  outputTokens: number
  /** Số bước model chạy. Bằng số vòng tool cộng một bước trả lời cuối. */
  toolRounds: number
  toolNames: string[]
  timeToFirstTokenMs: number | null
  latencyMs: number
  /**
   * So loi goi model THAT SU da xong, va tong thoi gian nha cung cap giu.
   *
   * Truoc day `requestCount` duoc suy ra bang `toolRounds + 1` — mot con so
   * dung trong truong hop ly tuong va vo dung khi chan doan. Do that thi tach
   * duoc "model cham" khoi "ta cham": `latencyMs` tru `msModel` la thoi gian
   * cua tool, cua database, va cua chinh ta.
   */
  soLanGoiModel: number
  msModel: number
  /** Chạm trần `AI_MAX_TOOL_ROUNDS` mà chưa có câu trả lời. */
  chamTran: boolean
  /** Mọi lời gọi tool kèm kết quả, theo thứ tự. Nơi gọi dùng để suy nhãn và dựng thẻ UI. */
  goiTool: { ten: string; ketQua: unknown }[]
}

export async function chayLuotChat(ts: ThamSoLuotChat): Promise<KetQuaLuotChat> {
  const batDau = Date.now()
  let mocChuDau: number | null = null
  let soLanGoiModel = 0
  let msModel = 0

  const kq = streamText({
    model: modelChat(),
    system: ts.system,
    messages: ts.messages,
    tools: ts.tools,
    maxOutputTokens: aiConfig.maxOutputTokens,
    abortSignal: ts.abortSignal,

    /*
     * KHÔNG thử lại. Mặc định của AI SDK là 2 lần, tức một câu hỏi thành tối
     * đa BA lời gọi — và thử lại đúng lúc nhà cung cấp đang trả 429 là cách
     * nhanh nhất để hạn mức của họ cạn lâu hơn. Review 2026-10-05.
     *
     * Không mất gì của người dùng: lượt hỏng TRƯỚC chữ đầu tiên được hoàn, họ
     * bấm "gửi lại" là xong. Còn lỗi lặp lại thì mạch ngắt (`mach-ngat.ts`)
     * chặn ở cửa, trước khi ai kịp giữ lượt.
     */
    maxRetries: 0,

    /*
     * Mặc định của AI SDK v7 là `isStepCount(20)`.
     *
     * Với hạn mức tính theo REQUEST/ngày thì một câu hỏi mơ hồ đốt được 20
     * request của cả ngày. Đặt 4: đủ cho timViecLam → xemChiTietViec →
     * xemLichRanhCuaToi → trả lời.
     */
    stopWhen: isStepCount(aiConfig.maxToolRounds),

    /*
     * =====================================================================
     * TRUOC DAY KHONG CO TRAN THOI GIAN NAO CA
     * =====================================================================
     * `AI_REQUEST_TIMEOUT_MS` co trong cau hinh tu buoc 1, nhung chi
     * `kiem-tra.ts` dung. Duong chay that truyen `ts.abortSignal` — ma signal
     * do chi bat khi NGUOI DUNG dong tab. Nha cung cap treo thi ket noi SSE
     * treo theo, vo han.
     *
     * Ba tran vi mot con so khong dien ta duoc bai toan: xem `config.ts`.
     */
    timeout: {
      totalMs: aiConfig.turnTimeoutMs,
      stepMs: aiConfig.requestTimeoutMs,
      toolMs: aiConfig.toolTimeoutMs,
    },

    /*
     * Dem loi goi model that va thoi gian nha cung cap giu.
     *
     * `performance.responseTimeMs` la thu duy nhat tra loi duoc cau hoi "cham
     * la do LLM hay do minh". Khong co no thi chi thay mot con so tong, va moi
     * gia thuyet deu nghe hop ly nhu nhau.
     */
    onLanguageModelCallEnd: (e) => {
      soLanGoiModel += 1
      msModel += e.performance.responseTimeMs
    },

    /*
     * Tắt bản in mặc định: nó đổ NGUYÊN `APICallError` ra console, kể cả
     * `requestBodyValues` — tức toàn bộ prompt. Lỗi không bị mất: vòng đọc
     * stream bên dưới bắt lại và ném ra cho nơi gọi.
     */
    onError: () => {},
  })

  /*
   * `fullStream`, KHÔNG phải `textStream`.
   *
   * Bản đầu đọc `textStream` rồi rút tên tool từ `kq.steps` sau khi xong. Chạy
   * thử một lượt thật là thấy ngay: chỉ báo "đang tra cứu…" hiện ra SAU câu trả
   * lời. Đúng thứ tự code, vô dụng với người dùng — họ ngồi nhìn màn hình trắng
   * gần 3 giây rồi mới biết là hệ thống đang làm gì.
   *
   * `tool-input-start` là tín hiệu SỚM NHẤT có được: model vừa bắt đầu phát lời
   * gọi tool, chưa cần đợi tham số đầy đủ hay đợi tool chạy xong.
   */
  /*
   * ---------------------------------------------------------------------------
   * LỖI CỦA NHÀ CUNG CẤP NẰM TRONG STREAM — PHẢI TỰ NHẶT RA
   * ---------------------------------------------------------------------------
   * Gemini trả 429 thì AI SDK KHÔNG ném. Nó phát một phần `error` mang
   * `APICallError` gốc — status, `retry-after` đủ cả — rồi đóng stream. Thứ ném
   * ra sau đó, lúc `await kq.steps`, là `NoOutputGeneratedError` với `cause`
   * rỗng: mọi dấu vết của nhà cung cấp đã mất.
   *
   * Bỏ qua phần `error` thì mạch ngắt không bao giờ mở: nó chỉ thấy một lỗi lạ,
   * và `laLoiNhaCungCap` đúng là phải coi lỗi lạ là lỗi của ta. Đo bằng
   * provider Google thật với mạng giả trả 429, 2026-10-05.
   *
   * Hết giờ thì khác: stream phát `abort` chứ không phát `error`, và thứ ném ra
   * đã là `TimeoutError` — nhánh đó vốn đúng, không cần nhặt.
   *
   * Lấy lỗi ĐẦU TIÊN: những lỗi sau thường chỉ là hệ quả của nó.
   */
  let loiNhaCungCap: { e: unknown } | null = null

  for await (const m of kq.fullStream) {
    if (m.type === 'text-delta') {
      mocChuDau ??= Date.now()
      ts.onChu(m.text)
    } else if (m.type === 'tool-input-start') {
      ts.onTool?.(m.toolName)
    } else if (m.type === 'error') {
      loiNhaCungCap ??= { e: m.error }
    }
  }

  if (loiNhaCungCap) throw loiNhaCungCap.e

  const [buoc, dung] = await Promise.all([kq.steps, kq.usage])

  const goiTool: { ten: string; ketQua: unknown }[] = []
  for (const b of buoc) {
    for (const r of b.toolResults) {
      goiTool.push({ ten: r.toolName, ketQua: r.output })
    }
  }

  const traLoi = await kq.text

  return {
    traLoi,
    // `inputTokens` có kiểu `number | undefined`: nhà cung cấp được phép không
    // khai. Ghi 0 chứ không ghi undefined — cột trong database là NOT NULL.
    inputTokens: dung.inputTokens ?? 0,
    outputTokens: dung.outputTokens ?? 0,
    toolRounds: Math.max(0, buoc.length - 1),
    toolNames: [...new Set(goiTool.map((g) => g.ten))],
    timeToFirstTokenMs: mocChuDau === null ? null : mocChuDau - batDau,
    latencyMs: Date.now() - batDau,
    soLanGoiModel,
    msModel: Math.round(msModel),
    /*
     * Chạm trần mà không có chữ nào: model vẫn đang gọi tool khi bị dừng. Nơi
     * gọi phải trả một câu cố định chứ không để màn hình trống.
     */
    chamTran: buoc.length >= aiConfig.maxToolRounds && traLoi.trim() === '',
    goiTool,
  }
}
