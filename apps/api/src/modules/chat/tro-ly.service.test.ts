import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APICallError,
  _datLaiMach,
  _datMangGia,
  machChoPhep,
  resetProviderCache,
  type ModelMessage,
} from '@uniwork/ai-runtime'
import { chayLuot } from './tro-ly.service.js'

/**
 * `chayLuot` BÁO KẾT QUẢ cho mạch ngắt — dây nối, không phải logic của mạch.
 *
 * Logic của mạch có test riêng (`mach-ngat.test.ts`). Ở đây canh hai dòng gọi
 * nằm trong `chayLuot`, vì mất một trong hai thì không có lỗi nào bắn ra:
 *
 *   mất `ghiLoi`       — mạch không bao giờ mở. Sự cố 429 lại kéo dài như cũ.
 *   mất `ghiThanhCong` — mạch mở xong không bao giờ đóng hẳn. Sau lần ngắt đầu,
 *                        một lỗi lẻ duy nhất là đủ ngắt lại, mãi mãi.
 *
 * Mạch dùng bản THẬT; chỉ thay model, sổ lượt và database.
 */

const chayLuotChatGia = vi.hoisted(() => vi.fn())

vi.mock('@uniwork/ai-runtime', async (goc) => ({
  ...(await goc<typeof import('@uniwork/ai-runtime')>()),
  chayLuotChat: chayLuotChatGia,
  chotLuot: vi.fn(async () => {}),
  hoanLuot: vi.fn(async () => {}),
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }))

vi.mock('./chat.service.js', () => ({
  layLichSu: vi.fn(async (): Promise<ModelMessage[]> => [{ role: 'user', content: 'BI-MAT-CUA-SV' }]),
  ghiTraLoi: vi.fn(async () => ({ ghi: true, seq: 2 })),
  boCoDangChay: vi.fn(async () => {}),
}))

vi.mock('./tro-ly.cau-hinh.js', () => ({
  cauHinhTroLy: () => ({
    system: 'he thong',
    promptVersion: 'test-1',
    cauKhiChamTran: 'cham tran',
    dungTool: () => ({}),
  }),
}))

const loi429 = () =>
  new APICallError({
    message: 'Resource has been exhausted',
    url: 'https://generativelanguage.googleapis.com',
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  })

const traLoiTot = {
  traLoi: 'Có 3 việc phù hợp.',
  inputTokens: 10,
  outputTokens: 5,
  toolRounds: 0,
  toolNames: [],
  timeToFirstTokenMs: 100,
  latencyMs: 200,
  soLanGoiModel: 1,
  msModel: 150,
  chamTran: false,
  goiTool: [],
}

const motLuot = (phat: (ten: string, du: unknown) => void = () => {}) =>
  chayLuot({
    userId: 'u-1',
    role: 'STUDENT',
    sessionId: 'p-1',
    kind: 'AI_STUDENT',
    turnId: 't-1',
    phat,
    tinHieu: new AbortController().signal,
  })

let bayGio = 1_000_000

beforeEach(() => {
  bayGio = 1_000_000
  _datLaiMach(() => bayGio)
  chayLuotChatGia.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  _datLaiMach()
  resetProviderCache()
  vi.restoreAllMocks()
})

describe('chayLuot báo kết quả cho mạch ngắt', () => {
  it('ba lượt gặp 429 liên tiếp thì mạch MỞ', async () => {
    chayLuotChatGia.mockRejectedValue(loi429())
    for (let i = 0; i < 3; i += 1) await motLuot()
    expect(machChoPhep().duoc).toBe(false)
  })

  /*
   * Mạch đã mở rồi hết chờ, một lượt thành công phải ĐÓNG HẲN nó — đủ ba lỗi
   * mới mở lại. Thiếu `ghiThanhCong` thì một lỗi lẻ ở đây đã ngắt lại.
   */
  it('sau khi mở, một lượt thành công đóng hẳn mạch', async () => {
    chayLuotChatGia.mockRejectedValue(loi429())
    for (let i = 0; i < 3; i += 1) await motLuot()
    bayGio += 60_001

    chayLuotChatGia.mockResolvedValueOnce(traLoiTot)
    await motLuot()

    chayLuotChatGia.mockRejectedValueOnce(loi429())
    await motLuot()
    expect(machChoPhep().duoc).toBe(true)
  })

  it('lỗi KHÔNG phải của nhà cung cấp thì mạch vẫn đóng', async () => {
    chayLuotChatGia.mockRejectedValue(new Error('lỗi của ta, không phải của Gemini'))
    for (let i = 0; i < 5; i += 1) await motLuot()
    expect(machChoPhep().duoc).toBe(true)
  })
})

/*
 * ===========================================================================
 * ĐƯỜNG THẬT: PROVIDER GOOGLE THẬT, CHỈ MẠNG LÀ GIẢ
 * ===========================================================================
 * Ba ca trên giả `chayLuotChat` ném thẳng `APICallError` — tức là giả định AI
 * SDK ném lỗi của nhà cung cấp ra ngoài. Nó KHÔNG ném: nó gói 429 vào một phần
 * `error` của stream, và thứ nổi lên là `NoOutputGeneratedError` không còn dấu
 * vết nào của Google. Mạch ngắt bản đầu không bao giờ mở vì thế, trong khi cả
 * ba ca trên vẫn xanh.
 *
 * Ở đây `chayLuotChat` là bản thật, model là provider Google thật; chỉ lớp
 * `fetch` trả về đúng thứ Google trả khi hết hạn mức.
 */
describe('đường thật: Google trả lỗi qua stream', () => {
  const mangTra = (status: number, headers: Record<string, string> = {}) => {
    const goi: string[] = []
    const mang: typeof fetch = async (url) => {
      goi.push(String(url))
      return new Response(
        JSON.stringify({ error: { code: status, message: 'Resource has been exhausted', status: 'RESOURCE_EXHAUSTED' } }),
        { status, headers: { 'content-type': 'application/json', ...headers } },
      )
    }
    return { mang, goi }
  }

  beforeEach(async () => {
    const that = await vi.importActual<typeof import('@uniwork/ai-runtime')>('@uniwork/ai-runtime')
    chayLuotChatGia.mockImplementation(that.chayLuotChat)
  })

  it('ba lượt gặp 429 thật thì mạch MỞ, và chờ đúng retry-after', async () => {
    const { mang, goi } = mangTra(429, { 'retry-after': '120' })
    _datMangGia(mang)

    for (let i = 0; i < 3; i += 1) await motLuot()
    expect(goi).toHaveLength(3) // không thử lại: mỗi lượt đúng một lời gọi
    expect(machChoPhep().duoc).toBe(false)

    bayGio += 90_000
    expect(machChoPhep().duoc).toBe(false)
    bayGio += 30_001
    expect(machChoPhep().duoc).toBe(true)
  })

  it('người dùng nhận lỗi kèm "đã trả lượt"', async () => {
    _datMangGia(mangTra(503).mang)
    const suKien: [string, unknown][] = []
    await motLuot((ten, du) => suKien.push([ten, du]))
    expect(suKien).toEqual([['loi', expect.objectContaining({ code: 'AI_UNAVAILABLE', hoanLuot: true })]])
  })

  /*
   * Lỗi gốc giờ được ném ra — và `APICallError` mang theo NGUYÊN prompt. In
   * nguyên nó là đổ lịch sử hội thoại của sinh viên vào log.
   */
  it('log lỗi KHÔNG chứa nội dung hội thoại', async () => {
    _datMangGia(mangTra(429).mang)
    const inRa = vi.spyOn(console, 'error').mockImplementation(() => {})
    await motLuot()

    const daIn = JSON.stringify(inRa.mock.calls, (_k, v) => (v instanceof Error ? { ...v, stack: v.stack } : v))
    expect(daIn).toContain('429')
    expect(daIn).not.toContain('BI-MAT-CUA-SV')
  })
})
