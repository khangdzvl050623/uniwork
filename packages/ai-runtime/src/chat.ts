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
  /** Chạm trần `AI_MAX_TOOL_ROUNDS` mà chưa có câu trả lời. */
  chamTran: boolean
  /** Mọi lời gọi tool kèm kết quả, theo thứ tự. Nơi gọi dùng để suy nhãn và dựng thẻ UI. */
  goiTool: { ten: string; ketQua: unknown }[]
}

export async function chayLuotChat(ts: ThamSoLuotChat): Promise<KetQuaLuotChat> {
  const batDau = Date.now()
  let mocChuDau: number | null = null

  const kq = streamText({
    model: modelChat(),
    system: ts.system,
    messages: ts.messages,
    tools: ts.tools,
    maxOutputTokens: aiConfig.maxOutputTokens,
    abortSignal: ts.abortSignal,

    /*
     * Mặc định của AI SDK v7 là `isStepCount(20)`.
     *
     * Với hạn mức tính theo REQUEST/ngày thì một câu hỏi mơ hồ đốt được 20
     * request của cả ngày. Đặt 4: đủ cho timViecLam → xemChiTietViec →
     * xemLichRanhCuaToi → trả lời.
     */
    stopWhen: isStepCount(aiConfig.maxToolRounds),
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
  for await (const m of kq.fullStream) {
    if (m.type === 'text-delta') {
      mocChuDau ??= Date.now()
      ts.onChu(m.text)
    } else if (m.type === 'tool-input-start') {
      ts.onTool?.(m.toolName)
    }
  }

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
    /*
     * Chạm trần mà không có chữ nào: model vẫn đang gọi tool khi bị dừng. Nơi
     * gọi phải trả một câu cố định chứ không để màn hình trống.
     */
    chamTran: buoc.length >= aiConfig.maxToolRounds && traLoi.trim() === '',
    goiTool,
  }
}
