import { randomUUID } from 'node:crypto'
import type { Role } from '@prisma/client'
import { aiConfig, chayLuotChat, chotLuot, hoanLuot } from '@uniwork/ai-runtime'
import { prisma } from '../../lib/prisma.js'
import { boCoDangChay, ghiTraLoi, layLichSu } from './chat.service.js'
import { layDeNghi, suyNhan } from './nhan.js'
import { CAU_KHI_CHAM_TRAN, HE_THONG_SINH_VIEN } from './prompts/he-thong-sinh-vien.js'
import { dungToolSinhVien } from './tools.sinh-vien.js'

/**
 * Định danh của process đang chạy.
 *
 * Lúc tắt server có trật tự, chỉ được dọn những lượt do CHÍNH mình giữ — API
 * deploy lại không được đụng vào lượt worker đang chạy dở. Sinh một lần lúc nạp
 * module, không đổi trong suốt đời process.
 */
export const RUNNER_ID = `api-${randomUUID().slice(0, 8)}`

export interface ChayLuotInput {
  userId: string
  role: Role
  sessionId: string
  turnId: string
  jobIdDangXem?: string
  phat: (ten: string, du: unknown) => void
  tinHieu: AbortSignal
}

/**
 * Chạy một lượt: dựng ngữ cảnh, gọi model, đẩy chữ ra, ghi kết quả, chốt lượt.
 *
 * KHÔNG ném ra ngoài. Tới đây thì header SSE đã gửi rồi, nên mọi lỗi phải đi
 * bằng sự kiện `loi` — `res.status()` lúc này không còn tác dụng.
 */
export async function chayLuot(v: ChayLuotInput): Promise<void> {
  const tools = dungToolSinhVien({ userId: v.userId, jobIdDangXem: v.jobIdDangXem })
  let coChu = false

  try {
    const kq = await chayLuotChat({
      system: HE_THONG_SINH_VIEN,
      messages: await layLichSu(v.sessionId),
      tools,
      abortSignal: v.tinHieu,
      onChu: (chu) => {
        coChu = true
        v.phat('chu', chu)
      },
      onTool: (ten) => v.phat('tool', { ten }),
    })

    /*
     * Lời đề nghị chuyển sang nhà tuyển dụng đi ra như một sự kiện RIÊNG, không
     * lẫn vào chữ. Giao diện cần nó ở dạng có cấu trúc để dựng cái nút; bắt
     * client tự đọc câu văn của model để đoán ra jobId là mời nó đoán sai.
     *
     * Vẫn KHÔNG có tin nào được gửi cho nhà tuyển dụng ở bước này.
     */
    const deNghi = layDeNghi(kq.goiTool)
    if (deNghi !== null) v.phat('de-nghi', deNghi)

    const traLoi = kq.chamTran ? CAU_KHI_CHAM_TRAN : kq.traLoi
    if (kq.chamTran) v.phat('chu', traLoi)

    const ghi = traLoi.trim() === '' ? { ghi: false } : await ghiTraLoi(v.sessionId, v.turnId, traLoi)
    if (!ghi.ghi) await boCoDangChay(v.sessionId, v.turnId)

    await chotLuot(prisma, {
      turnId: v.turnId,
      state: 'SUCCEEDED',
      inputTokens: kq.inputTokens,
      outputTokens: kq.outputTokens,
      requestCount: kq.toolRounds + 1,
      toolRounds: kq.toolRounds,
      toolNames: kq.toolNames,
      category: suyNhan(kq.goiTool),
      latencyMs: kq.latencyMs,
      timeToFirstTokenMs: kq.timeToFirstTokenMs ?? undefined,
      errorCode: kq.chamTran ? 'TOOL_ROUNDS_EXCEEDED' : undefined,
      handoffProposed: deNghi !== null,
    })

    /*
     * `daLuu: false` nghĩa là hội thoại đã chuyển sang người thật giữa chừng và
     * câu trả lời bị bỏ. Nói ra chứ không im lặng: client cần biết để không vẽ
     * một tin nhắn mà lần tải lại sau sẽ không còn.
     */
    v.phat('xong', { daLuu: ghi.ghi, seq: ghi.seq ?? null })
  } catch (e) {
    await xuLyLoi(v, e, coChu)
  } finally {
    /* Kênh do nơi gọi đóng — ở đây chỉ bảo đảm cờ không kẹt lại. */
    await boCoDangChay(v.sessionId, v.turnId).catch(() => {})
  }
}

/**
 * ---------------------------------------------------------------------------
 * HOÀN LƯỢT HAY KHÔNG: RANH GIỚI LÀ "NGƯỜI DÙNG CÓ THẤY CHỮ NÀO KHÔNG"
 * ---------------------------------------------------------------------------
 * Chưa có chữ nào ⇒ hoàn. Nhà cung cấp sập, hết hạn mức ở tầng của họ, mạng
 * hỏng — người dùng nhận đúng con số không, và trừ lượt là bắt họ trả giá cho
 * sự cố của ta.
 *
 * Đã có chữ ⇒ tính SUCCEEDED-hụt, tức FAILED, và VẪN trừ. Token đã tiêu thật,
 * hạn mức RPD của nhà cung cấp đã bị trừ thật. Hoàn ở đây là mời người dùng bấm
 * lại năm lần và đốt năm lần tài nguyên với đúng một lượt trên sổ.
 */
async function xuLyLoi(v: ChayLuotInput, e: unknown, coChu: boolean): Promise<void> {
  const boQua = v.tinHieu.aborted
  const ma = boQua ? 'ABORTED' : 'PROVIDER_ERROR'

  console.error(`[tro-ly] lượt ${v.turnId} hỏng (${ma})`, e)

  if (coChu) {
    await chotLuot(prisma, { turnId: v.turnId, state: 'FAILED', errorCode: ma }).catch(() => {})
  } else {
    await hoanLuot(prisma, v.turnId, ma).catch(() => {})
  }

  /* Người dùng đã đóng tab thì không còn ai nghe — ghi nhận rồi thôi. */
  if (!boQua) {
    v.phat('loi', {
      code: 'AI_UNAVAILABLE',
      message: coChu
        ? 'Trợ lý bị ngắt giữa chừng. Bạn thử hỏi lại nhé.'
        : 'Trợ lý đang bận, bạn thử lại sau ít phút nhé. Lượt của bạn đã được trả lại.',
      hoanLuot: !coChu,
    })
  }
}

/** Dùng cho `GET /api/tro-ly/luot-con-lai` và cho câu chào ở giao diện. */
export const TRAN_LUOT_CHAT = aiConfig.chatTurnsPerDay
